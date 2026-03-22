# 01 — Лендинг (promptshot.ru)

> Последнее обновление: 2026-03-22 (legacy vibe chain `2c23ce94`: только `photo_app_config.vibe_legacy_prompt_chain_2c23ce94`, миграция `sql/153_*.sql`; колонка `vibes.prompt_chain` — `sql/152_*.sql`; см. `docs/22-03-stv-single-generation-flow.md`)

> UI side panel + content script: см. `docs/extension-ui-spec.md`; карта файлов и токены — `extension/DEVELOPER.md`.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| Язык | TypeScript |
| Стили | Tailwind CSS |
| Шрифт | Inter (latin + cyrillic) |
| БД / API | Supabase (service role на сервере, anon key в браузере) |
| Хостинг | Vercel |
| Аналитика | — |

---

## Структура маршрутов

```
/                       → Главная (категории + поиск)
/p/[slug]               → Карточка промта
/[...slug]              → Листинг по тегу (напр. /promty-dlya-foto-devushki, /stil/cherno-beloe)
/search                 → Поиск (клиентский)
/favorites              → Избранное (требует авторизации)
/generations            → Мои генерации (debug-only, требует auth)
/auth/callback          → OAuth callback (server-side)
```

### API Routes

| Путь | Назначение |
|------|-----------|
| `/api/search` | Текстовый поиск (`search_cards_text` RPC) |
| `/api/filter-counts` | Счётчики тегов для текущей выборки (`get_filter_counts` RPC) |
| `/api/search-card` | Карточка по ID / prefix / batch |
| `/api/search-cards` | Фильтрованный поиск (`search_cards_filtered` RPC) |
| `/api/datasets` | Список датасетов (debug) |
| `/api/set-before` | Before/after медиа |
| `/api/generation-config` | Конфиг генерации (модели, лимиты) |
| `/api/generation-prompt` | EN промпт карточки по cardId |
| `/api/upload-generation-photo` | Загрузка фото для генерации |
| `/api/upload-generation-photo/signed-url` | GET: подписанный URL превью загруженного фото (auth, path в query) |
| `/api/generate` | Запуск генерации (auth) |
| `/api/generate-process` | Внутренний: обработка генерации |
| `/api/generations` | Список генераций пользователя |
| `/api/generations/[id]` | Статус/результат генерации |
| `/api/me` | Текущий пользователь + credits |
| `/api/buy-credits-link` | Deep link в Telegram-бота для покупки web-кредитов |
| `/api/vibe/extract` | Извлечение style JSON из URL изображения (auth) |
| `/api/vibe/expand` | Один rich prompt из style JSON (auth) |
| `/api/vibe/assemble-prompt` | Пересборка финального промпта по чекбоксам grooming без LLM (auth) |
| `/api/vibe/save` | Сохранение выбранной vibe-генерации (auth) |

### Модуль генерации (debug-only)

- **Точка входа:** кнопка «Сгенерировать» на странице карточки (`/p/[slug]`), рядом с «Скопировать промпт».
- **Видимость:** только при `debugOpen` (5 кликов по логотипу в футере).
- **Flow:** Browser → POST /api/generate → создание записи → fire-and-forget fetch на /api/generate-process → Gemini через VPN proxy → результат в Storage.
- **Gemini routing:** `generate-process` читает `photo_app_config.gemini_use_proxy`; при `true` использует `GEMINI_PROXY_BASE_URL`, при `false` ходит напрямую в `generativelanguage.googleapis.com`.
- **Таблицы:** `landing_users.credits`, `landing_generations`, `landing_generation_config`.
- **Storage:** `web-generation-uploads` (входные фото), `web-generation-results` (результаты).
- **Страница:** `/generations` — «Мои генерации» (в дропдауне пользователя при debug).

### Vibe Pipeline (Steal This Vibe)

