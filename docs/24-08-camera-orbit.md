# 24-08 — Camera orbit: другой ракурс той же съёмки

> Дата: 2026-08-24  
> Ветка: `feature/24-08-camera-orbit`  
> Статус: код готов; выкат: SQL 212 → worker → landing → `camera_orbit_enabled=true`  
> Поверхности: generate-dock result chrome (`CardInlineGeneratePanel` + `GenerationResultActionRail`), `/generations` → `seedCompletedResult`

## Цель

После готового **фото** пользователь ставит камеру на орбите вокруг человека и снимает **новый кадр той же сцены**. Стиль, сет, свет, одежда, лицо и **взгляд/поза как в исходнике**. Крутится только камера.

Это не remix («Что изменить»), не video («Оживить»), не 3D-мир и не прогулка по комнате.

Генерация — обычный image job: та же очередь, та же цена выбранной модели (5/10), тот же poll.

Реализация — только на ветке `feature/24-08-camera-orbit` от `origin/main`. Не писать код на чужой feature-ветке.

---

## Продуктовые решения (зафиксировано)

| # | Решение |
|---|---|
| D1 | Кейс v1 — **орбита вокруг человека**, не walkthrough комнаты |
| D2 | **Взгляд и поза lock.** Голова, тело, глаза смотрят туда же, что на корневом кадре. В новую камеру не смотрят. Тоггла «смотреть в камеру» нет |
| D3 | Цена = **обычная image-генерация** (стоимость модели корня: Flash/Lite 5, Pro/Grok 10). Не дешевле «вариации» |
| D4 | Камера — **отдельный intent** `camera_orbit`. Не переиспользовать `GENERATE_LANDING_CARD_EDIT_RULES` (они запрещают менять camera/crop) |
| D5 | I2I всегда с **scene root** (первая не-orbit генерация сцены). Hop→hop запрещён |
| D6 | Поза камеры **абсолютная** относительно корневого кадра `(0, 0, 1.0)`, не дельта от предыдущего орбита |
| D7 | Generate только по CTA **«Снять кадр»**. Не на pointerup / не на чип |
| D8 | Угол в v1: yaw **±60°**, pitch **±60°**, distance **0.75–1.35×**. Клик оси = **+30°** (повтор копит). Чипа «Сзади» нет |
| D9 | Канон UI — **оверлей на result в generate-dock**. Новой SEO-страницы нет |
| D10 | Видео-результат: кнопки «Камера» нет. С орбита «Оживить» по-прежнему запрещает новый ракурс |
| D11 | Флаг `camera_orbit_enabled` (default `false`) + тот же internal allowlist, что у video. Выкат: SQL → worker → landing → флаг |
| D12 | Копирайт не обещает «3D» и «ходи вокруг». Формулировка: «другой ракурс той же съёмки» |

---

## 1. Context and assumptions

### 1.1 Как сейчас

| Что | Факт |
|---|---|
| Result rail | `Посмотреть` / `Скачать` / `Повторить` / `Оживить` / `Что изменить` — `GenerationResultActionRail`, справа внизу, `min-h-12`, `text-[13px]`, иконки `h-5 w-5` |
| «Что изменить» | remix → `POST /api/generate` + `parentGenerationId` + свободный `editInstruction` ≤1000 |
| Worker local edit | `assembleLandingCardEditPrompt` / `assembleGrokImageEditPrompt` — **keep camera, pose, crop** |
| Parent | `landing_generations.parent_generation_id` + enqueue check owned + completed + result object |
| `/generations` | клик → `seedCompletedResult` → тот же dock result chrome |
| «Оживить» | `modality=video`, 30–60 кредитов; video-промпт **запрещает** новый угол камеры |
| Лендинг | ~2 GiB cgroup; depth/3DGS/ffmpeg на образе **нет** |
| Не-РФ API | только `GEMINI_PROXY_BASE_URL` / `XAI_BASE_URL` через DO |

### 1.2 Вне scope

