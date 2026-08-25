# 25-08 — Seedream 4.5 (Replicate) для генерации фото

> Дата: 2026-08-25  
> Статус: реализация (код + тесты + `01-landing.md`; флип `enabled` после прокси)  
> Ветка: `feature/25-08-seedream-45-replicate`

## Цель

Пользователь выбирает **Seedream 4.5** в пикере фото-моделей. Worker гоняет ByteDance Seedream 4.5 через **Replicate HTTP API**, все исходящие вызовы — **только через DO-прокси** (тот же vhost, что Gemini / xAI).

Не путать с Seedream 5.0 Pro (другой id, другой прайс, не в этом релизе).

---

## 1. Context and assumptions

### 1.1 Что считается данным

- Image-пайплайн: `CardInlineGeneratePanel` → `POST /api/generate` → `landing_enqueue_generation` → `processGeneration`.
- Каталог — JSON `landing_generation_config.models`. Кредиты списываются на enqueue. Refund — только terminal fail.
- Сейчас router: `grok-imagine-image*` → `xai-image.ts`, иначе Gemini; eligible fail → Grok. Этот фолбек **не меняем**.
- Worker и Dockhost в РФ. Прямой `api.replicate.com` / `replicate.delivery` с worker **запрещён** (таймаут / geo).
- Контракт DO-прокси: `{GEMINI_PROXY_ORIGIN}/u/<allowlisted-host>/...`. `location /` остаётся только Google. Чужой host под `/u/` → 403. См. `.cursor/rules/non-rf-via-do-proxy.mdc` и `docs/20-08-grok-imagine-video.md`.
- Официальный Replicate: [bytedance/seedream-4.5](https://replicate.com/bytedance/seedream-4.5/api)  
  docs: [llms.txt](https://replicate.com/bytedance/seedream-4.5/llms.txt), [HTTP](https://replicate.com/docs/reference/http).

### 1.2 Контракт Replicate (vendor)

| Поле | Значение |
|---|---|
| Model | `bytedance/seedream-4.5` |
| Submit | `POST /v1/models/bytedance/seedream-4.5/predictions` |
| Poll | `GET /v1/predictions/{id}` |
| Auth | `Authorization: Bearer $REPLICATE_API_TOKEN` |
| Sync wait | Vendor: `Prefer: wait=1..60`. **В v1 не используем** — async POST + poll (см. §3.3) |
| `prompt` | string, max 4000; BytePlus советует ≤ 600 EN words |
| `image_input` | Vendor: 0–14 URL или data URI. **Мы: только signed HTTP URL**, clamp как у входа job |
| `size` | **`2K` \| `4K` \| `custom`**. **1K нет** |
| `aspect_ratio` | наши `1:1` `4:3` `3:4` `16:9` `9:16` `3:2` `2:3`; `match_input_image` не используем в v1 |
| `sequential_image_generation` | всегда **`disabled`** |
| `max_images` | всегда **1** |
| `disable_safety_checker` | всегда **false** / не передавать |
| Output | массив URI на `replicate.delivery` |
| Цена Replicate | **$0.04 / image** (как BytePlus 4.5) |

`width` / `height` (`custom`) в v1 не используем.

### 1.3 Зафиксированные продуктовые решения

| Тема | Решение |
|---|---|
| Internal id | `seedream-4.5` |
| Replicate model | `bytedance/seedream-4.5` |
| UI | **Seedream 4.5** — «Реализм и лицо по референсу» |
| Дефолт пикера | Без изменений (Nano Banana) |
| Кредиты | **10**, как у Grok Imagine photo |
| Фолбек Gemini→Grok | Не трогаем. Seedream **не** target фолбека в v1 |
| 1K | Clamp в **2K** + лог `seedream_size_clamped` |
| 4K | Разрешён (в отличие от Grok) |
| Scope | Только web image job |
| Safety | Чекер Replicate включён. Не даём юзеру его выключить |

### 1.4 Вне scope

- Seedream 5.0 Pro / Lite, Fal, BytePlus напрямую, Volcano.
- Telegram-бот.
- Video / «Оживить».
- Смена дефолта пикера.
- `sequential_image_generation=auto`, `n>1`, mask-edit.
- Seedream как `image_fallback_model`.
- Отдельный тариф 2K vs 4K.

### 1.5 Экономика

10 кр на пакете 299/100 ≈ **29,9 ₽** выручки.  
COGS **$0.04 ≈ 3,3 ₽** (ЦБ ~83 ₽/$). Маржа нормальная.  
На Максимуме 990/500: 10 кр ≈ **19,8 ₽** vs 3,3 ₽.

Повторный POST той же job без resume = второй `$0.04` при том же списании 10 кр. Это главный cost-баг v1, не маржа пакета. См. §3.7.

### 1.6 NFR и нагрузка (явно)

Текущий режим, не «Google-scale на вырост»:

| Величина | Допущение v1 |
|---|---|
| Image RPS | ≪ 1 в среднем; пик — единицы одновременных job |
| Image concurrency | `WORKER_CONCURRENCY=10` (уже есть). **Не поднимаем**, второй очереди нет |
| Seedream доля | опция в пикере, не дефолт. Ожидаем ≪ Gemini |
| p50 / p95 latency | 2K: p50 ~20–40 с, p95 **< 90 с**; 4K: p95 **< 150 с**, hard cap **180 с** (`Cancel-After`) |
| Availability | best-effort extra model. Не часть дефолтного error budget Gemini |
| Регион worker | РФ / Dockhost → vendor **только** через DO `/u/` |
| Рост данных | 1 PNG на успех, как сейчас. Новых таблиц нет |

Если допущения сломаются (Seedream > ~30% image-слотов **и** p95 > 90 с) — не плодить микросервис. Эволюция: отдельный in-flight cap на Seedream (bulkhead), не новая очередь.

---

## 2. Прокси DigitalOcean — жёсткое правило

Как xAI, не как «опциональный VPN».

### 2.1 Куда ходить

`GEMINI_PROXY_BASE_URL` **не подменять** и не слать на Replicate.

```text
REPLICATE_API_TOKEN=...          # только env, не в git
REPLICATE_BASE_URL={GEMINI_PROXY_ORIGIN}/u/api.replicate.com
```

`GEMINI_PROXY_ORIGIN` — тот же host, что у `GEMINI_PROXY_BASE_URL`, без path.

Примеры (host в логах, не полный URL с token):

```text
{REPLICATE_BASE_URL}/v1/models/bytedance/seedream-4.5/predictions
  → https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions

{REPLICATE_BASE_URL}/v1/predictions/{id}
  → https://api.replicate.com/v1/predictions/{id}

{GEMINI_PROXY_ORIGIN}/u/replicate.delivery/...
  → https://replicate.delivery/...
```

### 2.2 Allowlist nginx (`location /u/`)

Добавить к существующему списку (`api.x.ai`, `api.openai.com`, Google hosts):

| Host | Зачем |
|---|---|
| `api.replicate.com` | submit + poll |
| `replicate.delivery` | скачать output |

Если в ответе придёт другой delivery-host (`*.replicate.delivery`) — **либо** wildcard в allowlist, **либо** rewrite только точных host’ов + fail с `config_error` на неизвестный host. Не скачивать в обход `/u/`.

Чужой host под `/u/` → 403, как сейчас.

`location /` Gemini не трогать. `resolver … ipv6=off` как у xAI.

### 2.3 Запрещено

- Хардкод `https://api.replicate.com` как единственный URL.
- Fallback на `api.replicate.com`, если `REPLICATE_BASE_URL` пуст.
- Прямой `fetch` output URL с Dockhost / локальной РФ-машины.
- Логировать полный proxy URL с credentials / token.
- Слайть `image_input` на URL вида `{наш-прокси}/u/...` — Replicate сам ходит за референсом **со своей стороны** (US). Ему нужен публичный/signed URL нашего Storage, не DO-шлюз.

### 2.4 Пустой env

| Ситуация | Поведение |
|---|---|
| Выбран Seedream, нет `REPLICATE_BASE_URL` или `REPLICATE_API_TOKEN` | `config_error`, `retryable=false`, **не** звать vendor |
| Выбран Seedream, base не содержит `/u/` (prod/worker) | `config_error` (тест может подставлять полный `/u/` fixture) |

Локальный `next dev` без прокси Seedream не гоняет.

### 2.5 Rewrite URL из ответа

Как `rewriteXaiDownloadUrl`:

1. `urls` prediction (`get` / `urls.get`) с host `api.replicate.com` → `{REPLICATE_BASE_URL}{pathname}{search}`.
2. `output[]` с host `replicate.delivery` (и разрешённые sibling) → `{GEMINI_PROXY_ORIGIN}/u/<host>{pathname}{search}`.
3. Иной host → не качать, `provider_error`.

Тесты — зеркало `xai-video.test.ts` / `xai-image.test.ts`.

---

## 3. Target architecture

### 3.1 Router

Один image-job. Новый адаптер, не второй enqueue.

```
processGeneration
  grok-imagine-image*  → xai-image
  seedream-*           → replicate-seedream.ts   // только через REPLICATE_BASE_URL
  иначе                → Gemini
                           └─ eligible fail → Grok (без изменений)
```

SSOT: `landing/src/lib/generation/image-options.ts` + зеркало в worker.

```
SEEDREAM_45_IMAGE_MODEL = "seedream-4.5"
SEEDREAM_45_REPLICATE_MODEL = "bytedance/seedream-4.5"
SEEDREAM_45_CREDIT_COST = 10
isSeedreamImageModel(id) = typeof id === "string" && id.startsWith("seedream-")
```

В v1 enabled только `seedream-4.5`. Префикс `seedream-` оставляем под 5.0 позже.

### 3.2 Компоненты

| Слой | Что меняется |
|---|---|
| DO nginx | allowlist `api.replicate.com`, `replicate.delivery` |
| Worker env | `REPLICATE_API_TOKEN`, `REPLICATE_BASE_URL` |
| Worker | `replicate-seedream.ts` + router в `processGeneration` |
| Config | SQL append в `models` |
| Labels / icon | `generation-model-labels.ts`; иконка ByteDance/Seed (не Grok) |
| `GET /api/generation-config` | пункт в пикере; для Seedream размеры **2K / 4K** (1K скрыт или клампится) |
| `POST /api/generate` | id из `models`, cost=10 |
| Preferences | можно сохранить; выключили модель — откат на default |
| История / админка | `executed_model` как у Grok |
| Finance | семья `seedream` для ручного COGS (GCP не увидит) |

### 3.3 Провайдерный контракт (worker)

Вход тот же: `prompt_text`, 0..N фото, local edit / vibe.

1. Промпт **без** Gemini `[# Sources]` / IMAGE A/B. Отдельные `assembleSeedreamImage*Prompt` (identity / apply edit), рядом с Grok-сборщиком.
2. `sequential_image_generation=disabled`, `max_images=1`.
3. Size map: `1K→2K` (clamp), `2K→2K`, `4K→4K`.
4. `aspect_ratio` = `job.aspect_ratio` (наш allowlist). Не `match_input_image`.
5. Референсы: **только signed HTTP URL** из Storage (TTL **15 мин**, как кадр Grok video). Data URI **не** в v1: юзер-фото почти всегда > 256 KB (лимит Replicate для data URL), тело попрёт через наш POST и DO-прокси. Replicate сам качает URL из US. Эти URL **не** прогонять через `/u/`.
6. Submit: `POST {REPLICATE_BASE_URL}/v1/models/bytedance/seedream-4.5/predictions`.
   - **`Prefer: wait` в v1 не ставить.** Sync-wait до 60 с держит слот воркера и nginx, а если процесс умрёт до ответа — нет `id` и retry сделает второй prediction (второй `$0.04`).
   - Сразу после 2xx взять `id`, **persist**, потом poll.
   - Заголовок **`Cancel-After: 180`** (официальный header Replicate): вендор сам отменит prediction, если мы умерли / упёрлись в дедлайн.
7. Poll: `GET` через **rewrite** `urls.get` на `REPLICATE_BASE_URL`, каждые 2–3 с, дедлайн **180 с** от момента submit (совпадает с `Cancel-After`). `starting` / `processing` — не успех.
8. `provider_operation_id` = prediction `id`. Persist **до** первого poll, через тот же `landing_save_provider_operation`, что video. Пока RPC не `true` — poll не начинать; persist fail → `retryable=true`, но см. §3.7 (без второго POST).
9. Output: первый URI → скачать **через rewrite на `/u/replicate.delivery`**. Пустой массив → `provider_error`. Лимит тела: **25 MB**; больше → `provider_error`, не ретраить как сеть.
10. HTTP timeout одного GET/POST: **20 с**. Lease image **180 с** + heartbeat **30 с** (как сейчас). Heartbeat обязан идти во время poll, иначе reaper заберёт job.
11. Safety / moderation Replicate → `safety_block`, `retryable=false`.
12. 429 / 5xx / network → retryable, политика 30/90 как сейчас. Circuit: §5.2.
13. Промпт: clamp **4000** символов (лимит Replicate). Не 400 от вендора.

### 3.4 Кредиты

| Сценарий | Списание | Refund |
|---|---|---|
| Выбран Seedream, успех | 10 | нет |
| Выбран Seedream, fail | 10 | да |
| Gemini fail → Grok | как сейчас | как сейчас |
| Guest / open-debug | 0 | нет |

Seedream в фолбек не входит — кредиты фолбека не пересчитываем.

Один job = **не больше одного** Replicate prediction. Второй POST на том же `generation_id` — дефект (двойной COGS). Retry сети после успешного submit запрещён: только poll уже сохранённого `id`.

### 3.5 UI

- Пункт в том же пикере, после Grok / в конце.
- При выбранном Seedream: **2K / 4K**. Если пользователь пришёл с prefs `1K` — показать 2K и списать как 10 кр.
- CTA: 10 кредитов.
- 4K не прячем (есть у модели).
- STV/admin: тот же `models` JSON.

### 3.6 Данные

Новая миграция **`sql/215_seedream_45_replicate.sql`** (не править 204/207):

```json
{"id":"seedream-4.5","label":"Seedream 4.5","cost":10,"enabled":false}
```

Дефолт пикера не менять. `image_fallback_model` не менять.

Колонки `requested_model` / `executed_model` / `fallback_used` уже есть. Enqueue: `requested_model = seedream-4.5`. Complete: `executed_model = seedream-4.5`.

В миграции **`enabled: false`**. Флип `true` — отдельным `UPDATE` после прокси + env + смоука (как фичефлаг в БД). Не вставлять сразу `enabled:true`.

### 3.7 Идемпотентность submit (обязательно)

Официальный `POST /v1/models/{owner}/{name}/predictions` **не** принимает наш `prediction_id` и **не** документирует `Idempotency-Key` (это Cog self-host, не Replicate cloud). Значит идемпотентность — **наша**.

```
if job.provider_operation_id:
    GET prediction  // только poll, никогда POST
else:
    POST prediction
    persist id      // landing_save_provider_operation
    if persist fail:
        // есть id в памяти — ещё раз persist; POST не повторять
        // нет id (упали до JSON) — редкое окно, один лишний $0.04; лог seedream_submit_lost
    poll
```

Reaper / рестарт воркера mid-poll: новый claim **обязан** увидеть `provider_operation_id` и пойти в GET. Тест: job с уже записанным id не вызывает POST (зеркало video).

Webhook Replicate **не** подключаем в v1: новый публичный ingress, ретраи, подпись — лишняя поверхность при нашем RPS.

---

## 4. Scaling and bottlenecks

Что ломается **первым** при росте (порядок):

1. **Слоты image-воркера.** Seedream 4K держит слот 2–3× дольше Gemini. Общий пул 10. Отдельный queue/worker **не** заводим, пока нет метрики §1.6.
2. **DO-прокси.** Каждый job: 1 POST + ~30–90 GET poll + 1 download 2K/4K (до ~10–20 MB). Allowlist/reload — hard gate: пока 403, SQL `enabled` не флипать.
3. **Двойной POST** при рестарте (§3.7) — ломает COGS раньше, чем RPS.
4. **1K → 2K.** Юзер на дефолте 1K получит 2K и тот же `$0.04`. Логируем clamp, отдельный тариф не вводим.
5. **14 рефов у вендора vs наши 4–10.** Clamp, не 400.
6. Rate limit Replicate (не публичный точный RPS). На 429 — retry 30/90 + circuit (§5.2), не параллелить retry.

Не делать в v1: второй микросервис, webhook-ingress, отдельная таблица predictions, Redis.

---

## 5. Reliability and SLOs

Seedream — **не** дефолт. Деградация: пункт в пикере `enabled:false` или circuit open → job `provider_error` / `config_error`, **без** тихой подмены на Gemini/Grok.

| Сигнал | Цель | Действие |
|---|---|---|
| Success rate (completed / started) | ≥ 80% на окне 20 job после смоука | ниже → circuit + ручной `enabled:false` |
| p95 prediction | 2K < 90 с; 4K < 150 с | hard 180 с + `Cancel-After: 180` |
| 403 `/u/` | 0 после выката allowlist | не флипать SQL, пока не 0 на смоуке |
| Двойной POST на generation_id | 0 | тест resume; лог `seedream_submit_duplicate` = P0 |
| Safety rate | наблюдать | без retry, `safety_block` |

### 5.1 Что мониторить (RED)

Счётчики (без prompt / token / URL / base64):

- `seedream_submit` / `seedream_completed` / `seedream_failed` + `errorType`
- histogram `seedream_prediction_ms`
- `seedream_size_clamped`
- `seedream_circuit_open`
- `seedream_submit_lost` (POST без persist id)
- `seedream_download_rewritten` — только output host

Логи тех же имён, плюс `seedream_prediction_poll` (`id`, `status`), `seedream_config_error`.

### 5.2 Circuit / bulkhead

Скопировать окно как `GrokImageCircuit` (20 / minN 8 / errorRate 0.5 / cooldown 60 с). Open → не POST, `retryable=true` (короткий retry после cooldown) или fail, **без** fallback на Gemini.

Bulkhead в v1: тот же image in-flight. Отдельный `inFlightSeedream` (например max 3) — только если сработает триггер §1.6.

Lease lost mid-poll: не `terminalFail` и не новый POST. Job вернётся в очередь с уже записанным `provider_operation_id`.

---

## 6. Security and compliance

| Риск | Минимум |
|---|---|
| Токен Replicate в git / логах | только env; в логах `proxyHost`, не URL с creds и не Bearer |
| Токен утёк | трата $ + генерации на нашем аккаунте. Ротация в Replicate; worker env обновить. Не логировать |
| Фото юзера уходят к Replicate / ByteDance | как у Grok: signed URL 15 мин. Не слать `/u/` URL (референс должен открываться из US без нашего прокси) |
| SSRF с worker | качать только rewrite allowlisted host (`api.replicate.com`, `replicate.delivery` + явные sibling). Иной host → не fetch |
| Data URI в `image_input` | запрет v1: раздувает POST, секреты/байты в prediction metadata |
| Safety checker | всегда вкл. Юзеру выключатель не даём |
| Промпт / PII в логах | не писать prompt, base64, signed URL |
| Публичный webhook | не открывать в v1 |
| Spend-шторм | 1 prediction / job + circuit + `Cancel-After: 180` + кредитный enqueue как сейчас |
| `REPLICATE_BASE_URL` без `/u/` на worker | `config_error`, не fallback на `api.replicate.com` |

Least privilege: отдельный Replicate token только для этого продукта, не общий «на все эксперименты».

---

## 7. Выкат

1. DO: allowlist `api.replicate.com` + `replicate.delivery`, `nginx -t && reload`.
2. Worker env: `REPLICATE_*`. Пустой base — стоп. Секреты не в git и не в чат.
3. Worker + landing. Контракт/адаптер + тесты rewrite/resume + `docs/architecture/01-landing.md` — **один delivery unit** (один коммит).
4. SQL `215` с **`enabled:false`**. Пикер молчит, `config_error` с улицы нет.
5. Смоук с allowlist-аккаунта (флаг временно true на тесте или ручной job): text-only 2K; 1 фото 2K 9:16; 4K; prefs 1K → clamp 2K; fail/refund; **рестарт воркера mid-poll → тот же prediction id, второй POST = 0**.
6. Прод-флип: `UPDATE landing_generation_config` / JSON `enabled:true` у `seedream-4.5`. Не раньше зелёного смоука прокси.

Откат: `enabled:false` у `seedream-4.5`. Прокси-хосты можно оставить.

Смоук прокси (с DO, не с РФ напрямую):

```bash
# только структура; токен не светить
curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  "$REPLICATE_BASE_URL/v1/models/bytedance/seedream-4.5"
```

Ожидаем не 403 (нет в allowlist) и не таймаут на `api.replicate.com` в обход `/u/`.

---

## 8. Checklist реализации

- [x] `isSeedreamImageModel` + labels + cost 10
- [x] `replicate-seedream.ts`: async POST (без `Prefer: wait`) → persist id → poll → download только через rewrite
- [x] `Cancel-After: 180`
- [x] resume: существующий `provider_operation_id` → только GET
- [x] тест: второй POST на ту же job не уходит
- [x] тесты rewrite (как xAI)
- [x] circuit как Grok image
- [x] 1K→2K clamp
- [x] prompt clamp 4000; refs = signed URL, не data URI
- [x] `sequential_image_generation=disabled`
- [x] SQL `215` с `enabled:false`
- [x] `docs/architecture/01-landing.md` рядом с кодом
- [ ] nginx `/u/` + `api.replicate.com` + `replicate.delivery` (+ `pbxt.replicate.delivery`)
- [ ] `REPLICATE_BASE_URL` / `REPLICATE_API_TOKEN` на worker
- [ ] смоук, затем флип `enabled:true`

---

## 9. Evolution

Не сейчас, только по метрике:

| Триггер | Следующий шаг |
|---|---|
| Seedream 5.0 | новый id `seedream-5.0`, тот же адаптер / тот же `REPLICATE_*` |
| 4K жрёт слоты | in-flight cap Seedream (max 3), не новый сервис |
| Нужен webhook | отдельная спека: публичный ingress + подпись Replicate. v1 poll достаточен |
| BytePlus напрямую | другой base/host, не этот релиз |
| Seedream как fallback Gemini | отдельное решение по кредитам/COGS, не вшивать |

## 10. Открыто до кода

1. Иконка в пикере: буква S / лого ByteDance?
2. Подпись UI ок: «Реализм и лицо по референсу»?
3. Ключ Replicate заведён — да / нет (в чат не кидать).
