# 01 — Лендинг (promptshot.ru)

> Последнее обновление: 2026-03-18

## Стек

| Компонент | Технология |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| Язык | TypeScript |
| Стили | Tailwind CSS |
| Шрифт | Inter (latin + cyrillic) |
| БД / API | Supabase (service role на сервере, anon key в браузере) |
| Хостинг | Vercel |
| Аналитика | — |

---

## Структура маршрутов

```
/                       → Главная (категории + поиск)
/p/[slug]               → Карточка промта
/[...slug]              → Листинг по тегу (напр. /promty-dlya-foto-devushki, /stil/cherno-beloe)
/search                 → Поиск (клиентский)
/favorites              → Избранное (требует авторизации)
/generations            → Мои генерации (debug-only, требует auth)
/auth/callback          → OAuth callback (server-side)
```

### API Routes

| Путь | Назначение |
|------|-----------|
| `/api/search` | Текстовый поиск (`search_cards_text` RPC) |
| `/api/filter-counts` | Счётчики тегов для текущей выборки (`get_filter_counts` RPC) |
| `/api/search-card` | Карточка по ID / prefix / batch |
| `/api/search-cards` | Фильтрованный поиск (`search_cards_filtered` RPC) |
| `/api/datasets` | Список датасетов (debug) |
| `/api/set-before` | Before/after медиа |
| `/api/generation-config` | Конфиг генерации (модели, лимиты) |
| `/api/generation-prompt` | EN промпт карточки по cardId |
| `/api/upload-generation-photo` | Загрузка фото для генерации |
| `/api/generate` | Запуск генерации (auth) |
| `/api/generate-process` | Внутренний: обработка генерации |
| `/api/generations` | Список генераций пользователя |
| `/api/generations/[id]` | Статус/результат генерации |
| `/api/me` | Текущий пользователь + credits |

### Модуль генерации (debug-only)

- **Точка входа:** кнопка «Сгенерировать» на странице карточки (`/p/[slug]`), рядом с «Скопировать промпт».
- **Видимость:** только при `debugOpen` (5 кликов по логотипу в футере).
- **Flow:** Browser → POST /api/generate → создание записи → fire-and-forget fetch на /api/generate-process → Gemini через VPN proxy → результат в Storage.
- **Gemini routing:** `generate-process` читает `photo_app_config.gemini_use_proxy`; при `true` использует `GEMINI_PROXY_BASE_URL`, при `false` ходит напрямую в `generativelanguage.googleapis.com`.
- **Таблицы:** `landing_users.credits`, `landing_generations`, `landing_generation_config`.
- **Storage:** `web-generation-uploads` (входные фото), `web-generation-results` (результаты).
- **Страница:** `/generations` — «Мои генерации» (в дропдауне пользователя при debug).

### Статические файлы

- `sitemap.ts` — динамический sitemap (L1 теги + L2 комбинации + карточки)
- `robots.ts` — robots.txt

---

## Рендеринг и кеширование

### Стратегия: ISR (Incremental Static Regeneration)

Все основные страницы используют `revalidate = 3600` (1 час):

| Страница | Рендеринг | Кеш |
|----------|-----------|-----|
| `/` (главная) | ISR | `revalidate = 3600` |
| `/p/[slug]` (карточка) | ISR | `revalidate = 3600` |
| `/[...slug]` (листинг) | ISR | `revalidate = 3600` |
| `/search` | CSR | `robots: noindex` |
| `/favorites` | CSR | требует auth |
| `/generations` | CSR | debug-only, требует auth |

### Слои кеширования

```
┌─────────────────────────────────────────────┐
│  1. Next.js ISR Cache (revalidate=3600)     │ ← страница целиком
├─────────────────────────────────────────────┤
│  2. unstable_cache (revalidate=3600)        │ ← fetchMenuCounts (Header)
├─────────────────────────────────────────────┤
│  3. React.cache (per-request dedup)         │ ← getCardPageData (metadata + page)
├─────────────────────────────────────────────┤
│  4. loading.tsx (Suspense skeletons)        │ ← мгновенный UI при навигации
├─────────────────────────────────────────────┤
│  5. <Link prefetch> (client-side prefetch)  │ ← предзагрузка при hover
└─────────────────────────────────────────────┘
```