- **Extract:** `POST /api/vibe/extract` — проверяет auth, валидирует безопасный URL (SSRF guard), скачивает изображение, затем vision+JSON через выбранный LLM. **Провайдер:** `photo_app_config.vibe_extract_llm` = `gemini` | `openai` (миграция `sql/150_*.sql`, fallback env **`VIBE_EXTRACT_LLM`**, дефолт **gemini**). **Gemini:** `vibe_extract_model` → `GEMINI_VIBE_EXTRACT_MODEL` → `gemini-2.5-pro`, proxy как раньше. **OpenAI:** Chat Completions + `response_format: json_object`, картинка как `data:` URL; **`OPENAI_API_KEY`**, опционально **`OPENAI_BASE_URL`**; модель `vibe_openai_extract_model` → env **`VIBE_OPENAI_EXTRACT_MODEL`** → **`gpt-4o`**. В ответе **`modelUsed`**, **`llmProvider`**. Инструкция — `EXTRACT_STYLE_INSTRUCTION` / one-shot: **`subject_pose`** и one-shot **`prompt`** задают поворот туловища/головы **качественно** (шкала square-on → strong three-quarter / look-back), **без градусов**; сначала **FRONTAL BODY CHECK** (грудь+бёдра к камере + лицо в линзу → square-on), **WARDROBE TRAP** (off-shoulder / асимметрия декольте ≠ поворот рёбер). Expand не добавляет разворот, если JSON говорит square-on; image prefix + **POSE LOCK** не докручивают three-quarter, если A фронтальный. Поле **`environment`** — плотное описание сета; **`scene`** — сюжет/место. **`coerceStylePayload`:** как раньше.
- **Legacy extract (фиче-флаг):** при **`photo_app_config.vibe_legacy_prompt_chain_2c23ce94` = true** (ключ создаётся миграцией **`sql/153_*.sql`**, по умолчанию `false`) — vision возвращает **8 полей** как в коммите `2c23ce94` (`scene`, `genre`, `lighting`, `camera`, `mood`, `color`, `clothing`, `composition`); **`vibe_one_shot_extract_prompt`** для этого запроса **не применяется** (лог **`one_shot_ignored_due_to_legacy_chain`**). В insert: **`prompt_chain` = `legacy_2c23`** (миграция **`sql/152_vibes_prompt_chain.sql`**). Ответ: **`legacyPromptChain: true`**.
- **One-shot extract (опционально):** при `photo_app_config.vibe_one_shot_extract_prompt` = `true` — vision-вызов, ответ JSON **`{ "prompt", "grooming": { "hair", "makeup" } }`** (мин. длина только у **`prompt`**, см. **`MIN_VIBE_SCENE_PROMPT_CHARS`**). Fallback: legacy **`{ "prompt" }`** без grooming. Те же лимиты длины, что expand (**`validateVibePersistParts`**); при превышении — **400** `vibe_prompt_too_large`. В БД: **`prefilled_generation_prompt`**, **`prompt_scene_core`**, **`grooming_reference`**, **`last_monolithic_prompt`**, **`style`** из **`buildOneShotVibeStyleFromPrompt`**. Миграция колонок: **`sql/151_*.sql`**. Ответ extract: **`oneShotExtract: true`**.
- **Expand:** `POST /api/vibe/expand` — style из body или по `vibeId`. Prefilled-путь: собирает тело через **`combineVibePromptBody`** (сцена + grooming по умолчанию) из колонок vibes; при длине ≥ порога — без второго LLM. Иначе LLM JSON как one-shot (structured + legacy fallback). **`prompts[0].prompt`** = unprefixed combined body; **`finalPromptForGeneration`** = **`assembleVibeFinalPrompt`**. При успехе и **`vibeId`**: **`UPDATE`** с **`eq(id)` + `eq(user_id)`**; при ошибке БД или 0 строк — **500** `expand_persist_failed` (ответ expand не считается успешным). Превышение лимитов длины полей (см. **`validateVibePersistParts`** в `vibe-grooming-assembly.ts`) — **400** `vibe_prompt_too_large` + **`detail`**. Флаг **`vibeGroomingControlsAvailable`**: непустой **`prompt_scene_core`** и хотя бы один из hair/makeup в ref.
- **Legacy expand:** если **`vibes.prompt_chain` = `legacy_2c23`** — отдельный путь: LLM → ровно **3** `{ accent, prompt }` (lighting / mood / composition), затем **второй вызов** merge → **`mergedPrompt`** (fallback: механика / акцент lighting — см. `docs/22-03-stv-single-generation-flow.md` §11.5). **`assembleVibeFinalPrompt(..., oneShotExtractConfigEnabled=false)`**. **`vibeGroomingControlsAvailable: false`**, **`UPDATE` vibes** по сцене не выполняется. Ответ включает **`mergedPrompt`**, **`mergeModelUsed`**, **`mergeOk`**, **`mergeMs`**, **`legacyPromptChain: true`**.
- **Assemble:** `POST /api/vibe/assemble-prompt` — body **`{ vibeId, groomingPolicy: { applyHair, applyMakeup } }`**, ответ как у expand (вкл. **`prompts`**, **`finalPromptForGeneration`**). Лог **`[vibe.assemble]`**. Нет данных для сборки — **409** `assemble_requires_data`. Для **`prompt_chain` = `legacy_2c23`** — **409** **`assemble_not_applicable_legacy`** (grooming assemble не используется).
- **Pipeline spec (отладка / extension):** `GET /api/vibe/pipeline-spec` (auth) — для **`extract`** / **`expand`**: **`llmProvider`**, **`providerConfigKey`**, **`providerEnvKey`**, вложенные **`gemini`** / **`openai`** (config/env/model), **`modelUsed`**, **`instruction`**. One-shot: **`extract.oneShot`**.
- **Save:** `POST /api/vibe/save` — сохраняет выбранную completed-генерацию в `landing_vibe_saves`, связывает с `vibe_id`/`card_id`, пишет `auto_seo_tags` и, если `card_id` отсутствует, пытается автосоздать `prompt_cards` + `prompt_card_media` + `prompt_variants` из `landing_generations.result_storage_*`. После этого обогащает `prompt_cards.seo_tags` на основе `vibes.style` (через `TAG_REGISTRY`).
- **Generate:** `POST /api/generate` — по умолчанию расширение вызывает **один раз** за запуск (`prompts[0]` после expand/assemble, либо **`mergedPrompt`** из expand если поле задано). Если в панели включён флаг **`stv_triple_variant_flow`** (`localStorage` = `1` / чекбокс «Для разработчиков»), за один запуск — **до трёх** параллельных вызовов при **ровно 3** элементах в `prompts`; детали — **`docs/22-03-stv-single-generation-flow.md`**.
- **generate-process (vibe):** при `vibe_id` и **`photo_app_config.vibe_attach_reference_image_to_generation`** = `true` (дефолт в миграции `sql/147_*.sql`) сервер качает `vibes.source_image_url` и шлёт в Gemini **два** изображения с метками: `[IMAGE A]`, референс, `[IMAGE B]`, фото(а) пользователя из Storage, затем длинный текст. **Полный текст:** `GENERATE_VIBE_PREFIX_TWO_IMAGES` + `GENERATE_VIBE_JSON_IDENTITY_BRIDGE_DUAL` + expanded prompt + **`GENERATE_VIBE_TRAILING_POSE_LOCK_DUAL`** (финальный «pose lock» после сцены). Если в конфиге `false`, строка в БД отсутствует (fallback: env `VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION`, затем default on), ошибка чтения `photo_app_config`, или скачивание референса не удалось — только user + текст и **`GENERATE_VIBE_PREFIX_SINGLE_IMAGE`** + prompt + **`GENERATE_VIBE_TRAILING_POSE_LOCK_SINGLE`**. При **`vibe_one_shot_extract_prompt` = `true`**: **`GENERATE_VIBE_PREFIX_TWO_IMAGES_ONE_SHOT`** + prompt + trailing dual (без bridge и без блока про seamless/collage в префиксе) или **`GENERATE_VIBE_PREFIX_SINGLE_IMAGE_ONE_SHOT`** + prompt + trailing single — см. `assembleVibeFinalPrompt(..., oneShotExtractConfigEnabled)`. Если **`vibes.prompt_chain` = `legacy_2c23`**, **`oneShotExtractConfigEnabled`** принудительно **`false`** (независимо от глобального one-shot). Лог **`vibe_generation_layout`**: `architecture` = `dual_reference_plus_user` | `single_user_image_plus_text_only`, плюс **`oneShotExtractConfigEnabled`**, **`vibePromptChain`**, **`legacyPromptChain`**. Чтение: `getVibeAttachReferenceImageToGeneration` в `vibe-gemini-instructions.ts`.
- **Логи полного промпта:** перед вызовом Gemini `generate-process` пишет **`console.warn` `[generation.process] full_prompt_text`** с полем `text` (весь `fullPrompt`) и метаданными. Отключить: `LANDING_LOG_FULL_GENERATION_PROMPT=0` (см. `.env.example`).
- **Логи картинок в Gemini:** **`[generation.process] gemini_multimodal_images`** — `imagesSentToGemini` (роли `IMAGE_A_style_reference` / `IMAGE_B_user_subject_*` или `user_subject_*`, `storagePath`, URL превью референса, mime, bytes), плюс **`partsSequence`**.
- **Gemini routing:** при провайдере **gemini** extract/expand используют `photo_app_config.gemini_use_proxy` и `GEMINI_PROXY_BASE_URL`. OpenAI ходит на **`OPENAI_BASE_URL`** (или `https://api.openai.com/v1`) с **`Authorization: Bearer`**, proxy не используется.
- **Логи (extract/expand):** Gemini: `gemini_request` / `gemini_response` / `extract_parse_ok` | `expand_parse_ok`. OpenAI: `openai_request` / `openai_response`. Общие: **`PIPELINE_FAIL`**, `extract_pipeline_failed` / `expand_pipeline_failed` / `extract_pipeline_failed_one_shot`. При `GEMINI_VIBE_DEBUG=1` — превью текста и для OpenAI (`landing/src/lib/gemini-vibe-debug-log.ts`).
- **Extension (grooming):** блок **«Внешний вид (референс)»** (чекбоксы волосы/макияж) в UI **выше** полосы прогресса и кнопок «Сгенерировать» / «Купить кредиты». При запуске генерации: после **`expand`**, если **`vibeGroomingControlsAvailable`**, side panel **сразу** вызывает **`assemble-prompt`** с текущими чекбоксами (без паузы и без обязательного «Продолжить»). Debounced **`assemble-prompt`** остаётся для правок чекбоксов **вне** активного запуска. Прогресс и подпись primary-кнопки покрывают весь пайплайн: extract → expand → assemble (если есть) → polling **`/api/generations/:id`**. **`generate`** по-прежнему шлёт unprefixed **`prompt`** из `prompts[0]`; префикс добавляет **`generate-process`**. Детали v1 — **`docs/20-03-vibe-grooming-extension-controls.md` §3.4** (кнопка «Продолжить» — только для старых сохранённых сессий с **`awaitingContinueGenerate`**).
- **Extension (история запусков):** листинг карточек в side panel: превью по сохранённому **`resultUrl`**, чипы **модель / aspect ratio / image size**, действия **скачать** (fetch→blob при успешном CORS, иначе открытие URL), **открыть**, **промпт** (копирование в буфер + раскрытие `<details>` с текстом). Персистенция в **`chrome.storage.local`** (`stv_state_v2.runHistory`), лимит **`MAX_RUN_HISTORY`** (10): только метаданные и строки (**`prompt`**, URL), **без** бинарников; опционально **`generationId`** для возможного будущего re-sign. Записи до этого изменения без **`resultUrl`/`prompt`** показывают заглушку и disabled-кнопки.
- **Extension (прогресс):** общая полоса показывается только при **`generating` / `resuming`** или пока есть строки результата в **`queued` / `creating` / `processing`**. Расчёт: **0–50%** — этапы extract/expand/assemble по **`pipelinePrepPercent`** (на этих этапах **не** смешивают со старыми строками с прошлого запуска); **50–100%** — средний **`progress`** по строкам (polling **`/api/generations/:id`**). После завершения всех строк полоса скрывается (не залипает на 100%).

