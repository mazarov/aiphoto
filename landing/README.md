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

# Dev (перед первым открытием /embed/stv или модалки генерации — собрать панель STV)
npm run build:stv-web
npm run dev
# http://localhost:3001

# Build (включает build:stv-web автоматически)
npm run build
npm start
```

## Сборка (`npm run build`)

- Запуск из каталога **`landing/`**.
- **`build:stv-web`** смотрит **`../extension/sidepanel`**, иначе **`./stv-web-sidepanel/`** (зеркало в git для Docker). После правок в **`extension/sidepanel/`**: **`npm run sync:stv-sidepanel`**.
- Скрипты: **`build:stv-web`** → `public/stv-panel/boot.mjs` + `styles.css`; **`build`** → STV + **`next build`**.

## Steal This Vibe (extension + API)

Новые endpoints:

- `POST /api/vibe/extract`
- `POST /api/vibe/expand`
- `POST /api/vibe/save`

Новые SQL-миграции:

- `138_vibes_table.sql`
- `139_landing_generations_vibe_id.sql`
- `140_landing_vibe_saves.sql`
- `142_landing_vibe_saves_auto_seo_tags.sql`

### CORS для extension

API вызывается из origin `chrome-extension://<id>`, поэтому в `landing/.env.local` обязательно:

```bash
CHROME_EXTENSION_ID=<id из chrome://extensions>
# или CORS_ALLOWED_ORIGINS=chrome-extension://<id1>,chrome-extension://<id2>
```

Без этого браузер заблокирует запросы в API из extension.

### Try this look на карточках

Чтобы включить публичную кнопку генерации на карточках (`/p/[slug]`), добавь:

```bash
NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK=true
```

Если флаг не задан, кнопка остаётся доступной только в debug-режиме.

### Быстрый smoke checklist

1. Пользователь залогинен -> `GET /api/me` возвращает `200`
2. Upload фото -> `POST /api/upload-generation-photo` возвращает `storagePath`
3. Extract -> `POST /api/vibe/extract` возвращает `{ vibeId, style }`
4. Expand -> `POST /api/vibe/expand` возвращает 1 prompt (`accent: scene`)
5. Generate -> 1x `POST /api/generate` возвращает id
6. Polling -> `GET /api/generations/[id]` до `completed`
7. Save -> `POST /api/vibe/save` возвращает `saveId` (+ `autoTagCount`), auto-теги сохраняются в `landing_vibe_saves.auto_seo_tags`, при отсутствии `card_id` выполняется автопубликация карточки

## Docker

Контекст сборки — **каталог `landing/`** (как у Dockhost). Исходники STV для бандла лежат в **`landing/stv-web-sidepanel/`**.

```bash
# из корня клона aiphoto/
docker build -f landing/Dockerfile -t aiphoto-landing landing/
docker run -p 3001:3001 -e NEXT_PUBLIC_SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... aiphoto-landing
```

Не собирать **`docker build -f landing/Dockerfile .`** из корня репо — в контекст попадёт не тот **`package.json`**.