**Почему `unstable_cache` для меню:** Header вызывает `fetchMenuCounts`, который делает ~88 RPC-запросов `resolve_route_cards` для подсчёта карточек в каждой категории. Без кеша это 2-4 сек на каждый cold page load.

---

## Data Flow

### Главная страница

```
fetchHomepageSections(siteLang)          ← RPC get_homepage_sections
  → sections[] с фото-URL
  → buildMenuCountsFromSections()       ← без доп. запросов
  → pickDeduplicatedPhotos()
  → CategorySection[]
```

### Листинг `/[...slug]` (L1 / L2 / L3)

```
resolveUrlToTags(slugSegments)          ← route-resolver.ts
  → ResolvedRoute { tags[], level, rpcParams, canonicalPath, parentPath }
fetchRouteCards(rpcParams)              ← RPC resolve_route_cards (multi-tag)
  → RouteCard[]
expandCardGroups(cards)                 ← prompt_cards (siblings, Promise.all)
enrichCardsWithDetails(cards)           ← prompt_cards + prompt_variants
                                          + prompt_card_media
                                          + prompt_card_before_media
getSeoForRoute(route)                   ← seo-templates.ts → seo-content.ts fallback
  → h1, metaTitle, metaDescription, intro, FAQ, howTo
```

**Programmatic SEO levels:**

| Level | URL example | Резолвинг |
|-------|------------|-----------|
| L1 | `/promty-dlya-foto-devushki/` | 1 тег из TAG_REGISTRY |
| L2 | `/promty-dlya-foto-devushki/cherno-beloe/` | 2 тега из разных измерений |
| L3 | `/promty-dlya-foto-devushki/cherno-beloe/v-zerkale/` | 3 тега из разных измерений |

**Index/noindex:** L1 >= 3 карточек, L2/L3 >= 6 карточек. При noindex — canonical на родительский L1.

**L2 чипы на L1:** На L1 страницах отображаются чипы-ссылки на L2 комбинации, сгруппированные по измерениям. Данные из RPC `get_indexable_tag_combos(min_cards=6)`, фильтруются для текущего L1 тега. Чипы показывают label + количество карточек.

**Фильтрация (FilterFAB):** Плавающая кнопка справа внизу на листингах и в поиске. При нажатии открывается панель с чипсами по измерениям: Кто на фото, Стиль, Событие, Сцена. Фильтры передаются через query params (`?audience=devushka&style=portret`). На tag-страницах измерения, уже заданные URL-путём, скрыты из панели. Каталог: серверный merge `route.rpcParams` + `searchParams`, refetch при смене фильтров. **Применимые теги:** на каталоге FilterPanel запрашивает `/api/filter-counts` (RPC `get_filter_counts`); на поиске — агрегирует счётчики из загруженных карточек (`cardsForCounts`). Показываются только теги с карточками, с счётчиками (напр. «Портрет (42)»), отсортированы по убыванию count.

### Карточка `/p/[slug]`

```
getCachedCardPageData(slug)             ← React.cache(getCardPageData)
  → prompt_cards (by slug)
  → prompt_variants
  → prompt_card_media
  → prompt_card_before_media
  → siblings (same source_message_id)
getFirstTagFromSeoTags(seo_tags)        ← breadcrumb
```

### Поиск `/search`

```
SearchResults (client, infinite scroll)
  → /api/search?q=&limit=24&offset=N
  → search_cards_text (hybrid rank: FTS + trigram)
  → enrichCardsWithDetails(cards)
  → FilterFAB: фильтрация по audience/style/occasion/object (client-side по seo_tags)
```

- Пагинация детерминированная: `24 → 48 → 72` (без расширения групп в поиске).
- Ранжирование гибридное: морфология (`fts`) + fuzzy (`trigram` по `title_ru` и `prompt_text_ru`).
- Стабильная сортировка: `has_fts DESC`, затем `relevance_score`, `source_date DESC`, `id`.

---

## Ключевые компоненты

### Server Components

| Компонент | Файл | Роль |
|-----------|------|------|
| PageLayout | `components/PageLayout.tsx` | Серверный: fetchMenuCounts → HeaderClient + SidebarNav + children + Footer |
| Header | `components/Header.tsx` | Legacy серверный (заменён PageLayout) |
| Footer | `components/Footer.tsx` | Статический |
| CardPage | `app/p/[slug]/page.tsx` | Серверный, SSR карточки |

