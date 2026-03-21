# Web Generation Module

> Последнее обновление: 2026-03-20

Модуль генерации изображений на лендинге PromptShot. Открывается как модальное окно поверх любой страницы. Точка входа — кнопка рядом с «Скопировать промпт» на странице карточки.

**Доступ:** только при включённом debug-флаге (`debugOpen` в `DebugProvider`).

---

## 1. Архитектура

### Flow запроса

```
Browser
  │
  ├─ POST /api/generate            ← auth token + параметры
  │
  ▼
Next.js API Route (Dockhost, Россия)
  │  • Валидация auth (Supabase session)
  │  • Проверка / списание кредитов
  │  • Создание записи в landing_generations (status=pending)
  │  • Скачивание фото из Supabase Storage
  │  • Вызов Gemini через прокси
  │
  ├─ HTTPS + x-goog-api-key ──►  VPN Proxy (Германия, nginx)
  │                                       │
  │                                       ▼
  │                                 Gemini API
  │                                 (generativelanguage.googleapis.com)
  │  ◄────────────────────────  Response (base64 image)
  │
  │  • Сохранение результата в Supabase Storage
  │  • Обновление landing_generations (status=completed)
  │
  ▼
Browser  ← polling GET /api/generations/[id] каждые 2-3 сек
```

### Безопасность

| Секрет | Где хранится | Видим в браузере? |
|--------|-------------|-------------------|
| `GEMINI_API_KEY` | env vars Next.js сервера | Нет |
| `GEMINI_PROXY_BASE_URL` | env vars Next.js сервера | Нет |
| `SUPABASE_SERVICE_ROLE_KEY` | env vars Next.js сервера | Нет |

Браузер вызывает только `/api/generate` и `/api/generations/[id]` на своём домене. Ключи, URL прокси и service role key никогда не попадают в клиентский код.

---

## 2. Модели

| Model ID | UI-название | Стоимость по умолч. | Конфиг-ключ |
|----------|------------|---------------------|-------------|
| `gemini-2.5-flash-image` | Flash | 1 кредит | `web_model_flash_cost` |
| `gemini-3-pro-image-preview` | Pro | 2 кредита | `web_model_pro_cost` |
| `gemini-3.1-flash-image-preview` | Ultra | 3 кредита | `web_model_ultra_cost` |

- Стоимость регулируется через конфиг-таблицу `landing_generation_config`.
- Список моделей и их стоимость загружаются с сервера при открытии модалки (`GET /api/generation-config`).
- UI-названия моделей — тоже из конфига (чтобы менять без деплоя).

---

## 3. Параметры генерации

### 3.1. Формат (aspect ratio)

Передаётся в Gemini `generationConfig.imageConfig.aspectRatio`.

| Значение | UI-лейбл |
|----------|----------|
| `1:1` | 1:1, квадратный |
| `4:3` | 4:3, горизонтальный |
| `3:4` | 3:4, вертикальный |
| `16:9` | 16:9, горизонтальный |
| `9:16` | 9:16, вертикальный |
| `3:2` | 3:2, горизонтальный |
| `2:3` | 2:3, вертикальный |

### 3.2. Качество (imageSize)

Передаётся в Gemini `generationConfig.imageConfig.imageSize`. Без серверного resize результата.

| Значение | UI-лейбл |
|----------|----------|
| `1K` | 1K (1024px) |
| `2K` | 2K (2048px) |
| `4K` | 4K (4096px) |

### 3.3. Промпт

- При открытии модуля со страницы карточки — автозаполняется **`prompt_text_en`** из `prompt_variants` по `card_id` текущей карточки (берётся вариант текущей карточки в группе).
- Пользователь может редактировать промпт после подстановки.
- Минимальная длина промпта: 8 символов.
- Негативного промпта нет.

### 3.4. Фото (обязательно)

