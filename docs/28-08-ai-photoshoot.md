# 28-08 — AI-фотосессия: 4 позы в одном кадре

> Дата: 2026-08-28  
> Ветка: `feature/28-08-ai-photoshoot`  
> Статус: код на `feature/28-08-ai-photoshoot`; флаг `photoshoot_enabled=false`  
> Поверхности: generate-dock result chrome (`CardInlineGeneratePanel` + `GenerationResultActionRail`), `/generations` → `seedCompletedResult`

## Цель

После готового **фото** пользователь одним тапом снимает **мини-фотосессию**: профессиональный фотограф (vision LLM) придумывает 4 разных позы/движения, image-модель рисует их **одним job** как лист 2×2. Цена — **10 кредитов**. Исходник — то фото, что на экране.

Это не «Камера» (там поза lock, крутится viewpoint), не remix («Что изменить»), не «Оживить», не SEO-кластер `/promty-dlya-ii-fotosessii`.

Реализация — только на ветке `feature/28-08-ai-photoshoot` от `origin/main`. Не писать код на чужой feature-ветке и не мешать с WIP `promty-dlya-ii-fotosessii`.

---

## Продуктовые решения (зафиксировано)

| # | Решение |
|---|---|
| D1 | Один `POST /api/generate`, один enqueue, **один** result, **10 кредитов** |
| D2 | Модель рисует **2×2 contact sheet** на холсте исходника, снапнутом в `1:1` / `16:9` / `9:16`. Worker режет 4 JPEG sidecar (`photoshoot_tile_paths`, SQL `225`). Лист — внутренний артефакт (Storage / re-cut), **пользователю не показываем и не отдаём**. API/UI/UGC/скачивание — только 4 кадра. Спеки `docs/28-08-ai-photoshoot-split.md`, `docs/28-08-ai-photoshoot-aspect.md` |
| D3 | Planner — Gemini **vision** в **worker** (не в Next API). Роль: professional photographer. Ответ: **EN JSON**, 4 шота |
| D4 | Все 4 позы I2I от **одного** исходного jpeg (фото на экране). С готовой фотосессии кнопка остаётся: source = выбранный кадр, не лист 2×2. Лист без тайлов по-прежнему 400 `photoshoot_from_sheet` (SQL `226`) |
| D5 | Intent `edit_kind=photoshoot`. Не reuse local-edit (запрещает менять позу) и не camera-orbit (лочит взгляд/позу) |
| D6 | Флаг `photoshoot_enabled` (default **false**) + тот же internal allowlist, что у video/orbit (`azarov.maxim@gmail.com` + `NODE_ENV=development`) |
| D7 | Модель кадра = `photoshoot_model` (дефолт `grok-imagine-image-2.0`, 10 кр). Пикер в оверлее скрыт. Чужой/выключенный id → 503, не Flash |
| D8 | Кнопка только после **completed image**. На video нет |
| D9 | С готового листа «Оживить» / «Камера» в v1 **выключены** (2×2 как source ломает оба) |
| D10 | Клиент не пишет сценарии и не зовёт Gemini. `prompt_text` сервер ставит сам (`PHOTOSHOOT`) |
| D11 | Новой SEO-страницы нет. Не путать с `/promty-dlya-ii-fotosessii` |
| D12 | Копирайт: «4 кадра одной съёмки», не «4 отдельные генерации» и не пакет 40 кредитов |
| D13 | `/generations`: одна карточка = сетка 4 кадров + шильд «Фотосессия». Клик открывает обычный result chrome на кадре 1 + rail + плёнка. 4 URL идут в `seedCompletedResult` сразу из списка, без второго `GET /generations/:id` на плёнку |
| D14 | Клик «Сделать фотосессию» не ставит job. Правый rail: креативность 0–100 (50 = temp 0.5, 100 = temp 2.0) + «Выйти» + «Создать ИИ фотосессию». Temp в `edit_instruction`; worker передаёт в planner и меняет brief (низкий = близко к позе, высокий = смелые позы). Картинка-модель temp не видит |

