#!/usr/bin/env python3
"""Push landing health and disk usage into local Loki. Cron runs this every minute."""

import json
import os
import re
import time
import urllib.error
import urllib.request

ENV_PATH = os.environ.get("OBS_ENV", "/opt/observability/.env")
PUSH_URL = os.environ.get("LOKI_PUSH_URL", "http://127.0.0.1:3100/loki/api/v1/push")


def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    try:
        with open(path, encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip('"').strip("'")
    except FileNotFoundError:
        return env
    return env


def disk_pct() -> int:
    stat = os.statvfs("/")
    if stat.f_blocks == 0:
        return 0
    used = stat.f_blocks - stat.f_bavail
    return int(round(used * 100 / stat.f_blocks))


def probe(url: str) -> tuple[int, bool]:
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return response.status, response.status == 200
    except urllib.error.HTTPError as error:
        return error.code, False
    except Exception:
        return 0, False


def safe_label(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "-", value.strip())[:40]
    return cleaned or "url"


def main() -> None:
    env = load_env(ENV_PATH)
    raw = env.get("PROBE_URLS", "landing=https://promptshot.ru/api/health")
    streams: list[dict[str, object]] = []
    stamp = time.time_ns()

    def add(labels: dict[str, str], line: str) -> None:
        nonlocal stamp
        stamp += 1
        streams.append({"stream": labels, "values": [[str(stamp), line]]})

    pct = disk_pct()
    add(
        {
            "service": "probe",
            "env": env.get("LOG_ENV", "prod") or "prod",
            "level": "info",
            "instance": "ops",
            "target": "disk",
        },
        json.dumps({"event": "disk", "pct": pct}),
    )
    for item in [part.strip() for part in raw.split(",") if part.strip()]:
        if "=" in item:
            name, url = item.split("=", 1)
        else:
            name, url = item, item
        target = safe_label(name)
        status, ok = probe(url.strip())
        add(
            {
                "service": "probe",
                "env": env.get("LOG_ENV", "prod") or "prod",
                "level": "info" if ok else "error",
                "instance": "ops",
                "target": target,
            },
            json.dumps({"event": "probe", "target": target, "status": status, "ok": 1 if ok else 0}),
        )

    body = json.dumps({"streams": streams}).encode()
    request = urllib.request.Request(
        PUSH_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            response.read()
    except Exception as error:
        print(f"loki push failed: {error}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"probe failed: {error}", flush=True)
