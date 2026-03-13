# Полнотекстовый поиск по сайту (PG FTS + pg_trgm)

**Дата:** 2026-03-13
**Статус:** code ready, pending SQL migration on DB
**Ветка:** `feature/13-03-fulltext-search`

## Цель

Добавить публичный текстовый поиск по карточкам промптов на лендинге PromptShot.
Пользователь вводит запрос — получает релевантные карточки.

## Текущее состояние

- Навигация только по категориям (audience, style, occasion, object, doc_task)
- Поиск доступен только в debug-панели (по UUID и фильтрам)
- Полнотекстового поиска нет

## Что ищем

| Поле | Таблица | Вес |
|---|---|---|
| `title_ru` | prompt_cards | A (высший) |
| `title_en` | prompt_cards | B |
| seo_tags (все значения) | prompt_cards | C |

## Технология

### PostgreSQL Full-Text Search (FTS)

- `tsvector` колонка с весами (A/B/C) для заголовков и тегов
- `plainto_tsquery('russian', ...)` для русскоязычных запросов
- `ts_rank()` для ранжирования
- GIN-индекс на tsvector

### pg_trgm (триграммы) — fallback

- Для typo tolerance: "партрет" → "портрет"
- `similarity()` + оператор `%`
- GIN-индекс `gin_trgm_ops` на `title_ru`
- Используется когда FTS не даёт результатов

## Архитектура

```
[SearchBar] → debounce 300ms → GET /api/search?q=...&limit=20
                                       ↓
                               supabase.rpc('search_cards_text')
                                       ↓
                               PostgreSQL: FTS → fallback trgm
                                       ↓
                               enrichCardsWithDetails()
                                       ↓
                               JSON { cards, total }
```

## SQL миграция (120)

### 1. Расширение pg_trgm

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 2. Колонка tsvector

```sql
ALTER TABLE prompt_cards ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce(title_ru, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title_en, '')), 'B')
  ) STORED;
```

### 3. Индексы

```sql
CREATE INDEX IF NOT EXISTS idx_cards_fts ON prompt_cards USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_cards_title_ru_trgm ON prompt_cards USING GIN(title_ru gin_trgm_ops);
```

### 4. RPC search_cards_text

Параметры:
- `p_query text` — поисковый запрос
- `p_limit int DEFAULT 20`
- `p_offset int DEFAULT 0`

Возвращает:
- `id, slug, title_ru, title_en, seo_tags, relevance_score, match_type`

Логика:
1. FTS: `fts @@ plainto_tsquery('russian', p_query)`
2. Если 0 результатов → fallback: `similarity(title_ru, p_query) > 0.15`
3. Только `is_published = true` + есть фото
4. ORDER BY: `ts_rank DESC, seo_readiness_score DESC`

## API route

`GET /api/search?q=текст&limit=20&offset=0`

- Минимальная длина запроса: 2 символа
- Ответ: `{ cards: PromptCardFull[], total: number, matchType: 'fts' | 'trgm' }`

## UI компоненты

### SearchBar (в Header)

- Поле ввода с иконкой поиска
- Debounce 300ms
- Dropdown с превью результатов (до 5 карточек)
- Enter / клик → переход на `/search?q=...`
- Escape → закрыть dropdown
- Mobile: иконка → раскрывается поле

### Страница /search

- Полная страница результатов
- Поле поиска сверху
- Карточки в grid (переиспользуем PromptCard)
- Пагинация
- "Ничего не найдено" + предложения категорий
- SEO: `<title>Поиск: {query} — PromptShot</title>`

## Ограничения

- Поиск по текстам промптов (prompt_variants) — **отложено** на этап 2
- Автодополнение с подсказками тегов — **отложено** на этап 2
- Семантический поиск (pgvector) — **отложено** на этап 2

## Файлы (реализовано)

| Файл | Изменение | Статус |
|---|---|---|
| `sql/120_fulltext_search.sql` | Миграция: pg_trgm, fts колонка, индексы, RPC | done |
| `landing/src/lib/supabase.ts` | `searchCardsByText()` | done |
| `landing/src/app/api/search/route.ts` | API route GET /api/search | done |
| `landing/src/components/SearchBar.tsx` | Компонент поиска с dropdown | done |
| `landing/src/components/HeaderClient.tsx` | SearchBar в Header | done |
| `landing/src/app/search/page.tsx` | Server page + metadata | done |
| `landing/src/app/search/SearchResults.tsx` | Client-side results with pagination | done |

## Деплой

1. Применить миграцию `sql/120_fulltext_search.sql` на БД
2. Задеплоить лендинг (Docker rebuild)
