# PromptShot: аналитика поиска на /admin/analytics

> Дата: 2026-09-13
> Ветка: `feature/13-09-search-analytics`

## Цель

В `/admin/analytics` видеть first-party факты по **зафиксированным** поискам:

1. что пользователь ввёл в `/search`;
2. какой размер выдачи мы показали на первой странице;
3. конверсия в просмотр карточки промта (CTR, позиция).

Метрика (`/search?q=`) остаётся контрольным контуром, не источником дашборда: нет `result_count` и нет join к клику.

## Что считается поиском

Только успешный first-page `doSearch` на `/search` после debounce / Enter / сабмита хедера / клика чипа.

Не пишем:

- префиксы при наборе (отдельные abort-запросы);
- инлайн-превью на главной / каталоге / generate;
- `/api/listing?q=` (теги birthday-кластера, не пользовательский ввод);
- пагинацию как новый поиск (тот же `search_id`).

`result_count` = `cards.length` первой страницы (лимит 48). Настоящего total у `/api/search` нет. `has_more` = `length === 48`.

## Почему не GET /api/search

`GET /api/search` отдаёт `Cache-Control: public, s-maxage=30`. Запись в GET посчитала бы только cache-miss. Ingest — отдельный `POST /api/search-events` с клиента после ответа, best-effort (`keepalive`), вне критического пути поиска.

## События

| event | когда | ключ |
|---|---|---|
| `search` | first page `/search` успешен | клиентский `search_id` |
| `search_click` | открытие карточки из этой выдачи | тот же `search_id` + slug + position |

`search_id` живёт в snapshot `/search` и в отдельном `promptshot_search_nav_v1` (не в общем listing-nav: каталог его перезапишет). Remount / overlay с тем же `requestKey` — тот же id. Смена q или фильтров — новый id.

Клик: модалка (`open` / `goToNeighbor`) и hard `/p/{slug}` (`entry=page`), если slug есть в search-nav. Каталог search-nav не пишет.

Дедуп: клиент — один ingest на `search_id`, повтор `(session, query_norm, filters)` за 30 с не шлёт новое событие. Сервер — `ON CONFLICT (id) DO NOTHING`.

## Данные

Миграция `sql/254_landing_search_analytics.sql`:

- `landing_search_events` — append-only поиски
- `landing_search_clicks` — append-only клики
- view `analytics_search_daily`
- RPC `admin_search_summary(p_days)`, `admin_search_queries(p_days, p_limit, p_zero_only)`
- только `service_role`; IP нет

Retention сырых событий: 180 дней (cleanup RPC/cron — follow-up, не блокер дашборда).

## Дашборд

`GET /api/admin/search-analytics?days=1|7|30|90` + `requireAnalyticsAdmin`, `Cache-Control: no-store`.

Секция `SearchAnalyticsSection` на `/admin/analytics` (свой fetch, как кредиты):

- KPI: поиски, уникальные visitor, доля нулевой выдачи, CTR (поиски с ≥1 click), средний `result_count`
- ряд по дням: поиски / клики / zero-result
- топ запросов: текст, поиски, уники, средний размер, клики, CTR
- раскрываемая «Нулевая выдача»

Истории до выката нет.

## Эволюция

- v1.1 — join по `visitor_id` к `prompt_copy` / `landing_generations` / оплатам
- v2 — инлайн-превью отдельной поверхностью
- materialized daily — если RPC топа > ~200 ms на 90 днях