---

## 1. Context and assumptions

### 1.1 Как сейчас

| Что | Факт |
|---|---|
| Result rail | `Посмотреть` / `Скачать` / `Повторить` / `Оживить` / `Камера` / `Что изменить` — `GenerationResultActionRail`, справа внизу |
| «Камера» | `editKind=camera_orbit`, 1 job / 10 кр, I2I от scene root, **поза lock** |
| «Что изменить» | remix text (`/api/prompt-remix`) → local_edit, **keep camera/pose** |
| «Оживить» | `modality=video`; рядом уже есть `/api/generate/animate-scenario` (vision→текст), но это не очередь |
| Очередь | 1 row `landing_generations` = 1 result. `landing_enqueue_generation` уже принимает `p_edit_kind` (SQL `213`) |
| CHECK | `edit_kind IN ('local_edit', 'camera_orbit')` — photoshoot не пройдёт без миграции |
| Кредиты | списание на enqueue, refund только terminal fail |
| Не-РФ API | только DO-прокси |
| Лендинг | ~2 GiB cgroup; долгий vision+image в API route не кладём |

### 1.2 Вне scope

- 4 отдельных image-job / 40 кредитов (это **v2**, если 2×2 не удержит лицо)
- Telegram-бот, STV, Extension Lite
- SEO-кластер «промты для ИИ фотосессии»
- Автокритик «лицо поехало»
- Смена модели / aspect / quality в оверлее
- Photoshoot с video-результата
- «Оживить» / «Камера» с листа 2×2
- Отдельная валюта / скидка за пачку
- Хранить 4 jpeg в Storage в v1

---

## 2. Target architecture

### 2.1 Source of truth

Один серверный гейт: существующий **`POST /api/generate`** с `editKind=photoshoot` + `parentGenerationId`. UI не собирает промпт и не зовёт planner.

```
result chrome
  → rail «Сделать фотосессию»
  → правый rail: Креативность + Выйти + «Создать ИИ фотосессию»
  → POST /api/generate
       editKind=photoshoot
       parentGenerationId=<displayed>
       plannerTemperature=<0..1>
  → API
       ├─ флаг / allowlist
       ├─ parent = owned completed image, не photoshoot и не video
       ├─ busy? 409 photoshoot_busy
       ├─ model + 10 кр = photoshoot_model
       └─ landing_enqueue_generation
            parent=displayed, edit_kind=photoshoot,
            prompt_text=PHOTOSHOOT, edit_instruction=PHOTOSHOOT,
            vibe_id=NULL
  → worker (один job)
       1. Vision planner → 4 EN shots (JSON)
       2. UPDATE photoshoot_plan
       3. assemblePhotoshootSheetPrompt(shots)
       4. I2I от jpeg родителя
       5. JPEG 2×2 → Storage
  → child completed
  → UI режет 2×2 на 4 тайла (object-position TL/TR/BL/BR)
```

Planner в worker: пользователь сразу видит generating; таймаут/ретрай уже есть; лендинг не держит vision 10–20 с.

Аналог `/api/generate/animate-scenario` **не** копировать в отдельный HTTP до enqueue: там planner до video-compose и не списывает кредиты. Здесь план — часть оплаченного job.

### 2.2 I2I source

| На экране | Можно? | I2I input |
|---|---|---|
| Обычное фото / remix / орбит | да | этот jpeg |
| Video | нет, кнопки нет | — |
| Уже photoshoot (лист 2×2) | нет, 400 `photoshoot_from_sheet` | — |
| Parent pending | 409 `parent_not_ready` | — |

Не сводить к camera-orbit `scene_root_id`. Фотосессия снимает **того человека, которого видит пользователь сейчас**, включая орбит-ракурс.

`vibe_id` у child **NULL**.

### 2.3 Данные

Новая миграция **`sql/224_ai_photoshoot.sql`**. Старые SQL не трогать. Enqueue RPC **не** копировать, если на проде уже сигнатура из `213` с `p_edit_kind`.

