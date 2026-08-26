# 25-08 — Video fallback: Veo/Omni → Grok 1.5

> Дата: 2026-08-25  
> Статус: требования  
> Ветка (когда делать код): `feature/25-08-video-grok-fallback`  
> Архитектура: [`docs/architecture/01-landing.md`](architecture/01-landing.md) — править в том же коммите, что код.

Код только после `git fetch origin main && git checkout -b feature/25-08-video-grok-fallback origin/main`. Не писать в `feature/25-08-seedream-after-grok-onto-main` и не мешать с чужим dirty WIP.

## Цель

Тот же video-job: если выбранная **не-Grok** video-модель упала — **один раз** в том же attempt зовём `grok-imagine-video-1.5`. Как текущий image-хоп Gemini → Grok (`image-fallback.ts`: eligible всё кроме `shutdown`, кредиты не пересчитываем, `fallback_used` + `executed_model`, retry сразу в Grok).

Второго video-хопа нет (нет Seedream/Kling). Primary Grok fail — terminal / retry Grok, без возврата на Veo.

Триггер: Veo 3.1 Lite `safety_block` «photorealistic children» (25.08) при дефолте Lite. Image уже фолбечит `safety_block`; video сегодня сразу `failed` + refund.

---

## 1. Context and assumptions

### 1.1 Что считается данным

- Video-job уже durable: `POST /api/generate?modality=video` → `landing_generations` → `processVideoGeneration` → Grok / Veo Lite LRO / Omni Interactions.
- Дефолт пикера: `veo-3.1-lite-generate-preview` (`DEFAULT_VIDEO_MODEL`). Grok 1.5 уже в `video_models`, cost 30.
- Списание на enqueue: Lite 15 + 0/10/20 (4/6/8 с); Omni/Grok 30 + 0/10/20/30 (4/6/8/10 с). Refund только terminal fail.
- Image-фолбек SSOT: `isImageFallbackEligible` пропускает только `shutdown`. `safety_block` **eligible**. Строка в `docs/21-08-grok-imagine-photo.md` «не фолбечить safety» — устарела, не копировать.
- Video resume: `provider_operation_id` + `landing_save_provider_operation`. Пустой id RPC **не** чистит (возвращает false). Это главный отличитель от sync image.
- `processGrokVideoGeneration` сейчас шлёт в xAI `model: job.model`. После хопа `job.model` остаётся Veo — **обязательно** подставлять id Grok, не `job.model`.
- Колонки `requested_model` / `executed_model` / `fallback_used` уже есть (SQL `204`). Новых колонок нет.
- Video lease 600 с, timeout 480 с, heartbeat 30 с, cap 2 / global 8 / per-user 1. UGC для video выкл.
- xAI video: **$0.080 / сек**. 4 с ≈ $0.32, 8 с ≈ $0.64. Прокси тот же `XAI_BASE_URL={GEMINI_PROXY_ORIGIN}/u/api.x.ai`.

### 1.2 Зафиксированные продуктовые решения

| Тема | Решение |
|---|---|
| Цепочка | не-Grok video → Grok 1.5. Один хоп. Primary Grok — без следующего vendor |
| Eligible | любая ошибка **после** вызова Veo/Omni, включая `safety_block` (дети / RAI / policy) |
| Не eligible | только `shutdown`; ошибки до submit (input / parent / crop / storage) |
| Кредиты | не пересчитываем, не досписываем. Lite 15 → успех Grok = 15 |
| UX | тихий completed. Факт — job + логи + админка (`executed_model`) |
| Кадр / длительность / 9:16 | те же, что в job. Не удлиняем 4 с |
| Промпт | тот же `prompt_text`, сборщик `assembleGrokVideoMotionPrompt` |
| Kill-switch | `video_fallback_model` пусто **или** `enabled:false` у Grok video |
| Пикер / дефолт | не менять |

### 1.3 Вне scope