### Покупка web-кредитов через Telegram Stars

- **Endpoint:** `POST /api/buy-credits-link` (auth required).
- **Bot runtime:** обработка платежей выполняется отдельным сервисом `payment-bot` (standalone Telegram bot).
- **Если привязка уже есть:** возвращает `?start=webcredits`.
- **Если привязки нет:** создаёт OTP в `landing_link_tokens`, возвращает `?start=weblink_<otp>`.
- **Связка аккаунтов:** `landing_user_telegram_links` (1 Telegram ↔ 1 landing user).
- **Оплата:** Telegram callback `webpack_*` создаёт `landing_web_transactions`, `successful_payment` завершает транзакцию и начисляет кредиты через RPC `landing_add_credits`.
- **`TELEGRAM_BOT_LINK`:** в API нормализуется до абсолютного `https://t.me/<bot>` (можно задать полный URL, `@username` или голый username). Иначе `window.open` из sidepanel разрешал бы относительную строку как `chrome-extension://.../sidepanel/...` без перехода в Telegram.

### CORS for Extension

- API теперь обрабатывает CORS в `middleware.ts` для `chrome-extension://` origin.
- Allowlist источников формируется из `CORS_ALLOWED_ORIGINS` и `CHROME_EXTENSION_ID`.
- Поддерживается preflight (`OPTIONS`) + credentialed requests (`Access-Control-Allow-Credentials: true`).

