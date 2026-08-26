# 24-08 — Analyze: снять сценарий с видео

> Дата: 2026-08-24  
> Ветка: `feature/24-08-analyze-video-scenario`  
> Статус: requirements  
> Поверхности: generate-dock (video compose), `POST /api/extension/analyze-video`

## Цель

По короткому ролику получить **готовый motion-сценарий** для уже существующего image-to-video compose — аналог `/foto-v-promt`, но video→текст, не photo→photoreal-промт.

Пользователь загружает клип → Flash описывает, **что уже происходит в кадре** → сценарий попадает в поле промпта видео, кадр 0 становится Image1. Генерацию не запускать автоматически.

Это **не** `POST /api/generate/animate-scenario`: тот **выдумывает** 1–2 предложения с фото. Здесь модель **смотрит видео** и снимает сценарий, не придумывает новый beat.

`POST /api/extension/analyze` (фото) **не менять**.

Реализация — только после checkout этой ветки от `origin/main`. Не писать код на чужой feature-ветке.

---

## 1. Context and assumptions

### 1.1 Как сейчас

| Что | Факт |
|---|---|
| Фото-analyze | `POST /api/extension/analyze`: JPEG/PNG/WebP/GIF ≤10 MB, Flash `inlineData`, abort **30 с**, 10 free / 1 кредит |
| История | `analyze_history.kind ∈ {analyze, remix}`, превью через `sharp` → JPEG |
| Сценарий «Оживить» | `POST /api/generate/animate-scenario`: фото → выдуманный RU-текст ≤400 символов, **без кредитов** |
| Video compose | Нужны **ровно одно фото** (кадр) + короткий motion-промпт. Text-only и video-from-video у провайдера запрещены |
| Worker | Умеет mp4 на выходе генерации. Gemini File API upload **нет**. На лендинге **нет ffmpeg** |
| Процесс лендинга | ~2 GiB cgroup, JSON+base64 уже тяжёлый на фото |

### 1.2 Продуктовые решения (зафиксировано)

| # | Решение |
|---|---|
| D1 | Отдельная ручка `POST /api/extension/analyze-video`. Фото-analyze, scout, remix, animate-scenario — без изменений контракта |
| D2 | Выход — **1–2 предложения на русском**, тот же лимит **400 символов**, что у animate-scenario. Не photoreal-секции, не shot-list, не CRITICAL RULES 8K |
| D3 | Канон UI v1 — **generate-dock в video-модальности**. Новой SEO-страницы и scout в v1 нет |
| D4 | После успеха: сценарий → video-промпт; кадр 0 (постер) → единственный Image1. Существующий кадр **заменяется**. `animate-scenario` **не** вызывать (перезапишет снятое) |
| D5 | Квота видео **отдельная** от фото: бакеты `video:user:{id}` / `video:{ipHash}`. 3 успешных / UTC-сутки бесплатно, дальше **2 кредита**, только авторизованный. Гость после 3 → AuthModal |
| D6 | Anonymous JWT и STV-guest = гость. Виртуальные 999 кредитов не списывать |
| D7 | Верхнего потолка на *платные* видео-анализы в v1 нет (как у фото). Стоп = баланс < 2 |
| D8 | Сутки — **UTC**, тот же window helper, что фото-analyze |
| D9 | Вход: один клип `video/mp4`, **≤10 с**, **≤8 MB**. `video_url` в v1 нет (SSRF + размер) |
| D10 | v1 **синхронный**, abort Gemini **60 с**. Async/worker — только если spike (§2.7) провален |
| D11 | Постер для истории и Image1 снимает **клиент** (canvas, frame 0). Сервер без ffmpeg. В Gemini уходит **видео**, не постер |
| D12 | Успех не стартует генерацию и не списывает 30–60 видео-кредитов |
| D13 | Один in-flight на идентичность (`pending ≥ 1` → 429 `busy`). Глобальный in-process cap **5** |
| D14 | Fail-closed: квота недоступна → 503, Gemini не звать. Fail/timeout/SAFETY → release + refund, слот успеха не жечь |

### 1.3 Вне scope

