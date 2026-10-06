# «Сделать стикер» из готового фото (sticker from result)

Ветка: `feature/06-10-sticker-from-result`. Продолжение `docs/04-10-stiker-iz-foto.md`, `docs/05-10-sticker-styles-actions.md`, `docs/05-10-sticker-pack-web.md`.

## 1. Контекст и допущения

**Что есть.** Стикер на сайте — `edit_kind=sticker`. Источник сегодня один из двух:

- первичный стикер: ровно одно фото из библиотеки (`photoStoragePaths:[1]`, без parent);
- edit «Эмоция / Движение»: `parentGenerationId` → **только готовый стикер** (`sticker_parent_not_sticker` в API `route.ts` L568–579 и в RPC `landing_enqueue_generation`, SQL 264/270 L307).

Рельса обычного фото-результата (`CardInlineGeneratePanel.tsx` L3829–4107): Опубликовать · Посмотреть · Скачать · Повторить · Оживить · Камера · Фотосессия · «Что изменить». Кнопки «Стикер» нет. Все follow-up с результата (Оживить, Камера, Фотосессия, «Что изменить») идут через `parent_generation_id`, не через копию в библиотеку.

**Что просит пользователь.** После генерации фото — кнопка «Сделать стикер». По клику: (1) выбрать стиль стикера; (2) выбор стиля можно **закрыть** (вернуться к результату без последствий) и **сменить** (перевыбрать до запуска и после — для того же фото).

**Допущения.**

- Цена = цена первичного стикера (модель `sticker_model`, `stickerModelConfig.cost`). Новых ключей цены нет.
- Источник — **результат генерации**, не оригинал пользователя: стикер делается из уже стилизованного фото. Это и есть продуктовая ценность кнопки (стикер из «того самого» кадра).
- Стикер из результата **не** становится карточкой каталога (`create_ugc=false`, как у всех стикеров).
- Стикер пак из результата — вне скоупа (RPC запрещает parent для `sticker_pack`, L249). См. §6.

**Решение по источнику — вариант B (parent), не копия в библиотеку.**

| | A. save-to-library → `photoStoragePaths` | **B. `parentGenerationId` → результат** |
|---|---|---|
| SQL / API / worker | без изменений | SQL 273 + ветка в `route.ts` + 0 правок в worker-источнике |
| Побочный эффект | лишнее фото в библиотеке пользователя, +1 копия JPEG в Storage | нет |
| Лаг до старта | +1 RTT (copy ~0.5–1 с) | нет |
| Lineage / аналитика | теряется связь стикер → фото | `parent_generation_id` как у Оживить / Фотосессии |
| Фотосессия как источник | тайл надо отдельно сохранять | уже решено `resolvePhotoshootParentSourcePath` + `parentTile` |

B согласован с тем, как работают остальные три follow-up. A — обходной путь, который даёт две разные модели источника для одного и того же действия.

## 2. Целевая архитектура

```
Результат фото (image, !sticker, !video)
  └─ рельса: … · Стикер N✦ · …            ← гейт: stickerEnabled && stickerFromResultEnabled
       └─ click → StickerFromResultSheet (overlay над результатом, как PhotoshootSheet)
            ├─ заголовок «Стиль стикера», StickerStylePicker (style_presets_v2 через /api/sticker-catalog)
            ├─ CTA «Сделать стикер · N✦» (disabled пока стиль не выбран / каталог грузится)
            ├─ закрыть: X / Esc / тап по подложке / swipe-down → результат как был, без запросов
            └─ сменить: radio-перевыбор в любой момент до CTA

POST /api/generate {editKind:"sticker", parentGenerationId, stickerStyleId, photoStoragePaths:[], parentTile?}
  ├─ флаг sticker_generation_enabled (как сейчас)                       → 503 sticker_disabled
  ├─ флаг sticker_from_result_enabled (новый, только для ветки с parent не-стикером) → 503 sticker_from_result_disabled
  ├─ parent: completed, modality image, edit_kind ∉ {sticker, sticker_pack}
  │     parent.edit_kind = photoshoot → parentTile обязателен (как у фотосессии из тайла)
  ├─ stickerStyleId обязателен (resolveStickerStyleForEnqueue)           → 400 «Выберите стиль стикера»
  ├─ stickerAction / editInstruction должны быть пустыми                 → 400 validation_error
  ├─ prompt_text = buildStickerPromptText(style)  («STICKER style=<id>\n<prompt_hint>») — тот же, что из фото
  ├─ fingerprint = stickerFromResultFingerprintFields(parentId, styleId, tile)
  └─ RPC landing_enqueue_generation p_edit_kind='sticker', p_parent_generation_id, p_input_photo_paths='{}', p_edit_instruction=NULL

worker (без изменений в пайплайне):
  resolveInputSource → parent.result_storage_path из web-generation-results (уже умеет; тайл — resolvePhotoshootParentSourcePath)
  isSticker → assembleStickerFinalPrompt (нет маркера «STICKER edit=» → первичный стикер) → модель → finalizeStickerImage → PNG 512

Результат (edit_kind=sticker, parent = фото):
  рельса стикера как сейчас (Посмотреть · Скачать · Ещё стикер · Эмоция · Движение · Текст · Рамка)
  плюс «Сменить стиль» → тот же StickerFromResultSheet, но вход — PNG этого стикера
  (parent = текущий стикер, без edit_instruction, промпт нового стиля). SQL `274`.
```

