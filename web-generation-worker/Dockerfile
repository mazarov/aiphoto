FROM node:20-alpine AS builder

# Build with repository root as context:
# docker build -f web-generation-worker/Dockerfile .
# glibc compat + musl sharp: Alpine `npm install` can skip @img/sharp-libvips-linuxmusl-*.
RUN apk add --no-cache libc6-compat
WORKDIR /repo/web-generation-worker
COPY web-generation-worker/package*.json ./
RUN npm install \
  && npm install --no-save --os=linux --libc=musl --cpu=x64 --include=optional sharp@0.33.5
COPY web-generation-worker/tsconfig.json ./
COPY web-generation-worker/src ./src
COPY landing/src/lib/image-generation-prompt.ts /repo/landing/src/lib/image-generation-prompt.ts
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production
COPY web-generation-worker/package*.json ./
RUN npm install --omit=dev \
  && npm install --no-save --os=linux --libc=musl --cpu=x64 --include=optional sharp@0.33.5
COPY --from=builder /repo/web-generation-worker/dist ./dist
EXPOSE 3003
CMD ["node", "dist/web-generation-worker/src/index.js"]