- Менять `POST /api/extension/analyze` / scout / imageprompt.tools / Extension Lite
- YouTube URL, произвольный `video_url`, HLS, MOV/WebM в v1
- Ролики с телефона 30–60 с / 50 MB, File API, ffmpeg на лендинге
- Audio-транскрипт, субтитры, shot-list, полный image-промт
- SEO-кластер «видео в промт», sitemap, JSON-LD
- Публикация `analyze_history` video-строк в `prompt_cards`
- Video-from-video у Veo/Grok (провайдер по-прежнему image-to-video)
- Подписка, отдельная валюта анализа, сутки Europe/Moscow
- Новая модерация сверх ответа Gemini SAFETY

---

## 2. Target architecture

### 2.1 Source of truth

Один серверный гейт: **`POST /api/extension/analyze-video`**.

UI не вызывает Gemini напрямую и не обходит квоту. Клиент показывает остаток и модалки по полям ответа.

`generationSurface` / pathname **не** гейтят квоту.

```
generate-dock (video)
  → client: duration/size/mime + poster JPEG
  → POST /api/extension/analyze-video
       ├─ parse video + optional poster
       ├─ identity + video-bucket
       ├─ RPC reserve (free | auth_required | no_credits | paid | busy)
       ├─ Gemini Flash + inline video/mp4
       └─ confirm / release+refund
       ▼
  { scenario, quota } | error
  → dock: upload poster как кадр, prompt = scenario
```

### 2.2 Границы

| Слой | Ответственность |
|---|---|
| Клиент dock | File picker `video/mp4`, проверка `video.duration` и size **до** сети, canvas-постер, timeout fetch 70 с, 401/402 UX |
| Route | Валидация, квота, Gemini, история, события |
| Gemini + DO-прокси | Понимание ролика. Тот же `GEMINI_PROXY_BASE_URL` / `photo_app_config.gemini_use_proxy`, что фото-analyze |
| Worker / enqueue | Не участвует в v1 |
| `animate-scenario` | Не вызывать после extract |

### 2.3 Квота

Переиспользовать `analyze_quota_reserve` / confirm / release. **Не** смешивать с фото-бакетами `user:{id}` и raw IP.

| Ключ `aiid_app_config` | Default | Смысл |
|---|---|---|
| `analyze_video_free_per_day` | `3` | Бесплатных успешных + pending / UTC-день |
| `analyze_video_credit_cost` | `2` | Кредитов сверх бесплатных |

Бакеты:

```
auth (не anonymous, не STV-guest) → video:user:{dbUserId}
иначе                             → video:{ipHash}
```

`ipHash` — тот же salted helper, что фото-analyze.

Merge гость→юзер: существующий `extension_rate_limit_merge_ip_to_user` зашивает `user:{id}` и **сольёт видео в фото-квоту**. В новой миграции — merge с префиксом `video:` (`video:{ip}` → `video:user:{id}`). Фото-merge не трогать.

Идентичность и fail-closed — как фото-analyze (ensure landing user, 503 `quota_unavailable`).

`pending ≥ 1` по video-бакету до reserve → **429 `busy`**, Gemini нет. Двойной клик не держит два ролика в памяти.

### 2.4 Gemini

| Параметр | Значение |
|---|---|
| Модель | `GEMINI_ANALYZE_VIDEO_MODEL` или `gemini-2.5-flash` |
| Вход | `inlineData` `video/mp4` + user/system extract-промпт |
| Выход | только текст сценария |
| temperature | `0.2` (extract, не invent) |
| maxOutputTokens | `256` |
| thinkingBudget | `0` |
| timeout | **60 с** |
| max chars после sanitize | `400` (`sanitizeAnimateScenario` или общий helper) |

Промпт (смысл обязателен, формулировку можно править в коде):

```
You extract a 4–10s image-to-video motion beat from the attached video.
The video is the only source of truth. Do not invent action, people, or a new camera.
The still frame 0 of this video will be the starting image. Describe only what happens FROM that frame forward.
Write 1–2 sentences in Russian.
Do not restate appearance, clothing, hair, age, or beauty.
No titles, quotes, markdown, or explanation. Return only the scenario.
```

Запрещено подмешивать `buildExtractPrompt("photoreal")` и CRITICAL RULES фото-analyze.

Пустой/SAFETY/не-текст → 422/503 как у animate-scenario, квота release.