- Свободный 6DoF, Dutch/roll, walkthrough комнаты
- Depth, warp, Gaussian splat, live 3D preview
- «Сзади» / yaw > 60°
- Тоггл взгляда в камеру
- Video-from-orbit, orbit после video
- Дешёвая «вариация», отдельная валюта
- Telegram-бот, STV sidepanel, Extension Lite
- SEO-кластер «камера / 3D фото»
- Автокритик «голова поехала» в v1 (только ручной чеклист)
- Смена модели / aspect / quality внутри оверлея камеры

---

## 2. Target architecture

### 2.1 Source of truth

Один серверный гейт: существующий **`POST /api/generate`** с `editKind=camera_orbit` + `cameraPose`. UI не собирает свободный orbit-промпт и не зовёт Gemini напрямую.

Сервер:

1. Резолвит `scene_root_id` (не доверяет клиенту).
2. Ставит `parent_generation_id = scene_root_id`.
3. Сериализует `edit_instruction` из позы (клиентский текст игнорируется).
4. Списывает кредиты модели корня (или fallback, §5.1).
5. Enqueue в ту же очередь image.

```
result chrome
  → rail «Камера»
  → CameraOrbitOverlay (rail 30°, ghost, плёнка)
  → CTA «Снять кадр»
       POST /api/generate
         editKind=camera_orbit
         cameraPose={azimuthDeg,elevationDeg,distanceRel}
         parentGenerationId=<displayed>   // сервер сам сведёт к root
       ├─ resolve scene root (image, owned, completed)
       ├─ busy? 409
       ├─ serializeCameraOrbit(pose) → edit_instruction
       ├─ credits = cost(root.model)
       └─ landing_enqueue_generation
            parent=root, edit_kind=camera_orbit,
            scene_root_id=root, camera_pose=json
  → worker
       I2I от root jpeg
       assembleCameraOrbitEditPrompt (НЕ local-edit rules)
  → child completed
  → плёнка + кадр
```

### 2.2 Scene root

```
resolveSceneRoot(g):
  if g.edit_kind == 'camera_orbit' and g.scene_root_id:
    return g.scene_root_id
  return g.id
```

| Действие на экране | Root для следующего орбита | I2I input |
|---|---|---|
| Сгенерировали A | A | A |
| Орбит A → B | A | A |
| Орбит, стоя на B → C | A | A (не B) |
| «Что изменить» A → D | D (новая сцена) | — |
| Орбит с D → E | D | D |

Remix/edit/новая генерация = новый корень. Орбиты одного корня = одна **плёнка**.

`vibe_id` у child **NULL**. Иначе worker уйдёт в vibe-сборку и сломает lock. Пиксели — результат корня, не dual IMAGE A/B.

### 2.3 Camera pose

Правая система относительно **корневого кадра** = `(0, 0, 1.0)`.

| Поле | Тип | Диапазон | Смысл |
|---|---|---|---|
| `azimuthDeg` | number | **−60…+60** | + = камера **слева от субъекта** (чип «Слева») |
| `elevationDeg` | number | **−60…+60** | + = камера выше; шаг кнопки 30° |
| `distanceRel` | number | **0.75…1.35** | 1.0 = как в корне; <1 ближе |

Квантование на сервере: 1° и 0.01×. Вне диапазона → 400, без enqueue.

Нулевая поза `(0, 0, 1.0)` → 400 `pose_unchanged`. Клиент не шлёт CTA в нуле.

Жест в UI = **двигаем камеру**, не крутим объект:

- drag вправо → камера вправо → `azimuthDeg` падает → «Справа»
- drag вверх → камера выше → `elevationDeg` растёт

### 2.4 Границы слоёв

| Слой | Ответственность |
|---|---|
| `CameraOrbitOverlay` | rail 30°, ghost на подложке, плёнка, одна CTA, выход на root |
| `lib/camera-orbit.ts` | clamp, serialize, resolve-root helper, chip presets — SSOT |
| `POST /api/generate` | валидация, root, busy, credits, enqueue |
| Worker | I2I + **отдельный** orbit-промпт Gemini и Grok |
| Remix / animate-scenario | не вызывать |

