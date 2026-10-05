# Стикер пак на сайте: бекенд генерации (`edit_kind=sticker_pack`)

Ветка: `feature/05-10-sticker-square-frame`. Продолжение `docs/04-10-stiker-iz-foto.md` и `docs/05-10-sticker-styles-actions.md`. Это **бекенд**: SQL, API, worker, read-side листинга. В модалке кнопка «Создать стикер пак» активна только когда `stickerPackEnabled` (флаг или allowlist). Для остальных подпись «Стикер пак — скоро».

## Решения пользователя (05.10)

| Вопрос | Решение |
|---|---|
| Цена | ключ `sticker_pack_cost` в `landing_generation_config`, default **20✦** за 16 стикеров |
| Модель листа | **GPT Image 2.5 Flare** (OpenRouter) — реальная альфа. Пак принимает только модель с `imageModelOutputsAlpha`. Фон ячейки не снимаем |
| Результат | **как фотосессия**: одна строка `landing_generations`, каждый стикер — отдельный файл (16 × PNG 378 в `photoshoot_tile_paths`), превью 4×4 в `result_storage_path` |
| Сцены | только `pack_content_sets` бота (клиент шлёт `packContentSetId`; сервер берёт `scene_descriptions`, `is_active`, `sticker_count=16`) |

## Геометрия: один лист 4×4

GPT Image через OpenRouter отдаёт **только 1024 px**. Один вызов рисует сетку 4×4. Worker поднимает лист до **1512×1512** и режет 16 ячеек по **378 px** (`1512 / 4`). Это и есть холст стикера. Себестоимость ≈ 1 × $0.022, цена 20✦ = 10 ₽.

Бот (один Gemini лист 4×4 на 2K, magenta `#FF00FF`, rembg по ячейке) — отдельный пайплайн; на сайте от него взяты правила промпта грида и формула `cols = ceil(sqrt(N))`.

## Поток

```
POST /api/generate {editKind:"sticker_pack", stickerStyleId, packContentSetId, photoStoragePaths:[1]}
  ├─ флаг sticker_pack_enabled (isStickerPackUnlocked: true/1/on или allowlist)   → 503 sticker_pack_disabled
  ├─ стиль: resolveStickerStyleForEnqueue (style_presets_v2 → STICKER_STYLES)       → 400 «Выберите стиль стикера»
  ├─ сет: resolveStickerPackSetForEnqueue (pack_content_sets: is_active, 16, 16 сцен) → 400 «Выберите набор стикер пака»
  ├─ модель: resolveStickerModel(sticker_pack_model || sticker_model, default_model) → 503 sticker_pack_model_unavailable
  ├─ цена: parseStickerPackCreditCost(sticker_pack_cost) (гость / open-debug → 0)
  ├─ prompt_text = buildStickerPackPromptText → «STICKER_PACK style=<id> set=<id> count=16\n<prompt_hint>\nSCENES\n1. …\n16. …»
  └─ RPC landing_enqueue_generation p_edit_kind='sticker_pack', aspect 1:1, size 1K, p_create_ugc=false, vibe=null

worker processGeneration (process-generation.ts, ветка до OpenRouter/Gemini)
  ├─ ровно 1 фото, без parent
  ├─ модель с альфой (imageModelOutputsAlpha, сейчас gpt-image-*)                    → иначе config_error
  ├─ parseStickerPackPrompt → 16 сцен на один лист
  ├─ один вызов: assembleStickerPackSheetPrompt(mode transparent, 4×4) → generateSeedreamImage
  │     (signed URL фото, quality = sticker_image_quality, background transparent, 1024 px)
  ├─ upscaleStickerPackSheet → 1512×1512
  ├─ splitStickerPackSheet → 16 ячеек по 378 px
  ├─ каждая ячейка → finalizeStickerPackCell (только альфа ≥ 5 % → PNG 378, поле 16 px, без обводки;
  │     нет альфы → provider_error, retry job; rembg и chroma не вызываются)
  ├─ composeStickerPackPreview → 4×4 PNG 1024 (256/ячейка) с альфой
  └─ upload web-generation-results: {user}/{job}/{lease}-01.png … -16.png + {lease}.png (превью)
       return { resultPath: превью, photoshootTilePaths: 16 }

index.ts → landing_complete_generation(p_photoshoot_tile_paths = 16)   # SQL 270: cardinality 4 | 16
```

## Контракты

`landing/src/lib/sticker-pack.ts` (общий для landing и worker, без `@/`; добавлен в `web-generation-worker/tsconfig.json` и оба Dockerfile):