- Второй video-vendor после Grok.
- Фолбек Grok → Veo.
- Менять дефолт пикера или цены.
- Обход child-safety: не ретушировать кадр, не «сделай 25 лет», не другой промпт.
- Telegram-бот.
- Env-флаг продукта (`VIDEO_FALLBACK_*`). Только БД.
- Поднимать video concurrency / lease / timeout «на всякий случай».

### 1.4 Экономика (явно)

Обязательство: 1 кр. = **0,5 ₽**.

| Primary | Списано (4 с) | COGS Grok 4 с | Комментарий |
|---|---|---|---|
| Veo Lite | 15 кр. = 7,5 ₽ | ≈ $0.32 ≈ 29 ₽ | фолбек сильно в минус |
| Omni | 30 кр. = 15 ₽ | ≈ $0.32 ≈ 29 ₽ | тоже в минус, меньше разрыв |
| Grok прямой | 30 кр. | ≈ $0.32 | как сейчас, хопа нет |

Принято так же, как Flash 5 → Seedream $0.04: спасаем failed job и refund, не выравниваем тариф. Circuit обязателен: массовый Veo 5xx не должен удвоить xAI bill.

Child-safety на Lite может быть **постоянным** % (не только инцидент 5xx). Бюджет закладывать отдельно от «Gemini лежит».

---

## 2. Target architecture

### 2.1 Source of truth

Один video-job, один router в `processVideoGeneration`. Не второй enqueue, не `if (veoFailed)` внутри `veo-video.ts`.

```
POST /api/generate  modality=video
  credits = cost(selected_model, duration)
  landing_generations.model = selected
        │
        ▼
processVideoGeneration
  resolveVideoProvider(job)
        │
        ├─ grok-* ИЛИ fallback_used+executed grok
        │     → processGrokVideoGeneration(model=grok-imagine-video-1.5)
        ├─ veo-3.1-lite*
        │     → Veo LRO
        │         └─ eligible fail → тот же attempt, Grok
        │            persist fallback_used, clear provider_operation_id
        └─ иначе Omni
              → Interactions
                  └─ то же
```

SSOT id — уже есть:

```
GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5"
isGrokVideoModel(id) = id.startsWith("grok-imagine-video")
```

Не расширять `isGrokImageModel`. Photo и video — разные префиксы, разные circuit.

### 2.2 Компоненты

| Слой | Что меняется |
|---|---|
| Config | SQL `218`: `video_fallback_model` = `grok-imagine-video-1.5` |
| Worker | `video-fallback.ts` (зеркало `image-fallback.ts`) + router в `processVideoGeneration` |
| Circuit | отдельный `grokVideoCircuit` (не `grokImageCircuit`), те же 20/8/50%/60 с |
| Job row | те же `requested_model` / `executed_model` / `fallback_used`; **сброс** `provider_operation_id` на хопе |
| `processVideoGeneration` return | как image: `{ executedModel, fallbackUsed, resultPath, rawPrompt, mimeType }` |
| `index.ts` | persist executed на complete/fail video (сейчас video complete без `executedModel`) |
| История / админка | уже читают `executed_model` — не трогать, кроме смоука |
| Landing generate | не менять списание и пикер |

### 2.3 Решение хопа

`shouldAttemptGrokVideoFallback` — копия `shouldAttemptGrokFallback` без Seedream-веток:

```
ok = false, reason:
  primary_is_grok
  already_used
  not_eligible          # только shutdown
  xai_unconfigured
  fallback_disabled     # ключ пуст / Grok video enabled:false
  circuit_open
ok = true, model = video_fallback_model
```

Primary: любая enabled video-модель, которая **не** `isGrokVideoModel` (Veo Lite и Omni).

Eligible: ошибка из Veo/Omni submit **или** poll (`safety_block`, `gemini_error`, `gemini_http_*`, `timeout`, `network_error`, RAI / empty video, `config_error` ключа Gemini).

Не eligible:

- `shutdown`
- ошибка до provider-вызова (нет кадра, parent, crop, signed URL) — в catch провайдера не попадает
- `result_upload_error` после уже скачанного mp4 — ретраим upload, не генерим Grok заново
- primary Grok
- `fallback_used=true`
- circuit open / нет `XAI_*` / kill-switch

