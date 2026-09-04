# 04-09 — Подбор примеров под загруженное фото

Compose «Выбрать пример» фильтрует каталог по **кто на identity-фото** (`audience_tag`), не по визуальному сходству селфи с результатом карточки.

## Решение

- Сигнал: `devushka` | `muzhchina` | `para` | `semya` | `malchik` | `devochka` | `malysh` (каталожные `audience_tag`).
- Сетка: тот же `GET /api/listing` (`sort=new`, CDN). Auto-тег + чип сцены — два query param.
- Сброс: чип аудитории с крестиком → снова newest. Поиск `q=` тоже снимает auto-тег.
- Visual k-NN (`search_cards_visual` от селфи или от выбранного примера) — не входит.

## Поток

```
Фото загружено / выбрано в «Ваши фото»
  → classify audience + warmup listing (newest, потом tagged)
Шит «Выбрать пример» открыт
  → если тег уже есть — сразу listing?audience_tag=…&strict=1
  → если classify ещё летит — newest, потом подмена (тот же in-flight)
timeout / low conf / 429 → остаёмся на newest
Чип «Девушки ×» → newest; сцена (СВО/Осень) остаётся
Смена фото в «Ваши фото» → снова match (кэш тега, без повторного Gemini)
Выбор примера → только cardId + prompt
```

## Классификатор

`POST /api/compose/classify-audience`

- Гость / ephemeral: `image_base64` (data URL). Фото на диск не пишем.
- Authed library: `photoId` — читаем storage, при попадании в кэш колонки не зовём Gemini.
- Модель: `gemini-2.5-flash`, thinking 0, JPEG ≤256px / ≤20KB (как analyze, чтобы прокси не отваливался).
- Timeout API: 8s. Classify стартует **на загрузке/выборе фото**, не на открытии шторки. UI listing **не ждёт** classify, если тег ещё не готов. SSOT клиента: `compose-example-audience-client.ts`.
- Fallback: `{ audienceTag: null }` (200), без баннера ошибки.

Соло-ребёнок → `malchik` / `devochka` / `malysh` (не взрослый пол и не newest без фильтра). Не маппим `s_mamoy`, `beremennaya`, питомца, «пару» на одном человеке.

## Кэш и флаг

- `landing_user_photos.audience_tag` (+ confidence, tagged_at). Не face-vector.
- Guest: in-memory Map по id фото в пикере.
- Флаг `landing_generation_config.compose_example_match_enabled` default `false`.
- Unlock как у photoshoot: флаг **или** internal allowlist **или** `next dev`.
- Rate limit — своя таблица, не `SEARCH_VISUAL_*`. Лимиты в той же config-таблице.

## Выкат

1. SQL `240` на test/prod (`false`).
2. Деплой кода.
3. `UPDATE landing_generation_config SET value = 'true' WHERE key = 'compose_example_match_enabled'`.
4. Откат — тот же `UPDATE` на `false`.

## Тесты

- `generaciya-foto-compose-example.test.ts` — два фильтра, search сбрасывает audience.
- `compose-example-audience.test.ts` — маппинг JSON → тег / null.
- `compose-example-audience-client.test.ts` — кэш ключ и URL warmup listing.
- `compose-example-match-access.test.ts` — флаг.