Логи: `requestId`, host прокси, `viaProxy`, `videoBytes`, `durationMs` клиента если есть, `latencyMs`, `resultChars`. Не логировать base64 и полный proxy URL с credentials.

### 2.5 История и события

Успех (после confirm) best-effort в `analyze_history`:

- `kind = video` — расширить CHECK (`analyze` / `remix` / `video`)
- `change_request` NULL (как analyze)
- `prompt` = сценарий
- `image_path` = JPEG постера, если клиент прислал валидный poster; иначе строка **без** картинки (промт всё равно писать)
- `credits_spent` / `quota_mode` как у фото
- `client_source` — тот же `resolveClientSource` / `x-client` (страница dock: обычно `generaciya_foto` / `promptshot` / `admin`)
- `user_id` = shared db id

Сырой mp4 в bucket **не** класть.

`recordAnalyzeEvent`: `endpoint: "analyze_video"` (колонка text, enum в SQL нет). Outcomes те же + `busy`.

Админка `/admin/analyze-history` и `/analyses`: бейдж «Видео», превью постера если есть. Публикация карточки из video-строки — **не** в v1.

### 2.6 Постер и Image1

Клиент:

1. `HTMLVideoElement` + seek `0` + `canvas.toDataURL('image/jpeg', 0.85)`
2. Ресайз длинной стороны ≤1280 (как animate-scenario)
3. Шлёт `poster` вместе с видео
4. После 200 — существующий `POST /api/upload-generation-photo` (постер как обычное фото) и ставит его единственным кадром compose

Сервер:

- Постер опционален: без него сценарий всё равно считается
- Sniff JPEG/PNG/WebP, ≤1 MB, не подменять им video part в Gemini
- Если постер битый — игнорировать, не валить весь запрос

### 2.7 Spike (go / no-go) до UI

Полдня, без UI, на проде-прокси:

1. Один mp4 4 с / ≤4 MB и один 10 с / ~8 MB в Flash через тот же proxy helper, что analyze.
2. Записать p50/p95 latency, HTTP прокси, не режет ли тело.

Стоп и переход на async (storage → worker), **не** клеить UI, если:

- прокси/ingress стабильно 413 / обрыв тела ≥4–8 MB, или
- p95 Gemini **> 45 с** на клипе ≤10 с.

Результат spike — комментарий в этой спеке (числа + дата) до merge UI.

---

## 3. Scaling, reliability, security

### 3.1 Что ломается первым

| Узкое место | Порядок | Защита v1 |
|---|---|---|
| Тело запроса | 8 MB файл ≈ тот же порядок в multipart; JSON base64 ≈ 11 MB + копия в Gemini | multipart канон; JSON только запасной путь с тем же cap |
| Память лендинга | ~30 MB пик на запрос × N | D13: 1 на bucket, 5 на процесс |
| Latency | 15–45 с vs 3–8 с у фото | отдельный route и timeout; фото-analyze не делит abort 30 с |
| Токены Gemini | ~5–20× фото | 3 free, 2 кредита |
| Прокси | неизвестный `client_max_body` / read timeout | spike §2.7 |

Фото-analyze SLO не менять: p95 **<10 с**, abort 30 с.

Video-analyze v1: p95 **<45 с**, abort 60 с. Иначе 503 + release.

### 3.2 Валидация файла

Сервер (обязательно, клиент не trusted):

1. Размер decoded ≤ **8_388_608** байт. Больше → 400 `too_large`, без reserve.
2. Sniff: `ftyp` + brand `isom` / `iso2` / `mp41` / `mp42` / `avc1` / `dash`. Иначе 400 `unsupported_video`.
3. Длительность: парсер `mvhd` (timescale + duration) **без ffmpeg**. `>10.0 с` → 400 `too_long`. Нет `mvhd` → 400 `invalid_video` (не слать в Gemini «на всякий случай»).
4. Клиентский `duration_seconds` информативный, для логов. Сервер режет по `mvhd`.

MIME из заголовка не доверять.

### 3.3 Security

- Нет `video_url` / редиректов.
- Нет credentials в URL.
- SAFETY Gemini → 422, без истории, refund.
- Copyright/NSFW — как у фото, отдельную модерацию не строить (D вне scope).
- Не класть сырое видео в `analyze-history`.

---

