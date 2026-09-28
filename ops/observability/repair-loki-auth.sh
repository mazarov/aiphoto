#!/bin/bash
# Rewrite Caddy basic auth so LOKI_PUSH_PASSWORD from .env matches /loki/* push.
# Tries bcrypt and the image default hash, escaped and raw, and keeps the first
# variant that gets past Caddy (HTTP 204 or 400 from Loki, not 401).
set -uo pipefail
cd /opt/observability
set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${LOKI_PUSH_PASSWORD:-}" ] || [ -z "${OPS_DOMAIN:-}" ]; then
  echo "Missing LOKI_PUSH_PASSWORD or OPS_DOMAIN in /opt/observability/.env"
  exit 1
fi

if [ -f Caddyfile ]; then
  cp Caddyfile Caddyfile.bak
fi

write_caddy() {
  python3 - "$OPS_DOMAIN" "${LOKI_PUSH_USER:-loki}" "$1" << 'PY'
import pathlib, sys
domain, user, token = sys.argv[1:4]
pathlib.Path("/opt/observability/Caddyfile").write_text(
    f"{domain} {{\n"
    "\tencode gzip\n"
    "\thandle /loki/* {\n"
    "\t\tbasic_auth {\n"
    f"\t\t\t{user} {token}\n"
    "\t\t}\n"
    "\t\treverse_proxy loki:3100\n"
    "\t}\n"
    "\thandle {\n"
    "\t\treverse_proxy grafana:3000\n"
    "\t}\n"
    "}\n"
)
PY
}

auth_code() {
  local stamp body code
  stamp="$(date +%s%N)"
  body="$(printf '{"streams":[{"stream":{"service":"repair","env":"prod","level":"info","instance":"ops"},"values":[["%s","{\\"event\\":\\"repair\\"}"]]}]}' "$stamp")"
  code="$(curl -sS -o /tmp/loki-auth-body.txt -w '%{http_code}' --max-time 15 \
    -u "${LOKI_PUSH_USER:-loki}:${LOKI_PUSH_PASSWORD}" \
    -H 'Content-Type: application/json' \
    --data "$body" \
    "https://${OPS_DOMAIN}/loki/api/v1/push" || true)"
  printf '%s' "$code"
}

reload_and_test() {
  docker compose up -d --force-recreate --no-deps caddy >/dev/null
  local i code
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    code="$(auth_code)"
    echo "attempt ${i} status=${code}"
    if [ "$code" = "204" ] || [ "$code" = "400" ]; then
      return 0
    fi
  done
  return 1
}

hash_line() {
  docker run --rm caddy:2.9.1-alpine caddy hash-password --plaintext "$LOKI_PUSH_PASSWORD" "$@" | tr -d '[:space:]'
}

try_token() {
  local label="$1"
  local token="$2"
  echo "testing ${label}"
  write_caddy "$token"
  if reload_and_test; then
    echo "loki auth ok (${label})"
    return 0
  fi
  return 1
}

bcrypt_raw="$(hash_line --algorithm bcrypt)"
bcrypt_escaped="$(printf '%s' "$bcrypt_raw" | sed 's/\$/$$/g')"
default_raw="$(hash_line)"
default_escaped="$(printf '%s' "$default_raw" | sed 's/\$/$$/g')"

if try_token bcrypt-escaped "$bcrypt_escaped"; then
  exit 0
fi
if try_token bcrypt-raw "$bcrypt_raw"; then
  exit 0
fi
if [ "$default_raw" != "$bcrypt_raw" ]; then
  if try_token default-raw "$default_raw"; then
    exit 0
  fi
  if try_token default-escaped "$default_escaped"; then
    exit 0
  fi
fi

if [ -f Caddyfile.bak ]; then
  cp Caddyfile.bak Caddyfile
  docker compose up -d --force-recreate --no-deps caddy >/dev/null
fi
echo "loki auth still failing"
exit 1