- Минимум 1, максимум 4 фото.
- Загрузка в Supabase Storage (bucket: `web-generation-uploads`, путь: `{user_id}/{generation_id}/{index}.jpg`).
- Перед отправкой в Gemini — resize на сервере до max 2048px по длинной стороне, JPEG quality 85 (экономия трафика через прокси и ускорение запроса).
- Допустимые форматы: JPEG, PNG, WebP.
- Макс размер загружаемого файла: 10 MB.

---

## 4. Database

### 4.1. Изменения в существующих таблицах

```sql
-- Добавляем кредиты в landing_users
ALTER TABLE landing_users
  ADD COLUMN IF NOT EXISTS credits int NOT NULL DEFAULT 0;
```

### 4.2. `landing_generations`

```sql
CREATE TABLE landing_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Статус: pending → processing → completed | failed
  status text NOT NULL DEFAULT 'pending',

  -- Что генерировали
  card_id uuid REFERENCES prompt_cards(id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  model text NOT NULL,
  aspect_ratio text NOT NULL DEFAULT '1:1',
  image_size text NOT NULL DEFAULT '1K',
  credits_spent int NOT NULL DEFAULT 1,

  -- Входные фото (paths в Supabase Storage)
  input_photo_paths text[] NOT NULL DEFAULT '{}',

  -- Результат
  result_storage_bucket text,
  result_storage_path text,

  -- Ошибки
  error_message text,
  error_type text,
    -- gemini_blocked | gemini_error | no_image | timeout | unknown

  -- Тайминг
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_gen_user
  ON landing_generations(user_id, created_at DESC);

CREATE INDEX idx_landing_gen_pending
  ON landing_generations(status)
  WHERE status IN ('pending', 'processing');

ALTER TABLE landing_generations ENABLE ROW LEVEL SECURITY;

-- Пользователи видят только свои генерации
CREATE POLICY "Users read own generations"
  ON landing_generations FOR SELECT
  USING (auth.uid() = user_id);
```

### 4.3. `landing_generation_config`

Key-value конфиг, аналогично `photo_app_config` в боте.

```sql
CREATE TABLE landing_generation_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Начальные значения
INSERT INTO landing_generation_config (key, value) VALUES
  -- Модели: JSON массив {id, label, cost, enabled}
  ('models', '[
    {"id":"gemini-2.5-flash-image","label":"Flash","cost":1,"enabled":true},
    {"id":"gemini-3-pro-image-preview","label":"Pro","cost":2,"enabled":true},
    {"id":"gemini-3.1-flash-image-preview","label":"Ultra","cost":3,"enabled":true}
  ]'),
  -- Дефолтные значения
  ('default_model', 'gemini-2.5-flash-image'),
  ('default_aspect_ratio', '1:1'),
  ('default_image_size', '1K'),
  -- Лимиты
  ('max_photos', '4'),
  ('max_file_size_mb', '10'),
  ('min_prompt_length', '8')
ON CONFLICT (key) DO NOTHING;
```

### 4.4. `landing_deduct_credits` (RPC)

Атомарное списание кредитов (аналог `photo_deduct_credits`).

```sql
CREATE OR REPLACE FUNCTION landing_deduct_credits(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_credits int;
BEGIN
  UPDATE landing_users
  SET credits = credits - p_amount, updated_at = now()
  WHERE id = p_user_id AND credits >= p_amount
  RETURNING credits INTO v_credits;

  IF NOT FOUND THEN
    RETURN -1; -- недостаточно кредитов
  END IF;
  RETURN v_credits;
END;
$$;
```

---

## 5. API Endpoints

### 5.1. `GET /api/generation-config`

Возвращает конфиг для модалки (модели, стоимость, лимиты).

**Ответ:**
```json
{
  "models": [
    { "id": "gemini-2.5-flash-image", "label": "Flash", "cost": 1 },
    { "id": "gemini-3-pro-image-preview", "label": "Pro", "cost": 2 },
    { "id": "gemini-3.1-flash-image-preview", "label": "Ultra", "cost": 3 }
  ],
  "aspectRatios": ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
  "imageSizes": ["1K", "2K", "4K"],
  "defaults": {
    "model": "gemini-2.5-flash-image",
    "aspectRatio": "1:1",
    "imageSize": "1K"
  },
  "limits": {
    "maxPhotos": 4,
    "maxFileSizeMb": 10,
    "minPromptLength": 8
  }
}
```

