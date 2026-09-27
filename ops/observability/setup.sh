#!/bin/bash
# Install Loki + Grafana + Caddy on the second DigitalOcean droplet.
# Run as root in the droplet web console. Does not touch a box that already
# listens on 80/443/3100 or has running containers, unless OBS_FORCE=1.
set -euo pipefail

if [ "$(uname -s)" != "Linux" ]; then
  echo "Run this in the DigitalOcean web console on the Ubuntu droplet, not on a laptop."
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root."
  exit 1
fi

echo "=== memory ==="
free -h || true
echo "=== listeners ==="
ss -lntup || true
echo "=== docker ==="
if command -v docker >/dev/null 2>&1; then
  docker ps || true
fi

if [ "${OBS_FORCE:-}" != "1" ]; then
  if ss -lnt | awk 'NR>1 { print $4 }' | grep -Eq ':(80|443|3100)$'; then
    echo "Port 80, 443, or 3100 is already in use. Aborting so an existing service is not overwritten."
    echo "Re-run with OBS_FORCE=1 only if this droplet is the observability box."
    exit 1
  fi
  if command -v docker >/dev/null 2>&1; then
    running="$(docker ps -q | wc -l | tr -d ' ')"
    if [ "${running}" != "0" ]; then
      echo "Docker already has running containers. Aborting."
      exit 1
    fi
  fi
fi

mem_kb="$(awk '/MemTotal/ { print $2 }' /proc/meminfo)"
if [ "${mem_kb}" -lt 1500000 ]; then
  echo "RAM is under 1.5 GB. A 2 GB swap file will be added. If Grafana is killed, resize the droplet to 2 GB."
fi

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 >/dev/null
grep -q '^vm.swappiness=' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
fi
if ! command -v python3 >/dev/null 2>&1; then
  apt-get update
  apt-get install -y python3
fi
if ! command -v ufw >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ufw
fi

REF="${OBS_GIT_REF:-feature/27-09-observability-loki-grafana}"
BASE="https://raw.githubusercontent.com/mazarov/aiphoto/${REF}/ops/observability"
ROOT=/opt/observability
mkdir -p "$ROOT"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC=""
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
  SRC="$SCRIPT_DIR"
fi

fetch() {
  rel="$1"
  mkdir -p "$ROOT/$(dirname "$rel")"
  if [ -n "$SRC" ] && [ -f "$SRC/$rel" ]; then
    if [ "$SRC/$rel" -ef "$ROOT/$rel" ]; then
      return
    fi
    cp "$SRC/$rel" "$ROOT/$rel"
  else
    curl -fsSL "$BASE/$rel" -o "$ROOT/$rel"
  fi
}

fetch docker-compose.yml
fetch loki-config.yml
fetch Caddyfile.template
fetch probe.py
fetch grafana/provisioning/datasources/loki.yml
fetch grafana/provisioning/dashboards/provider.yml
fetch grafana/provisioning/dashboards/json/promptshot.json
fetch grafana/provisioning/alerting/rules.yml

cd "$ROOT"
if [ ! -f .env ]; then
  grafana_password="$(openssl rand -hex 18)"
  loki_password="$(openssl rand -hex 18)"
  domain="${OPS_DOMAIN:-46.101.248.190.sslip.io}"
  cat > .env << EOF
OPS_DOMAIN=${domain}
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${grafana_password}
LOKI_PUSH_USER=loki
LOKI_PUSH_PASSWORD=${loki_password}
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
PROBE_URLS=landing=https://promptshot.ru/api/health
LOG_ENV=prod
EOF
  chmod 600 .env
  echo "Created /opt/observability/.env"
else
  echo "Keeping existing /opt/observability/.env"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

hash="$(docker run --rm caddy:2.9.1-alpine caddy hash-password --plaintext "$LOKI_PUSH_PASSWORD" | tr -d '\r\n')"
escaped="$(printf '%s' "$hash" | sed 's/\$/$$/g')"
sed "s|LOKI_HASH_PLACEHOLDER|${escaped}|" Caddyfile.template > Caddyfile

mkdir -p generated/alerting
rm -f generated/alerting/*
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  cp grafana/provisioning/alerting/rules.yml generated/alerting/rules.yml
  cat > generated/alerting/contact-points.yml << EOF
apiVersion: 1
contactPoints:
  - orgId: 1
    name: telegram
    receivers:
      - uid: telegram-promptshot
        type: telegram
        settings:
          bottoken: "${TELEGRAM_BOT_TOKEN}"
          chatid: "${TELEGRAM_CHAT_ID}"
EOF
  cat > generated/alerting/policies.yml << 'EOF'
apiVersion: 1
policies:
  - orgId: 1
    receiver: telegram
    group_by:
      - grafana_folder
      - alertname
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
EOF
  echo "Telegram contact point written"
else
  echo "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is empty. Alerts are not armed."
fi

docker compose up -d --force-recreate

python3_bin="$(command -v python3)"
cat > /etc/cron.d/observability << EOF
* * * * * root ${python3_bin} /opt/observability/probe.py >> /var/log/obs-probe.log 2>&1
EOF
chmod 644 /etc/cron.d/observability

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat > CONNECT.txt << EOF
Grafana: https://${OPS_DOMAIN}
user: ${GRAFANA_ADMIN_USER:-admin}
password: ${GRAFANA_ADMIN_PASSWORD}

Dockhost env for landing, web-generation-worker, and payment-bot:
LOKI_PUSH_URL=https://${OPS_DOMAIN}/loki/api/v1/push
LOKI_BASIC_AUTH=${LOKI_PUSH_USER}:${LOKI_PUSH_PASSWORD}
LOG_ENV=${LOG_ENV:-prod}
EOF
chmod 600 CONNECT.txt

echo
echo "Grafana: https://${OPS_DOMAIN}"
echo "user: ${GRAFANA_ADMIN_USER:-admin}"
echo "password: ${GRAFANA_ADMIN_PASSWORD}"
echo "LOKI_PUSH_URL=https://${OPS_DOMAIN}/loki/api/v1/push"
echo "LOKI_BASIC_AUTH=${LOKI_PUSH_USER}:${LOKI_PUSH_PASSWORD}"
echo "LOG_ENV=${LOG_ENV:-prod}"
echo "Saved to /opt/observability/CONNECT.txt"
echo "Wait about a minute, then open Grafana. The landing health probe stays red until /api/health is deployed."
