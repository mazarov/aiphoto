u# Steal This Vibe — Browser Extension

> Требования на реализацию проекта
> Дата: 2026-03-18

## 1. Суть продукта

Браузерное расширение, которое позволяет пользователю **захватить визуальный стиль** любого фото в интернете и **применить его к своей фотографии** в 1–2 клика.

**Ключевая формулировка:** пользователь не хочет писать промпт — он хочет "примерить образ".

### Двойная роль

| Слой | Для кого | Что даёт |
|------|----------|----------|
| User-facing | Пользователь | "Вау, это я в этом стиле" (3 варианта на выбор) |
| Internal | PromptShot | Автоматическая генерация карточек промптов для SEO |

## 2. Целевая аудитория (MVP)

- **Сегмент:** fashion / Instagram портреты
- **Пользователь:** видит фото, хочет "так же", но не умеет описать
- **Болезнь:** "хочу как на фото, но не знаю как описать"

## 3. User Flow

```
Интернет (любой сайт)
│
├─ hover на фото → появляется кнопка "Steal this vibe"
│
├─ клик → popup расширения
│   ├─ превью оригинала
│   ├─ кнопка "Загрузить своё фото"
│   └─ (или использовать ранее загруженное)
│
├─ загрузка → ожидание 10–20 сек
│
├─ результат: 3 варианта
│   ├─ версия A: акцент на lighting
│   ├─ версия B: акцент на mood
│   └─ версия C: акцент на composition
│
├─ пользователь выбирает лучший
│
└─ действия:
    ├─ "Save" → сохранить в профиль
    ├─ "Download" → скачать
    └─ "Open on site" → перейти на PromptShot
```

## 4. Архитектура

### 4.1. Принцип: Extension = новый вход в существующий пайплайн

Генерация изображений на PromptShot **уже работает**. Extension не создаёт новый backend — он добавляет только два новых шага перед существующей генерацией:

```
                    ┌─────────────────────────────────────────────────┐
  НОВОЕ             │  Block 1: Extract                               │
  (extension only)  │  Vision model → structured JSON стиля           │
                    │  Block 2: Expand                                │
                    │  JSON → 3 промпта с разными акцентами           │
                    └──────────────────┬──────────────────────────────┘
                                       ▼
                    ┌─────────────────────────────────────────────────┐
  СУЩЕСТВУЮЩЕЕ      │  Текущий пайплайн PromptShot:                   │
  (без изменений)   │  POST /api/upload-generation-photo              │
                    │  POST /api/generate                             │
                    │  → /api/generate-process (Gemini)               │
                    │  → polling GET /api/generations/[id]            │
                    │  → результат в Supabase Storage                 │
                    └──────────────────┬──────────────────────────────┘
                                       ▼
                    ┌─────────────────────────────────────────────────┐
  НОВОЕ             │  Block 3: Select + Save                         │
  (extension only)  │  Пользователь выбирает лучший                   │
                    │  → результат + промпт → карточка на PromptShot  │
                    └─────────────────────────────────────────────────┘
```

### 4.2. Что переиспользуется (существующий код лендинга)

| Компонент | Что делает | Где в коде |
|-----------|-----------|------------|
| `POST /api/upload-generation-photo` | Загрузка фото пользователя (resize 2048px, JPEG 85%) | `landing/src/app/api/upload-generation-photo/` |
| `POST /api/generate` | Создание задачи: валидация, списание кредитов, запуск | `landing/src/app/api/generate/` |
| `/api/generate-process` | Gemini API call, upload результата в Storage | `landing/src/app/api/generate-process/` |
| `GET /api/generations/[id]` | Polling статуса (pending → processing → completed) | `landing/src/app/api/generations/[id]/` |
| `GET /api/generation-config` | Доступные модели, aspect ratios, размеры | `landing/src/app/api/generation-config/` |
| `landing_generations` | Таблица с историей генераций | Supabase |
| `web-generation-uploads` | Bucket для загруженных фото | Supabase Storage |
| `web-generation-results` | Bucket для результатов | Supabase Storage |
| Auth (Supabase) | Авторизация, кредиты | Общая с сайтом |

### 4.3. Extension (UI)

- **Content Script:** overlay-кнопка "Steal this vibe" поверх изображений на страницах
- **Side Panel / Popup:** компактный UI с тремя экранами:
  1. Превью захваченного фото + загрузка своего фото
  2. Прогресс генерации (polling `/api/generations/[id]`)
  3. 3 результата + save/download/open
- **Auth:** OAuth через PromptShot (общий аккаунт и кредиты с сайтом)

### 4.4. Новый backend (только Extract + Expand)