### Client Components

| Компонент | Файл | Роль |
|-----------|------|------|
| HeaderClient | `components/HeaderClient.tsx` | Тонкий sticky header: логотип + SearchBar + UserMenu |
| SidebarNav | `components/SidebarNav.tsx` | Сквозной левый sidebar (desktop sticky, mobile FAB+slide-over): accordion-секции, подсветка активного URL |
| PromptCard | `components/PromptCard.tsx` | Карточка в листинге |
| GroupedCard | `components/GroupedCard.tsx` | Группа split-карточек |
| CardPageClient | `components/CardPageClient.tsx` | Клиентская часть карточки |
| PhotoCarousel | `components/PhotoCarousel.tsx` | Карусель фото |
| CardFilters | `components/CardFilters.tsx` | Debug-фильтры (FilterableGrid) |
| CatalogWithFilters | `components/CatalogWithFilters.tsx` | Листинг + FilterFAB, useListingFilters |
| FilterFAB | `components/FilterFAB.tsx` | Плавающая кнопка фильтров, передаёт rpcParams в FilterPanel |
| FilterPanel | `components/FilterPanel.tsx` | Панель с чипсами, при rpcParams — fetch filter-counts, только применимые теги с счётчиками |
| FilterChips | `components/FilterChips.tsx` | Строка чипсов для одного измерения |
| HomeSearch | `components/HomeSearch.tsx` | Поиск на главной |
| ReactionButtons | `components/ReactionButtons.tsx` | Like/dislike |
| FavoriteButton | `components/FavoriteButton.tsx` | Избранное |
| CopyPromptButton | `components/CopyPromptButton.tsx` | Копирование промта |
| AuthModal | `components/AuthModal.tsx` | Модалка авторизации |
| DebugFAB | `components/DebugFAB.tsx` | Debug-панель |

OAuth completion: `AuthProvider` завершает `code -> session` на клиенте через `exchangeCodeForSession()` и очищает auth-параметры из URL.

---

## SEO

### Метаданные

- **Root layout:** дефолтный title + description
- **Главная:** canonical, JSON-LD `CollectionPage`
- **Листинг L1:** `generateMetadata` → title/description из `getSeoContent(tag.slug)`
- **Листинг L2/L3:** `generateMetadata` → title/description из `getSeoForRoute(route)` (шаблоны)
- **JSON-LD:** `BreadcrumbList` + `FAQPage` на всех листингах
- **Index/noindex:** L1 >= 1 карточки, L2/L3 >= 6 карточек
- **Карточка:** `generateMetadata` → OpenGraph, Twitter, `noindex` для thin/secondary карточек
- **Поиск:** `robots: { index: false }`

### Tag Registry (`src/lib/tag-registry.ts`)

```typescript
interface TagEntry {
  slug: string;
  dimension: "audience_tag" | "style_tag" | "occasion_tag" | "object_tag" | "doc_task_tag";
  labelRu: string;
  labelEn: string;
  urlPath: string;       // e.g. "/stil/cherno-beloe"
  patterns: RegExp[];    // для regex-матчинга промтов
}
```

Функции: `findTagByUrlPath`, `findTagBySlug`, `findTagByLastSegment`, `getAllTagPaths`, `getFirstTagFromSeoTags`, `getSiblingTags`.

Индексы: `byUrlPath` (полный путь), `bySlug` (dimension:slug), `byLastSegment` (последний сегмент URL → кандидаты для L2/L3).

### Route Resolver (`src/lib/route-resolver.ts`)

Парсит `slug[]` из `[...slug]` маршрута в `ResolvedRoute`:

```typescript
type ResolvedRoute = {
  tags: TagEntry[];        // 1..3 распознанных тега
  level: 1 | 2 | 3;
  rpcParams: { audience_tag, style_tag, occasion_tag, object_tag, doc_task_tag };
  canonicalPath: string;   // нормализованный URL
  parentPath: string | null;
  primaryTag: TagEntry;
};
```

Алгоритм: сначала `findTagByUrlPath(fullPath)` (L1), затем поиск splitAt с `findTagByLastSegment` (L2/L3).

### SEO Content (`src/lib/seo-content.ts`)

