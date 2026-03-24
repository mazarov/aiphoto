# Build from repository root (sibling `extension/sidepanel` is required for `npm run build:stv-web`):
#   docker build -f landing/Dockerfile .
#
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /work/landing
COPY landing/package.json landing/package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /work/landing
COPY --from=deps /work/landing/node_modules ./node_modules
COPY landing/ .
# Steal This Vibe web bundle — esbuild entry `extension/sidepanel/boot-web.js` (see `scripts/build-stv-web.mjs`)
COPY extension/sidepanel /work/extension/sidepanel
ENV NEXT_TELEMETRY_DISABLED=1
ARG SUPABASE_SUPABASE_PUBLIC_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SUPABASE_PUBLIC_URL=$SUPABASE_SUPABASE_PUBLIC_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /work/landing/.next/standalone /opt/standalone
RUN if [ -f /opt/standalone/landing/server.js ]; then \
      cp -a /opt/standalone/landing/. /app/; \
    elif [ -f /opt/standalone/server.js ]; then \
      cp -a /opt/standalone/. /app/; \
    else \
      echo "ERROR: no server.js under .next/standalone"; find /opt/standalone -name server.js 2>/dev/null || true; exit 1; \
    fi \
    && rm -rf /opt/standalone \
    && chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /work/landing/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /work/landing/public ./public
USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
