# Build context must be the landing app directory (Dockhost / typical CI):
#   docker build -f landing/Dockerfile landing/
# From repo root:
#   docker build -f landing/Dockerfile ./landing
#
# STV web bundle: sources in landing/stv-web-sidepanel/ (mirror of extension/sidepanel).
# After editing extension/sidepanel: from landing/ run npm run sync:stv-sidepanel and commit.
#
FROM node:20-alpine AS base
# glibc compat (gcompat; Alpine 3.23 dropped the libc6-compat package name).
# Dockhost/RF often cannot fetch dl-cdn.alpinelinux.org — apk then times out
# (~8 min) and reports "no such package". Use the Yandex Alpine mirror.
RUN set -eu; \
  sed -i 's#https\?://dl-cdn.alpinelinux.org/alpine#https://mirror.yandex.ru/mirrors/alpine#g' /etc/apk/repositories; \
  i=0; \
  until apk add --no-cache gcompat; do \
    i=$((i + 1)); \
    [ "$i" -ge 3 ] && exit 1; \
    sleep $((i * 4)); \
  done

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` can skip nested optional `@img/sharp-libvips-*`. Without it, `next build`
# dies while collecting `/api/admin/generate` (`libvips-cpp.so.42` missing).
RUN npm ci \
  && npm install --no-save --os=linux --libc=musl --cpu=x64 --include=optional sharp@0.33.5

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG SUPABASE_SUPABASE_PUBLIC_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID
ARG NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI
ENV SUPABASE_SUPABASE_PUBLIC_URL=$SUPABASE_SUPABASE_PUBLIC_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID=$NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID
ENV NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI=$NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone /opt/standalone
RUN if [ -f /opt/standalone/landing/server.js ]; then \
      cp -a /opt/standalone/landing/. /app/; \
    elif [ -f /opt/standalone/server.js ]; then \
      cp -a /opt/standalone/. /app/; \
    else \
      echo "ERROR: no server.js under .next/standalone"; find /opt/standalone -name server.js 2>/dev/null || true; exit 1; \
    fi \
    && rm -rf /opt/standalone \
    && chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