```sql
ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_edit_kind_valid,
  ADD CONSTRAINT landing_generations_edit_kind_valid
    CHECK (edit_kind IS NULL OR edit_kind IN ('local_edit', 'camera_orbit', 'photoshoot'));

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS photoshoot_plan jsonb;

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_photoshoot_complete,
  ADD CONSTRAINT landing_generations_photoshoot_complete
    CHECK (
      edit_kind IS DISTINCT FROM 'photoshoot'
      OR (
        parent_generation_id IS NOT NULL
        AND edit_instruction IS NOT NULL
      )
    );

CREATE INDEX IF NOT EXISTS idx_landing_generations_photoshoot_active
  ON public.landing_generations(requester_auth_user_id)
  WHERE edit_kind = 'photoshoot'
    AND status IN ('pending', 'processing');

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  ('photoshoot_enabled', 'false', now()),
  ('photoshoot_model', 'grok-imagine-image-2.0', now())
ON CONFLICT (key) DO NOTHING;
```

`photoshoot_plan` пишет **worker** после planner, не API. На enqueue колонка NULL — это ок.

Poll `GET /api/generations/:id` отдаёт `editKind`, `photoshootPlan` (когда есть), `parentGenerationId`, `photoshootTileUrls`. `resultUrl` для photoshoot — **первый кадр**, не лист. URL листа в клиент не отдаём.

### 2.4 Planner (vision, EN)

Вход: jpeg родителя (resize ≤1280 по длинной стороне, как animate-scenario) + system.

Модель planner: `gemini-2.5-flash` (или тот же id, что animate-scenario). `thinkingBudget: 0` + `responseSchema` + `maxOutputTokens: 2048` (`PHOTOSHOOT_PLANNER_PROMPT_V2`). Thinking Flash при 1024 токенах съедает бюджет — parse fail + refund. Только через `GEMINI_PROXY_BASE_URL`. Пустой proxy → `config_error`, refund, не прямой Google.

Роль: professional photographer. Язык выхода: English only.

Схема (zod/ручная валидация, не «почти JSON»):

```json
{
  "theme": "golden hour rooftop editorial",
  "shots": [
    { "i": 1, "pose": "...", "motion": "...", "lens": "85mm, waist-up" },
    { "i": 2, "pose": "...", "motion": "...", "lens": "..." },
    { "i": 3, "pose": "...", "motion": "...", "lens": "..." },
    { "i": 4, "pose": "...", "motion": "...", "lens": "..." }
  ]
}
```

Правила в system:

- ровно 4 шота, индексы 1–4
- поза и motion **не повторяются** (стоя / шаг / поворот корпуса / рука / вес на другой ноге)
- лицо, тело, одежда, локация, свет — как на референсе
- не все 4 смотрят в камеру одним взглядом
- без текста на кадрах, без описания Polaroid-рамок (рамку задаёт sheet-промпт)
- parse fail → 1 retry → job fail + refund

Токены planner **не** в кредитах пользователя.

Промпт версионировать в коде: `PHOTOSHOOT_PLANNER_PROMPT_V1`. Лог: model id, `viaProxy`, schema ok/fail — без полного jpeg.

### 2.5 Image prompt (sheet)

Новый assembler `assemblePhotoshootSheetPrompt` в `landing/src/lib/image-generation-prompt.ts` (+ Grok/Seedream-обёртки по тому же правилу, что orbit).

**Запрещено** кормить photoshoot в `assembleLandingCardEditPrompt` / `assembleCameraOrbitEditPrompt` / `assembleGrokImageEditPrompt` — они лочат позу или камеру.

Смысл sheet-промпта:

- output = ровно одна фотография, **строго 2×2**, 4 отдельных снимка
- один человек с референса
- panel 1 TL / 2 TR / 3 BL / 4 BR = shots из плана
- MUST CHANGE: поза и движение в каждой клетке
- LOCK: identity, wardrobe, set, lighting, time of day
- без подписей, стрелок, Polaroid-рамок, watermark
- без склейки двух тел в одну клетку