### Extension auth (Bearer) и public-config

- **`GET /api/public-config`** — публично отдаёт `supabaseUrl` + `supabaseAnonKey` (те же `NEXT_PUBLIC_*`, что уже в браузере лендинга) для инициализации Supabase Client в расширении.
- **Route Handlers** vibe/generate/me/upload/buy-credits/generations: авторизация через `getSupabaseUserForApiRoute(request)` — если в запросе есть **`Authorization: Bearer <access_token>`**, пользователь берётся из JWT; иначе — сессия по **cookies** (как на сайте).
- Расширение: Google OAuth в отдельной вкладке, redirect на `chrome-extension://<id>/sidepanel/auth-callback.html` (URL нужно добавить в Supabase **Redirect URLs**).

### 301 редиректы карточек `/p/[slug]`

- `middleware.ts` проверяет `slug_redirects` для любого URL вида `/p/:slug`.
- При наличии записи `old_slug -> new_slug` выполняется `301` на `/p/new_slug`.
- Это покрывает как старые slug без short-id, так и slug после массового ре-тайтла карточек.

### Try This Look (карточка промта)

- Кнопка на карточке использует существующий `GenerationModal` (`GenerationContext.openGenerationModal`).
- Публичная видимость управляется флагом `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK=true`.
- Если флаг выключен, кнопка доступна только в debug-режиме (совместимо с текущим workflow).

