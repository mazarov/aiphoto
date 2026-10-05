# Стикер из фото — веб-генератор на promptshot.ru

> Рынок: RU (Яндекс + Google). Ветка `feature/04-10-stiker-iz-foto`. Срез спроса — Wordstat `sticker-wordstat.csv` (04.10.2026, 299 фраз, Россия). Позиций по URL нет: токен Вебмастера протух — baseline снимаем после обновления токена.

## Решения

| Вопрос | Решение |
|---|---|
| Домен / URL | promptshot.ru, корневой `/stiker-iz-foto` (вне catch-all, свой route) |
| Продукт | 1 стикер за генерацию: PNG 512×512 с прозрачным фоном и белой обводкой. Цена = цена фото-модели |
| UI | Generate dock, инструмент «Стикер» (`seedSticker`, idle intent `sticker`). Отдельной `StickerStudio` нет |
| Фон | Уже поднятый контейнер `p2s-rembg:5000` проекта photo2sticker. Генерация остаётся в `web-generation-worker`. `REMBG_URL` — внутренний адрес по межпроектной сети Dockhost |
| Флаг | `landing_generation_config.sticker_generation_enabled` (default `false`). Гейтит API, плитку dock, index и sitemap одним ключом |
| Владение ключом | «сделать / создать стикер из фото», «фото в стикер», «стикер из фото онлайн», «нейросеть стикеры» — `/stiker-iz-foto`. «Бот для стикеров», «стикерпак в тг», «стикеры айфона» — остаются у photo2sticker.ru (бот). Пересечение по голове «стикер из фото» — риск, мерим по URL в обоих Вебмастерах |

## Семантика (срез 04.10, уникальные фразы)

| Интент | Показы | Что делаем |
|---|---|---|
| Ядро «стикер из фото / фото в стикер / сделать стикер из фото» | ~61 000 | H1, Title, intro |
| Онлайн / бесплатно / бот / приложение | ~4 800 | Title-хвост «онлайн», FAQ «бесплатно» |
| Нейросеть / ИИ | ~2 900 | H2 секции стилей |
| Стикерпак | ~14 700 | FAQ: как собрать пак из PNG в Telegram / Max (продукт отдаёт по одному стикеру) |
| Платформы iPhone / Android | ~11 500 | FAQ: работает в браузере на любом телефоне; на фичу iOS не претендуем |
| Мессенджер Макс / ТГ / WhatsApp | ~6 900 | FAQ по Max и Telegram |
| Стиль мультяшный / аниме / 3D / без фона | ~400 | пресеты стилей, названия на чипах |
| Удалить / где хранятся / картинки для стикеров | ~55 000 | не наш интент, не трогаем |

## Карта слотов `/stiker-iz-foto`

| Слот | Ключ | Показы | Текст |
|---|---|---|---|
| H1 (основной) | сделать стикер из фото | 9 744 (лемма «стикер из фото» 14 750) | `Сделать стикер из фото` |
| Title (≠ H1) | стикер из фото онлайн | 985 | `Сделать стикер из фото онлайн 🎨 — нейросеть, PNG без фона за минуту` |
| Hero intro | фото в стикер | 11 283 | «Превратите фото в стикер: загрузите снимок, выберите стиль…» |
| H2 стили | нейросеть стикеры | 881 | `Нейросеть для стикеров: 6 стилей` |
| FAQ | сделать стикерпак · бесплатно · на айфоне / андроиде · в макс · из картинки | 3 710 · 643 · 3 065 · 2 401 · 1 409 | вопросы FAQ |

Одна лемма — один заголовок: «стикер» в H1, «нейросеть» в H2 стилей, «фото в стикер» только в intro.

## Контракт

### API `POST /api/generate`

```json
{
  "editKind": "sticker",
  "stickerStyleId": "cartoon",
  "photoStoragePaths": ["<user>/<uuid>.jpg"],
  "generationSurface": "seo_page"
}
```

- Флаг `sticker_generation_enabled` выкл и email не в allowlist → `503 sticker_disabled`.
- Ровно одно фото, без `parentGenerationId`, без `editInstruction`, modality `image`.
- Сервер сам собирает `prompt_text` из стиля (`buildStickerPromptText`), `aspect_ratio=1:1`, `image_size=1K`, модель — `sticker_model` из конфига (default `default_model`), цена — `cost` модели.
- `p_edit_kind='sticker'`, `p_create_ugc=false` (прозрачный PNG не идёт в каталог).

### Worker

- `isStickerEditKind(job.edit_kind)` → промпт `assembleStickerFinalPrompt(rawPrompt)` (flat #FF00FF фон, chest-up, без обводки и текста, 15 % поля).
- После провайдера вместо `encodeGenerationResult` → `finalizeStickerImage`: rembg `POST {REMBG_URL}/remove-background` → убрать остатки magenta → белая обводка (dilate alpha) → trim → 512×512 contain → PNG. Результат `.png`, `image/png`. Лог `sticker_finalized`: `rembgMs`, `rembgAttempts`, `bytesOut`.
- Нет `REMBG_URL` → `config_error` без retry. rembg 5xx / сеть → temporary (retry по общей политике, refund при terminal fail).

### Страница и dock

- Server page, ISR 3600. Флаг выкл → `robots: noindex`, нет плитки, CTA в бота @Photo_2_StickerBot. Флаг вкл → index, sitemap 0.9, плитка «Стикер» в dock.
- Вход: FAB / таббар / hero «Создать стикер» → `seedSticker`. В панели: одно фото из библиотеки, чип стиля, `editKind=sticker`. Результат — PNG на шахматке, «Скачать» и «Ещё стикер».
- Нет кредитов → pricing-модалка (`usePricingModal`).

### Включение на проде

1. Dockhost: разрешить трафик проекта aiphoto (web-generation-worker) → проект photo2sticker. Внутренний адрес `p2s-rembg:5000`. Из контейнера воркера `GET /health`.
2. Env воркера (не в git): `REMBG_URL=http://<ip-or-dns>:5000`.
3. Применить `sql/262_sticker_generation.sql`. При желании `sticker_model` (лучше Gemini — ровный magenta).
4. Задеплоить лендинг и воркер после мержа.
5. `UPDATE landing_generation_config SET value='true' WHERE key='sticker_generation_enabled'` — плитка, index и sitemap сразу. Откат — то же `UPDATE` на `false`, без редеплоя.

## Checklist

- [x] `landing/src/lib/sticker.ts` + тесты
- [x] `sql/262_sticker_generation.sql`
- [x] API-ветка sticker
- [x] Worker: промпт, rembg finalize, `REMBG_URL`, tsconfig + оба Dockerfile
- [x] Страница, copy SSOT, JSON-LD, sitemap
- [x] Инструмент dock «Стикер» (`seedSticker`, плитка, чипы, шахматка)
- [x] `docs/architecture/01-landing.md`
- [ ] Деплой: сеть Dockhost до `p2s-rembg` проекта photo2sticker, `REMBG_URL` на worker, миграция 262, затем `UPDATE … sticker_generation_enabled='true'`
- [ ] Baseline Вебмастера по `/stiker-iz-foto` после индексации; окно 2–4 недели

## Риски

- Нет позиций по URL (токен Вебмастера) — спрос только по Wordstat.
- Два своих домена на один head-ключ. Если photo2sticker.ru держит топ по «стикер из фото» — не трогать его Title до окна измерения.
- rembg на лицах с волосами даёт рваный край — проверить на 10 кадрах до включения флага.