Gemini system instruction (отдельная, не orbit):

```
You are shooting a four-frame photoshoot from the attached reference.
Output one photorealistic 2x2 contact sheet. Never return the input crop unchanged.
```

`resolveImageEditMode`: `photoshoot` определяется по `edit_kind` **или** префиксу `PHOTOSHOOT` в `edit_instruction` (как orbit страхуется префиксом).

Aspect / size = как у родителя. 2×2 из 3:4 остаётся 3:4; из 16:9 — 16:9.

### 2.6 UI

Кнопка в том же rail, между «Камера» и «Что изменить», только `resultModality === "image"` и флаг on.

Оверлей `PhotoshootOverlay` по канону `CameraOrbitOverlay`, без yaw/pitch. Плёнка читает `photoshootTileUrls`; нет URL — CSS crop листа.

- открытие = сразу enqueue (нет второго CTA «снять»)
- крупный кадр = выбранный тайл (1 из 4)
- снизу плёнка: 4 превью `h-16` × 48px, `object-fit: cover` + `object-position` `0% 0%` / `100% 0%` / `0% 100%` / `100% 100%`
- пока job: 4 плейсхолдера + тот же progress, что у generate
- готово: клик по тайлу меняет крупный вид (`object-fit: contain` того же crop)
- Скачать выбранный тайл: canvas crop 50%×50%. Отдельно в ⋮ или второй action — «скачать лист»
- Повторить фотосессию = новый POST (ещё 10 кр), не доработка листа
- Выйти: закрыть оверлей, backdrop снова показывает **родителя**, не лист (лист остаётся в `/generations`)

`/generations` → `seedCompletedResult`: если `edit_kind=photoshoot`, открывать оверлей с 4 тайлами, не плоский одиночный кадр.

Типографика rail: `min-h-12`, `text-[13px]`, иконки `h-5 w-5` — как остальные.

### 2.7 API / config

`GET /api/generation-config`:

```ts
photoshootEnabled: boolean
photoshootModel: { id, cost } | null
photoshootCreditCost: 10
```

Unlock: копия `isCameraOrbitUnlocked` → `isPhotoshootUnlocked` (`landing/src/lib/photoshoot-access.ts`). Кэш localStorage по образцу `camera-orbit-availability.ts`.

`POST /api/generate` ветка `isPhotoshoot`:

1. `requestedEditKind === 'photoshoot'`
2. не вместе с video
3. parent обязателен, image, completed, owned, `edit_kind !== 'photoshoot'`
4. busy: есть pending/processing photoshoot этого user → 409
5. клиентский `prompt` / `editInstruction` / `model` игнорировать
6. `creditsNeeded` = cost `photoshoot_model`
7. fingerprint: `photoshoot` + parentId (повтор того же родителя в полёте = idempotency/busy, не второй charge)

Ошибки:

| Status | `error` |
|---|---|
| 503 | `photoshoot_disabled` / `photoshoot_model_unavailable` |
| 409 | `photoshoot_busy` / `parent_not_ready` |
| 400 | `photoshoot_from_sheet` / `validation_error` |
| 400 | `insufficient_credits` |

### 2.8 Границы слоёв

| Слой | Делает | Не делает |
|---|---|---|
| Rail + Overlay | CTA, плёнка, crop просмотр/скачивание | промпт, выбор модели |
| `POST /api/generate` | флаг, parent, busy, 10 кр, enqueue | vision, 4 шота |
| Worker | plan → sheet prompt → I2I → JPEG | кредиты, UI |
| Config | `photoshoot_enabled`, `photoshoot_model` | env-гейт продукта |

---

## 3. Scaling and bottlenecks

1. **Качество 2×2** — identity drift, швы, повтор позы. Главный риск v1, не RPS.
2. Два вызова провайдера на job: vision ~2–5 с + image ~15–40 с. p95 wall ≈ 45–60 с.
3. При открытии флага всем: +1 image job на долю result-CTR. Сначала allowlist.
4. Client crop дешёвый. 4 объекта Storage не пишем.
5. Per-user image cap (сейчас 3) не мешает: v1 = 1 job.
6. Не параллелить 4 image в v1.