Worker держит копию контракта (`web-generation-worker/src/camera-orbit.ts`), как у `generation-edit-contract`. Поведение тестов должно совпадать.

### 2.5 Промпт worker (обязательный смысл)

Классификация SSOT: `resolveImageEditMode` в `landing/src/lib/camera-orbit.ts`. Орбита, если `edit_kind=camera_orbit` **или** `edit_instruction` начинается с `CAMERA ORBIT` (claim без колонки / старый воркер-образ не должен уйти в local-edit). Local-edit assembler при таком префиксе перенаправляет в orbit-промпт.

Не подмешивать `GENERATE_LANDING_CARD_EDIT_RULES` и Grok `EDIT_RULES` (там «keep camera»). Если кадр визуально тот же — промпт требует FAIL.

Абстрактных «Azimuth: N°» Flash недостаточно: джоб `55f97a43` уже шёл как `camera_orbit`, модель скопировала кроп. Сериализация добавляет walk/reveal (LEFT cheek / shoulder). MUST CHANGE раньше LOCK. Gemini: `systemInstruction` + текст до картинки + подпись «SOURCE PHOTO… do not copy this crop». Local-edit и vibe — по-прежнему image-then-text.

Gemini и Grok — один смысл, разный враппер:

```
CAMERA ORBIT (HIGHEST PRIORITY)
New photograph. Copying this crop is a failure.

Camera (absolute vs the source photo):
- Azimuth: {azimuthDeg} degrees ({left|right|on axis}). Walk N° LEFT/RIGHT around the person.
- Elevation / distance: raise/lower/step closer in plain language.

MUST CHANGE: new silhouette; more of the requested side; mirror selfie rebuilds room/phone.

LOCK: same person, clothes, room, light, expression; original world gaze; no head-turn to the new lens.
```

`edit_instruction` в БД = короткая сериализация позы (≤1000, классификация). `prompt_text` child = **полный бриф, переписанный под ракурс** (не копия корня и не одно поле Camera). На enqueue: LLM rewrite секций Camera/Pose/Composition/Scene/Avoid, fallback `rewriteScenePromptForCameraOrbit`. Worker: `resolveCameraOrbitScenePrompt` — если `prompt_text` уже с `CAMERA ORBIT`, брать его; иначе переписать root-бриф по `camera_pose`. I2I = этот бриф + `CAMERA ORBIT RULES`.

### 2.6 Модель, кадр, кредиты

Из **корня**, не из текущего пикера compose:

| Параметр | Откуда |
|---|---|
| `model` | `root.model`, если ещё enabled; иначе `default_model` |
| `aspect_ratio` | `root.aspect_ratio` |
| `image_size` | `root.image_size`, clamp модели |
| credits | `cost(resolved model)` как у обычного generate |
| guest / open-debug | `credits_spent=0`, как generate |

Пикер модели в оверлее камеры **скрыт**. Смена модели — только новым generate, не орбитом.

---

## 3. Scaling, reliability, security

### 3.1 Что ломается первым

| Узкое место | Порядок | Защита v1 |
|---|---|---|
| COGS | 2–3 орбита на completed ≈ +200–300% image с этого кадра | полная цена; CTA; 1 in-flight на сцену |
| Очередь | те же image-воркеры | не отдельный cap; тот же `WORKER_GLOBAL_CAP` |
| Identity / head-turn | не infra | промпт lock + лимит ±60°; hop от root |
| Память | 1 jpeg как у local edit | без второго ref и без depth |

SLO как у image-edit: p95 как текущий generate, abort/retry те же. Отдельный latency budget не заводим.

Допустимая деградация: голова слегка «подъехала» — показать кадр, не ретраить молча. Пользователь жмёт ещё раз с того же корня (другой угол или тот же).

### 3.2 Busy и идемпотентность

Пока у requester есть `pending|processing` с `edit_kind=camera_orbit` и тем же `scene_root_id` → **409** `camera_orbit_busy`. Gemini/xAI нет.

Fingerprint += `editKind`, `sceneRootId`, округлённая поза. Одинаковый повтор с тем же Idempotency-Key — существующая строка, без второго списания.