## 4. Functional requirements

### F1. Гость, бесплатные

Пока usage < 3 в UTC-день по `video:{ip}`:

- Разбор без аккаунта.
- Кредиты 0.
- Ответ: `quota.mode=free`, `remaining_free`, `free_max=3`, `credit_cost=2`.

### F2. Гость, слоты кончились

- Gemini нет.
- **401** `auth_required`, PromptShot `AuthModal` (не imageprompt.tools).
- После входа: merge video-IP → `video:user:{id}`. Если usage ≥ 3 — сразу F4/F5, не вторая тройка.

Клиент не теряет выбранный файл и постер.

### F3. Авторизованный, бесплатные

Тот же порог 3 на `video:user:{id}` после merge.

### F4. Авторизованный, платный, баланс ≥ 2

- Hold + списать **2**.
- Успех: сценарий, `mode=paid`, `credits_charged=2`, актуальный баланс.
- UI до сабмита, если quota уже известна: «Разбор спишет 2 токена».
- После успеха — `CREDIT_BALANCE_REFRESH_EVENT`.

### F5. Авторизованный, платный, баланс < 2

- **402** `no_credits`, pricing overlay как у генерации.
- Отдельная цель Метрики `analyze_video_no_credits` (не смешивать с generate/foto-analyze).

### F6. Остаток до запроса

`GET /api/extension/analyze-video/quota` — cookie, `Cache-Control: no-store`. Те же поля, что фото-quota, со своими `free_max` / `credit_cost`.

### F7. Fail-closed и busy

- RPC/БД квоты → **503** `quota_unavailable`.
- Уже есть pending по video-бакету → **429** `busy` («Дождитесь текущего разбора»).
- In-process ≥ 5 → **503** `overloaded`.

### F8. Клиентский префлайт

До POST: не mp4 / >8 MB / `duration > 10` → ошибка в UI, сети нет, квота не трогается.

### F9. Успех в dock

1. Поле промпта = `scenario` (не generic «Оживи изображение»).
2. Постер загружен как единственный кадр; второй фото не оставлять.
3. Модальность video, выбранная video-модель не сбрасывается.
4. CTA генерации как обычно (цена 30–60). Разбор ≠ генерация.
5. Stash video-промпта = снятый сценарий, `lastScenarioKey` не должен триггерить повторный animate-scenario.

### F10. Тексты (RU)

| Ситуация | Смысл |
|---|---|
| Гость, 3 из 3 | «Бесплатные разборы видео на сегодня закончились. Войдите — дальше 2 токена за разбор.» |
| Юзер, <2 токенов | «Бесплатные разборы видео закончились. Пополните токены: разбор стоит 2 токена.» |
| Слишком длинное | «Нужен ролик до 10 секунд.» |
| Слишком тяжёлое | «Файл больше 8 МБ. Сожмите или обрежьте клип.» |
| Не mp4 | «Нужен файл MP4.» |
| Busy | «Этот разбор ещё идёт.» |
| 503 квота | «Сервис лимитов временно недоступен. Попробуйте ещё раз.» |
| Upstream / timeout | «Не удалось разобрать видео. Попробуйте другой клип.» |
| Paid успех | «Списано 2 токена» |

Не писать «безлимит». Не слать на imageprompt.tools.

---

## 5. API

### 5.1 `POST /api/extension/analyze-video`

`runtime = nodejs`. Канон — `multipart/form-data`:

| Поле | Обязательно | Ограничение |
|---|---|---|
| `video` | да | файл mp4 ≤8 MB |
| `poster` | нет | JPEG/PNG/WebP data URL или файл ≤1 MB |
| `locale` | нет | default `ru`, тот же `normalizeAnalyzeLocale` |
| `duration_seconds` | нет | число, только логи |

Запасной JSON (тот же cap, не UI-канон):

```json
{
  "video_base64": "data:video/mp4;base64,...",
  "poster_base64": "data:image/jpeg;base64,...",
  "locale": "ru",
  "duration_seconds": 6
}
```

Ровно один источник видео: multipart `video` **или** `video_base64`. Оба / ни одного → 400.

Успех 200:

```json
{
  "scenario": "Девушка медленно поворачивает голову к камере, волосы чуть колышет ветер.",
  "quota": {
    "mode": "free",
    "free_max": 3,
    "remaining_free": 2,
    "credits_charged": 0,
    "authenticated": false,
    "credit_cost": 2
  }
}
```

Поле назвать `scenario`, не `prompt` — чтобы клиенты фото-analyze не перепутали контракт.

Ошибки:

| HTTP | `error` | Когда |
|---|---|---|
| 400 | `invalid_video` / `unsupported_video` / `too_large` / `too_long` | валидация |
| 401 | `auth_required` | гость, free исчерпаны |
| 402 | `no_credits` | юзер, free исчерпаны, баланс < 2 |
| 429 | `busy` | pending того же bucket |
| 422 | `scenario_failed` | пустой/SAFETY, не retryable |
| 503 | `quota_unavailable` / `overloaded` / `upstream_failed` | квота, cap, Gemini timeout/5xx/429 |

`auth_required: true` / `no_credits: true` — как у фото-клиента.

### 5.2 `GET /api/extension/analyze-video/quota`

Cookie session, no-store. Не читать и не писать фото-бакеты.

### 5.3 Что не трогать

| Ручка | v1 |
|---|---|
| `POST /api/extension/analyze` | без изменений |
| `GET /api/extension/analyze/quota` | без изменений |
| `POST /api/scout/analyze` | без видео |
| `POST /api/generate/animate-scenario` | без изменений; dock не вызывает его после extract |
| `POST /api/generate` | без video-from-video |

---

## 6. UI / UX

Единственная поверхность v1: **generate-dock при `composeModality=video`**.

- В зоне кадра: действие «Снять сценарий с видео» (или эквивалент рядом с загрузкой фото). `input accept="video/mp4"`.
- Пока идёт разбор: тот же placeholder-паттерн, что `ANIMATE_SCENARIO_PLACEHOLDER` («Разбираю видео…»), CTA генерации disabled.
- Чип квоты video-analyze **отдельный** от фото `/foto-v-promt` (другие числа). Можно не показывать на фото-страницах.
- Флаг `video_animate_enabled` **не** блокирует extract: разбор текста дешевле генерации. Если video compose скрыт — прятать и extract (нечего сеять в Image1).
- `/foto-v-promt` и стартер «По фото» не принимают видео.

Копирайт SEO-страниц в v1 не менять.

---

## 7. Аналитика

`extension_analyze_events.endpoint = analyze_video`.

| Событие / outcome | Зачем |
|---|---|
| `success` + `quota_mode=free\|paid` | aha vs overage |
| `auth_required` | гость упёрся в 3 |
| `no_credits` | юзер упёрся в 2 токена |
| `busy` / `quota_unavailable` | давление и дыры |
| `upstream_error` + `latencyMs` | timeout vs 4xx Gemini |

Метрика: `analyze_video_{open,submit,ready,auth_required,no_credits}` — не смешивать с `generation_photo_prompt_*` и `prompt_card_generation_*`.

Admin analytics: резать `analyze_video` отдельно от `analyze` / `remix`, иначе COGS фото и видео смешаются.

---

## 8. Миграция и выкат

Порядок: **SQL → деплой landing**. Код без RPC → 503 (безопаснее, чем безлимитный Gemini).

Новая миграция (следующий свободный номер в `sql/`, не править старые):

1. `aiid_app_config`: `analyze_video_free_per_day=3`, `analyze_video_credit_cost=2`
2. `analyze_history.kind` CHECK += `video`; `change_request` valid: `video` как `analyze` (без change_request)
3. Merge IP→user с префиксом `video:` (новый RPC или `create or replace` с опциональным prefix в **новом** файле)
4. Комментарии на конфиг/RPC

Выкат:

1. Spike §2.7 на проде-прокси. Нет — стоп, правка спеки на async.
2. SQL на БД лендинга.
3. Деплой landing.
4. Чеклист §11.
5. Обновить `docs/architecture/01-landing.md` **в том же коммите**, что код (дата в шапке). Delivery unit: код + тесты + SSOT-дока.

Не деплоить worker. Env новый не обязателен (`GEMINI_ANALYZE_VIDEO_MODEL` опционален). `GEMINI_API_KEY` / `GEMINI_PROXY_BASE_URL` уже есть.

---

## 9. Риски