v2 (если лист не удержит лицо): тот же CTA и плёнка, RPC на 4 child-job и 40 кр. Тайл = URL, не crop.

---

## 4. Reliability and SLOs

| Сигнал | Цель v1 (allowlist) |
|---|---|
| enqueue success | как обычный image |
| planner parse fail | < 5% job; 1 retry |
| image fail / refund | полный возврат 10 |
| p95 wall time | < 70 с |
| busy collision | 409, без второго списания |

Деградации:

- нет proxy / ключа planner → `config_error`, refund
- `photoshoot_model` выключена → 503 до enqueue
- один photoshoot pending/processing на user → 409

Метрики worker/API: `generationMode=photoshoot`, `planner_ok`, `sheet_ok`, refund. `viaProxy` без credentials.

Цели Метрики:

| Событие | Когда |
|---|---|
| `photoshoot_open` | тап rail (enqueue стартует сразу) |
| `photoshoot_submit` | 202, `{ credits: 10, parentId }` |
| `photoshoot_ready` | completed |
| `photoshoot_fail` | terminal fail |
| `photoshoot_busy` | 409 |
| `photoshoot_no_credits` | 400 insufficient |
| `photoshoot_disabled` | 503 |

Admin finance: резать `edit_kind=photoshoot` отдельно от local_edit и camera_orbit.

Ручной чеклист качества (автокритика в v1 нет): 4 разные позы, одно лицо, нет текста на листе, тайл кликается.

---

## 5. Security and compliance

- Тот же auth, owner-check parent, idempotency key, fingerprint
- Клиентский текст игнор
- Референс planner — owned result, не произвольный URL
- Секреты только env. Флаг только БД
- Rate: существующий generate + busy
- Результат приватный. Лист не публиковать в каталог автоматически
- Guest/debug: `credits_spent=0`, как обычный generate

---

## 6. Evolution / выкат

1. SQL `224`: флаг `false`, модель, колонка, CHECK.  
2. Worker: classify `photoshoot` → planner → assembler → I2I. Пока флаг false — мёртвый код, безопасно.  
3. Landing: кнопка + overlay + ветка в `POST /api/generate` + `generation-config`.  
4. Allowlist smoke 10–20 лиц (портрет / пара / полный рост).  
5. Если 2×2 держит identity — `photoshoot_enabled=true`.  
6. Если нет — v2 (4 job), UI плёнки тот же.

Откат: `UPDATE landing_generation_config SET value = 'false' WHERE key = 'photoshoot_enabled'`. Колонки аддитивны.

Delivery unit: код + тесты + эта спека + `docs/architecture/01-landing.md` **в одном коммите**. Чужие грязные hunks в `01-landing.md` не тащить.

Порядок деплоя: SQL → worker → landing → флаг.

---

## 7. Риски

| Риск | Как закрываем |
|---|---|
| Модель рисует коллаж, не 4 фото | sheet-промпт «four separate photographs»; ручной чеклист; v2 если плохо |
| Identity drift между клетками | I2I от одного jpeg + LOCK identity; не 4 независимых T2I |
| Local-edit/orbit rules бьют позы | отдельный assembler + `edit_kind` + префикс `PHOTOSHOOT`; тесты «промпт не содержит keep pose/camera» |
| `vibe_id` на child | принудительно NULL |
| Двойной тап = 2 списания | 409 busy + in-flight fingerprint |
| Photoshoot листа → каша 16 клеток | 400 `photoshoot_from_sheet` |
| 2×2 как source для «Оживить»/«Камера» | кнопки скрыты на photoshoot-result |
| Путаница с SEO-кластером | D11, другая ветка |
| Клиент шлёт свой промпт | сервер отбрасывает |
| Флаг забыли | default false, 503 |
| Planner в API повесит лендинг | planner только в worker |

---

## 8. Тесты (обязательны в том же PR)

