FROM node:20-alpine AS builder

# Build with repository root as context:
# docker build -f web-generation-worker/Dockerfile .
WORKDIR /repo/web-generation-worker
COPY web-generation-worker/package*.json ./
RUN npm install
COPY web-generation-worker/tsconfig.json ./
COPY web-generation-worker/src ./src
COPY landing/src/lib/image-generation-prompt.ts /repo/landing/src/lib/image-generation-prompt.ts
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY web-generation-worker/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /repo/web-generation-worker/dist ./dist
EXPOSE 3003
CMD ["node", "dist/web-generation-worker/src/index.js"]
