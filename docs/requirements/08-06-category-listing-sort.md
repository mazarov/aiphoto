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
- **Score считается на лету в `resolve_route_cards`** (миграция `163`), без cron и без материализации
- Формула: `(view_count + react_weight·(likes_count − dislikes_count)) / (1 + age_days / half_life_days) ^ decay_exponent`
- Константы — **`photo_app_config`**: `listing_popularity_react_weight`=3.0, `listing_popularity_half_life_days`=30, `listing_popularity_decay_exponent`=1.0
- База — lifetime `view_count` (обновляется в реальном времени), лайки — лёгкий бонус, возраст — мягкое затухание
- Карточка с 0 просмотров — внизу, не скрывается

> **История:** изначально (миграции `158–161`) score был материализован (`prompt_cards.popularity_score`) и пересчитывался hourly job'ом `recalculate_popularity_scores()` по `views_7d` из `prompt_card_view_events`. Cron на DO **не был настроен** → score завис в 0 у всех карточек, и `popular` совпадал с `new`. Миграция `163` убрала зависимость от cron: score теперь query-time. Колонки `popularity_score`/`views_7d`, job и таблица событий оставлены как наследие (follow-up на чистку).

## Режим «Новое»

- ORDER BY: **`created_at DESC`**, `id DESC`
- Те же фильтры качества, что в `resolve_route_cards`: `is_published`, фото, prompt text

## API

`GET /api/listing?sort=popular|new` (default `popular`). Невалидный sort → **400** `{ error: "invalid_sort" }`.

## Данные и jobs

| Объект | Назначение |
|--------|------------|
| `prompt_cards.view_count` | Lifetime просмотры (realtime, через `/api/card-view`) — база score |
| `prompt_cards.likes_count` / `dislikes_count` | Реакции (триггер из `card_reactions`) — бонус в score |
| `photo_app_config` | Константы формулы (`react_weight`, `half_life_days`, `decay_exponent`) |
| ~~`prompt_card_view_events` / `views_7d` / `recalculate_popularity_scores()`~~ | **Наследие** (миграции 158–160): больше не участвуют в ранжировании |

## Миграции

- `sql/158_prompt_cards_popularity_columns.sql` *(наследие)*
- `sql/159_prompt_card_view_events.sql` *(наследие)*
- `sql/160_popularity_recalculate_and_view_events.sql` *(наследие)*
- `sql/161_resolve_route_cards_listing_sort.sql`
- `sql/163_resolve_route_cards_query_time_popularity.sql` — **query-time score, без cron**

## Out of scope (v2+)

- Поиск, главная, рекомендации
- localStorage между сессиями
- Keyset pagination
- ML-ранжирование

## Связанные документы

- `docs/architecture/01-landing.md`
- `docs/23-03-prompt-card-view-count-requirements.md` — `view_count` для UI; ranking popular → `popularity_score`
