# Сортировка листингов категорий: Популярное / Новое

> Дата: 8 июня 2026  
> Статус: реализовано  
> Scope: только листинги SEO-тегов (`/[...slug]/`). Поиск, главная, debug — без изменений.

## Цель

Пользователь в категории видит не только старые хиты, но и свежие карточки. Переключатель «Популярное / Новое», по умолчанию — Популярное.

## UI

- **`ListingSortToggle`** над сеткой в **`CatalogWithFilters`**
- Дефолт: **Популярное**
- Выбор сохраняется в **`sessionStorage`** (`promptshot_listing_sort`), общий для всех категорий в сессии
- При `sort=new` — **`?sort=new`** в URL (SSR без flash)
- Смена сортировки → remount grid, `offset=0`, **`resetListingScroll()`**
- Empty state при `sort=new` и пустом списке: **«Пока нет новых»**

## Режим «Популярное»

- ORDER BY: **`popularity_score DESC`**, `created_at DESC`, `id DESC`
- Формула: `views_7d / (age_hours + 48) ^ 1.2`
- Константы 48 и 1.2 — **`photo_app_config`**
- Карточка с 0 просмотров — внизу, не скрывается

## Режим «Новое»

- ORDER BY: **`created_at DESC`**, `id DESC`
- Те же фильтры качества, что в `resolve_route_cards`: `is_published`, фото, prompt text

## API

`GET /api/listing?sort=popular|new` (default `popular`). Невалидный sort → **400** `{ error: "invalid_sort" }`.

## Данные и jobs

| Объект | Назначение |
|--------|------------|
| `prompt_card_view_events` | Событие просмотра (`card_id`, `viewed_at`) |
| `prompt_cards.views_7d` | Rolling 7d count |
| `prompt_cards.popularity_score` | Материализованный score |
| `recalculate_popularity_scores()` | Hourly batch |
| `src/standalone/recalculate-popularity-scores-standalone.mjs` | Runner на DO |

## Миграции

- `sql/158_prompt_cards_popularity_columns.sql`
- `sql/159_prompt_card_view_events.sql`
- `sql/160_popularity_recalculate_and_view_events.sql`
- `sql/161_resolve_route_cards_listing_sort.sql`

## Out of scope (v2+)

- Поиск, главная, рекомендации
- localStorage между сессиями
- Keyset pagination
- ML-ранжирование

## Связанные документы

- `docs/architecture/01-landing.md`
- `docs/23-03-prompt-card-view-count-requirements.md` — `view_count` для UI; ranking popular → `popularity_score`
