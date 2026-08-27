# Birthday L3 retire + L2 search window

Ветка: `feature/27-08-birthday-l3-retire-search-window`.

## Что делаем

1. L3 кластера `/sobytiya/den-rozhdeniya/{audience}/{object}` больше не отдаём. Постоянный 301 на audience L2 (object-first → audience L2; object×object → первый L2).
2. Сетка хаба и L2 остаётся поиском. Запрос везде `день рождения`. L2 дополнительно фильтрует `audience_tag` / `object_tag`. Listing hybrid материализует до 500 хитов (SQL `least(500, p_limit)`). Публичный `/api/search` остаётся на окне 100.

## Редиректы

См. `DEN_ROZHDENIYA_PERMANENT_REDIRECTS` в `landing/src/lib/den-rozhdeniya-cluster.ts`.