### Статические файлы

- `sitemap.ts` — динамический sitemap (L1 теги + L2 комбинации + карточки)
- `robots.ts` — robots.txt

---

## Рендеринг и кеширование

### Стратегия: ISR (Incremental Static Regeneration)

Все основные страницы используют `revalidate = 3600` (1 час):

| Страница | Рендеринг | Кеш |
|----------|-----------|-----|
| `/` (главная) | ISR | `revalidate = 3600` |
| `/p/[slug]` (карточка) | ISR | `revalidate = 3600` |
| `/[...slug]` (листинг) | ISR | `revalidate = 3600` |
| `/search` | CSR | `robots: noindex` |
| `/favorites` | CSR | требует auth |
| `/generations` | CSR | debug-only, требует auth |

### Слои кеширования

```
┌─────────────────────────────────────────────┐
│  1. Next.js ISR Cache (revalidate=3600)     │ ← страница целиком
├─────────────────────────────────────────────┤
│  2. unstable_cache (revalidate=3600)        │ ← fetchMenuCounts (Header)
├─────────────────────────────────────────────┤
│  3. React.cache (per-request dedup)         │ ← getCardPageData (metadata + page)
├─────────────────────────────────────────────┤
│  4. loading.tsx (Suspense skeletons)        │ ← мгновенный UI при навигации
├─────────────────────────────────────────────┤
│  5. <Link prefetch> (client-side prefetch)  │ ← предзагрузка при hover
└─────────────────────────────────────────────┘
```

**Почему `unstable_cache` для меню:** Header вызывает `fetchMenuCounts`, который делает ~88 RPC-запросов `resolve_route_cards` для подсчёта карточек в каждой категории. Без кеша это 2-4 сек на каждый cold page load.

---

## Data Flow

### Главная страница

```
fetchHomepageSections(siteLang)          ← RPC get_homepage_sections
  → sections[] с фото-URL
  → buildMenuCountsFromSections()       ← без доп. запросов
  → pickDeduplicatedPhotos()
  → CategorySection[]
```

### Листинг `/[...slug]` (L1 / L2 / L3)

```
resolveUrlToTags(slugSegments)          ← route-resolver.ts
  → ResolvedRoute { tags[], level, rpcParams, canonicalPath, parentPath }
fetchRouteCards(rpcParams)              ← RPC resolve_route_cards (multi-tag)
  → RouteCard[]
expandCardGroups(cards)                 ← prompt_cards (siblings, Promise.all)
enrichCardsWithDetails(cards)           ← prompt_cards + prompt_variants
                                          + prompt_card_media
                                          + prompt_card_before_media
getSeoForRoute(route)                   ← seo-templates.ts → seo-content.ts fallback
  → h1, metaTitle, metaDescription, intro, FAQ, howTo
```

**Programmatic SEO levels:**

| Level | URL example | Резолвинг |
|-------|------------|-----------|
| L1 | `/promty-dlya-foto-devushki/` | 1 тег из TAG_REGISTRY |
| L2 | `/promty-dlya-foto-devushki/cherno-beloe/` | 2 тега из разных измерений |
| L3 | `/promty-dlya-foto-devushki/cherno-beloe/v-zerkale/` | 3 тега из разных измерений |

**Index/noindex:** L1 >= 3 карточек, L2/L3 >= 6 карточек. При noindex — canonical на родительский L1.

**L2 чипы на L1:** На L1 страницах отображаются чипы-ссылки на L2 комбинации, сгруппированные по измерениям. Данные из RPC `get_indexable_tag_combos(min_cards=6)`, фильтруются для текущего L1 тега. Чипы показывают label + количество карточек.

