# Steal This Vibe — Smoke Test

Быстрый ручной e2e тест для нового пайплайна:

`upload -> extract -> expand -> generate x3 -> poll -> save`

## 0) Preconditions

- Миграции применены:
  - `138_vibes_table.sql`
  - `139_landing_generations_vibe_id.sql`
  - `140_landing_vibe_saves.sql`
- В `landing/.env.local` есть:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `CHROME_EXTENSION_ID` или `CORS_ALLOWED_ORIGINS`
- Локально поднят landing:

```bash
cd landing
npm run dev
```

## 1) Получить auth cookie

1. Открой `http://localhost:3001`
2. Залогинься через Google
3. В DevTools -> Network выбери любой `GET /api/me`
4. Скопируй значение request header `Cookie`

## 2) Upload photo

```bash
BASE_URL="http://localhost:3001"
COOKIE="<весь Cookie header>"
PHOTO_PATH="/absolute/path/to/photo.jpg"

curl -s -X POST "$BASE_URL/api/upload-generation-photo" \
  -H "Cookie: $COOKIE" \
  -F "file=@$PHOTO_PATH"
```

Ожидаемо: `{"storagePath":"<userId>/<timestamp>_<rand>.jpg"}`

Сохрани `storagePath` в переменную:

```bash
STORAGE_PATH="<из ответа>"
```

## 3) Extract vibe

```bash
IMAGE_URL="https://images.unsplash.com/photo-1517841905240-472988babdf9"

curl -s -X POST "$BASE_URL/api/vibe/extract" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"imageUrl\":\"$IMAGE_URL\"}"
```

Ожидаемо:

- `vibeId` (uuid)
- `style` с полями:
  - `scene`
  - `genre`
  - `lighting`
  - `camera`
  - `mood`
  - `color`
  - `clothing`
  - `composition`

Сохрани `vibeId`:

```bash
VIBE_ID="<из ответа>"
```

## 4) Expand prompts

```bash
curl -s -X POST "$BASE_URL/api/vibe/expand" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"vibeId\":\"$VIBE_ID\"}"
```

Ожидаемо: `prompts` массив из 3 элементов с `accent`:

- `lighting`
- `mood`
- `composition`

Сохрани три prompt текста отдельно (для шага generate).

## 5) Generate (x3)

```bash
PROMPT_1="<lighting prompt>"
PROMPT_2="<mood prompt>"
PROMPT_3="<composition prompt>"

curl -s -X POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"prompt\":\"$PROMPT_1\",\"model\":\"gemini-2.5-flash-image\",\"aspectRatio\":\"1:1\",\"imageSize\":\"1K\",\"vibeId\":\"$VIBE_ID\",\"photoStoragePaths\":[\"$STORAGE_PATH\"]}"
```

Повтори 3 раза (по prompt). Каждый ответ: `{"id":"<generationId>"}`.

Сохрани `GEN_ID_1`, `GEN_ID_2`, `GEN_ID_3`.

## 6) Poll statuses

```bash
curl -s -X GET "$BASE_URL/api/generations/$GEN_ID_1" -H "Cookie: $COOKIE"
```

Ожидаемый переход:

- `pending` -> `processing` -> `completed`
- при `completed` есть `resultUrl`

Повторять каждые ~2.5 сек до `completed` по всем 3 id.

## 7) Save one result

```bash
curl -s -X POST "$BASE_URL/api/vibe/save" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"vibeId\":\"$VIBE_ID\",\"generationId\":\"$GEN_ID_1\",\"prompt\":\"$PROMPT_1\",\"accent\":\"lighting\"}"
```

Ожидаемо: `saveId`, `generationId`, `vibeId`, `cardId` (опционально), `cardUrl` (опционально).

## 8) DB sanity checks (optional)

```sql
-- vibe записался
select id, user_id, created_at from vibes order by created_at desc limit 3;

-- генерации связаны с vibe
select id, vibe_id, status, created_at
from landing_generations
where vibe_id = '<VIBE_ID>'
order by created_at desc;

-- save записался
select id, user_id, vibe_id, generation_id, accent, created_at
from landing_vibe_saves
where vibe_id = '<VIBE_ID>'
order by created_at desc;
```

## Acceptance criteria

- Все 3 generate-запроса созданы без `validation_error`
- Минимум 2/3 генераций доходят до `completed`
- `vibe_id` сохраняется в `landing_generations`
- `/api/vibe/save` успешно создаёт запись в `landing_vibe_saves`
