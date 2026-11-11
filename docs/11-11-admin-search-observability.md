# 11-11 — Наблюдаемость гибридного поиска в `/admin/search`

Ветка: `feature/11-11-admin-search-observability`

## Цель

Показывать на странице `/admin/search` три операционные метрики поискового движка:
1. Какая доля поисков идёт через эмбеддинги (`hybrid`), а какая только через текст (`text` + `text_fallback`).
2. Сколько опубликованных карточек с фото сейчас без готового эмбеддинга (`published_with_photo - ready`) и что в очереди `prompt_card_visual_embedding_jobs`.
3. Сколько текстовых запросов реально ушло в Gemini за вектором (когда готового вектора не было ни в `L1 RAM`, ни в `L2 search_query_embeddings`) против запросов, обслуженных готовыми векторами.

## Архитектура

1. **Серверная телеметрия первых страниц поиска (`sql/281_admin_search_observability.sql`):**
   - Таблица `public.search_engine_daily_stats` (по UTC-дням, `service_role` only): агрегирует все вызовы `GET /api/search` с `offset = 0` (включая `/search` и инлайн-поиск на хабах) через Next `after()` (`0 мс` на критическом пути ответа).
   - Идемпотентный исторический seed из `landing_search_events` по `match_type`, чтобы доля `эмбеддинги vs текст` была видна сразу за `7 / 30 / 90` дней.
   - В `landing_search_events` добавляются опциональные поля `search_outcome`, `embed_source`, `fallback_reason`.
2. **Единый admin RPC `admin_search_observability(p_days int)`:**
   - Возвращает `jsonb` со сводкой режимов (`hybrid` / `text_only` / `fallback`), источниками векторов (`embed_gemini_ok` + `embed_gemini_error` vs `embed_l1_hits` + `embed_l2_db_hits` + `embed_guard_blocked`), дневным рядом, общим числом сохранённых векторов в `search_query_embeddings`, расходом дневного бюджета `visual_search_rate_limit` и живым срезом `visual_embedding_coverage()`.
   - Сигнатуры существующих `admin_search_summary` и `admin_search_queries` не меняются (безопасный rolling-deploy).
3. **UI `/admin/search` (`SearchAnalyticsDashboard.tsx`):**
   - Секция из 3 карточек состояния движка:
     1) «Эмбеддинги vs Текст»
     2) «Карточки без эмбеддинга»
     3) «Ушло в Gemini vs Готовый вектор»

## Чеклист

- [x] Ветка `feature/11-11-admin-search-observability` и спека
- [x] SQL миграция `sql/281_admin_search_observability.sql`
- [x] Телеметрия в `GET /api/search` (`after()`) и поля в `POST /api/search-events`
- [x] `fetchSearchAnalyticsDashboard` + UI карточек в `SearchAnalyticsDashboard.tsx`
- [x] Тесты, проверка `tsc` и обновление `docs/architecture/01-landing.md`