### 3.3 Security

- Parent/root только owned + completed + `modality=image` + есть result object.
- Клиентский `editInstruction` при `camera_orbit` отбрасывается.
- Нет URL/ply/глубины с клиента.
- SAFETY / refund — как image job.
- Лица: тот же контур, что generate. В UI не писать «точный 3D человека».
- Прокси: без нового host.

---

## 4. Functional requirements

### F1. Флаг

`landing_generation_config.camera_orbit_enabled` = `true` | `false` (default **false**).

Пока `false`: CTA в rail нет, `POST` с `editKind=camera_orbit` → **503** `camera_orbit_disabled` (кроме allowlist `INTERNAL_GENERATE_ALLOWLIST` / `azarov.maxim@gmail.com` и local `next dev` — как video).

`GET /api/generation-config` (image) отдаёт `cameraOrbitEnabled: boolean`.

### F2. Кто видит «Камера»

Показать, если **все** истинны:

- `cameraOrbitEnabled`
- result `modality=image`
- phase `done`, есть `generationId` + result URL
- не video chrome

С `/generations` после `seedCompletedResult` — то же.

На video result и в compose idle — скрыть.

### F3. Открыть оверлей

Тап «Камера»:

1. Rail действий скрыть (оверлей занимает тот же кадр).
2. Риг = поза текущего кадра: корень → `(0,0,1)`; орбит-child → его `camera_pose`.
3. Подгрузить плёнку `GET /api/generations/:id/camera-scene`.
4. Footer generate / prompt sheet не открывать.

Закрытие (X, Escape, rail **«Выйти»**): оверлей снять, вернуть обычный result rail, кадр = **исходник сцены** (root), не последний орбит.

### F4. Кнопки оси (накопительные, шаг 30°)

Тот же `GenerationResultActionRail`, справа внизу. Повтор клика **добавляет** шаг, затем clamp.

| Кнопка | Дельта за клик | Clamp |
|---|---|---|
| Слева | `azimuthDeg += 30` | ±60 |
| Справа | `azimuthDeg −= 30` | ±60 |
| Выше | `elevationDeg += 30` | ±60 |
| Ниже | `elevationDeg −= 30` | ±60 |
| Ближе | `distanceRel −= 0.15` | 0.75…1.35 |
| Дальше | `distanceRel += 0.15` | 0.75…1.35 |

Чипа «Сзади» нет. В том же rail: **Выйти** (на корень) и primary **Снять кадр · N** (кредиты в той же кнопке, отдельного credit badge нет).

### F5. Пад

Зона жеста — сам кадр (не чипы, не CTA).

| Жест | Ось | Чувствительность |
|---|---|---|
| drag по X | azimuth | ширина кадра ≈ 120°, clamp ±60 |
| drag по Y | elevation | высота кадра ≈ 120°, clamp ±60 |
| pinch | distance | 0.75…1.35 |

За clamp — резинка, не уход за лимит. Pointer capture. На время generate жесты off.

Клавиатура (desktop): ←/→/↑/↓ = тот же шаг 30°, что у кнопок; `+`/`−` distance ±0.05; Escape = выйти на исходник.

### F6. Ghost

Не live-generate и не depth-warp.

- По центру кадра, на подложке `bg-black/50 backdrop-blur-md rounded-full`, `text-[13px] font-semibold`.
- Пример: `Камера слева 30°, высота как была`. Высота с числом: `выше 30°` / `ниже 30°`.
- Нулевая поза: `Исходный ракурс`.

### F7. Снять кадр

CTA активна только если поза ≠ `(0,0,1.0)` и нет busy.

Лейбл: `Снять кадр · N` (N = кредиты модели). Guest/debug — без `· N`.

Клик:

1. Баланс < N → текущий pricing overlay generate (402), job нет.
2. Иначе POST, риг lock, кадр в том же generating chrome, что обычный generate.
3. 409 busy → тост «Этот ракурс ещё снимается», CTA ждёт poll существующего job если тот же fingerprint, иначе ждём чужой in-flight этой сцены.
4. Успех: кадр = новый result, риг = заказанная поза, плёнка + thumb, баланс refresh.
5. Fail: тост, риг разлочен, поза сохранена, повтор CTA = новый job (новый idempotency, если поза та же — fingerprint может вернуть старый failed? **Нет:** failed не идемпотентный hit. Новый key на каждый клик CTA, fingerprint только защищает double-submit в полёте).

