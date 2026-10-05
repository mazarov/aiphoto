# Стикеры: стили из бота и действия «Эмоция / Движение / Текст»

Ветка: `feature/05-10-sticker-styles-actions`. Продолжение `docs/04-10-stiker-iz-foto.md`.

## Контекст и допущения

- Бот photo2sticker и promptshot живут в **одном Supabase-проекте**. Таблицы `style_groups`, `style_presets_v2` (12 активных стилей, `prompt_hint`, `is_default`), `emotion_presets` (10 + `custom`), `motion_presets` (12 + `custom`) уже есть и редактируются из бота.
- Решения пользователя (05.10): стили читаем **напрямую** из `style_presets_v2` / `style_groups` (одна таблица на оба продукта); «Эмоция» и «Движение» стоят **как стикер** (цена фото-модели, `sticker_model`); «Текст» — **бесплатный серверный оверлей**, результат сохраняется как новая генерация; пресеты из бота + поле «Своё».
- Статический список `STICKER_STYLES` в `landing/src/lib/sticker.ts` остаётся **fallback**: если запрос к `style_presets_v2` упал или вернул пусто.

## Целевая архитектура

```
«Выбрать стиль» (режим Стикер) ──► GET /api/sticker-catalog ──► style_groups + style_presets_v2 + emotion/motion_presets
                                                                  (service role, Cache-Control s-maxage=300)
Создать стикер ──► POST /api/generate {editKind:sticker, stickerStyleId, photoStoragePaths:[1]}
                   prompt_text = «STICKER style=<id>\n<prompt_hint из БД>»
Результат (edit_kind=sticker) ──► рельса: Посмотреть · Скачать · Эмоция N✦ · Движение N✦ · Текст (бесплатно) · Ещё стикер
  Эмоция/Движение ──► POST /api/generate {editKind:sticker, parentGenerationId, stickerAction, stickerPresetId | stickerCustomHint}
                      prompt_text = «STICKER edit=<action> preset=<id|custom>\n<hint>»; edit_instruction = hint
                      worker: источник = PNG родителя (alpha → flatten #FF00FF) → модель (edit-промт) → rembg → PNG 512
  Текст ──► POST /api/generations/[id]/sticker-text {text ≤ 30}
            landing: sharp + opentype.js (Inter-Bold) бейдж снизу → upload web-generation-results → INSERT landing_generations
            status=completed, credits_spent=0, edit_kind=sticker, parent_generation_id
```

### Контракты

`landing/src/lib/sticker.ts` (общий для landing и worker, без `@/`):

- `buildStickerPromptText({ id, prompt })` — промт строится из строки БД, не из статического списка.
- `buildStickerEditPromptText({ action, presetId, hint })`, `parseStickerEditFromPrompt(prompt)`.
- `assembleStickerFinalPrompt(rawPrompt)` сам различает первичный стикер и edit (по маркеру `STICKER edit=`).
- `STICKER_EDIT_ACTIONS = ['emotion','motion']`, `STICKER_CUSTOM_HINT_MAX = 120`, `sanitizeStickerCustomHint`.
- `STICKER_TEXT_MAX_CHARS = 30`, `normalizeStickerOverlayText`.
- `stickerEditFingerprintFields(parentId, action, presetId, hint)`.

`landing/src/lib/sticker-catalog-db.ts` (только landing): `loadStickerCatalog(supabase)` → `{ groups, styles, emotions, motions }` с fallback на `STICKER_STYLES`; `findStickerStyleInCatalog`, `findStickerPreset`.

### SQL

- `sql/263_sticker_edit_kind_check.sql` — CHECK `edit_kind` включает `sticker` (hotfix, уже применён на проде 05.10).
- `sql/264_sticker_edit_from_result.sql` — `landing_enqueue_generation`: стикер **либо** без родителя + 1 фото + без инструкции, **либо** с родителем `edit_kind='sticker'` + инструкцией + без фото. 262 не правится.

### Воркер

- `process-generation.ts`: для стикера с родителем входной PNG с alpha сплющивается на `#FF00FF` (`flattenStickerSourceForEdit`), чтобы модель видела фон, который потом снимет rembg. Остальной пайплайн (`finalizeStickerImage`) без изменений.
- OpenRouter/Seedream-путь сплющивание не делает (стикер-модель по умолчанию Gemini).

## Масштаб и узкие места

- `GET /api/sticker-catalog` — 4 маленьких запроса, кешируется CDN на 5 мин; клиент кеширует в памяти модуля на сессию. Правка стиля в боте доезжает до сайта ≤ 5 мин.
- Текстовый оверлей — синхронный sharp в `/api` (как `save-to-library`): ≤ 1 МБ PNG, 512×512, `runSharpLimited`. Без очереди.
- Эмоция/движение — обычная очередь воркера; rembg-контейнер общий с ботом (`p2s-rembg`).

## Надёжность

- Фолбэк стилей: БД недоступна → статические 6 стилей, страница и плитка живут.
- Edit-промт запрещает перерисовку с нуля и смену стиля (перенесено из бота); идентичность и magenta-фон — те же CRITICAL RULES.
- Логи: `[generation.create] resolved config` уже содержит `generationMode:'sticker'`, `parentGenerationId`; worker `generation_prompt_resolved` + `sticker_finalized`.
- Метрика: `sticker_emotion`, `sticker_motion`, `sticker_text`.

## Безопасность

- Таблицы бота читаются только service-role на сервере; клиенту уходят `id/emoji/name_ru/prompt_hint/description_ru`.
- Кастомный хинт: trim, без переводов строк, ≤ 120 символов — только в `edit_instruction`/`prompt_text`, в URL не попадает.
- Текст оверлея: ≤ 30 символов, рендер через glyph-пути (opentype.js), без шрифтовой подсистемы контейнера.
- Родитель проверяется дважды: route (`requester_auth_user_id`, `completed`, `edit_kind=sticker`) и RPC.

## Эволюция

1. SQL 264 → деплой landing + worker → плитка «Выбрать стиль» показывает стили бота, рельса — три действия.
2. Позже: превью стилей (колонка `preview_path` в `style_presets_v2` добавляется из репо бота), пак из нескольких стикеров, WebP для Telegram.

## Checklist

- [x] `sticker.ts`: промт из БД, edit-маркер, hint/text нормализация, тесты
- [x] `sticker-catalog-db.ts` + `GET /api/sticker-catalog` + клиентский кэш `sticker-catalog-client.ts`
- [x] `POST /api/generate`: стиль из БД; ветка edit с родителем (`stickerAction` / `stickerPresetId` / `stickerCustomHint`)
- [x] `sql/264_sticker_edit_from_result.sql` — **применить на проде до включения «Эмоция» / «Движение»** (иначе RPC отвечает `sticker_source_conflict`)
- [x] worker: flatten источника для edit (`flattenStickerSourceForEdit`, лог `sticker_edit_source_flattened`)
- [x] `POST /api/generations/[id]/sticker-text` + `opentype.js` + `public/fonts/Inter-Bold.otf`
- [x] UI: `StickerStylePicker` вместо каталога в режиме Стикер; `StickerActionSheet`; рельса результата («Эмоция» / «Движение» с ценой, «Текст» бесплатно); цели Метрики `sticker_emotion` / `sticker_motion` / `sticker_text`
- [x] `/stiker-iz-foto`: список стилей из БД, H2 с живым счётчиком `stickerStylesTitle(count)`
- [x] `docs/architecture/01-landing.md`
- [ ] Прод-проверка: стили из `style_presets_v2` видны в плитке; эмоция → новый стикер с тем же персонажем; текст → PNG с плашкой в истории