```
┌──────────────────────────────────────────────────┐
│  POST /api/vibe/extract                          │
│                                                  │
│  Input:  URL изображения из интернета            │
│  Action: Vision model анализирует изображение    │
│  Output: Structured JSON:                        │
│    { scene, style, lighting, camera, mood, color }│
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│  POST /api/vibe/expand                           │
│                                                  │
│  Input:  Structured JSON стиля                   │
│  Action: LLM генерирует промпты с акцентами      │
│  Output: 3 промпта:                              │
│    - вариант A: акцент на lighting               │
│    - вариант B: акцент на mood                   │
│    - вариант C: акцент на composition            │
└──────────────────────────────────────────────────┘
```

После Extract + Expand extension вызывает **стандартный** `POST /api/generate` с каждым из 3 промптов — дальше работает существующий пайплайн.

### 4.5. Сайт (накопление и рост)

Выбранный результат превращается в карточку на PromptShot:

| Поле карточки | Источник |
|---------------|----------|
| Изображение | Сгенерированный результат (не оригинал → нет юр. рисков) |
| Промпт | Автоматически сгенерированный через Extract→Expand |
| Теги | Автоматически из structured JSON (style, mood, scene…) |
| Кнопка "Try this look" | Другие пользователи могут применить тот же стиль через стандартную генерацию |

## 5. Growth Loop

```
Пользователь A видит фото в интернете
       ↓
"Steal this vibe" → генерация → save
       ↓
Карточка появляется на PromptShot (SEO)
       ↓
Пользователь B находит карточку через поиск
       ↓
"Try this look" → генерация со своим фото
       ↓
Новая карточка → ещё больше контента
       ↓
🔁 Цикл повторяется
```

**Ключевой механизм:** интернет → датасет PromptShot, пользователи → контент-генераторы.

## 6. Текущая авторизация на сайте (переиспользуется)

### 6.1. Провайдеры

| Провайдер | Статус |
|-----------|--------|
| **Google OAuth** | Активен |
| Telegram | Запланирован (отключён) |
| Yandex | Запланирован (отключён) |

### 6.2. Auth Flow (пошагово)

```
1. Пользователь → кнопка "Войти" → AuthModal
2. "Войти через Google" → supabase.auth.signInWithOAuth({ provider: "google" })
3. Redirect: Supabase → Google → Supabase → /auth/callback?code=...&next=...
4. Server callback (auth/callback/route.ts):
   - exchangeCodeForSession(code)
   - Cookies set (Supabase SSR)
   - Redirect to origin + next
5. Client (AuthContext): getUser() → setUser()
6. onAuthStateChange — держит состояние в синхронизации
```

### 6.3. Supabase-клиенты

| Клиент | Файл | Назначение |
|--------|------|-----------|
| Browser | `lib/supabase-browser.ts` | `createBrowserClient` (anon key, cookies) — для клиентских компонентов |
| Server Auth | `lib/supabase-server-auth.ts` | `createServerClient` (anon key, cookies) — для проверки auth в API routes |
| Server Data | `lib/supabase.ts` | `createClient` (service role key) — для операций с данными |

### 6.4. Проверка auth в API routes

Паттерн, используемый во всех защищённых endpoints:

```typescript
const supabaseAuth = await createSupabaseServerAuth();
const { data: { user }, error } = await supabaseAuth.auth.getUser();
if (error || !user) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

Используется в: `/api/me`, `/api/generate`, `/api/upload-generation-photo`, `/api/generations`, `/api/generations/[id]`.

### 6.5. Таблица `landing_users` и кредиты

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid (PK, FK → auth.users) | ID пользователя |
| `display_name` | text | Имя из Google |
| `avatar_url` | text | Аватар из Google |
| `provider` | text | Провайдер авторизации |
| `credits` | int (default 0) | Баланс кредитов |
| `created_at` | timestamp | Дата регистрации |

- Строка создаётся автоматически: **trigger `handle_new_auth_user`** на `auth.users` INSERT
- Списание кредитов: RPC **`landing_deduct_credits(p_user_id, p_amount)`**
- `/api/me` возвращает `{ user, credits }`
- `/api/generate` проверяет кредиты перед генерацией, рефандит при ошибке

### 6.6. Ключевые компоненты авторизации

| Компонент | Файл | Роль |
|-----------|------|------|
| `AuthProvider` | `context/AuthContext.tsx` | React-контекст: `user`, `loading`, `openAuthModal`, `signOut` |
| `AuthModal` | `components/AuthModal.tsx` | Модальное окно логина (Google) |
| `HeaderClient` | `components/HeaderClient.tsx` | Кнопка "Войти" / аватар / дропдаун |
| `useUserInteractions` | `hooks/useUserInteractions.ts` | Лайки/избранное — открывает auth modal если не залогинен |

### 6.7. Как Extension будет использовать auth

Extension **не реализует свою авторизацию** — он переиспользует сессию сайта:

1. Пользователь логинится на `promptshot.ru` (Google OAuth)
2. Supabase-сессия хранится в cookies домена `promptshot.ru`
3. Extension делает запросы к `promptshot.ru/api/*` — cookies подставляются автоматически
4. API routes проверяют auth стандартным паттерном `createSupabaseServerAuth()`
5. Кредиты расходуются из того же баланса `landing_users.credits`

> **Если пользователь не залогинен** — extension показывает кнопку "Войти" и открывает `promptshot.ru` в новой вкладке для авторизации.

---

## 7. Технические требования

### 7.1. Chrome Extension — структура проекта

```
extension/
├── manifest.json
├── background.ts          # Service worker (Manifest V3)
├── content-script.ts      # Overlay-кнопка на страницах
├── content-script.css     # Стили overlay-кнопки
├── sidepanel/
│   ├── index.html
│   ├── App.tsx            # Главный компонент side panel
│   ├── screens/
│   │   ├── UploadScreen.tsx    # Превью + загрузка фото
│   │   ├── ProcessingScreen.tsx # Прогресс 3 генераций
│   │   └── ResultsScreen.tsx   # 3 результата + действия
│   └── hooks/
│       └── useAuth.ts         # Проверка сессии через /api/me
├── lib/
│   └── api.ts             # Обёртки над fetch к promptshot.ru/api/*
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 7.2. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Steal This Vibe",
  "version": "0.1.0",
  "description": "Capture any photo's style and apply it to your own photo",
  "permissions": ["sidePanel", "activeTab"],
  "host_permissions": ["https://promptshot.ru/*"],
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "css": ["content-script.css"]
    }
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Критично:** `host_permissions: ["https://promptshot.ru/*"]` — без этого fetch из extension не отправит cookies домена `promptshot.ru`.

### 7.3. Content Script — логика overlay-кнопки

```typescript
// content-script.ts — псевдокод

const MIN_IMAGE_SIZE = 200; // px — игнорируем мелкие иконки/аватары
const BUTTON_OFFSET = 8;    // px от правого верхнего угла

function shouldShowButton(img: HTMLImageElement): boolean {
  return (
    img.naturalWidth >= MIN_IMAGE_SIZE &&
    img.naturalHeight >= MIN_IMAGE_SIZE &&
    !img.closest("nav, header, footer") && // не показываем на навигации
    img.src.startsWith("http")              // только абсолютные URL
  );
}

function getImageUrl(img: HTMLImageElement): string {
  // Приоритет: srcset (наибольший) → src
  if (img.srcset) {
    const largest = parseSrcset(img.srcset).sort((a, b) => b.width - a.width)[0];
    if (largest) return largest.url;
  }
  return img.src;
}

// При hover на изображение (>= MIN_IMAGE_SIZE):
// 1. Показать кнопку "✨ Steal this vibe" в правом верхнем углу
// 2. При клике: отправить URL изображения в background.ts
// 3. background.ts открывает side panel и передаёт URL

// При уходе мыши с изображения:
// Скрыть кнопку (с задержкой 300ms чтобы успеть кликнуть)
```

### 7.4. Auth из Extension — механизм

Extension **НЕ реализует свой OAuth**. Он проверяет и использует существующую сессию:

```
Шаг 1: Side panel загружается → GET https://promptshot.ru/api/me (credentials: "include")
       ├─ 200 { user, credits } → пользователь залогинен, показать UI
       └─ 401 → показать экран "Войдите на promptshot.ru"
               └─ кнопка → chrome.tabs.create({ url: "https://promptshot.ru" })
                           (пользователь логинится на сайте через Google OAuth)
               └─ после логина: side panel повторно проверяет /api/me

Шаг 2: Все API-вызовы из side panel / background.ts:
       fetch("https://promptshot.ru/api/...", { credentials: "include" })
       → благодаря host_permissions cookies promptshot.ru передаются автоматически
```

**Важно:** `credentials: "include"` обязателен в каждом fetch-вызове. Без него cookies не отправятся.

### 7.5. Новые API endpoints — детальные спеки

#### 7.5.1. POST `/api/vibe/extract`

**Request:**

```json
{
  "imageUrl": "https://example.com/photo.jpg"
}
```

**Response (200):**

```json
{
  "vibeId": "uuid",
  "style": {
    "scene": "woman in a cafe, sitting by the window",
    "genre": "fashion editorial",
    "lighting": "soft natural light from window, warm tones",
    "camera": "portrait, 85mm, shallow depth of field, bokeh background",
    "mood": "candid, relaxed, contemplative",
    "color": "warm palette, desaturated shadows, golden highlights",
    "clothing": "oversized knit sweater, minimal jewelry",
    "composition": "rule of thirds, subject left, negative space right"
  }
}
```

**Промпт для Vision model (Gemini):**

```
Analyze this image and extract its visual style as a structured description.
Return a JSON object with these exact fields:

- scene: What is depicted (subject, setting, action). 1-2 sentences.
- genre: The photographic genre (fashion editorial, street photography, portrait, etc.)
- lighting: Describe the lighting setup, direction, quality, color temperature.
- camera: Lens, focal length, depth of field, angle, distance.
- mood: The emotional tone and atmosphere.
- color: Color palette, grading, contrast, saturation levels.
- clothing: What the subject is wearing (if applicable, empty string if not).
- composition: Framing, rule of thirds, negative space, leading lines.

Be specific and precise — these descriptions will be used to recreate the style with a different subject. Focus on reproducible visual attributes, not the identity of the person.

Return ONLY valid JSON, no markdown.
```

**Ошибки:**

| Status | Body | Когда |
|--------|------|-------|
| 401 | `{ error: "unauthorized" }` | Нет сессии |
| 400 | `{ error: "invalid_url" }` | URL пустой или не http(s) |
| 400 | `{ error: "fetch_failed" }` | Не удалось скачать изображение по URL |
| 500 | `{ error: "extract_failed" }` | Gemini вернул ошибку или невалидный JSON |

**Реализация:**

1. Проверить auth (`createSupabaseServerAuth`)
2. Скачать изображение по URL (fetch, limit 10MB)
3. Отправить в Gemini Vision с промптом выше
4. Парсить JSON из ответа
5. Сохранить в таблицу `vibes`
6. Вернуть `vibeId` + `style`

#### 7.5.2. POST `/api/vibe/expand`

**Request:**

```json
{
  "vibeId": "uuid",
  "style": {
    "scene": "...",
    "genre": "...",
    "lighting": "...",
    "camera": "...",
    "mood": "...",
    "color": "...",
    "clothing": "...",
    "composition": "..."
  }
}
```

**Response (200):**

```json
{
  "prompts": [
    {
      "accent": "lighting",
      "prompt": "A portrait photo of {subject} in soft natural window light, warm golden highlights, shallow depth of field at 85mm, candid and relaxed mood, wearing an oversized knit sweater, desaturated shadows with warm color palette, rule of thirds composition"
    },
    {
      "accent": "mood",
      "prompt": "A contemplative fashion editorial of {subject} sitting by a window in a cafe, dreamy and introspective atmosphere, soft bokeh background, gentle natural illumination, minimal styling with knit sweater, muted warm tones"
    },
    {
      "accent": "composition",
      "prompt": "A cinematic portrait of {subject} framed with rule of thirds, positioned left with negative space right, cafe setting visible through window, 85mm portrait lens, shallow depth of field, warm ambient light, relaxed editorial style"
    }
  ]
}
```

**Промпт для LLM (Gemini text):**

```
You are a prompt engineer for AI image generation.

Given a structured style description of a photo, generate exactly 3 prompts for recreating this style with a different person's photo.

Each prompt must:
1. Include "{subject}" placeholder where the person should be described
2. Be 1-3 sentences, 30-80 words
3. Focus on a different visual accent:
   - Prompt A: emphasize LIGHTING (direction, quality, color temperature, shadows)
   - Prompt B: emphasize MOOD (atmosphere, emotion, narrative)
   - Prompt C: emphasize COMPOSITION (framing, angles, spatial arrangement)
4. Include ALL style elements but weight the accent aspect more heavily
5. Be directly usable as a Gemini image generation prompt

Style description:
{style_json}

Return ONLY valid JSON array with 3 objects, each having "accent" and "prompt" fields.
```

**Ошибки:**

| Status | Body | Когда |
|--------|------|-------|
| 401 | `{ error: "unauthorized" }` | Нет сессии |
| 400 | `{ error: "missing_style" }` | Нет style в body |
| 500 | `{ error: "expand_failed" }` | Gemini вернул ошибку |

#### 7.5.3. POST `/api/vibe/save`

**Request:**

```json
{
  "vibeId": "uuid",
  "generationId": "uuid",
  "prompt": "выбранный промпт",
  "accent": "lighting"
}
```

**Response (200):**

```json
{
  "cardId": "uuid",
  "cardUrl": "https://promptshot.ru/card/slug"
}
```

**Реализация:**

1. Проверить auth
2. Загрузить generation из `landing_generations` (проверить что `status = completed`, что `user_id` совпадает)
3. Создать запись в `prompt_cards` (или аналогичной таблице карточек):
   - `image_url` — из `result_storage_bucket/result_storage_path`
   - `prompt` — из request
   - `tags` — из `vibes.style` JSON (scene → tag, genre → tag, mood → tag и т.д.)
   - `source_vibe_id` — ссылка на vibe
4. Вернуть `cardId` и URL карточки

### 7.6. Контракт существующего `/api/generate` (для вызова из extension)

Extension вызывает этот endpoint 3 раза (по одному на каждый промпт из expand).

**Request:**

```json
{
  "prompt": "A portrait photo of {subject} in soft natural window light...",
  "model": "gemini-2.5-flash-image",
  "aspectRatio": "1:1",
  "imageSize": "1K",
  "photoStoragePaths": ["userId/1710850000_abc123.jpg"],
  "cardId": null
}
```

| Поле | Тип | Обязательно | Дефолт | Валидация |
|------|-----|-------------|--------|-----------|
| `prompt` | string | Да | — | `trim().length >= 8` |
| `model` | string | Нет | `gemini-2.5-flash-image` | Из списка enabled моделей |
| `aspectRatio` | string | Нет | `1:1` | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3` |
| `imageSize` | string | Нет | `1K` | `1K`, `2K`, `4K` |
| `photoStoragePaths` | string[] | Да | — | 1–4 элемента |
| `cardId` | string? | Нет | null | — |

**Response (200):** `{ "id": "uuid" }` — ID генерации для polling.

**Стоимость:** зависит от модели (Flash = 1 кредит, Pro = 2, Ultra = 3). Extension создаёт 3 генерации = 3× стоимость модели.

### 7.7. Контракт существующих endpoints (reference)

#### GET `/api/me`

**Response (200):** `{ "user": { "id", "email", ... }, "credits": 15 }`
**Response (401):** `{ "error": "unauthorized" }`

Extension использует для проверки авторизации и показа баланса.

#### POST `/api/upload-generation-photo`

**Request:** `FormData` с полем `file` (image/jpeg, image/png, image/webp, ≤ 10MB).
**Response (200):** `{ "storagePath": "userId/1710850000_abc123.jpg" }`

Изображение ресайзится до 2048px, конвертируется в JPEG 85%.

#### GET `/api/generations/[id]`

**Response:**

```json
{
  "id": "uuid",
  "status": "pending | processing | completed | failed",
  "progress": 10 | 50 | 100 | 0,
  "model": "gemini-2.5-flash-image",
  "aspectRatio": "1:1",
  "createdAt": "2026-03-18T...",
  "resultUrl": "https://...supabase.co/storage/v1/object/public/web-generation-results/...",
  "completedAt": "2026-03-18T...",
  "errorType": "...",
  "errorMessage": "...",
  "creditsRefunded": true
}
```

`resultUrl` появляется только при `status: "completed"`. Polling: каждые 2.5 сек.

### 7.8. Orchestration Flow в Extension (пошагово)

```
Side Panel загружен, пользователь нажал "Steal this vibe" на фото
│
├─ 1. GET /api/me → проверить auth и баланс
│   └─ 401 → экран "Войдите на сайт"
│   └─ credits < 3 → экран "Недостаточно кредитов"
│
├─ 2. POST /api/vibe/extract { imageUrl }
│   └─ получаем vibeId + style JSON
│   └─ показываем превью style (теги: genre, mood, lighting)
│
├─ 3. Пользователь загружает своё фото
│   └─ POST /api/upload-generation-photo (FormData: file)
│   └─ получаем storagePath
│
├─ 4. POST /api/vibe/expand { vibeId, style }
│   └─ получаем 3 промпта (lighting, mood, composition)
│
├─ 5. 3× POST /api/generate { prompt, photoStoragePaths: [storagePath], model, aspectRatio, imageSize }
│   └─ получаем 3 generationId
│
├─ 6. Polling: 3× GET /api/generations/[id] каждые 2.5 сек
│   └─ показываем общий прогресс (0/3, 1/3, 2/3, 3/3 ready)
│   └─ по мере готовности показываем результаты
│
├─ 7. Все 3 готовы → экран результатов
│   └─ 3 карточки с изображениями
│   └─ у каждой: label акцента (Lighting / Mood / Composition)
│   └─ кнопки: ⭐ Save / ⬇ Download / 🔗 Open on site
│
└─ 8. "Save" → POST /api/vibe/save { vibeId, generationId, prompt, accent }
    └─ получаем cardUrl
    └─ показываем ссылку на карточку
```

### 7.9. Новая таблица `vibes`

```sql
CREATE TABLE vibes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  source_image_url TEXT NOT NULL,
  style JSONB NOT NULL,
  -- { scene, genre, lighting, camera, mood, color, clothing, composition }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vibes_user_id ON vibes(user_id);
CREATE INDEX idx_vibes_created_at ON vibes(created_at DESC);

ALTER TABLE vibes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own vibes"
  ON vibes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vibes"
  ON vibes FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Опционально — поле `vibe_id UUID REFERENCES vibes(id)` в `landing_generations` для связи генераций с vibe.

### 7.10. Обработка ошибок

| Ситуация | Что делает extension |
|----------|---------------------|
| Пользователь не залогинен (`/api/me` → 401) | Экран "Войдите на promptshot.ru", кнопка открывает сайт |
| Недостаточно кредитов | Показать баланс + "Нужно N кредитов, у вас M", ссылка на пополнение |
| Extract не смог скачать изображение | "Не удалось загрузить изображение. Попробуйте другое фото" |
| Extract вернул невалидный JSON | Retry 1 раз, если снова → "Не удалось определить стиль" |
| Одна из 3 генераций failed | Показать 2 успешных, для failed — "Не удалось сгенерировать", кредит возвращён |
| Все 3 генерации failed | Экран ошибки + "Попробовать ещё раз" |
| Таймаут генерации (> 60 сек) | Прекратить polling, показать "Генерация заняла слишком долго" |
| Сеть недоступна | Toast "Нет соединения", retry кнопка |

### 7.11. Хранение

| Что | Где | Новое? |
|-----|-----|--------|
| Extracted style JSON | Таблица `vibes` (schema выше) | **Да** |
| Связь vibe → generations | Поле `vibe_id` в `landing_generations` (ALTER TABLE) | **Да** |
| Загруженные фото | Bucket `web-generation-uploads` | Нет (существующий) |
| Результаты генерации | Bucket `web-generation-results` | Нет (существующий) |
| Промпты для SEO | Таблица `prompt_variants` | Нет (существующий) |

## 8. Ограничения MVP

### Делаем

- [x] Chrome extension: content script + side panel UI
- [x] Overlay-кнопка "Steal this vibe" поверх фото на страницах
- [x] Новые endpoints: `/api/vibe/extract`, `/api/vibe/expand`, `/api/vibe/save`
- [x] Upload фото через существующий `/api/upload-generation-photo`
- [x] 3 генерации через существующий `/api/generate`
- [x] Выбор лучшего + save как карточка
- [x] Auth через существующую Supabase авторизацию
- [x] Таблица `vibes` для хранения extracted styles

### НЕ делаем в MVP

- ❌ Новый backend генерации (используем существующий)
- ❌ Новую систему кредитов (используем существующую)
- ❌ Идеальный prompt extraction (вариативность компенсирует)
- ❌ Сложная сегментация лица
- ❌ Библиотека сохранённых вайбов в расширении
- ❌ Галерея / лента в extension (только на сайте)
- ❌ Firefox / Safari
- ❌ Мобильную версию

## 9. Метрики успеха

| Метрика | Целевое значение |
|---------|-----------------|
| "Вау"-реакция (результат похож на стиль) | 8 из 10 попыток |
| Конверсия клик → save | > 30% |
| Карточек создано за неделю (organic) | > 100 |
| Время от клика до результата | < 20 сек |

## 10. Критичные проблемы (не были учтены)

> Статус на 2026-03-19: ключевые блокеры из этого раздела закрыты в реализации (CORS для extension, message passing content-script ↔ sidepanel, SSRF guard, auth/cookies, устойчивый polling и UX стоимости).

### 10.1. CORS — BLOCKER

**Проблема:** Side panel extension работает на origin `chrome-extension://...`. Все fetch-запросы к `promptshot.ru/api/*` будут заблокированы браузером — **CORS не настроен** на лендинге. Сейчас в `next.config.ts` и `middleware.ts` нет никаких `Access-Control-Allow-Origin` заголовков.

**Решение:** Добавить CORS middleware или заголовки в `next.config.ts`:

```typescript
// landing/next.config.ts — добавить секцию headers
async headers() {
  return [
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Access-Control-Allow-Origin",
          // В проде: конкретный chrome-extension://ID
          // На этапе разработки: можно "*" (но не с credentials!)
          value: "chrome-extension://EXTENSION_ID_HERE",
        },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        { key: "Access-Control-Allow-Credentials", value: "true" },
      ],
    },
  ];
},
```

**Нюанс:** `Access-Control-Allow-Credentials: true` **несовместим** с `Access-Control-Allow-Origin: *`. Нужен конкретный origin. Варианты:
- Хардкодить `chrome-extension://EXTENSION_ID` (ID фиксируется после публикации)
- Динамический CORS middleware, который проверяет origin по allowlist

### 10.2. `{subject}` placeholder — логическая дыра

**Проблема:** Expand генерирует промпты с `{subject}` placeholder:
```
"A portrait photo of {subject} in soft natural window light..."
```

Но кто и чем заменяет `{subject}`? Существующий `/api/generate` отправляет prompt как есть в Gemini. Пользователь не описывает себя текстом — он загружает фото. Gemini при image generation с reference photo сам "видит" человека на фото.

**Решение:** Заменять `{subject}` на `"the person in the provided reference photo"` перед отправкой в `/api/generate`:

```typescript
// extension lib/api.ts
const finalPrompt = prompt.replace(
  "{subject}",
  "the person in the provided reference photo"
);
```

Или изменить промпт Expand — не использовать `{subject}`, а формулировать промпты в стиле:
```
"Transform the reference photo into a portrait with soft natural window light, warm golden highlights..."
```

**Решение нужно протестировать в Фазе 1** — какая формулировка лучше сохраняет identity.

### 10.3. Content Script ↔ Side Panel — протокол общения не описан

**Проблема:** Когда пользователь кликает "Steal this vibe" на странице, content script должен передать URL изображения в side panel. Документ это упоминает, но не описывает механизм.

**Решение — message passing через background:**

```typescript
// content-script.ts — при клике на кнопку
chrome.runtime.sendMessage({
  type: "STEAL_VIBE",
  imageUrl: "https://example.com/photo.jpg",
  pageUrl: window.location.href,
  pageTitle: document.title,
});

// background.ts — получает сообщение и открывает side panel
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "STEAL_VIBE") {
    // Сохранить данные для side panel
    chrome.storage.session.set({
      pendingVibe: {
        imageUrl: message.imageUrl,
        pageUrl: message.pageUrl,
        pageTitle: message.pageTitle,
      },
    });
    // Открыть side panel на текущей вкладке
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
});

// sidepanel/App.tsx — при загрузке читает данные
chrome.storage.session.get("pendingVibe", (data) => {
  if (data.pendingVibe) {
    setVibeSource(data.pendingVibe);
    chrome.storage.session.remove("pendingVibe");
  }
});
```

### 10.4. Серверный fetch изображений — CDN блокировки и SSRF

**Проблема:** `/api/vibe/extract` скачивает изображение по произвольному URL. Две критичные проблемы:

1. **CDN-блокировки:** Многие сайты (Pinterest, Instagram, Getty) блокируют серверные запросы (проверяют referer, user-agent, используют anti-bot). Скачать изображение не получится.

2. **SSRF (Server-Side Request Forgery):** Злоумышленник может передать `imageUrl: "http://169.254.169.254/latest/meta-data/"` и получить доступ к метаданным облачного сервера.

**Решение:**

**(a) Fallback: отправлять image data из content script:**

```typescript
// content-script.ts — при клике читаем изображение через canvas
async function captureImageData(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve!, "image/jpeg", 0.9));
}

// Если canvas не работает (CORS на img) → fallback на URL
```

**Важно:** `canvas.toBlob()` выбросит ошибку для cross-origin изображений без `crossorigin` атрибута. Fallback-стратегия:
1. Попробовать canvas capture (работает для same-origin и изображений с `crossorigin="anonymous"`)
2. Если ошибка → отправить URL, пусть сервер попробует скачать
3. Если сервер не смог → показать ошибку "Не удалось захватить изображение с этого сайта"

**(b) SSRF-защита на сервере:**

```typescript
// landing/src/app/api/vibe/extract/route.ts
function isUrlSafe(url: string): boolean {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  // Блокируем private ranges
  const hostname = parsed.hostname;
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    hostname.endsWith(".local")
  ) return false;
  return true;
}
```

### 10.5. API route timeout для Extract

**Проблема:** Extract выполняет 2 тяжёлых операции последовательно:
1. Скачать изображение по URL (1–5 сек)
2. Отправить в Gemini Vision + получить ответ (3–10 сек)
Итого: 4–15 секунд.

Многие хостинги (Vercel free = 10 сек, Dockhost зависит от настроек) имеют таймаут на API routes. Если Extract не успеет — 504 Gateway Timeout.

**Решение:** Сделать Extract **асинхронным** по аналогии с существующим generate → generate-process:

```
POST /api/vibe/extract
  → создаёт запись в vibes (status: "pending")
  → fire-and-forget вызов /api/vibe/extract-process
  → возвращает { vibeId }

POST /api/vibe/extract-process (internal)
  → скачивает изображение
  → вызывает Gemini Vision
  → обновляет vibes (status: "completed", style: {...})

GET /api/vibe/extract/[id]
  → polling статуса (как /api/generations/[id])
```

Или если хостинг позволяет долгие запросы (> 30 сек) — можно оставить синхронным для простоты MVP.

### 10.6. Стоимость: 3 кредита за один "vibe" — UX

**Проблема:** Каждый "Steal this vibe" создаёт 3 генерации = минимум 3 кредита (Flash). При выборе Pro = 6 кредитов, Ultra = 9 кредитов. Пользователь может не ожидать такой стоимости.

**Решение:** Обязательный UI перед запуском:

```
┌─────────────────────────────────────────┐
│  💫 Steal this vibe                     │
│                                         │
│  Будет создано 3 варианта               │
│  Модель: Flash (1 кр. × 3 = 3 кр.)     │
│  Ваш баланс: 15 кредитов               │
│                                         │
│  [Изменить модель ▾]                    │
│                                         │
│  [ ✨ Генерировать — 3 кредита ]        │
└─────────────────────────────────────────┘
```

Если баланс < нужного — кнопка неактивна, ссылка "Пополнить баланс".

---

## 11. Риски

| Риск | Вероятность | Mitigation |
|------|-------------|------------|
| Система не улавливает ключевые признаки стиля | Высокая | Multi-aspect extraction (несколько "взглядов" на картинку) |
| Результат не похож на оригинальный стиль | Средняя | 3 варианта с разными акцентами → пользователь выбирает |
| Uncanny valley при identity injection | Средняя | Начать с fashion/портретов (более forgiving) |
| CORS блокирует запросы из extension | **Высокая** | Настроить CORS до начала разработки extension (§10.1) |
| CDN блокирует серверный fetch изображений | **Высокая** | Canvas capture как primary, URL fetch как fallback (§10.4) |
| Пользователь не понимает стоимость | Средняя | Экран подтверждения с ценой перед генерацией (§10.6) |
| Extension перегружен функциями | Низкая | Extension = действие, сайт = накопление |
| Юридические риски (оригинальные фото) | Низкая | Храним только сгенерированный результат, не оригинал |

## 12. План реализации

### Фаза 0 — Подготовка инфраструктуры (0.5 дня)

1. **CORS:** Добавить CORS headers для `chrome-extension://` в landing `next.config.ts`
2. **Проверить таймауты:** Убедиться что хостинг позволяет API routes > 15 сек (или сделать async extract)
3. **SQL миграция:** Создать таблицу `vibes`

> Без CORS ни один запрос из extension не пройдёт. Делаем первым.

### Фаза 1 — Proof of Concept (1–2 дня)

1. Endpoint `/api/vibe/extract`: image URL → Gemini Vision → structured JSON
2. Endpoint `/api/vibe/expand`: JSON → 3 промпта
3. **Тест {subject} placeholder:** Какая формулировка лучше — `{subject}` → "the person in the reference photo" или без placeholder
4. Тест вручную: 10–20 fashion-фото → extract → expand → существующий `/api/generate`
5. Оценка качества: сколько из 10 дают "вау"

> Генерация уже работает — проверяем только качество extract + expand + формулировку промптов.

### Фаза 2 — MVP Extension (3–5 дней)

1. Chrome extension (Manifest V3): content script + side panel + background
2. Content script: overlay-кнопка + canvas capture + message passing к background
3. Background: приём сообщений, открытие side panel, storage.session
4. Side panel: auth check → upload → прогресс 3 генераций → 3 результата
5. Экран стоимости перед генерацией (модель + кредиты)

> Backend генерации не трогаем — extension вызывает те же API, что и сайт.

### Фаза 3 — Save as Card + Growth Loop (2–3 дня)

1. Endpoint `/api/vibe/save`: выбранный результат → карточка на PromptShot
2. Auto-tagging из structured JSON для SEO
3. Кнопка "Try this look" на карточках (переиспользует GenerationModal)
4. Таблица `vibes` + связь с `landing_generations`

### Фаза 4 — Оптимизация (ongoing)

1. Улучшение extraction (multi-aspect, несколько "взглядов")
2. A/B тесты промптов
3. Кеширование vibes (один URL → один extract, дедупликация)
4. Batch polling (один запрос на 3 генерации вместо 3 отдельных)
5. Сохранение состояния генерации в `chrome.storage.local` (переживает закрытие side panel)
6. Firefox extension