Статическая карта `slug → SeoContent` для L1 тегов:
- `h1`, `metaTitle`, `metaDescription`
- `intro` (текст для страницы)
- `faqItems` (FAQ для Schema.org)
- `howToSteps` (HowTo для Schema.org)

### SEO Templates (`src/lib/seo-templates.ts`)

Шаблонная генерация SEO-контента для L2/L3:
- Приоритет: ручной контент из `seo-content.ts` → шаблон по паре измерений → generic fallback
- Шаблоны для всех пар измерений (audience+style, audience+occasion, style+object и т.д.)
- JSON-LD: `BreadcrumbList` + `FAQPage` на всех листингах

---

## Таблицы БД (чтение)

| Таблица | Что читает лендинг |
|---------|-------------------|
| `prompt_cards` | Основные карточки (slug, title, seo_tags, is_published, ...) |
| `prompt_variants` | Тексты промтов (prompt_text_ru, prompt_text_en) |
| `prompt_card_media` | Фото (storage_bucket, storage_path, is_primary) |
| `prompt_card_before_media` | Before/after фото |
| `card_reactions` | Лайки/дизлайки (через supabase-browser) |
| `card_favorites` | Избранное (через supabase-browser) |

### RPC

| RPC | Назначение |
|-----|-----------|
| `resolve_route_cards` | Карточки по тегам (листинг + меню) |
| `get_filter_counts` | Счётчики тегов для текущей выборки (FilterPanel) |
| `get_homepage_sections` | Секции главной |
| `search_cards_filtered` | Фильтрованный поиск |
| `search_cards_text` | Полнотекстовый поиск |

---

## Типы

```typescript
// supabase.ts
RouteCard, RouteCardsResult, HomepageCardRaw, HomepageSectionItemRaw,
HomepageSectionItemWithUrls, PhotoMeta, PromptCardFull, CardPageSibling, CardPageData

// tag-registry.ts
Dimension, TagEntry

// route-resolver.ts
ResolvedRoute

// seo-templates.ts
(uses SeoContent from seo-content.ts)

// menu.ts
MenuItem, MenuGroup, MenuSection, RouteParams

// seo-content.ts
SeoContent
```

---

## Файловая структура

```
landing/src/
├── app/
│   ├── layout.tsx              ← Root layout (Inter, AuthProvider, DebugProvider)
│   ├── page.tsx                ← Главная
│   ├── globals.css
│   ├── sitemap.ts
│   ├── robots.ts
│   ├── [...slug]/
│   │   ├── page.tsx            ← Листинг по тегу (ISR)
│   │   └── loading.tsx         ← Skeleton
│   ├── p/[slug]/
│   │   ├── page.tsx            ← Карточка (ISR)
│   │   └── loading.tsx         ← Skeleton
│   ├── search/
│   │   ├── page.tsx
│   │   └── SearchResults.tsx
│   ├── favorites/
│   │   ├── page.tsx
│   │   └── FavoritesContent.tsx
│   ├── auth/callback/route.ts
│   └── api/
│       ├── search/route.ts
│       ├── search-card/route.ts
│       ├── search-cards/route.ts
│       ├── datasets/route.ts
│       └── set-before/route.ts
├── components/                 ← UI-компоненты (см. таблицу выше)
├── lib/
│   ├── supabase.ts             ← Серверный клиент + data fetching
│   ├── supabase-browser.ts     ← Браузерный клиент (auth, reactions)
│   ├── supabase-server-auth.ts ← Серверная авторизация
│   ├── tag-registry.ts         ← Реестр SEO-тегов (5 измерений, 100+ тегов)
│   ├── route-resolver.ts       ← Резолвинг URL → теги (L1/L2/L3)
│   ├── seo-templates.ts        ← Шаблонный SEO для L2/L3
│   ├── seo-content.ts          ← Ручной SEO-контент для L1
│   └── menu.ts                 ← Структура меню
├── context/
│   ├── AuthContext.tsx          ← Контекст авторизации
│   └── CardInteractionsContext.tsx
├── hooks/
│   └── useUserInteractions.ts
└── middleware.ts
```

---

## Env Variables

| Переменная | Где используется |
|-----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Браузерный клиент |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Браузерный клиент |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный клиент |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, OG |