- `STICKER_PACK_EDIT_KIND="sticker_pack"`, `isStickerPackEditKind`.
- Ключи: `STICKER_PACK_CONFIG_ENABLED_KEY`, `STICKER_PACK_CONFIG_COST_KEY`, `STICKER_PACK_CONFIG_MODEL_KEY`; `STICKER_PACK_DEFAULT_CREDIT_COST=20`, `parseStickerPackCreditCost`.
- Геометрия: `STICKER_PACK_COUNT=16`, `STICKER_PACK_GRID=4`, `STICKER_PACK_SHEET_COUNT=1`, `STICKER_PACK_SHEET_CELLS=16`, `STICKER_PACK_PROVIDER_SHEET_PX=1024`, `STICKER_PACK_UPSCALED_SHEET_PX=1512`, `STICKER_PACK_CELL_PX=378`, `STICKER_PACK_PREVIEW_PX=1024`; `stickerPackGrid`, `stickerPackCellBox`, `stickerPackSheetScenes`, `stickerPackStickerIndex`.
- Промпт: `buildStickerPackPromptText` / `parseStickerPackPrompt` / `isStickerPackPromptText`; `normalizeStickerPackScenes` (`{subject}` → «the person», ≤400 символов, ровно 16); `assembleStickerPackSheetPrompt({stylePrompt, scenes[4], mode})` — порт пак-грида бота (без обводки, padding ≥15%, seamless grid, likeness, chest-up, выражение 60–70%) с режимом фона.
- Storage: `stickerPackTileStoragePath(preview, n)` → `{stem}-NN.png`; `parseStickerPackTilePaths` (ровно 16), `deriveStickerPackTilePaths`, `stickerPackTilePathsForJob`, `isSidecarTileCount(4|16)`, `resolveStickerPackUserFacingResult` (превью в одиночный слот, 16 тайлов), `coerceTilePathList`.
- `stickerPackFingerprintFields(photoPath, styleId, setId)` для идемпотентности.

`landing/src/lib/sticker-pack-sets-db.ts` (landing-only): `stickerPackSetFromRow` (чистый маппер) и `resolveStickerPackSetForEnqueue(supabase, id)`.

`landing/src/lib/sticker-pack-examples.ts` импортирует геометрию из `sticker-pack.ts`; свои `STICKER_PACK_SHEET_PX=2048` / `STICKER_PACK_CELL_PX=512` описывают пример бота (один лист 4×4).

`web-generation-worker/src/sticker-pack-generation.ts`: `processStickerPack({ runSheet, mode: "transparent", … })` — один вызов провайдера, модуль без OpenRouter/Gemini и без rembg; `upscaleStickerPackSheet`, `splitStickerPackSheet`, `finalizeStickerPackCell`, `composeStickerPackPreview`, `stickerPackPreviewPath`, `requireStickerPackPrompt`. Логи: `sticker_pack_started`, `sticker_pack_sheet_ok`, `sticker_pack_sheet_split`, `sticker_pack_finalized` (`sheetMs`, `splitMs`, `finalizeMs`, `previewMs`, `uploadMs`, `routes.alpha_native`, `bytesOut`), `sticker_pack_upload_failed`.

## SQL 270 (`sql/270_sticker_pack_generation.sql`)

1. `landing_generations_edit_kind_valid` + `'sticker_pack'`.
2. `landing_generation_config`: `sticker_pack_enabled='false'`, `sticker_pack_cost='20'`, `sticker_pack_model='gpt-image-2.5-flare'` (`ON CONFLICT DO NOTHING`).
3. `landing_complete_generation`: `p_photoshoot_tile_paths` принимается при cardinality **4 или 16** (было только 4). Проверка таблицы `landing_generations_photoshoot_tile_paths_len` расширена в SQL `271` (в `270` осталась старая `= 4`, из-за неё complete падал и кредит возвращался).
4. `landing_enqueue_generation`: блок `sticker_pack` — только image, без parent и `edit_instruction` (`sticker_pack_source_conflict`), ровно 1 path (`sticker_pack_source_required`), `vibe=null`, `create_ugc=false`. Остальное как в 264.

## Read-side

`generations-list.ts` → `buildGenerationResultMedia`: для `sticker_pack` `resultUrl` = превью PNG (без JPEG-thumb — альфа), `photoshootTileUrls` / `photoshootTileThumbUrls` = 16 оригиналов 512 PNG. `generationListingAspectRatio` → 1. `generationGridDisplay` пока показывает только 4-тайловые сетки — 16-тайловая карточка в `/generations` и скачивание отдельных стикеров (`sticker-file?tile=`) — UI follow-up.

`GET /api/generation-config` (image): `stickerPackEnabled`, `stickerPackCreditCost`, `stickerPackCount`, `stickerPackModel {id,label,cost=цена пака}`.

## Включение

1. Применить `sql/270_sticker_pack_generation.sql`.
2. Деплой landing + worker (`OPENROUTER_*` уже стоят). `REMBG_URL` паку не нужен: его по-прежнему требует одиночный стикер, если кадр без альфы.
3. QA под allowlist-почтой (флаг `false`): `POST /api/generate` с `editKind:"sticker_pack"`, `stickerStyleId`, `packContentSetId` любого активного 16-сета, одно фото.
4. `UPDATE landing_generation_config SET value='true' WHERE key='sticker_pack_enabled'`. Откат — `false`, без редеплоя.

## Ограничения / follow-up

- Модель пака должна отдавать альфу (`gpt-image-*`, сейчас `gpt-image-2.5-flare`). Seedream, Flux, Gemini, Grok → `config_error` без retry. Ячейка без прозрачности → retry всего job, без rembg.
- Нет фолбека модели для пака (пустой кадр или ячейка без альфы → retry всего job). Оплачивается один вызов.
- `{subject}` → «the person» без определения пола (бот подставляет gender word из subject profile).
- Экспорт пака в Telegram / zip, карточка 16 тайлов в `/generations`, CTA вместо «Скоро» — UI-этап.
