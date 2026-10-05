# Стикеры: chroma-first вырезание, файлы под платформы, примеры стилей

Ветка: `feature/05-10-sticker-styles-actions` (продолжение `docs/05-10-sticker-styles-actions.md`).

## Контекст и допущения

Три проблемы с прода 05.10 (результаты `19bc590a`, `a26c09bd`, `208680c9`):

1. **«Обрезается стикер».** Фигура упирается в края холста без отступа; у бота вокруг всегда прозрачное поле. Причины: `composeStickerFromCutout` после обводки делает `trim → resize(512, contain)` и контент заполняет холст до края; плюс кадр с плоским `#FF00FF` всё равно идёт в rembg (isnet + `alpha_matting_erode_size=10`), который режет по «значимости» и эрозией съедает тонкие части. В боте был роутинг по доле ключевого цвета (PATH A/B/C, снят из-за зелёных артефактов); у нас есть `clearChromaFringe` + белая обводка, magenta на персонаже промт запрещает.
2. **Скачивание** отдаёт PNG 512 с альфой. Telegram принимает PNG/WebP ≤ 512 КБ (одна сторона ровно 512), WhatsApp — только WebP 512×512 ≤ 100 КБ с полем 16 px, Max — PNG/JPG ≥ 288 px ≤ 10 МБ (WebP не принимает). Наш PNG 220–320 КБ — WhatsApp не проходит, лимит 512 КБ не гарантирован.
3. **Нет картинок-примеров стилей.** У бота они есть в общем Supabase: `stickers.is_example = true` + `public_url` (бакет `stickers-examples`, публичный). Все активные стили покрыты (`photo_realistic` 2 … `cartoon_telegram` 53); часть ссылок уже 404.

Решения по умолчанию (диалог выбора не показался): файлы под платформы через выбор при скачивании (без deep link в бота — отдельная спека); chroma-first за флагом, выкат включённым.

4. **Модель стикеров → GPT Image 2.5 Flare через OpenRouter.** Единственная модель на рынке (окт. 2026) с настоящей альфой на уровне API (`background: "transparent"`) и уверенным русским текстом; Gemini / Seedream рисуют RGB (шахматка вместо прозрачности). Решения с пользователем: **5 кредитов**, модель **видна везде** в пикере (`models`) и **дефолт для стикеров** (`sticker_model`), качество **`medium`** (1024², ≈ $0.022 ≈ 1.8 ₽ за кадр по курсу ЦБ 83.48), выкат — SQL-миграция переключает `sticker_model` сразу, откат — `UPDATE` обратно.

## Целевая архитектура

```
worker: provider frame ──► transparentRatio(frame)
        ≥ 0.05 (GPT Image, альфа есть) → без ключа и rembg          route=alpha_native
        иначе magentaRatio(frame)
        ≥ 0.15 → chromaKeyMagenta (hard/soft + despill 3 px)        route=chroma
        0.05–0.15 → chromaKeyMagenta → rembg                       route=chroma_rembg
        < 0.05 → rembg (как сейчас)                                 route=rembg
        флаг sticker_bg_route = rembg → всегда rembg                route=rembg_forced
        → clearChromaFringe → outline → trim → 480 + 16 px поле → PNG 512 (RGBA)
        лог sticker_finalized {magentaRatio, route, rembgMs, rembgAttempts, bytesOut}

prompt:  imageModelOutputsAlpha(model) ? "transparent" : "magenta"
         assembleStickerFinalPrompt(raw, mode) / assembleStickerEditFinalPrompt(spec, mode)
         GPT Image body: model openai/gpt-image-2.5-flare, quality=<sticker_image_quality>, background=transparent,
         output_format png, без resolution; input_references ≤ 16

landing: GET /api/generations/[id]/sticker-file?platform=telegram|whatsapp|max
         STICKER_PLATFORMS (sticker.ts): формат, сторона, поле, maxBytes, filename
         sharp на лету (runSharpLimited): webp q↓ до лимита / png; Content-Disposition; Cache-Control private
         rail «Скачать» → три пункта; цель sticker_download {platform}

catalog: loadStickerCatalog → stickers(is_example, public_url, style_preset_id) → до 3 валидных на стиль
         (HEAD-проверка, кэш 10 мин в памяти процесса) → styles[].exampleUrls → карточка, плитка, страница
```

### Контракты