Правило idempotency: ключ клиента новый на каждый CTA; серверный fingerprint + короткий in-flight lock защищают двойной тап (~1 с). Failed/completed не переиспользуем молча.

### F8. Плёнка сцены

Горизонтальный ряд под кадром внутри оверлея.

- Первый thumb = root, подпись **«Исходник»**.
- Дальше орбиты этой сцены по `created_at` asc.
- Remix-дети и video-сиблинги **не** входят.
- Pending/processing — skeleton thumb, не кликабелен.
- Failed в плёнку не класть.
- Активный thumb — кольцо indigo (как generate CTA).
- Тап completed: показать его jpeg, риг ← его поза (root → нули).
- Следующий «Снять кадр» всё равно I2I от **root** с **текущей** позой рига.

Лимита числа орбит на сцену в v1 нет (остановка = баланс / 409 busy).

### F9. «Оживить» / «Что изменить» / «Повторить»

С орбит-кадра:

- **Оживить** — video от **показанного** кадра (как сейчас от любого image). Сценарий по-прежнему без нового угла.
- **Что изменить** — remix от показанного кадра; child remix = **новый** scene root.
- **Повторить** — выйти из result в compose, как сейчас (не орбит).

Из оверлея камеры эти три действия недоступны, пока оверлей открыт.

### F10. Тексты (RU)

| Ситуация | Смысл |
|---|---|
| Кнопка rail | «Камера» |
| Заголовок оверлея | «Ракурс» |
| Подзаголовок | «Камера вокруг человека. Взгляд как на исходном фото.» |
| CTA | «Снять кадр · {n}» |
| Нулевая поза, CTA disabled hint | «Сдвиньте камеру» |
| Busy | «Этот ракурс ещё снимается» |
| 503 флаг | «Смена ракурса пока недоступна» |
| 400 unchanged | «Это исходный ракурс» |
| Upstream / fail | как у обычной генерации |
| 402 | текущий pricing generate |
| Не обещать | «3D», «ходи по комнате», «безлимит», «точный двойник сзади» |

---

## 5. API

### 5.1 `POST /api/generate` — дополнение

Существующий контракт local edit не ломаем.

Новые поля (image only):

```json
{
  "parentGenerationId": "uuid",
  "editKind": "camera_orbit",
  "cameraPose": {
    "azimuthDeg": 30,
    "elevationDeg": 0,
    "distanceRel": 1
  }
}
```

| Правило | Поведение |
|---|---|
| `editKind=camera_orbit` | обязательны parent + pose; `editInstruction` с клиента **игнорировать** |
| `editKind` нет / `local_edit` | как сейчас, нужен `editInstruction` |
| `editKind` + `modality=video` | 400 |
| parent video / не готов / чужой | 400/409/403 как сейчас |
| root резолв с child | `parent_generation_id` в БД = root, не displayed |
| поза вне диапазона / не число | 400 `invalid_camera_pose` |
| (0,0,1) | 400 `pose_unchanged` |
| флаг выключен | 503 `camera_orbit_disabled` |
| in-flight на сцену | 409 `camera_orbit_busy` |
| `generationMode` в логах | `camera_orbit` |

`prompt` в body: клиент шлёт `root.prompt_text` (уже в dock). Если пусто — сервер подставляет prompt корня. Worker всё равно собирает orbit-промпт из позы.

### 5.2 `GET /api/generations/:id/camera-scene`

Auth, owned, `Cache-Control: no-store`.

`:id` — любой кадр сцены (root или орбит). 404/403 как GET generation.

```json
{
  "rootId": "uuid",
  "displayedId": "uuid",
  "shots": [
    {
      "id": "uuid",
      "role": "root" | "orbit",
      "status": "completed",
      "resultUrl": "signed-or-public",
      "cameraPose": { "azimuthDeg": 0, "elevationDeg": 0, "distanceRel": 1 },
      "createdAt": "ISO"
    }
  ]
}
```