### 5.2. `GET /api/generation-prompt?cardId=<uuid>`

Возвращает EN промпт карточки для автозаполнения.

**Ответ:**
```json
{
  "promptEn": "A woman in a black dress standing..."
}
```

Логика: `SELECT prompt_text_en FROM prompt_variants WHERE card_id = $1 ORDER BY variant_index LIMIT 1`.

### 5.3. `POST /api/generate`

Запуск генерации. Требует auth.

**Тело запроса:**
```json
{
  "prompt": "A woman in a black dress...",
  "model": "gemini-2.5-flash-image",
  "aspectRatio": "1:1",
  "imageSize": "1K",
  "cardId": "uuid-or-null",
  "photoStoragePaths": ["user123/gen456/0.jpg"]
}
```

**Логика:**
1. Валидация auth (Supabase session из cookie).
2. Валидация параметров (модель из списка, формат из списка, промпт >= 8 символов, 1-4 фото).
3. Определение стоимости по модели из конфига.
4. Атомарное списание кредитов (`landing_deduct_credits`).
5. Создание записи в `landing_generations` (status=`pending`).
6. Возврат `{ id: "generation-uuid" }`.
7. **Асинхронная обработка** (в том же запросе, после отправки ответа, или отдельным процессом — см. раздел 5.5).

**Ответ (success):**
```json
{ "id": "uuid" }
```

**Ответ (ошибки):**
```json
{ "error": "insufficient_credits", "message": "Недостаточно кредитов", "required": 2, "available": 1 }
{ "error": "validation_error", "message": "Промпт должен быть минимум 8 символов" }
{ "error": "unauthorized" }
```

### 5.4. `GET /api/generations/[id]`

Polling статуса генерации. Требует auth. Пользователь видит только свои.

**Ответ (processing):**
```json
{
  "id": "uuid",
  "status": "processing",
  "progress": 50,
  "createdAt": "2026-03-16T12:00:00Z"
}
```

**Ответ (completed):**
```json
{
  "id": "uuid",
  "status": "completed",
  "progress": 100,
  "resultUrl": "https://supabase-storage-url/...",
  "model": "gemini-2.5-flash-image",
  "aspectRatio": "1:1",
  "createdAt": "2026-03-16T12:00:00Z",
  "completedAt": "2026-03-16T12:00:35Z"
}
```

**Ответ (failed):**
```json
{
  "id": "uuid",
  "status": "failed",
  "errorType": "gemini_blocked",
  "errorMessage": "Контент заблокирован модерацией",
  "creditsRefunded": true
}
```

### 5.5. Обработка генерации (worker)

Два варианта реализации — выбрать при имплементации:

**Вариант A — Inline processing (проще для MVP):**
- `POST /api/generate` создаёт запись, возвращает id.
- `POST /api/generate-process` (внутренний, вызывается через `fetch` без await из первого endpoint'а, или через `waitUntil` если доступен).
- Обрабатывает: скачивает фото → вызывает Gemini → сохраняет результат.

**Вариант B — Отдельный worker (надёжнее):**
- Отдельный процесс (cron или long-running) поллит `landing_generations WHERE status = 'pending'`.
- Обрабатывает по одному.
- Аналогично `photo_jobs` + `worker.ts` в боте.

**Рекомендация:** Вариант A для MVP. Проще деплоить, не нужен отдельный процесс. Если упадёт — generation останется в `pending`, можно retry.

### 5.6. `GET /api/generations`

Список генераций пользователя (для вкладки «Мои генерации»).

**Query params:** `limit` (default 20), `offset` (default 0).

**Ответ:**
```json
{
  "generations": [
    {
      "id": "uuid",
      "status": "completed",
      "resultUrl": "...",
      "prompt": "A woman in...",
      "model": "gemini-2.5-flash-image",
      "aspectRatio": "1:1",
      "createdAt": "2026-03-16T12:00:00Z"
    }
  ],
  "total": 42
}
```

### 5.7. `POST /api/upload-generation-photo`

Загрузка фото для генерации. Требует auth.

**Тело:** `multipart/form-data` с полем `file`.

**Логика:**
1. Валидация: формат (JPEG/PNG/WebP), размер (<= 10MB).
2. Resize на сервере: max 2048px по длинной стороне, JPEG quality 85.
3. Загрузка в Supabase Storage: `web-generation-uploads/{user_id}/{timestamp}_{index}.jpg`.
4. Возврат пути.

**Ответ:**
```json
{ "storagePath": "user-uuid/1710590400_0.jpg" }
```

### 5.7.1. `GET /api/upload-generation-photo/signed-url`

Превью загруженного файла в extension после перезагрузки сайдпанели: `blob:` URL не восстанавливается из `chrome.storage`, а bucket `web-generation-uploads` приватный.

**Query:** `path` — тот же `storagePath`, что вернул POST upload (должен начинаться с `{user.id}/`).

**Ответ:** `{ "signedUrl": "…", "expiresIn": 86400 }` — короткоживущий URL для `<img src>`.

---

## 6. UI / UX

### 6.1. Точка входа

На странице карточки (`/p/[slug]`), рядом с кнопкой «Скопировать промпт»:

- **Desktop:** кнопка «Сгенерировать» рядом с «Скопировать промпт» (ниже блока промптов).
- **Mobile:** в sticky bar внизу — две кнопки: «Скопировать» и «Сгенерировать».
- Кнопка видна **только** при `debugOpen === true`.

### 6.2. Модальное окно генерации

Полноэкранная модалка (modal overlay) в стиле дизайн-системы лендинга.

**Структура модалки:**

```
┌─────────────────────────────────────────┐
│  ✕                    Генерация фото    │
│                           Баланс: N     │
│─────────────────────────────────────────│
│                                         │
│  Нейросеть                              │
│  ┌─────────────────────────────── ▾ ┐   │
│  │  Flash                           │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Формат              Качество           │
│  ┌──────── ▾ ┐       ┌──────── ▾ ┐     │
│  │ 1:1       │       │ 1K        │     │
│  └───────────┘       └───────────┘     │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  + Прикрепить фото (0/4)        │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Prompt text here...             │   │
│  │                                  │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│  Промпт должен быть минимум 8 символов  │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │       🚀 Генерация (N кр.)       │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 6.3. Состояния модалки

**Форма (idle):**
- Все селекторы активны.
- Кнопка «Генерация» показывает стоимость в кредитах.
- Кнопка disabled если: нет фото, промпт < 8 символов, нет кредитов.

**Генерация (processing):**
- Все поля disabled.
- Кнопка заменяется на progress bar.
- Progress bar: анимированный, этапы:
  - 0-10%: «Подготовка...»
  - 10-90%: «Генерация изображения...» (плавная анимация, ~30-60 сек)
  - 90-100%: «Сохранение...»
- Нельзя закрыть модалку (или предупреждение при попытке).

**Результат (completed):**
- Показываем сгенерированное изображение.
- Кнопки: «Скачать», «Сгенерировать ещё».
- «Сгенерировать ещё» возвращает к форме с теми же параметрами.

**Ошибка (failed):**
- Сообщение об ошибке.
- Если `gemini_blocked`: «Контент заблокирован модерацией. Попробуйте другой промпт или фото.»
- Если другая ошибка: «Произошла ошибка. Кредит возвращён на баланс.»
- Кнопка «Попробовать снова».

**Нет кредитов:**
- Если `credits === 0`: кнопка «Генерация» заменяется на «Пополнить баланс» (disabled, заглушка).
- Подпись: «Покупка кредитов — скоро».

### 6.4. Вкладка «Мои генерации»

Новый пункт в дропдауне залогиненного пользователя (рядом с «Избранное»).

- Страница: `/generations`.
- Список генераций пользователя: грид карточек с результатами.
- Каждая карточка: превью результата, модель, дата, статус.
- При клике — открывается модалка с полным изображением и кнопкой «Скачать».
- Видна **только** при `debugOpen === true`.

### 6.5. Дизайн-система

Использовать существующие паттерны лендинга:
- Кнопки: `rounded-xl`, `bg-zinc-900` (primary), `border-zinc-200` (secondary).
- Модалка: `rounded-2xl`, `bg-white`, `shadow-2xl`, backdrop `bg-black/50 backdrop-blur-sm`.
- Селекторы: `rounded-xl`, `border-zinc-200`, `bg-white`.
- Текст: `text-zinc-900` (основной), `text-zinc-500` (вторичный).
- Акцент: `indigo-*` для активных состояний.
- Аналог существующей `AuthModal` по структуре и стилям.

---

## 7. Обработка ошибок и рефанд

| Ситуация | Действие | Рефанд кредитов? |
|----------|----------|------------------|
| Gemini вернул `blockReason` | Показать ошибку модерации | Да |
| Gemini вернул пустой ответ (нет image) | Показать общую ошибку | Да |
| Gemini API timeout (>120 сек) | Показать ошибку таймаута | Да |
| Gemini API error (500, 503, etc.) | Показать общую ошибку | Да |
| Ошибка загрузки фото из Storage | Показать общую ошибку | Да |
| Невалидные параметры запроса | Показать ошибку валидации | Нет (не списывали) |
| Недостаточно кредитов | Показать заглушку | Нет (не списывали) |

**Логика рефанда:**

```sql
-- При ошибке генерации
UPDATE landing_users
SET credits = credits + <credits_spent>, updated_at = now()
WHERE id = <user_id>;

UPDATE landing_generations
SET status = 'failed', error_type = '...', error_message = '...', updated_at = now()
WHERE id = <generation_id>;
```

---

## 8. Gemini API вызов

Запрос к Gemini через VPN proxy (аналогично `worker.ts` в aiphoto боте):

```typescript
const geminiUrl = `${GEMINI_PROXY_BASE_URL}/v1beta/models/${model}:generateContent`;

const response = await fetch(geminiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": GEMINI_API_KEY,
  },
  body: JSON.stringify({
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        // Для каждого фото:
        { inlineData: { mimeType: "image/jpeg", data: base64Photo } },
      ],
    }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio,   // "1:1", "16:9", etc.
        imageSize,     // "1K", "2K", "4K"
      },
    },
  }),
});