### Как RPC различает три формы `edit_kind='sticker'`

| Форма | parent | parent.edit_kind | `edit_instruction` | `input_photo_paths` |
|---|---|---|---|---|
| первичный из фото | NULL | — | NULL | ровно 1 |
| **из результата (новая)** | NOT NULL | **не** sticker / sticker_pack, modality image | **NULL** | `{}` |
| edit эмоция/движение | NOT NULL | sticker | NOT NULL | `{}` |

Текущая проверка «sticker + parent ⇒ edit_instruction обязателен» заменяется на: `edit_instruction IS NULL` ⇔ parent не стикер; `edit_instruction IS NOT NULL` ⇔ parent стикер. Любая другая комбинация — `sticker_source_conflict` / `sticker_parent_not_sticker`.

### Контракты

`landing/src/lib/sticker.ts` (общий landing + worker, без `@/`):

- `isStickerFromResultParent({ modality, editKind })` — чистая функция: `image` и `editKind ∉ {sticker, sticker_pack}`.
- `stickerFromResultFingerprintFields(parentGenerationId, styleId, parentTile | null)`.
- `STICKER_FROM_RESULT_CONFIG_ENABLED_KEY = "sticker_from_result_enabled"`, `isStickerFromResultUnlocked(value, email)` в `sticker-access.ts` рядом с `isStickerUnlocked`.

`landing/src/lib/generate-compose-mode.ts`:

- `resolveStickerFromResultFrame({ generationId, resultUrl, resultModality, resultEditKind, photoshootTile })` → `{ parentGenerationId, previewUrl, parentTile } | null` — зеркало `resolvePhotoshootReadyFrame`. Юнит-тесты в `generate-compose-mode.test.ts`.

`GET /api/generation-config` → `stickerFromResultEnabled: boolean`.

### UI (`CardInlineGeneratePanel.tsx`)

- Состояние: `stickerFromResultOpen: boolean`, `stickerFromResultParentId: string | null`, `stickerFromResultTile: number | null`. Стиль — существующий `stickerStyleId` (тот же пользовательский дефолт из каталога, `stickerStyleTouchedRef`).
- Кнопка рельсы `id: "sticker"`, label «Стикер», `creditCost = stickerCost`, `creditUnaffordable` как у Оживить, aria «Сделать стикер, N кредитов». Позиция — после «Оживить», перед «Камера». Гейт: `stickerEnabled && stickerFromResultEnabled && resultModality === "image" && !stickerResult`.
- `openStickerFromResult()` — `resolveStickerFromResultFrame`, закрывает `photoshootOpen` / `cameraOrbitOpen`, открывает шит, цель `sticker_from_result_open`.
- `closeStickerFromResult()` — только локальный стейт, ничего не сбрасывает в результате. Цель `sticker_from_result_close`.
- `runGenerate` — новая ветка `isStickerFromResult`: `parentGenerationId = stickerFromResultParentId`, `photoStoragePaths: []`, `stickerStyleId`, `parentTile`, без `stickerAction`. Цель `sticker_start { style, source: "result" }` (сейчас без `source`; из фото — `source: "photo"`).
- После `done` у стикера с `stickerFromResultParentId` — в рельсе «Сменить стиль» вместо «Ещё стикер» (`resetToCompose` для этого кейса не нужен: источник не из библиотеки).
- `StickerFromResultSheet` — новый компонент в `components/sticker/`, обёртка над `StickerStylePicker` с заголовком, X и CTA; визуально по `PhotoshootSheet` (overlay над результатом, `tone` под `dockExampleExpanded`). Шрифты/иконки — по `ui-typography-icons-consistency.mdc`.

### SQL `273_sticker_from_result.sql`

1. `INSERT INTO landing_generation_config (key, value) VALUES ('sticker_from_result_enabled', 'false') ON CONFLICT DO NOTHING`.
2. `CREATE OR REPLACE FUNCTION landing_enqueue_generation(...)` — та же сигнатура, что 270. Правка только в блоке `v_edit_kind = 'sticker'` и в проверке parent (§2, таблица трёх форм). 262–272 не трогать.