**Фильтрация (FilterFAB):** Плавающая кнопка справа внизу на листингах и в поиске. При нажатии открывается панель с чипсами по измерениям: Кто на фото, Стиль, Событие, Сцена. Фильтры передаются через query params (`?audience=devushka&style=portret`). На tag-страницах измерения, уже заданные URL-путём, скрыты из панели. Каталог: серверный merge `route.rpcParams` + `searchParams`, refetch при смене фильтров. **Применимые теги:** на каталоге FilterPanel запрашивает `/api/filter-counts` (RPC `get_filter_counts`); на поиске — агрегирует счётчики из загруженных карточек (`cardsForCounts`). Показываются только теги с карточками, с счётчиками (напр. «Портрет (42)»), отсортированы по убыванию count.

### Карточка `/p/[slug]`

```
getCachedCardPageData(slug)             ← React.cache(getCardPageData)
  → prompt_cards (by slug)
  → prompt_variants
  → prompt_card_media
  → prompt_card_before_media
  → siblings (same source_message_id)
getFirstTagFromSeoTags(seo_tags)        ← breadcrumb
```

### Поиск `/search`

```
SearchResults (client, infinite scroll)
  → /api/search?q=&limit=24&offset=N
  → search_cards_text (hybrid rank: FTS + trigram)
  → enrichCardsWithDetails(cards)
  → FilterFAB: фильтрация по audience/style/occasion/object (client-side по seo_tags)
```

- Пагинация детерминированная: `24 → 48 → 72` (без расширения групп в поиске).
- Ранжирование гибридное: морфология (`fts`) + fuzzy (`trigram` по `title_ru` и `prompt_text_ru`).
- Стабильная сортировка: `has_fts DESC`, затем `relevance_score`, `source_date DESC`, `id`.

---

## Ключевые компоненты

### Server Components

| Компонент | Файл | Роль |
|-----------|------|------|
| PageLayout | `components/PageLayout.tsx` | Серверный: fetchMenuCounts → HeaderClient + SidebarNav + children + Footer |
| Header | `components/Header.tsx` | Legacy серверный (заменён PageLayout) |
| Footer | `components/Footer.tsx` | Статический |
| CardPage | `app/p/[slug]/page.tsx` | Серверный, SSR карточки |

### Client Components

| Компонент | Файл | Роль |
|-----------|------|------|
| HeaderClient | `components/HeaderClient.tsx` | Тонкий sticky header: логотип + SearchBar + UserMenu |
| SidebarNav | `components/SidebarNav.tsx` | Сквозной левый sidebar (desktop sticky, mobile FAB+slide-over): accordion-секции, подсветка активного URL |
| PromptCard | `components/PromptCard.tsx` | Карточка в листинге |
| GroupedCard | `components/GroupedCard.tsx` | Группа split-карточек |
| CardPageClient | `components/CardPageClient.tsx` | Клиентская часть карточки |
| PhotoCarousel | `components/PhotoCarousel.tsx` | Карусель фото |
| CardFilters | `components/CardFilters.tsx` | Debug-фильтры (FilterableGrid) |
| CatalogWithFilters | `components/CatalogWithFilters.tsx` | Листинг + FilterFAB, useListingFilters |
| FilterFAB | `components/FilterFAB.tsx` | Плавающая кнопка фильтров, передаёт rpcParams в FilterPanel |
| FilterPanel | `components/FilterPanel.tsx` | Панель с чипсами, при rpcParams — fetch filter-counts, только применимые теги с счётчиками |
| FilterChips | `components/FilterChips.tsx` | Строка чипсов для одного измерения |
| HomeSearch | `components/HomeSearch.tsx` | Поиск на главной |
| ReactionButtons | `components/ReactionButtons.tsx` | Like/dislike |
| FavoriteButton | `components/FavoriteButton.tsx` | Избранное |
| CopyPromptButton | `components/CopyPromptButton.tsx` | Копирование промта |
| AuthModal | `components/AuthModal.tsx` | Модалка авторизации |
| DebugFAB | `components/DebugFAB.tsx` | Debug-панель |

OAuth completion: `AuthProvider` завершает `code -> session` на клиенте через `exchangeCodeForSession()` и очищает auth-параметры из URL.

---

## SEO

### Метаданные

- **Root layout:** дефолтный title + description
- **Главная:** canonical, JSON-LD `CollectionPage`
- **Листинг L1:** `generateMetadata` → title/description из `getSeoContent(tag.slug)`
- **Листинг L2/L3:** `generateMetadata` → title/description из `getSeoForRoute(route)` (шаблоны)
- **JSON-LD:** `BreadcrumbList` + `FAQPage` на всех листингах
- **Index/noindex:** L1 >= 1 карточки, L2/L3 >= 6 карточек
- **Карточка:** `generateMetadata` → OpenGraph, Twitter, `noindex` для thin/secondary карточек
- **Поиск:** `robots: { index: false }`