`config_error` «нет GEMINI_API_KEY» на Omni/Veo — eligible (как image).

### 2.4 Resume и `provider_operation_id` (обязательно)

Image sync: хоп = второй HTTP. Video: после submit уже есть чужой operation id.

На решении хопа, **до** Grok submit, одним update (как `persistImageFallback`):

```
fallback_used = true
requested_model = исходный job.model   -- если ещё null
executed_model  = grok-imagine-video-1.5
provider_operation_id = null           -- иначе retry уйдёт poll-ить Veo id на xAI
-- job.model не затираем
```

`landing_save_provider_operation('')` id не чистит. Либо service-role PATCH `provider_operation_id=null`, либо новая RPC `landing_clear_provider_operation`. Предпочтение: PATCH рядом с persist fallback, без миграции RPC, если RLS/service-role уже пишет эти колонки.

Защита на входе Grok:

- если `fallback_used` и id похож на Gemini/Veo (`models/`, `operations/`) — **игнорировать**, новый submit;
- в xAI body всегда `GROK_IMAGINE_VIDEO_MODEL`, не `job.model`.

После Grok submit — обычный `landing_save_provider_operation` с xAI id. Следующий retry/resume — сразу Grok, без Veo.

Каждый vendor-хоп — **свой** `videoTimeoutMs` (480 с), не остаток после Veo. Lease живёт heartbeat (как Gemini+Grok image в одном attempt). `max_attempts` не увеличивать.

### 2.5 Кредиты

| Сценарий | Списание | Refund |
|---|---|---|
| Выбран Grok, успех | 30 + duration | нет |
| Выбран Lite (15+d), фолбек Grok успех | **15+d** | нет |
| Выбран Omni (30+d), фолбек Grok успех | **30+d** | нет |
| Оба провайдера упали | как сейчас | да, исходная сумма |
| Guest / open-debug | 0 | нет |

Не менять `credits_spent` после enqueue. Не досписывать «ещё 15 до цены Grok».

### 2.6 UI

Тихий. Пользователь видит обычный completed / обычный fail.

Админка и `/generations` уже отдают `executedModel` / `fallbackUsed`. На complete video worker **обязан** их записать — иначе после хопа в истории останется Veo.

Тост «сделано через Grok» — не в этом заходе.

### 2.7 Данные

Новая миграция **`sql/218_video_grok_fallback.sql`**. Не править 189/201/202/204/208/217.

```sql
INSERT INTO landing_generation_config (key, value, updated_at)
VALUES ('video_fallback_model', 'grok-imagine-video-1.5', now())
ON CONFLICT (key) DO NOTHING;
```

Пусто / `0` / `false` / `off` / `no` = выкл (тот же `pick()`, что image).  
`enabled:false` у пункта Grok в `video_models` = target disabled, фолбек skip; прямой выбор Grok → как сейчас `config`/400 на enqueue, если модель выключена.

Default **включён**: после SQL Lite-safety сразу идёт в Grok. Откат без деплоя — очистить ключ.

---

## 3. Scaling and bottlenecks

Что ломается первым:

1. **Двойной async poll при инциденте Veo.** Job держит video-слот (cap 2 / global 8) на время Veo + Grok, worst case ~8+8 мин. Не поднимать cap. Circuit режет лавину в xAI.
2. **COGS Lite → Grok.** При высоком % child-safety каждый «дешёвый» Lite 4 с стоит ~$0.32. Алерт по `video_fallback_used` + reason `safety_block` отдельно от 5xx.
3. **Resume-баг.** Неочищенный Veo id на Grok-retry = ложный `xai_error` / потерянный хоп. Тест: poll safety → `provider_operation_id` null → xAI submit.
4. **`job.model` в xAI body.** Без подмены id xAI получит `veo-3.1-lite-generate-preview` → 4xx, фолбек «не сработал».
5. **Lease.** Heartbeat уже продлевает 600 с от now. Не увеличивать `WORKER_VIDEO_LEASE_SECONDS` в v1; если p95 хопа > 12 мин — отдельный follow-up.

Отдельная очередь / второй worker не нужны.

