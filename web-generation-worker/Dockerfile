# Build with repository root as context:
# docker build -f web-generation-worker/Dockerfile .
FROM node:20-alpine AS alpine
# Same apk contract as landing/Dockerfile: Yandex mirror + gcompat (not libc6-compat).
RUN set -eu; \
  sed -i 's#https\?://dl-cdn.alpinelinux.org/alpine#https://mirror.yandex.ru/mirrors/alpine#g' /etc/apk/repositories; \
  i=0; \
  until apk add --no-cache gcompat; do \
    i=$((i + 1)); \
    [ "$i" -ge 3 ] && exit 1; \
    sleep $((i * 4)); \
  done

FROM alpine AS builder
# glibc compat + musl sharp: Alpine `npm install` can skip @img/sharp-libvips-linuxmusl-*.
WORKDIR /repo/web-generation-worker
COPY web-generation-worker/package*.json ./
RUN npm install \
  && npm install --no-save --os=linux --libc=musl --cpu=x64 --include=optional sharp@0.33.5
COPY web-generation-worker/tsconfig.json ./
COPY web-generation-worker/src ./src
# Keep this list in sync with tsconfig.json "include" and root Dockerfile.worker.
COPY landing/src/lib/image-generation-prompt.ts /repo/landing/src/lib/image-generation-prompt.ts
COPY landing/src/lib/grok-image-prompt.ts /repo/landing/src/lib/grok-image-prompt.ts
COPY landing/src/lib/seedream-image-prompt.ts /repo/landing/src/lib/seedream-image-prompt.ts
COPY landing/src/lib/generation-edit-contract.ts /repo/landing/src/lib/generation-edit-contract.ts
COPY landing/src/lib/camera-orbit.ts /repo/landing/src/lib/camera-orbit.ts
COPY landing/src/lib/photoshoot.ts /repo/landing/src/lib/photoshoot.ts
COPY landing/src/lib/photoshoot-planner.ts /repo/landing/src/lib/photoshoot-planner.ts
COPY landing/src/lib/video-motion-prompt.ts /repo/landing/src/lib/video-motion-prompt.ts
COPY landing/src/lib/user-generation-photo-paths.ts /repo/landing/src/lib/user-generation-photo-paths.ts
COPY landing/src/lib/generation/image-options.ts /repo/landing/src/lib/generation/image-options.ts
RUN npm run build

FROM alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY web-generation-worker/package*.json ./
RUN npm install --omit=dev \
  && npm install --no-save --os=linux --libc=musl --cpu=x64 --include=optional sharp@0.33.5
COPY --from=builder /repo/web-generation-worker/dist ./dist
EXPOSE 3003
CMD ["node", "dist/web-generation-worker/src/index.js"]