- `isPhotoshootUnlocked`: true/false/allowlist/dev
- `resolvePhotoshootModel`: пусто=Grok, чужой id=null
- `parsePhotoshootPlan`: 4 шота, дырка/повтор `i` → fail
- `assemblePhotoshootSheetPrompt`: есть 4 панели и LOCK identity; нет keep pose / CAMERA ORBIT
- `assembleLandingCardEditPrompt('PHOTOSHOOT…')` не должен уйти в local-edit keep-pose (редирект или явный не-photoshoot путь в worker)
- `resolveImageEditMode`: `edit_kind=photoshoot` и префикс
- API: happy path пишет `edit_kind` + parent; video parent → 400; photoshoot parent → 400; флаг off → 503; busy → 409; client prompt не в БД; vibe_id null; credits=10
- Worker: photoshoot → sheet assembler, не orbit/local-edit; planner retry; parse fail → fail+refund
- Config: `photoshootEnabled` в `/api/generation-config`
- Клиент (unit): 4 `object-position`; кнопка скрыта на video и на photoshoot-result для «Камера»/«Оживить»

Браузерная приёмка — §9, не e2e в CI.

---

## 9. Чеклист приёмки

Флаг off:

- [ ] Rail без «Сделать фотосессию» у обычного юзера
- [ ] POST photoshoot → 503, job нет
- [ ] Allowlist видит кнопку и может запустить

Флаг on:

- [ ] После image: кнопка между Камера и Что изменить
- [ ] Video result — кнопки нет
- [ ] Тап → списание 10, overlay, progress, один job
- [ ] Готово: плёнка 4 тайла, клик меняет крупный кадр
- [ ] Позы визуально разные, лицо одно (руками)
- [ ] Нет текста/рамок на листе
- [ ] Скачать тайл = четверть листа; скачать лист = полный jpeg
- [ ] Двойной тап: один job / один charge
- [ ] Второй photoshoot того же родителя после complete — новый job, ещё 10
- [ ] Photoshoot с листа → 400, кнопки нет
- [ ] 402/400 при нуле кредитов, как generate
- [ ] `/generations` → dock → лист открывается плёнкой
- [ ] Guest/debug не списывает, job создаётся
- [ ] Админ: бейдж «Фотосессия», plan json виден

Доки:

- [ ] `01-landing.md` в том же коммите, что код (только наши строки)

---

## 10. Follow-up (не блокируют v1)

1. v2: 4 отдельных кадра, 40 кр, если 2×2 не держит identity
2. Авто-eval «одно лицо / 4 позы» (Flash смотрит лист)
3. Glass-кнопка на `/generations` рядом с «Оживить»
4. Смена `photoshoot_model` без редеплоя (уже ключ в БД)
5. «Оживить» выбранный тайл: crop → отдельный upload → video parent (отдельная спека)

---

## 11. Оценка

| Кусок | Срок |
|---|---|
| SQL `224` + API ветка + access/config + тесты контракта | 1 день |
| Worker planner + sheet assembler Gemini/Grok/Seedream + тесты | 1–1.5 дня |
| Overlay + rail + crop download + `/generations` | 1.5–2 дня |
| Админ бейдж + Метрика + `01-landing.md` | 0.5 дня |
| **v1 целиком** | **4–5 дней** после старта кода |

Узкое место — качество 2×2 у модели, не очередь. Инфра та же, что local edit / orbit; новый продукт — planner + sheet-промпт + плёнка-crop.

---

## 12. Порядок реализации (когда скажут «делай»)

1. `sql/224_ai_photoshoot.sql`
2. `landing/src/lib/photoshoot.ts` + `photoshoot-access.ts` + тесты
3. Planner + `assemblePhotoshootSheetPrompt` + worker classify
4. `POST /api/generate` + `generation-config` + poll `photoshootPlan`
5. Rail CTA + `PhotoshootOverlay`
6. Админ / Метрика / `01-landing.md`
7. Приёмка по §9 на allowlist

Не коммитить SEO-файлы с `feature/28-08-promty-dlya-ii-fotosessii`.
