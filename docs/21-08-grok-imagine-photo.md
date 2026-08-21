# 21-08 — Grok Imagine (xAI) для генерации фото

> Дата: 2026-08-21  
> Статус: код готов; выкат: worker + landing → SQL 204  
> Ветка (когда делать код): `feature/21-08-grok-imagine-photo`

## Цель

1. Пользователь может **выбрать Grok Imagine** в пикере модели при генерации фото.
2. Если выбранная **другая** image-модель падает с ошибкой провайдера — **тот же job** один раз пробует Grok Imagine.
3. Стоимость выбора Grok Imagine — **5 кредитов**.

Не путать с уже живым video-провайдером `grok-imagine-video-1.5` («Оживить»). Это отдельная **image**-модель в том же durable job `landing_generations` / `web-generation-worker`.

---

## 1. Context and assumptions

### 1.1 Что считается данным

- Image-пайплайн уже есть: `CardInlineGeneratePanel` → `POST /api/generate` → `landing_enqueue_generation` → `processGeneration` → Gemini `generateContent`.
- Каталог моделей — JSON `landing_generation_config.models`. Стоимость списывается **на enqueue** по выбранной модели. Refund — только на terminal fail (`credits_refunded`).
- Retry сегодня: тот же `job.model`, 30/90 с jitter, до `max_attempts=3`. Safety / input / config — без retry.
- xAI-контур для video уже на worker: `XAI_API_KEY`, `XAI_BASE_URL={GEMINI_PROXY_ORIGIN}/u/api.x.ai`. `location /` Gemini не трогаем. Пустой `XAI_BASE_URL` — стоп, без fallback на `api.x.ai`.
- Официальный image-контракт xAI ([docs](https://docs.x.ai/developers/model-capabilities/images/generation)):
  - модель: `grok-imagine-image-2.0`
  - text-to-image: `POST /v1/images/generations` (sync)
  - image-to-image / edit: `POST /v1/images/edits`, до **3** входных фото
  - aspect ratios включают все наши: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`
  - resolution: **`1k` | `2k`** (нативного 4K нет)
  - quality: `low` | `medium` (default `medium`)
  - ответ: URL (временный) или `response_format=b64_json`
- Официальная цена: **$0.04 / image** для `grok-imagine-image-2.0` ([pricing](https://docs.x.ai/developers/pricing)). Старый `grok-imagine-image` = $0.02 — не берём в v1.

### 1.2 Зафиксированные продуктовые решения

| Тема | Решение |
|---|---|
| API id | `grok-imagine-image-2.0` |
| UI | **Grok Imagine** — «Альтернативная генерация xAI» |
| Дефолт пикера | Без изменений: Nano Banana (`gemini-2.5-flash-image`) |
| Кредиты за выбор Grok | **5**, как у Nano Banana / Lite |
| Фолбек | Только **с чужой image-модели → Grok**. С Grok на Gemini не ходим |
| Кредиты при фолбеке | Не списываем повторно. Pro (10) → успех Grok: **оставляем 10**. Оба провайдера упали — refund исходного списания |
| UX фолбека | Тихий: пользователь видит обычный completed. Факт фолбека — в job + логах + админке |
| Quality xAI | Всегда `medium`. Отдельный пикер не вводим |
| 4K на Grok | Clamp в **2K**. Не апскейлить sharp до 4K |
| Scope | Только **web image** job |

### 1.3 Вне scope

- Telegram-бот / `selected_model` в session бота.
- Video job и фолбек video-моделей (Grok 1.5 / Omni / Veo Lite).
- Смена дефолта пикера на Grok.
- `n>1`, negative prompt, mask-edit, Files API xAI.
- Нативный 4K у Grok.
- Показ тоста «сгенерировано через Grok» (можно добавить отдельным экспериментом).
- Отдельный тариф за 2K vs 1K.

### 1.4 Экономика (явно)

Обязательство кредита: 5 кр. = **2,5 ₽**.  
Grok Imagine 2.0: **$0.04 ≈ 3,6 ₽** при курсе 90. Выбор Grok и фолбек на Grok **чуть в минус** относительно liability. Это принято: фолбек спасает failed job и refund, прямой выбор — паритет с Flash по кредитам.

Дешевле ($0.02, `grok-imagine-image`) не берём: это не текущий Imagine 2.0.

---

## 2. Target architecture

### 2.1 Source of truth

Один image-job, один provider router в worker. Не плодить второй enqueue и не писать `if (geminiFailed)` внутри Gemini-клиента.

```
UI picker / config.models
        │
        ▼
POST /api/generate
  credits = cost(selected_model)   ← 5 если выбран Grok
  landing_generations.model = selected
        │
        ▼
web-generation-worker processGeneration
  resolveImageProvider(job)
        │
        ├─ grok-*  → xai-image (generations | edits)
        └─ иначе   → gemini generateContent
                      └─ eligible fail → тот же attempt, xai-image
                         persist fallback_used
                         дальнейшие retry только Grok
```

SSOT идентификаторов — `landing/src/lib/generation/image-options.ts` (+ зеркало в worker, как у video):

```
GROK_IMAGINE_IMAGE_MODEL = "grok-imagine-image-2.0"
isGrokImageModel(id) = id.startsWith("grok-imagine-image")
```

`isGrokVideoModel` не расширять: photo и video — разные префиксы.

### 2.2 Компоненты

| Слой | Что меняется |
|---|---|
| Config | SQL: элемент в `models` + `image_fallback_model` |
| Labels / icon | `generation-model-labels.ts`, `GenerationModelIcon` (уже есть Grok-иконка — включить для image id) |
| `GET /api/generation-config` | Модель появляется в пикере; для Grok `imageSizes` без 4K **или** UI сам прячет 4K |
| `POST /api/generate` | Валидный id из `models`; cost=5; неизвестный id → 400, не `models[0]` |
| Preferences | Можно сохранить Grok; если модель выключили — откат на default |
| Worker | `xai-image.ts` + router в `processGeneration` |
| Job row | `requested_model`, `executed_model`, `fallback_used` |
| История / админка | Показывать `executed_model`, если он есть; иначе `model` |
| Finance | Семья `grok-imagine-image` для ручного COGS; GCP-импорт Grok не увидит |

Прокcи: новые path на уже allowlisted `api.x.ai`:

```
{XAI_BASE_URL}/v1/images/generations
{XAI_BASE_URL}/v1/images/edits
```

Новый vhost не нужен. `GEMINI_PROXY_BASE_URL` не подменять.

### 2.3 Провайдерный контракт (worker)

Вход тот же: `prompt_text`, 0..N фото, optional local edit / vibe.

| Режим | xAI endpoint | Вход |
|---|---|---|
| text-only | `POST /v1/images/generations` | prompt + aspect + resolution |
| user photos / parent result / local edit / vibe | `POST /v1/images/edits` | prompt + до 3 image (data URI) |

Правила сборки:

1. Промпт — **без Gemini `[# Sources]` / IMAGE A/B тегов**. Отдельные `assembleGrokImage*Prompt` рядом с video-сборщиком. Identity/edit правила переписать коротко под Grok (preserve subject / apply only the edit).
2. `n=1`, `quality=medium`, `response_format=b64_json` (не ходить за временным URL; если URL всё же пришёл — скачать через rewrite на `XAI_BASE_URL`, как video).
3. Resolution map: `1K→1k`, `2K→2k`, `4K→2k` + лог `grok_image_size_clamped`.
4. Фото: первые **3** path; лишние отбросить + лог `grok_input_clamped`. `max_photos` Gemini (4/10) не режем глобально.
5. Timeout одного xAI-вызова: **120 с** (как Gemini). Heartbeat 30 с / lease 180 с уже продлевают lease — Gemini+Grok в одном attempt допустимы.
6. Пустые `XAI_BASE_URL` / `XAI_API_KEY`:
   - выбран Grok → `config_error`, без retry, без попытки `api.x.ai`;
   - фолбек → **пропустить** фолбек, дальше обычный retry/fail исходной ошибки.

Safety xAI (`respect_moderation=false` / policy text) → `safety_block`, `retryable=false`. Usage-guideline fee xAI ($0.05) возможна — не ретраим.

### 2.4 Фолбек — единые правила

Фолбек — **внутри того же attempt**, до `landing_retry_generation`. Не второй job, не второе списание.

**Кто может быть primary:** любая enabled image-модель, которая **не** `isGrokImageModel`.

**Eligible (провайдерный сбой):**

- HTTP 429 / 5xx
- timeout / network / parse non-JSON при 429/5xx
- пустой кадр / нет image candidate **без** safety
- `gemini_http_*`, `gemini_error` без safety/recitation/blockReason

**Не eligible:**

- `safety_block`, recitation, policy, prohibited
- `input_missing`, `config_error`, `vibe_reference_missing`
- чужой path / validation (до worker не доходят)
- shutdown / lease lost
- primary уже Grok
- `fallback_used=true` на job (второй фолбек запрещён)
- circuit open
- Grok выключен в `models` **или** нет `XAI_*`

После решения фолбека **в той же транзакции/RPC**:

```
fallback_used = true
requested_model = исходный job.model   -- если ещё null
-- job.model не затираем: это выбор пользователя
```

Следующие retry этого job идут **сразу в Grok**, без повторного Gemini (иначе платим два vendor-вызова на каждый retry).

Если Grok в фолбеке дал retryable ошибку — существующая политика 30/90, `max_attempts` без увеличения.  
Если Grok дал safety/config — terminal fail + refund исходных кредитов.

Circuit breaker (in-process на worker, без Redis):

- окно: последние 20 вызовов Grok image на инстансе;
- open, если error-rate ≥ 50% и n ≥ 8;
- half-open через 60 с;
- в open фолбек **пропускаем** (не валим выбранный Grok в пикере — прямой выбор всё ещё идёт в xAI, пока сам xAI не отвечает retryable).

### 2.5 Кредиты

| Сценарий | Списание | Refund |
|---|---|---|
| Выбран Grok, успех | 5 | нет |
| Выбран Flash/Lite (5), фолбек Grok успех | 5 | нет |
| Выбран Pro / Banana 2 (10), фолбек Grok успех | **10** (не возвращаем 5) | нет |
| Любой выбор, оба провайдера упали | как сейчас | да, исходная сумма |
| Guest / open-debug | 0 | нет |

Не делать досписание «ещё 5 за фолбек». Не менять `credits_spent` после enqueue.

### 2.6 UI

- Пункт в том же пикере, что Flash / Pro / Lite. Иконка Grok.
- При выбранном Grok: размер **1K / 2K**; 4K скрыт или disabled с подписью «до 2K».
- Стоимость на CTA: 5 кредитов; `needsCredits` считает `min(models.cost)` как сейчас.
- `/generaciya-foto` showcase подхватывает enabled-модели из конфига — отдельный хардкод не нужен, если витрина уже читает config.
- STV sidepanel сейчас хардкодит Flash/Pro — **либо** читать `/api/generation-config`, **либо** добавить третий пункт. Предпочтение: config, не второй каталог.
- Admin generate: тот же `models` JSON — Grok появится сам, если id валиден.

### 2.7 Данные

Новая миграция **`sql/204_grok_imagine-image.sql`** (не редактировать 173/177/201):

1. `UPDATE landing_generation_config` key=`models`: append

```json
{"id":"grok-imagine-image-2.0","label":"Grok Imagine","cost":5,"enabled":true}
```

Порядок: после Lite / в конце списка. Дефолт не менять.

2. `image_fallback_model` = `grok-imagine-image-2.0` (kill-switch фолбека: пустая строка или `enabled:false` у модели).

3. Колонки `landing_generations`:

```sql
requested_model text,          -- backfill = model
executed_model  text,          -- пишем на complete / terminal fail
fallback_used   boolean NOT NULL DEFAULT false
```

Enqueue: `requested_model = model`. Complete: `executed_model = фактически вызвана`.

---

## 3. Scaling and bottlenecks

Что ломается первым:

1. **Двойной vendor-вызов при инциденте Gemini.** Если Gemini 5xx массово, каждый job сразу бьёт в xAI. Circuit breaker обязателен, иначе xAI rate-limit + денежный всплеск.
2. **Синхронный Imagine 2.0 medium (10–75 с).** Конкурентность image (`WORKER_CONCURRENCY=10`, `GLOBAL_CAP=50`) не поднимаем. Фолбек удлиняет attempt — lease живёт heartbeat’ом, не увеличиваем `max_attempts`.
3. **3 фото vs 4–10 на Gemini.** Clamp, не 400: иначе фолбек «спасает» ошибку ценой нового fail.
4. **4K.** Пользователь Pro+4K после фолбека получит 2K. Это деградация качества, не ошибка. Логируем clamp.

На текущем RPS отдельная очередь / отдельный worker не нужны.

---

## 4. Reliability and SLOs

| Сигнал | Цель | Действие |
|---|---|---|
| Image completed (все модели) | без регресса текущего success-rate | fallback должен **поднять** completed, не заменить Gemini |
| `generation_fallback_used` rate | < 15% в норме | > 30% / 15 мин — смотреть Gemini 5xx |
| Grok image p95 | < 90 с | p95 > 120 с — резать quality или временно `enabled:false` |
| Fallback success | ≥ 70% от eligible | ниже — open circuit / выключить фолбек |
| Safety rate Grok | мониторинг | не ретраить, не фолбечить с safety Gemini на Grok (контент тот же) |

Логи (JSON, без prompt/base64):

- `grok_image_request_started` — model, endpoint (`generations`/`edits`), proxy host, partCount, clampedPhotos, clampedSize
- `generation_fallback_used` — from, to, errorType
- `generation_fallback_skipped` — reason (`circuit_open` / `xai_unconfigured` / `not_eligible`)
- существующие `generation_completed` / `generation_terminal_failed` + `executed_model`, `fallback_used`

Откат без деплоя:

1. `enabled:false` у `grok-imagine-image-2.0` — пункт пропадает, фолбек тоже (target disabled).
2. Очистить `image_fallback_model` — пункт остаётся, фолбек выкл.
3. Снять `XAI_*` с worker — прямой Grok → `config_error`; фолбек skip.

---

## 5. Security and compliance

- Секреты только env. Не логировать полный `XAI_BASE_URL` с credentials — host достаточно (`xaiProxyHost`).
- Не ходить на `api.x.ai` напрямую из РФ/Dockhost.
- Пользовательские фото в edits — data URI в теле, не публичный unsigned URL чужого бакета. Signed URL допустим, если TTL ≤ 15 мин (как video), но v1 проще data URI.
- Safety: не обходить Gemini-block через Grok. Eligible-фильтр это запрещает.
- Результат по-прежнему в `web-generation-results`, тот же encode/lease path — stale attempt не затирает чужой файл.

---

## 6. Evolution (без big bang)

Порядок выката — как у video, **SQL последним**:

1. Worker: `xai-image.ts` + router + колонки можно применить заранее (nullable, код пишет если есть).
2. Landing labels / icon / прятать 4K для Grok / generate-config + generate validation.
3. Env: те же `XAI_*`, что для video. Новых переменных нет.
4. SQL `204` — модель в пикере и фолбек target.
5. Смоук (allowlist / свой аккаунт):
   - прямой Grok: text-only 1K 9:16; 1 фото 2K 1:1; local edit; 4 фото (ожидаем clamp 3);
   - выбран Flash, инъекция 503 Gemini → completed через Grok, `fallback_used`, credits=5, без второго списания;
   - safety Gemini → **failed**, Grok не звали;
   - выбран Grok, xAI 500 → retry Grok, не Gemini;
   - fail обоих → refund;
   - 4K + Grok в пикере → ушло как 2K.

Откат: п.4 Reliability.

Дальше (не в этом релизе): тост фолбека, отдельная цена 2K, бот, `quality=low` если экономика не сойдётся.

---

## 7. Functional requirements

### F1. Выбор модели

Grok Imagine — enabled-элемент `models` со `cost=5`. Пикер, dock, `/generaciya-foto`, admin, STV (через config) показывают его. Default остаётся Nano Banana.

### F2. Фолбек ошибки

Если primary ≠ Grok и ошибка eligible — один вызов Grok в том же attempt. Успех → `completed`, `executed_model=grok-imagine-image-2.0`, `fallback_used=true`. Пользователь не стартует генерацию заново.

### F3. Стоимость

Выбор Grok = 5 кредитов на enqueue. Фолбек не меняет `credits_spent`.

### F4. Паритет входов

Text-only, 1..N фото (N>3 → clamp), parent/local edit, vibe (reference+subject, clamp до 3) работают на прямом Grok. Video не затрагиваем.

### F5. Наблюдаемость

Job хранит requested / executed / fallback. Логи и админ user-generations позволяют отличить «пользователь выбрал Grok» от «спасли фолбеком».

---

## 8. Checklist реализации

- [x] SSOT `GROK_IMAGINE_IMAGE_MODEL` / `isGrokImageModel`
- [x] `web-generation-worker/src/xai-image.ts` + тесты (URL, body, clamp, safety, rewrite)
- [x] Router + fallback eligibility + in-process circuit в `processGeneration`
- [x] Промпт-сборщики без Gemini-тегов
- [x] Labels, icon, спрятать 4K, generate-config
- [x] `POST /api/generate`: cost из конфига; неизвестная модель → 400
- [x] STV: config + DEFAULT_MODELS включает Grok; 4K прячется
- [x] SQL `204` (models + fallback key + колонки)
- [x] Админка / история: executed vs requested
- [x] `docs/architecture/01-landing.md` после выката
- [ ] Смоук из §6