### Tag Registry (`src/lib/tag-registry.ts`)

```typescript
interface TagEntry {
  slug: string;
  dimension: "audience_tag" | "style_tag" | "occasion_tag" | "object_tag" | "doc_task_tag";
  labelRu: string;
  labelEn: string;
  urlPath: string;       // e.g. "/stil/cherno-beloe"
  patterns: RegExp[];    // для regex-матчинга промтов
}
```

Функции: `findTagByUrlPath`, `findTagBySlug`, `findTagByLastSegment`, `getAllTagPaths`, `getFirstTagFromSeoTags`, `getSiblingTags`.

Индексы: `byUrlPath` (полный путь), `bySlug` (dimension:slug), `byLastSegment` (последний сегмент URL → кандидаты для L2/L3).

### Route Resolver (`src/lib/route-resolver.ts`)

Парсит `slug[]` из `[...slug]` маршрута в `ResolvedRoute`:

```typescript
type ResolvedRoute = {
  tags: TagEntry[];        // 1..3 распознанных тега
  level: 1 | 2 | 3;
  rpcParams: { audience_tag, style_tag, occasion_tag, object_tag, doc_task_tag };
  canonicalPath: string;   // нормализованный URL
  parentPath: string | null;
  primaryTag: TagEntry;
};
```

Алгоритм: сначала `findTagByUrlPath(fullPath)` (L1), затем поиск splitAt с `findTagByLastSegment` (L2/L3).

### SEO Content (`src/lib/seo-content.ts`)

Статическая карта `slug → SeoContent` для L1 тегов:
- `h1`, `metaTitle`, `metaDescription`
- `intro` (текст для страницы)
- `faqItems` (FAQ для Schema.org)
- `howToSteps` (HowTo для Schema.org)

**Синхронизация с реестром:** у каждого уникального `slug` из `TAG_REGISTRY` должна быть запись в `seo-content.ts`. Шаблон для новых slug строится в `seo-content-from-tag.ts`; скрипт `npm run seo:sync` дописывает недостающие блоки в конец объекта `SEO`, `npm run seo:check` падает с кодом 1 при пропусках (удобно для CI). Кураторские страницы можно править вручную в том же файле — повторный `--write` не перезаписывает существующие ключи.

### SEO Templates (`src/lib/seo-templates.ts`)

Шаблонная генерация SEO-контента для L2/L3:
- Приоритет: контент из `seo-content.ts` (L1 по `primaryTag.slug`) → шаблон по паре измерений → generic fallback
- Шаблоны для всех пар измерений (audience+style, audience+occasion, style+object и т.д.)
- Шаблонные `metaTitle` для fallback-страниц приведены к единому формату: `... — Nano Banana, ИИ-генератор | Бесплатно 2026`
- JSON-LD: `BreadcrumbList` + `FAQPage` на всех листингах

---

## Таблицы БД (чтение)

| Таблица | Что читает лендинг |
|---------|-------------------|
| `prompt_cards` | Основные карточки (slug, title, seo_tags, is_published, ...) |
| `slug_redirects` | Карта 301 редиректов старых slug на новые |
| `prompt_variants` | Тексты промтов (prompt_text_ru, prompt_text_en) |
| `prompt_card_media` | Фото (storage_bucket, storage_path, is_primary) |
| `prompt_card_before_media` | Before/after фото |
| `card_reactions` | Лайки/дизлайки (через supabase-browser) |
| `card_favorites` | Избранное (через supabase-browser) |
| `vibes` | Сохранённые extracted style JSON для Steal This Vibe |
| `landing_generations` | История web-генераций (добавлена связь `vibe_id`) |
| `landing_vibe_saves` | Сохранённые выборы пользователя по vibe-генерациям (`vibe_id`, `card_id`, `auto_seo_tags`) |
| `landing_user_telegram_links` | Привязка web-пользователя к Telegram (`landing_user_id` ↔ `telegram_id`) |
| `landing_link_tokens` | Одноразовые OTP для deep-link привязки (TTL 10 мин) |
| `landing_web_transactions` | Платежи web-кредитов через Telegram Stars |

### RPC

| RPC | Назначение |
|-----|-----------|
| `resolve_route_cards` | Карточки по тегам (листинг + меню) |
| `get_filter_counts` | Счётчики тегов для текущей выборки (FilterPanel) |
| `get_homepage_sections` | Секции главной |
| `search_cards_filtered` | Фильтрованный поиск |
| `search_cards_text` | Полнотекстовый поиск |
| `landing_add_credits` | Начисление кредитов в `landing_users.credits` после web-оплаты |

---

## Типы