---

## 4. Reliability and SLOs

| Сигнал | Цель | Действие |
|---|---|---|
| Video completed (все модели) | не хуже текущего success-rate | фолбек **поднимает** completed, не заменяет Veo |
| `video_fallback_used` rate | базовая линия после 7 дней | > 40% / 15 мин — смотреть Veo 5xx или массовый safety |
| `video_fallback_used` + `safety_block` | наблюдение | рост = больше детских/молодых лиц на Lite, не «Veo лежит» |
| Grok video p95 | < 180 с (как сейчас) | p95 > 300 с — временно пустой `video_fallback_model` |
| Fallback success | ≥ 60% от eligible | ниже — open circuit / выключить ключ |
| Grok safety после Veo safety | мониторинг | не ретраить, не крутить третий vendor |

Логи (JSON, без prompt/base64/полного proxy URL):

- `video_fallback_used` — from, to, errorType, hop=`grok`
- `video_fallback_skipped` — reason (`circuit_open` / `xai_unconfigured` / `not_eligible` / `already_used` / `primary_is_grok`)
- `video_fallback_operation_cleared` — старый id host-safe prefix (`models/` vs xai)
- существующие `video_submit` / `generation_completed` / `generation_terminal_failed` + `executed_model`, `fallback_used`, `modality=video`

Откат без деплоя:

1. `UPDATE landing_generation_config SET value = '' WHERE key = 'video_fallback_model';`
2. `enabled:false` у `grok-imagine-video-1.5` — пункт и фолбек выкл (прямой Grok тоже пропадёт).
3. Снять `XAI_*` — прямой Grok `config_error`; фолбек skip, исходная ошибка Veo.

---

## 5. Security and compliance

- Секреты только env. В логах host xAI, не URL с credentials.
- Не ходить на `api.x.ai` напрямую. Пустой `XAI_BASE_URL` — skip фолбека, не fallback на vendor-host.
- Тот же кадр и тот же пользовательский motion-текст. Не переписывать промпт и не «взрослять» лицо, чтобы пройти фильтр.
- Grok применяет свою moderation. Если тоже `safety_block` / `usage_guideline` — terminal fail + refund, без retry.
- Результат в `web-generation-results` / `{user}/{job}/{lease}.mp4` — stale attempt не затирает чужой файл.
- Фолбек не обходит запрет на сексуализацию несовершеннолетних. Это retry другого vendor на том же I2V; xAI сам режет свой policy.

---

## 6. Evolution (без big bang)

Порядок выката:

1. Worker: `video-fallback.ts` + router + clear operation id + return `executedModel`. Circuit. Тесты.
2. `index.ts`: persist executed/fallback на video complete и terminal fail.
3. SQL `218` **последним** (как image `204`/`217`) — иначе код без ключа = фолбек выкл.
4. Смоук allowlist:
   - Lite + инъекция Veo `safety_block` → completed Grok, `fallback_used`, `credits_spent` как у Lite, без второго списания;
   - Lite + Veo 503 → хоп, retryable Grok идёт в Grok, не обратно в Veo;
   - primary Grok fail → нет хопа на Veo;
   - kill-switch пустой ключ → fail исходной ошибкой;
   - resume: после хопа в БД нет Veo operation id, есть xAI id;
   - `shutdown` посреди Veo — Grok не стартуем.

В том же коммите: этот файл (checklist) + абзац в `01-landing.md` (Video provider route / Image fallback analog).

### Checklist реализации

- [ ] Ветка `feature/25-08-video-grok-fallback` от `origin/main`
- [ ] `shouldAttemptGrokVideoFallback` + тесты (safety eligible, shutdown skip, primary grok, circuit, kill-switch)
- [ ] Router + clear `provider_operation_id` + xAI `model` = Grok id
- [ ] Return/persist `executedModel` / `fallbackUsed` на video
- [ ] `grokVideoCircuit` 20/8/50%/60 с
- [ ] SQL `218` `video_fallback_model`
- [ ] `01-landing.md` в том же коммите
- [ ] Смоук safety → Grok completed без досписания
