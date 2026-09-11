# 11-09 — Compose: выбор модели на первой генерации

> Дата: 2026-09-11  
> Статус: реализация  
> Ветка: `feature/11-09-compose-model-pick`

## Цель

Не подставлять Nano Banana Flash (5 кредитов) как выбранную модель, если пользователь её не выбирал.

Первая фото-генерация: модель пустая, шторка выбора открывается как «Выбрать стиль» после загрузки фото. После completed image job — запоминать модель вместе с форматом/качеством.

## Поведение

| Состояние | Модель | Шторка |
|---|---|---|
| Нет completed image job | не выбрана | после upload (после примера, если он нужен) или CTA «Выбрать модель» |
| Completed image job есть | restore из prefs / session | не авто |
| `/nano-banana/pro` | Pro | landing `preferModelId` |
| Showcase «Выбрать» | явный id | не авто |

Video / photoshoot / photo_prompt не трогаем.

## SSOT

- `landing/src/lib/compose-image-model.ts`
- Hydrate: `GET /api/generations?limit=1` (или 12, если last-dock)
- Persist image model только после completed photo job
- Session `promptshot:compose-chosen-image-model` — выбор в этой вкладке (гость → auth)
- Бейдж Pro: `COMPOSE_RU_TEXT_BADGE` = «Русский текст» (emerald pill) на карточке `ComposeModelChoiceCard`
- Плитки Фото/Видео: короткое имя модели (`displayTileLabelForGenerationModel`) + мини-лого; «Фото»/«Видео» на верхнем бордере. Без модели — «Выбрать»
- Плитки «Ваши фото» / «Выбрать стиль»: тот же chrome (`ComposeDockToolTile`); выбранные кадры заливают квадрат, 2+ фото — мозаика (`compose-tile-mosaic.ts`); счётчик `n/cap` бейджем на фото. «Выбрать стиль» всегда в ряду инструментов, не только в режиме Фото
- Пустая модалка Фотосессии: explainer сначала одно исходное фото, потом 2×2 из четырёх кадров (`ComposeToolGuide` / `photoshoot-compose-example.ts`). Флаг `photoshoot_compose_example_enabled` (SQL `253`) подставляет каталог `/p/photoshoot-plannertemperature200-four-frame-contact-sheet-from-the-attached-phot-c0b56` (`photoshoot-example-source.jpg` + `photoshoot-example-1.jpg`…`-4.jpg`). Выкл — тот же 1→4 цикл на гайдовом портрете
- Пустая верхняя зона модалки: explainer в ритме «Какое фото добавить» (`compose-tool-guide.ts` / `ComposeToolGuide`). Промт по фото — copy и иллюстрация empty-state `/foto-v-promt` (`FotoVPromtEmptyState`)
- Выбранный tool-tile: заливка indigo как у бордера (`indigo-400` glass / `indigo-500` light)
- «Выбрать стиль»: первая страница listing в memory cache при открытии модалки; клик открывает уже загруженную сетку

## Не делать

- Vendor fallback Flash→Pro по тексту промта
- Смена модели в воркере
- Env-флаг
