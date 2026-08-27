# Birthday L3 retire + L2 search window

Ветка: `feature/27-08-birthday-l3-retire-search-window`.

## Что делаем

1. L3 кластера `/sobytiya/den-rozhdeniya/{audience}/{object}` больше не отдаём. Постоянный 301 на audience L2 (object-first → audience L2; object×object → первый L2).
2. Хаб и L2 девушке / с тортом — категорийные теги (`resolve_route_cards`, сорт по новизне). L2 детям / мужчине / с детским фото / с шампанским / со львом — свои поисковые запросы (`дети день рождения`, `мужской день рождения`, …). Их query-векторы лежат в `listing_query_embeddings` (SQL `223`); `/api/search` в эту таблицу не пишет. Публичный `/api/search` остаётся на окне 100.

## Редиректы

См. `DEN_ROZHDENIYA_PERMANENT_REDIRECTS` в `landing/src/lib/den-rozhdeniya-cluster.ts`.