`shots` = root + completed `edit_kind=camera_orbit` с этим `scene_root_id`. Без pending (pending клиент рисует optimistic сам).

### 5.3 `GET /api/generation-config`

`cameraOrbitEnabled` рядом с image defaults. Не смешивать с `video` enabled.

### 5.4 Что не трогать

| Ручка | v1 |
|---|---|
| `POST /api/prompt-remix` | без изменений |
| `POST /api/generate/animate-scenario` | без изменений |
| Video enqueue | без `edit_kind` |
| Extension / scout | нет |

---

## 6. UI / UX

Канон: **тот же кадр result**, не новая страница и не вторая шторка промпта.

Типографика — режим A (оверлей на фото): подписи и чипы `text-[13px] font-semibold`, иконки `h-5 w-5`, tap ≥ `min-h-12` / `min-h-11`. В одном ряду один масштаб. См. `ui-typography-icons-consistency`.

### 6.1 Rail

Порядок сверху вниз:

1. Посмотреть  
2. Скачать  
3. Повторить  
4. Оживить — если video enabled; `accent: "orbit"` **только** здесь  
5. **Камера** — glass как Посмотреть, **без** `accent: "orbit"` (не конкурировать с «Оживить»)  
6. Что изменить — `primary`

Иконка «Камера»: простой корпус + объектив (outline 1.8), не play и не карандаш.

Ширина rail `9.5rem` как сейчас. Лейбл «Камера» не обрезать.

На узком mobile rail не сжимать шрифт. Если 6 кнопок перекрывают кадр — допустимо: это уже так с 5; орбит не выносить в ⋮ в v1.

### 6.2 Оверлей — desktop и mobile

```
┌──────────────────────────────────────────────┐
│ [X]                                          │  ← выход на исходник
│                                              │
│         ┌────────────────────────┐           │
│         │ Камера слева 30°,      │  подложка │
│         │ высота как была        │           │
│         └────────────────────────┘           │
│                                              │
│  [Исх][…]              [Слева]               │
│                        [Справа]              │
│                        [Выше]                │
│                        [Ниже]                │
│                        [Ближе]               │
│                        [Дальше]              │
│                        [Выйти]               │
│                        [Снять кадр · 5]      │
└──────────────────────────────────────────────┘
```

- Фон кадра без scrim (как текущий result).
- X слева и rail «Выйти» — одно действие: закрыть режим, показать root.
- Кнопки оси = тот же `GenerationResultActionRail` (`min-h-12`, `text-[13px]`, иконки `h-5 w-5`, glass / primary).
- CTA одна: `Снять кадр · N` в rail, без второй кнопки футера и без отдельного credit badge.
- Footer лендинга скрыт, пока оверлей открыт.

Mobile dock: оверлей на всю пластину generate, не на весь viewport под табами.

### 6.3 Состояния кадра

| Состояние | Кадр | CTA | Риг |
|---|---|---|---|
| idle | текущий shot | активен если поза ≠ 0 | on |
| generating | тот же shot + прогресс как generate | disabled «Снимаем…» | off |
| success | новый jpeg | disabled пока поза снова не сдвинется | on, поза = заказ |
| fail | старый shot | снова «Снять кадр · N» | on |

Не прыгать в обычный result rail на время generate — пользователь теряет риг.

### 6.4 Плёнка

- Thumb: высота **64px**, ширина по aspect корня, `object-cover`, `rounded-xl`.
- Root: мелкий бейдж «Исходник» `text-[10px]` — исключение-badge по типографике.
- Gap 8px, горизонтальный scroll, без стрелок в v1.
- Не показывать позу числом на thumb (дубль ghost).

### 6.5 История `/generations`

В v1 **нет** второй glass-кнопки «Камера» на карточке (там уже «Оживить»). Путь: клик по фото → dock result → «Камера».

Список как был. Фильтр «только орбиты» не делаем.

