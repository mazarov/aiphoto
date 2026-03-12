# AIPhoto Landing — SEO-лендинг промтов для фото

Next.js 15, App Router, Tailwind CSS.

## Запуск

```bash
# Установить зависимости (уже сделано)
npm install

# Скопировать env из корня photo2sticker-bot
cp ../../.env .env.local
# Или создать .env.local. Поддерживаются:
# SUPABASE_SUPABASE_PUBLIC_URL или NEXT_PUBLIC_SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY

# Dev
npm run dev
# http://localhost:3001

# Build
npm run build
npm start
```

## Docker

```bash
docker build -t aiphoto-landing .
docker run -p 3001:3001 -e NEXT_PUBLIC_SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... aiphoto-landing
```