```typescript
// supabase.ts
RouteCard, RouteCardsResult, HomepageCardRaw, HomepageSectionItemRaw,
HomepageSectionItemWithUrls, PhotoMeta, PromptCardFull, CardPageSibling, CardPageData

// tag-registry.ts
Dimension, TagEntry

// route-resolver.ts
ResolvedRoute

// seo-templates.ts
(uses SeoContent from seo-content.ts)

// menu.ts
MenuItem, MenuGroup, MenuSection, RouteParams

// seo-content.ts
SeoContent
```

---

## Файловая структура

```
landing/src/
├── app/
│   ├── layout.tsx              ← Root layout (Inter, AuthProvider, DebugProvider)
│   ├── page.tsx                ← Главная
│   ├── globals.css
│   ├── sitemap.ts
│   ├── robots.ts
│   ├── [...slug]/
│   │   ├── page.tsx            ← Листинг по тегу (ISR)
│   │   └── loading.tsx         ← Skeleton
│   ├── p/[slug]/
│   │   ├── page.tsx            ← Карточка (ISR)
│   │   └── loading.tsx         ← Skeleton
│   ├── search/
│   │   ├── page.tsx
│   │   └── SearchResults.tsx
│   ├── favorites/
│   │   ├── page.tsx
│   │   └── FavoritesContent.tsx
│   ├── auth/callback/route.ts
│   └── api/
│       ├── search/route.ts
│       ├── search-card/route.ts
│       ├── search-cards/route.ts
│       ├── datasets/route.ts
│       └── set-before/route.ts
├── components/                 ← UI-компоненты (см. таблицу выше)
├── scripts/
│   └── sync-seo-content.ts     ← npm run seo:sync / seo:check
├── lib/
│   ├── supabase.ts             ← Серверный клиент + data fetching
│   ├── supabase-browser.ts     ← Браузерный клиент (auth, reactions)
│   ├── supabase-server-auth.ts ← Серверная авторизация
│   ├── tag-registry.ts         ← Реестр SEO-тегов (5 измерений, 100+ тегов)
│   ├── route-resolver.ts       ← Резолвинг URL → теги (L1/L2/L3)
│   ├── seo-templates.ts        ← Шаблонный SEO для L2/L3
│   ├── seo-content-from-tag.ts ← Шаблон L1 из TagEntry (npm run seo:sync)
│   ├── seo-content.ts          ← SEO для L1 (кураторский + автодобавленный)
│   └── menu.ts                 ← Структура меню
├── context/
│   ├── AuthContext.tsx          ← Контекст авторизации
│   └── CardInteractionsContext.tsx
├── hooks/
│   └── useUserInteractions.ts
└── middleware.ts
```

---

## Env Variables

| Переменная | Где используется |
|-----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Браузерный клиент |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Браузерный клиент |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный клиент |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, OG |
| `GEMINI_API_KEY` | Gemini вызовы в `generate-process`, `vibe/extract`, `vibe/expand` |
| `GEMINI_PROXY_BASE_URL` | Прокси-маршрутизация Gemini при `gemini_use_proxy=true` |
| `photo_app_config.vibe_extract_model` | ID модели Gemini для `/api/vibe/extract` (дефолт `gemini-2.5-pro`, см. `sql/148_*.sql`) |
| `photo_app_config.vibe_expand_model` | ID модели для `/api/vibe/expand` (дефолт `gemini-2.5-flash`) |
| `GEMINI_VIBE_EXTRACT_MODEL` | Fallback, если строка в `photo_app_config` пуста или чтение не удалось |
| `GEMINI_VIBE_EXPAND_MODEL` | То же для expand |
| `GEMINI_VIBE_DEBUG` | `1` / `true` — расширенные логи Gemini для vibe extract/expand |
| `photo_app_config.vibe_attach_reference_image_to_generation` | `true` / `false` — слать пиксели референса в web image-gen (ключ в БД, см. `sql/147_*.sql`) |
| `VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION` | Fallback, если строка в `photo_app_config` недоступна или пуста (`0` = выкл.) |
| `LANDING_LOG_FULL_GENERATION_PROMPT` | `0` — не логировать полный текст в `generate-process` |
| `CORS_ALLOWED_ORIGINS` | CSV allowlist origins для CORS API |
| `CHROME_EXTENSION_ID` | Extension ID для `chrome-extension://` CORS origin |
| `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK` | Публичная кнопка `Try this look` на `/p/[slug]` |
| `TELEGRAM_BOT_LINK` | `https://t.me/...`, `@bot` или `bot` — нормализуется до абсолютного URL для `/api/buy-credits-link` |
