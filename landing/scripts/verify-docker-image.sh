#!/usr/bin/env sh
# После `docker build` — убедиться, что entrypoint совпадает с landing/Dockerfile (node server.js в /app).
# Использование: ./scripts/verify-docker-image.sh IMAGE:TAG
set -e
IMAGE="${1:?usage: $0 IMAGE:TAG (example: promptshot-landing:latest)}"
docker run --rm --entrypoint sh "$IMAGE" -c 'test -f /app/server.js && echo OK: /app/server.js'