## 3. Масштаб и узкие места

- Нагрузка: +1 генерация на клик, тот же тип job, та же модель и цена, что первичный стикер. Ожидаемо ≤ 10–20 % от числа фото-результатов → для текущих объёмов worker-очереди не заметно.
- Parent lookup: по PK `landing_generations.id` в API, RPC (`FOR SHARE`) и worker — три точечных чтения, как у Оживить.
- Источник из `web-generation-results` — JPEG результата (до 2K/4K). Для стикера worker всё равно ужимает вход под модель; дополнительных ресайзов не добавляем.
- Idempotency: ключ клиента + fingerprint `(parentId, styleId, tile)`. Повтор «Сменить стиль» с другим стилем — новый job; с тем же — вернёт существующий (как сейчас у стикера из фото).

## 4. Надёжность и SLO

- Все три слоя валидации (API → RPC → worker) остаются согласованными: добавлять ветку в API без SQL нельзя (RPC сейчас упадёт `sticker_edit_incomplete`), и наоборот.
- Логи worker: уже пишется `sourceType: "generation_result"` в `video/photoshoot` log-fields; добавить тот же набор в `sticker_finalized` (`parentGenerationId`, `sourceType`). Loki: `{service="web-generation-worker", env="prod"} | json | event="sticker_finalized" | parentGenerationId != ""`.
- Деградация: флаг `sticker_from_result_enabled=false` убирает кнопку и закрывает API-ветку одним `UPDATE`, без редеплоя. Эмоция/Движение/первичный стикер не затрагиваются.
- Ошибки пользователю: `sticker_from_result_disabled` → «Стикер из этого фото пока недоступен»; `parent_not_ready` → как у Оживить.

## 5. Безопасность

- Владение parent проверяется `requester_auth_user_id` в API, RPC и worker — не ослабляем.
- `photoStoragePaths` для этой ветки должны быть пустыми (иначе `sticker_source_conflict`) — нельзя подмешать чужой путь.
- Флаг и allowlist — только из `landing_generation_config` (см. `feature-flags-db.mdc`), env не используем.
- Никаких новых секретов, модели идут через существующий прокси.

## 6. Эволюция

1. SQL 273 (флаг `false`) → деплой кода → `UPDATE … value='true'` для `sticker_from_result_enabled`.
2. Следом (отдельная спека): «Стикер пак» из результата — снять запрет parent в блоке `sticker_pack`, тот же шит с `StickerPackSetPicker`.
3. Потом: в `/generations` на карточке фото-результата та же кнопка через `seedCompletedResult` (сейчас — только в живой панели).

## Решения (06.10)

| Вопрос | Решение |
|---|---|
| Подпись в рельсе | «Сделать стикер» |
| «Сменить стиль» на готовом стикере | в этой итерации, тот же `parentGenerationId` |
| Флаг | отдельный `sticker_from_result_enabled` |
| Камера | UI снят (rail, `CameraOrbitOverlay`, `camera-orbit-availability`). API, worker, SQL и `camera_orbit_enabled` остаются |
| Источник v1 | только обычное фото. Фотосессия, стикер и стикер пак — не источник (`isStickerFromResultParent`) |

## Чеклист реализации

- [x] `sql/273_sticker_from_result.sql`: флаг + RPC (три формы sticker)
- [x] `sticker.ts`: `isStickerFromResultParent`, `stickerFromResultFingerprintFields`, ключ флага; `sticker-access.ts`: `isStickerFromResultUnlocked`
- [x] `route.ts`: ветка parent не-стикер (флаг, стиль, пустые paths, fingerprint, сообщения ошибок). `parentTile` фотосессии не делаем — фотосессия не источник
- [x] `/api/generation-config`: `stickerFromResultEnabled`
- [x] `generate-compose-mode.ts` + тест: `resolveStickerFromResultFrame`
- [x] `components/sticker/StickerFromResultSheet.tsx`
- [x] `CardInlineGeneratePanel.tsx`: кнопка рельсы, open/close, ветка `runGenerate`, «Сменить стиль» на стикер-результате
- [x] `yandex-metrika.ts`: `sticker_from_result_open` / `_close` / `_restyle`; `sticker_start` с `source`
- [x] worker без правок пайплайна; тест `resolveGenerationInputSource` для parent `edit_kind: null`. Отдельные поля в `sticker_finalized` не добавлялись
- [x] `docs/architecture/01-landing.md`: рельса, контракт `/api/generate`, RPC, флаг, цели Метрики