- `sticker.ts`: `STICKER_BG_ROUTE_CONFIG_KEY = 'sticker_bg_route'`, `STICKER_IMAGE_QUALITY_CONFIG_KEY = 'sticker_image_quality'`, `StickerBgRoute = 'chroma_first' | 'rembg'`, `StickerBackgroundMode = 'magenta' | 'transparent'`, `STICKER_SAFE_MARGIN_PX = 16`, `STICKER_PLATFORMS`, `stickerPlatformById`.
- `image-options.ts`: `GPT_IMAGE_25_FLARE_IMAGE_MODEL = 'gpt-image-2.5-flare'`, `isGptImageModel`, `imageModelOutputsAlpha`, `GptImageQuality = 'low' | 'medium' | 'high'`, `forcedImageCreditCost` → 5, только `1K`, `openRouterSendsResolution=false`.
- Воркер читает `sticker_bg_route` + `sticker_image_quality` одним запросом раз в 60 с (`lib/sticker-config.ts`); нет строки → `chroma_first` / `medium`.
- `/api/sticker-catalog`: `styles[].exampleUrls: string[]` (может быть пусто).

### SQL

- `sql/265_sticker_bg_route.sql`: `INSERT ... ('sticker_bg_route','chroma_first') ON CONFLICT DO NOTHING`.
- `sql/266_gpt_image_25_flare_sticker_model.sql`: merge `gpt-image-2.5-flare` в `models` (cost 5, enabled), upsert `sticker_model='gpt-image-2.5-flare'`, `sticker_image_quality='medium'` (DO NOTHING), `finance_model_unit_costs` 1K 0.022.

## Масштаб и узкие места

- chroma-пасс — O(w·h) на 1024² ≈ 1 М пикселей, ~15–30 мс в Node; rembg был 3.5–5.5 с. На комплаентных кадрах латентность стикера падает на порядок и `p2s-rembg` разгружается.
- Конверсия файла при скачивании — 512² sharp, < 50 мс; через `runSharpLimited`, 503 `busy` под нагрузкой.
- HEAD-валидация примеров — не на каждый запрос: кэш в процессе 10 мин + CDN 5 мин.

## Надёжность

- Любая ошибка chroma-пасса → rembg (как сейчас). Любая ошибка rembg после chroma при `chroma_rembg` → результат chroma.
- Откат роутинга: `UPDATE landing_generation_config SET value='rembg' WHERE key='sticker_bg_route'`.
- Откат модели: `UPDATE landing_generation_config SET value='<прежний id>' WHERE key='sticker_model'` — промт сам вернётся в режим `magenta`, пайплайн в chroma/rembg.
- Fallback OpenRouter → другая модель (`trySeedreamImageFallback`) собирает промт стикера под режим модели-замены.
- Метрика качества: доля `route=rembg` среди стикеров = доля кадров, где модель не нарисовала magenta; рост — сигнал править промт. При GPT Image ожидаем `alpha_native` ≈ 100 %.
- Известное: для эмоции/движения на OpenRouter в `input_references` уходит RGBA PNG родителя (для GPT Image — правильно); RGB-модели Seedream получают прозрачный вход при промте про magenta — не трогаем, пока `sticker_model` = GPT Image.

## Безопасность

- `sticker-file` — только владелец генерации (как `sticker-text`), размер источника ≤ 8 МБ.
- Примеры — публичный бакет бота, URL из БД; наружу уходят только `https://<supabase>/storage/v1/object/public/stickers-examples/...`.

## Эволюция

- Deep link «Добавить в Telegram» через `@Photo_2_StickerBot` (общая БД, бот забирает файл) — отдельная спека.
- Примеры из собственных веб-результатов (`create_ugc`) — когда накопятся.

## Checklist

- [x] worker: `magentaRatio`, `chromaKeyMagenta` + despill, `transparentRatio` / `alpha_native`, роутинг, флаг, отступ 16 px, лог, тесты
- [x] обводка: `hardenAlpha` (порог 128) до дилатации и дилатация уже в финальном размере — без даунскейла после неё. Иначе белое кольцо — градиент, а слабые квадраты модели (альфа < 128) раздуваются в кайму. Уже сохранённый PNG чистится на скачивании: `crispStickerFringe` в `sticker-export.ts` (только почти-белые пиксели).
- [x] `sql/265_sticker_bg_route.sql`
- [x] GPT Image 2.5 Flare: `image-options.ts`, лейбл, `openrouter-seedream.ts` (quality / background), prompt mode, `sql/266`
- [x] `STICKER_PLATFORMS` + `GET /api/generations/[id]/sticker-file` + `StickerDownloadSheet` в rail
- [x] `StickerStudioGate` — админ видит студию при выключенном флаге
- [x] каталог: `exampleUrls` (`lib/sticker-examples.ts`: `stickers.is_example` → 4 кандидата на стиль → HEAD с кэшем 10 мин / вердикт URL 60 мин, concurrency 12, таймаут 3 с, только `stickers-examples` на нашем Supabase-origin) + `StickerExampleStrip` в `StickerStylePicker`, карточках `/stiker-iz-foto` и превью dock-плитки «Выбрать стиль»
- [x] `docs/architecture/01-landing.md`