const data = await response.json();

// Проверка блокировки
const blockReason = data?.promptFeedback?.blockReason;
if (blockReason) throw new GenerationError("gemini_blocked", blockReason);

// Извлечение изображения
const imageBase64 = data?.candidates?.[0]?.content?.parts
  ?.find((p: any) => p.inlineData)?.inlineData?.data;
if (!imageBase64) throw new GenerationError("no_image", "Gemini returned no image");
```

**Env vars (Next.js сервер):**
- `GEMINI_API_KEY` — ключ Gemini API.
- `GEMINI_PROXY_BASE_URL` — URL VPN прокси в Германии (напр. `https://gemini-proxy.example.com`).

---

## 9. Feature Flag

### Механизм

Используем существующий `debugOpen` из `DebugProvider` (`DebugFAB.tsx`).

- Активация: 5 кликов по логотипу «PromptShot» в футере.
- Хранение: `localStorage` ключ `debug_open`.

### Что скрыто за флагом

- Кнопка «Сгенерировать» на странице карточки.
- Модальное окно генерации.
- Пункт «Мои генерации» в дропдауне пользователя.
- Страница `/generations`.

### Проверка

```tsx
const debug = useDebug();
const showGeneration = debug?.debugOpen ?? false;

if (!showGeneration) return null;
```

---

## 10. Ограничения и правила

