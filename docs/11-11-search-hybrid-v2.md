# 11-11 — Гибридный поиск V2 (L2-кэш векторов, кэш выдачи, порог ANN, FTS v2, CTR-буст)

Ветка: `feature/11-11-search-hybrid-v2`

## Контекст и проблемы V1

1. Каждый промах 10-минутного RAM-кэша на `GET /api/search` синхронно вызывает Gemini `embedContent` через DO-прокси (~550–700 мс при таймауте 800 мс; ~25 запросов в сутки падают в `text_fallback`).
2. Пагинация (`offset = 48, 96, 192`) на каждый запрос скролла заново гоняет текстовый и векторный RPC с растущим окном с нуля (`searchMs` до 2.7–3.8 с).
3. `search_cards_visual` не ограничивает `visual_distance` и на узкие запросы досыпает 72–300 нерелевантных карточек.
4. `search_cards_text` использует только `plainto_tsquery('russian', q)` (жёсткий `AND`, без `ё -> е`, без `title_en` и без RU/EN синонимов).
5. Ранкер не использует клики из `landing_search_clicks` как сигнал популярности при близкой релевантности.
6. Продуктовый гейт `SEARCH_VISUAL_ENABLED` жил в env вместо `landing_generation_config`.

## Архитектура V2

### Блок 0. Фичефлаги в `landing_generation_config`
- Ключи в `landing_generation_config` (`sql/280_search_hybrid_v2.sql`, `ON CONFLICT DO NOTHING`):
  - `search_visual_enabled` = `'false'` (перед выкатом контейнера на прод выставляется `'true'`).
  - `search_visual_max_distance` = `'0.70'` (`0` или пустая строка отключают отсечку).
- Чтение в `visual-search-config.ts` с 30-секундным in-memory кэшем. `process.env.SEARCH_VISUAL_ENABLED` удалён.

### Блок 1. L2-кэш векторов запросов (`search_query_embeddings`) + Write-Behind + Cron прогрев
- Таблица `public.search_query_embeddings` (`service_role` only, RLS on): `query_hash` PK, `query_norm`, `model`, `generation`, `use_task_prefix`, `embedding vector(768)`, `hit_count`, `last_used_at`, `created_at`.
- Горячий путь: `L1 RAM LRU (2000 ключей, 60 мин)` -> `L2 Postgres get_search_query_embedding` (обновляет `hit_count` / `last_used_at` не чаще раза в час) -> `Gemini embedContent (800 мс)`.
- Попадание в L2 не списывает `visual_search_rate_limit` и не трогает Gemini.
- После успешного live-ответа Gemini (`embedSource = "gemini"`) для запросов длиной `2..80` символов вектор пишется в `search_query_embeddings` через Next `after()` (`0 мс` к латентности ответа).
- Пятиминутный крон (`visual-embedding-cron.ts` / `POST /api/cron/visual-embeddings`) прогревает чипы подсказок (`SEARCH_SUGGESTIONS`, сценарии `/generaciya-foto`) и до `10` популярных запросов из `landing_search_events` (`searches >= 2` за 7 дней) с `timeoutMs = 8000` и `budgetActor = "system"`. Раз в сутки (03:00–03:04 UTC) вызывает `prune_search_query_embeddings()`.

### Блок 2. Кэш ранжированной выдачи (10 минут, топ-240)
- `searchResultCache` (500 записей, TTL 10 мин) + `searchResultFlight` по ключу `queryHash + filtersKey + generation + maxDistance`.
- Для `offset + limit <= 240` материализуется окно 240 карточек и кэшируется при `outcome !== "text_fallback"`. Скролл `offset = 48..192` отдаётся срезом из памяти (`< 1 мс` до `enrichCardsWithDetails`).

### Блок 3. Отсечение хвоста ANN (`max_visual_distance`)
- Новая перегрузка `search_cards_visual(..., p_max_distance real DEFAULT NULL)` фильтрует кандидатов в CTE `knn`: `(p_max_distance IS NULL OR (e.embedding <=> p_embedding) <= p_max_distance)`.
- Если после отсечения `visualCards` пуст, возвращаются честные текстовые хиты (или пустая выдача `0` карточек вместо случайного шума).

### Блок 4. Текстовый поиск V2 (`ё -> е`, `title_en`, синонимы, мягкий `OR`)
- Нормализация запроса (`search-query-normalize.ts`): `lower`, `trim`, пробелы, `ё -> е` + компактный двусторонний словарь RU/EN синонимов для текстовой ветки (`чб`, `олд мани`, `полароид`, `киберпанк`, `аниме`, `авто`, `др`) без изменения исходной строки для Gemini-эмбеддинга.
- `rebuild_card_fts` нормализует `ё -> е` и индексирует `title_en` (`english` A-weight). Добавлен GIN индекс `idx_cards_title_en_trgm`.
- Для запросов из 3+ лексем в `search_cards_text` добавлен мягкий `OR`-контур (`fts_soft_or`, потолок `relevance_score < 200`), чтобы частичные текстовые совпадения усиливали RRF, но не пробивали `STRONG_FTS_MIN_SCORE (200)`.

### Блок 5. CTR / Популярность как Tie-Breaker
- Колонка `prompt_cards.search_clicks_30d` обновляется раз в час через `refresh_card_search_clicks_30d()` из `landing_search_clicks`.
- Внутри Tier 2 ранкера добавляется ограниченный логарифмический бонус:
  `Math.min(0.0045, 0.0012 * Math.log1p(clicks30d) + 0.0002 * Math.log1p(viewCount))`.

## Чеклист реализации и выката

- [x] Ветка `feature/11-11-search-hybrid-v2` и спека
- [x] SQL миграция `sql/280_search_hybrid_v2.sql` (с сохранением старых перегрузок RPC)
- [x] Чтение `search_visual_enabled` и `search_visual_max_distance` из `landing_generation_config`
- [x] Нормализатор и словарь RU/EN синонимов `search-query-normalize.ts`
- [x] L2 Postgres кэш векторов запросов + `after()` write-behind + cron warm/prune
- [x] 10-минутный кэш ранжированной выдачи (топ-240) + `max_visual_distance`
- [x] Tie-breaker по `search_clicks_30d` / `view_count`, unit-тесты и обновление `docs/architecture/01-landing.md`, `03-pipeline.md`

### Порядок выката на prod (без даунтайма)
1. Применить `sql/280_search_hybrid_v2.sql` в Supabase.
2. Выполнить `UPDATE landing_generation_config SET value = 'true' WHERE key = 'search_visual_enabled';`.
3. Задеплоить лендинг.
4. Проверить в Loki `embedSource` (`l1` / `l2_db` / `gemini`), `[visual-embeddings] cron` и скорость `offset > 0`.