### 6.6 Админка

`/admin/analyze-history` → генерации пользователей: бейдж **«Камера»**, если `edit_kind=camera_orbit`. В детали — `azimuth/elevation/distance` и id корня. Provider badge (`Gemini edit` / `xAI edit`) остаётся; орбит = вид edit, не generate.

### 6.7 Пусто / ошибки загрузки плёнки

Оверлей всё равно открывается. Плёнка = только текущий кадр как root-кандидат. Снять кадр можно. Retry плёнки тихий при следующем успехе.

---

## 7. Аналитика

Не смешивать с `prompt_card_generation_*` и `analyze_*`.

| Событие | Когда |
|---|---|
| `camera_orbit_open` | открыли оверлей |
| `camera_orbit_chip` | `{ chip }` |
| `camera_orbit_submit` | CTA, `{ azimuth, elevation, distance, credits }` |
| `camera_orbit_ready` | completed |
| `camera_orbit_fail` | terminal fail |
| `camera_orbit_busy` | 409 |
| `camera_orbit_no_credits` | 402 |
| `camera_orbit_disabled` | 503 |

Логи `[generation.create]` / worker: `generationMode=camera_orbit`, `sceneRootId`, поза, `viaProxy` без credentials.

Admin finance: резать `edit_kind=camera_orbit` отдельно от local_edit, иначе COGS remix и орбит смешаются.

---

## 8. Миграция и выкат

Новая миграция — **следующий свободный номер** в `sql/` (сейчас после `211` → **`212_camera_orbit.sql`**). Старые enqueue-файлы не редактировать: `CREATE OR REPLACE` / `DROP FUNCTION` + новая сигнатура **копией** актуального `landing_enqueue_generation` из `200` + поля ниже.

На `landing_generations`:

```sql
edit_kind text NULL
  CHECK (edit_kind IS NULL OR edit_kind IN ('local_edit', 'camera_orbit'));

scene_root_id uuid NULL
  REFERENCES landing_generations(id) ON DELETE RESTRICT;

camera_pose jsonb NULL;

CHECK (
  (edit_kind IS DISTINCT FROM 'camera_orbit')
  OR (
    parent_generation_id IS NOT NULL
    AND scene_root_id IS NOT NULL
    AND camera_pose IS NOT NULL
    AND edit_instruction IS NOT NULL
  )
);
```

Индекс плёнки:

```sql
CREATE INDEX idx_landing_generations_camera_scene
  ON landing_generations(scene_root_id, created_at)
  WHERE edit_kind = 'camera_orbit';
```

Busy-индекс (дополнить существующий parent-active):

```sql
CREATE INDEX idx_landing_generations_camera_orbit_active
  ON landing_generations(scene_root_id)
  WHERE edit_kind = 'camera_orbit'
    AND status IN ('pending', 'processing');
```

Enqueue: параметры `p_edit_kind`, `p_scene_root_id`, `p_camera_pose`. Для `camera_orbit` RPC проверяет root image completed owned и пишет колонки. Старые вызовы без новых args — default NULL.

Конфиг:

```sql
INSERT INTO landing_generation_config (key, value)
VALUES ('camera_orbit_enabled', 'false');
```

Выкат:

1. SQL на БД лендинга.  
2. Worker (orbit-промпт; старые job без `edit_kind` = local_edit как сейчас).  
3. Landing.  
4. Allowlist smoke.  
5. `camera_orbit_enabled=true`.  
6. В **том же коммите**, что код: `docs/architecture/01-landing.md` (дата в шапке) + чеклист этой спеки.

Откат: флаг `false`. Колонки аддитивны.

Ветка реализации = эта. Delivery unit: код + тесты + SSOT-дока.

---

## 9. Риски