- **Последовательность:** один пользователь — одна генерация за раз. Кнопка «Генерация» disabled пока есть активная генерация (status = `pending` или `processing`).
- **Параллельность:** разные пользователи генерируют независимо, не блокируют друг друга.
- **Rate limiting:** только по кредитам, дополнительных ограничений нет.
- **Auth:** обязательна (Google OAuth через Supabase). При попытке генерации без auth — показать `AuthModal`.

---

## 11. Новые компоненты

| Компонент | Путь | Описание |
|-----------|------|----------|
| `GenerationModal` | `components/GenerationModal.tsx` | Основная модалка генерации |
| `GenerationForm` | `components/GenerationForm.tsx` | Форма: селекторы, загрузка фото, промпт |
| `GenerationProgress` | `components/GenerationProgress.tsx` | Progress bar во время генерации |
| `GenerationResult` | `components/GenerationResult.tsx` | Показ результата: превью, скачать |
| `GenerationError` | `components/GenerationError.tsx` | Экран ошибки с рефандом |
| `GenerateButton` | `components/GenerateButton.tsx` | Кнопка входа (рядом с Copy) |
| `PhotoUploader` | `components/PhotoUploader.tsx` | Загрузка 1-4 фото с превью |
| `ModelSelector` | `components/ModelSelector.tsx` | Dropdown выбора модели |
| `GenerationsPage` | `app/generations/page.tsx` | Страница «Мои генерации» |
| `GenerationCard` | `components/GenerationCard.tsx` | Карточка в списке генераций |

---

## 12. Новые API routes

| Route | Метод | Auth | Описание |
|-------|-------|------|----------|
| `/api/generation-config` | GET | Нет | Конфиг: модели, лимиты |
| `/api/generation-prompt` | GET | Нет | EN промпт карточки по cardId |
| `/api/upload-generation-photo` | POST | Да | Загрузка фото в Storage |
| `/api/upload-generation-photo/signed-url` | GET | Да | Подписанный URL превью по `path` |
| `/api/generate` | POST | Да | Запуск генерации |
| `/api/generations/[id]` | GET | Да | Статус/результат генерации |
| `/api/generations` | GET | Да | Список генераций пользователя |

---

## 13. Supabase Storage

### Новый bucket: `web-generation-uploads`

- Входные фото пользователей.
- RLS: пользователь может записывать в свою папку `{user_id}/`.
- TTL: 7 дней (фото нужны только для генерации).

### Новый bucket: `web-generation-results`

- Результаты генерации.
- RLS: пользователь может читать свои результаты.
- TTL: без ограничений (хранятся пока пользователь существует).

---

## 14. Миграции (порядок)

Для реализации нужны следующие SQL-миграции (нумерация — от текущей последней):

1. `130_landing_users_credits.sql` — добавление `credits` в `landing_users`.
2. `131_landing_generations.sql` — таблица `landing_generations` + RLS + индексы.
3. `132_landing_generation_config.sql` — таблица конфига + seed данные.
4. `133_landing_deduct_credits.sql` — RPC `landing_deduct_credits`.

---

## 15. Scope MVP / вне scope

### В scope MVP

- [x] Модалка генерации с формой
- [x] 3 модели Gemini с разной стоимостью
- [x] Выбор формата (aspect ratio)
- [x] Выбор качества (imageSize)
- [x] Загрузка 1-4 фото
- [x] Автозаполнение EN промпта из карточки
- [x] Редактируемый промпт
- [x] Списание кредитов
- [x] Рефанд при ошибке
- [x] Progress bar
- [x] Скачивание результата
- [x] Страница «Мои генерации»
- [x] Debug-only доступ
- [x] Заглушка «Пополнить баланс — скоро»

### Вне scope MVP

- Покупка кредитов (платёжная система)
- Негативный промпт
- Batch-генерация (несколько результатов за раз)
- Публичный доступ (без debug-флага)
- Шеринг результатов
- Генерация без фото (text-to-image)
- Retry автоматический при ошибке
- WebSocket/SSE вместо polling