| Риск | Как закрываем |
|---|---|
| Смешали квоту с фото | Префикс `video:`, отдельный merge, отдельные GET quota |
| Гость сделал 3 → вошёл → ещё 3 | video-merge до reserve |
| 5+5 / STV 999 | D6, тот же `isAnalyzePaidIdentity` |
| Двойной клик = 4 кредита / 60 MB RAM | pending → 429 busy, process cap 5 |
| JSON 11 MB убивает ingress | multipart канон; spike на 8 MB |
| 30 с abort режет живые ответы | отдельный route, 60 с |
| `animate-scenario` затирает extract | F9, не вызывать после video-seed |
| `sharp` на mp4 | история только из постера |
| Чужой merge сломает фото-квоту | фото-RPC не менять поведением; prefix только video |
| Бесплатные 3 сожгут COGS | 2 кредита после 3; follow-up anti-abuse cap если жгут пакеты |

---

## 10. Тесты (обязательны в том же PR)

- Парсер: валидный ftyp+mvhd 4 с / 10 с / 10.1 с / без mvhd / jpeg-as-mp4 / 8 MB+1
- Sanitize сценария: trim, markdown strip, cap 400
- Квота (unit с моком RPC): free / auth_required / no_credits (баланс 1 < 2) / busy / чужой фото-бакет не читается
- Промпт extract не содержит photoreal-секций
- Клиентский helper: mapping 401/402/429 busy / too_long
- Merge prefix: `video:{ip}` не пишет в `user:{id}`

Браузерная приёмка dock — чеклист §11, не e2e в CI.

---

## 11. Чеклист приёмки

Spike:

- [ ] 4 с / ≤4 MB через прокси: HTTP 200, latency записана
- [ ] 10 с / ~8 MB: не 413; если p95 >45 с — async, UI не мержить

Квота:

- [ ] Гость: 3 успеха, 4-й = 401 AuthModal PromptShot, в логах нет Gemini
- [ ] Гость 3 → логин → 4-й списывает 2 кредита, не даёт ещё 3 free
- [ ] Юзер с нуля: 3 free, 4-й при балансе ≥2 списывает 2, чип −2
- [ ] Баланс 1 после free: 402 pricing, Gemini нет
- [ ] Gemini 500 после paid-hold: +2 назад, успех не засчитан
- [ ] Два параллельных POST одного юзера: один идёт, второй 429 busy
- [ ] 10 фото-analyze подряд **не** уменьшают video `remaining_free`
- [ ] STV-guest / anonymous: не списывает 999
- [ ] RPC down: 503, нет Gemini

Файл:

- [ ] 11 с mp4 → 400, сети к Gemini нет
- [ ] 9 MB → 400
- [ ] PNG как video → 400
- [ ] Клиентский префлайт 11 с не бьёт API

Dock:

- [ ] Video compose: загрузка mp4 → сценарий в промпте, кадр = постер, одно фото
- [ ] Генерация сама не стартует
- [ ] `animate-scenario` не перезаписывает сценарий
- [ ] Переключение фото↔видео не теряет снятый текст (stash)
- [ ] `/foto-v-promt` по-прежнему только фото

Админ / analyses:

- [ ] Строка `kind=video`, бейдж, `credits_spent` 0 или 2, постер если был

Доки:

- [ ] `docs/architecture/01-landing.md` в том же коммите

---

## 12. Follow-up (не блокируют v1)

1. Async + File API / worker, если spike провален или появятся ролики >10 с
2. WebM/MOV после явного allowlist
3. SEO-страница «видео → сценарий»
4. Scout-ручка для бота (свой бакет, без кредитов, жёсткий дневной cap)
5. Дневной anti-abuse cap на paid video-analyze
6. Серверный постер через ffmpeg, если появится в образе
7. Safety-настройки Gemini отдельно от фото
8. Публикация video-history в карточки

---

## 13. Оценка

| Кусок | Срок |
|---|---|
| Spike прокси | 0.5 дня |
| Ручка + парсер + квота + тесты | 2–3 дня |
| Dock UI + история/админ | 1–1.5 дня |
| **v1 целиком** | **3–5 дней** после зелёного spike |

Модель уже умеет смотреть mp4. Срок — конверт (квота, память, timeout, dock), не промпт.