| Риск | Как закрываем |
|---|---|
| Модель разворачивает лицо в камеру | отдельный промпт + D2 в сериализации; лимит ±60° |
| Telephone identity | parent/I2I всегда root |
| Local-edit rules бьют орбит | `resolveImageEditMode` + префикс `CAMERA ORBIT`; local-edit assembler редиректит; тесты «промпт не содержит keep camera» |
| `vibe_id` на child | принудительно NULL |
| Двойной тап = 2 списания | 409 busy + in-flight fingerprint |
| Путаница с «Оживить» | разные глаголы; accent orbit только у video |
| Обещание 3D | копирайт D12 |
| Клиент шлёт свой промпт «look at camera» | сервер перезаписывает instruction |
| Remix в плёнке | фильтр `edit_kind=camera_orbit` |
| Флаг забыли | default false, 503 |

---

## 10. Тесты (обязательны в том же PR)

- `clampCameraPose` / quantize: границы, NaN, (0,0,1) |
- `serializeCameraOrbit`: есть LOCK gaze, нет «look at camera» как требования, ≤1000 |
- `resolveSceneRoot`: root / child / remix не является орбитом |
- API unit: happy path пишет root+kind+pose; child parent сведён к root; pose 61° → 400; zero → 400; video parent → 400; флаг off → 503; busy → 409; client `editInstruction` не попадает в БД |
- Fingerprint: та же поза = тот же hash |
- Worker: `camera_orbit` → orbit assembler, не `assembleLandingCardEditPrompt`; vibe_id null |
- Grok-ветка: не `assembleGrokImageEditPrompt` (keep camera) |
- Config: `cameraOrbitEnabled` true/false |
- Клиент: CTA disabled на нуле; чип Слева = +30; отображаемый child не становится parent в body без серверного резолва (клиент может слать displayed id — сервер чинит) |

Браузерная приёмка — §11, не e2e в CI.

---

## 11. Чеклист приёмки

Флаг off:

- [ ] Rail без «Камера» у обычного юзера  
- [ ] POST orbit → 503, job нет  
- [ ] Allowlist видит кнопку и может снять кадр  

Флаг on:

- [ ] После image: «Камера» между Оживить и Что изменить  
- [ ] Video result — кнопки нет  
- [ ] Оверлей: drag/чипы меняют строку ghost, generate нет  
- [ ] Нулевая поза — CTA disabled  
- [ ] «Слева» → списание как у модели корня (5 или 10), poll, новый jpeg  
- [ ] Второй орбит с child всё ещё похож на **первый** кадр, не на первый орбит (проверка глазами: одежда/сет с корня)  
- [ ] Голова не «приветствует» новую камеру на ±30° (ручная оценка)  
- [ ] Плёнка: исходник + 2 орбита, тап по исходному возвращает риг в 0  
- [ ] Двойной тап CTA: один job / один charge  
- [ ] 402 при нуле кредитов, как generate  
- [ ] «Что изменить» с орбит-кадра → remix; новый орбит с remix-результата **не** попадает в старую плёнку  
- [ ] «Оживить» с орбит-кадра стартует video от этого jpeg  
- [ ] `/generations` → dock → «Камера» работает  
- [ ] Guest/debug не списывает, job создаётся  
- [ ] Админ: бейдж «Камера», поза видна  

Доки:

- [ ] `01-landing.md` в том же коммите, что код

---

## 12. Follow-up (не блокируют v1)

1. Depth-warp ghost, если не понимают, куда уедет кадр  
2. Мягкий cap орбит / сутки, если COGS взорвётся  
3. Авто-eval head-turn (Flash смотрит пару jpeg)  
4. Чип «ещё левее» (±45) после статистики по ±30  
5. Glass «Камера» на `/generations` рядом с «Оживить»  
6. Смена модели в оверлее  
7. World / splat — только если попросят «войти в комнату»

---

## 13. Оценка

| Кусок | Срок |
|---|---|
| SQL + enqueue + API + тесты контракта | 1.5–2 дня |
| Worker orbit-промпт Gemini/Grok + тесты | 0.5–1 день |
| Overlay + rail + плёнка | 2–2.5 дня |
| Админ бейдж + аналитика + `01-landing.md` | 0.5 дня |
| **v1 целиком** | **5–7 дней** после merge этой спеки в работу |

Узкое место — lock взгляда у модели, не очередь. Инфра та же, что local edit; новый продукт — риг, root и отдельный промпт.
