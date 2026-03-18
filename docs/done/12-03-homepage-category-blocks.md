# Редизайн главной страницы — блоки категорий

**Дата:** 12.03.2026

## Текущее состояние

Главная (`landing/src/app/page.tsx`) показывает Hero + плоскую сетку из 48 карточек (`FilterableGrid`). Нет структуры по категориям — просто лента промптов.

Проблемы текущей реализации:
- `Header` вызывает `fetchMenuCounts` — **~80 отдельных RPC** (`resolve_route_cards` для каждого тега, батчами по 6)
- Нет ISR/кэширования — каждый заход = все запросы заново
- `enrichCardsWithDetails` тяжёлый (4 параллельных Supabase-запроса) — избыточен для превью

## Цель

Заменить плоскую сетку на **блоки категорий 2-го уровня** (теги из `TAG_REGISTRY`: Девушки, Мужчины, Чёрно-белое, День рождения и т.д.), где каждый блок показывает **стопку карточек** с превью последней загруженной карточки.

## UI: общий визуал страницы

### Принцип: не придумываем новых элементов

Все компоненты строятся из уже существующих паттернов лендинга:

| Паттерн | Где уже используется | Классы |
|---|---|---|
| Бейдж-счётчик | Hero (N+ промтов), Tag page (N промптов) | `rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600` |
| Карточка-ссылка | "Ещё разделы" на Tag page | `rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50` |
| Заголовок секции | "Как использовать", "Частые вопросы", "Ещё разделы" | `text-xl font-bold text-zinc-900` или `text-lg font-bold text-zinc-900` |
| Фото-карточка | PromptCard / GroupedCard | `rounded-2xl`, `aspect-[3/4]`, `object-cover` |
| Стопка | GroupedCard | `rotate-[2deg]`, offset, `opacity-60`, hover rotate+translate |

### Убираем разделитель Hero ↔ контент

Текущий: `<section className="... border-b border-zinc-100">`

Новый: убрать `border-b border-zinc-100` — Hero плавно перетекает в секции.

### Градиент на всю страницу

Текущий: градиент только внутри Hero-секции (`from-indigo-50/60 via-white to-white`).

Новый: **вынести градиент на уровень корневого контейнера**, чтобы он шёл от Hero до Footer:

```html
<div className="flex min-h-screen flex-col bg-gradient-to-b from-indigo-50/40 via-white to-zinc-50/50">
  <Header />
  <section><!-- Hero без border-b, без собственного градиента --></section>
  <main><!-- секции категорий --></main>
  <Footer />
</div>
```

Радиальный градиент (`radial-gradient` с indigo) — оставить только в Hero-зоне (декоративный акцент сверху).

## Структура новой главной

```
Header
Hero (без border-b, без собственного bg-gradient)
                                          ← градиент на всю страницу
Секция "Люди и отношения"
  [Девушки]  [Мужчины]  [Пары]  [Семья]  ...
  (стопки)   (стопки)  (стопки)

Секция "Стили"
  [Чёрно-белое]  [Реалистичное]  [Портрет]  ...

Секция "События"
  [День рождения]  [8 марта]  [Свадьба]  ...

Секция "Сцены и объекты"
  [С машиной]  [С цветами]  [На море]  ...

Footer
```

## Блок категории (CategoryCard)

Server Component (без `"use client"`). Собирается из существующих паттернов:

1. **Визуал стопки** — как `GroupedCard.tsx`:
   - Задняя карта: `rotate-[2deg]`, offset вправо-вниз, `opacity-60`, `rounded-2xl`
   - Передняя карта: основное фото, `rounded-2xl`, `aspect-[3/4]`, `object-cover`
   - Hover: задняя `rotate-[4deg]`, передняя `-translate-y-0.5`
   - **Fallback если нет фото**: `bg-zinc-200` (как пустой PromptCard)

2. **Название категории** под стопкой — `<h3 className="text-sm font-semibold text-zinc-900">`

3. **Счётчик** — бейдж как в Hero/Tag page: `rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500`

4. **Ссылка** — весь блок обёрнут в `<Link href={tag.urlPath + "/"}>`, кликабелен

5. **Alt текст** — `alt="Промт для фото — {название категории}"`

## Секция (CategorySection)

Группировка блоков по dimensions (из `CURATED_SECTIONS` в `menu.ts`):

1. **Заголовок секции** — `<h2 className="text-xl font-bold text-zinc-900">` (как "Как использовать" на Tag page)
2. **Горизонтальная сетка** блоков — `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5`
3. **Порядок блоков** — по порядку массива `items` в `CURATED_SECTIONS` (source of truth)
4. **Все ссылки в HTML** — рендерить все блоки в DOM. Если >10 — скрывать overflow через CSS (`max-h-[...] overflow-hidden`), кнопка "Показать все" переключает `max-h-none`. **Не удалять из DOM.**
5. **Кнопка "Показать все"** — стиль как у ссылок "Ещё разделы": `rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 hover:border-zinc-300`
6. **Скрывать пустые** — если `total_count === 0`, не рендерить блок
7. **Spacing между секциями** — `mt-12` (как между блоками на Tag page)

## Данные

### Новая RPC: `get_homepage_sections`

Одна RPC — возвращает всё для главной за один вызов.

**Входные параметры:**
```sql
p_site_lang text DEFAULT 'ru'
```

**Возвращает** `jsonb[]` — массив объектов:
```json
{
  "dimension": "audience_tag",
  "slug": "devushka",
  "total_count": 42,
  "photo_url": "prompt-cards/photo1.jpg",
  "photo_bucket": "prompt-cards",
  "second_photo_url": "prompt-cards/photo2.jpg",
  "second_photo_bucket": "prompt-cards"
}
```

**Логика SQL:**
```sql
-- Для каждого уникального значения в seo_tags по каждому dimension:
-- 1. COUNT(*) published карточек с фото и промтом
-- 2. Первое фото (ORDER BY source_date DESC, id DESC LIMIT 1)
-- 3. Второе фото (OFFSET 1)
-- Используем LATERAL JOIN для эффективности
```

**Зачем одна RPC:**
- Текущий `fetchMenuCounts` делает ~80 отдельных вызовов — неприемлемо
- Одна RPC = один round-trip к БД (~50-100ms вместо ~5-10 секунд)
- Header тоже может использовать counts из этой RPC (шаринг данных)

### Шаринг данных Header ↔ Main

`page.tsx` делает один `fetchHomepageSections()`, результат передаётся:
- в `<Header counts={counts} />` — для бейджей в меню
- в `<CategorySection>` блоки — для фото и counts

Это **убирает** текущий `fetchMenuCounts` (~80 RPC) из Header.

### Кэширование (ISR)

```typescript
// landing/src/app/page.tsx
export const revalidate = 3600; // ISR — rebuild каждый час
```

Данные меняются только при загрузке новых карточек — 1 час достаточно.

### Skeleton при client-side навигации

Добавить `landing/src/app/loading.tsx` — skeleton с серыми блоками на месте стопок.

## Компоненты

| Компонент | Файл | Описание |
|---|---|---|
| `CategoryCard` | `landing/src/components/CategoryCard.tsx` | Server Component. Стопка карточек для одного тега |
| `CategorySection` | `landing/src/components/CategorySection.tsx` | Server Component. Секция с заголовком + грид блоков |
| `HomePage` | `landing/src/app/page.tsx` | Рендерит Hero + секции. `revalidate = 3600` |
| `loading.tsx` | `landing/src/app/loading.tsx` | Skeleton для client-side навигации |

## Порядок секций на главной

1. Люди и отношения (`audience_tag`)
2. Стили (`style_tag`)
3. События (`occasion_tag`)
4. Сцены и объекты (`object_tag`)
5. Задачи (`doc_task_tag`) — только если есть карточки

## SEO

### Перелинковка
- Каждый блок — `<a href="/promty-dlya-foto-devushki/">` для внутренней перелинковки
- Все ссылки рендерятся в HTML (не скрывать JS-ом)
- Пустые категории (0 карточек) — не рендерить

### Заголовки
- `<h1>` — в Hero (уже есть)
- `<h2>` — заголовки секций ("Люди и отношения", "Стили", ...)
- `<h3>` — названия категорий внутри блоков

### Meta
- `<meta name="description">` — статический: "Готовые промты для генерации и обработки фотографий с нейросетями. {N}+ промптов в {M} категориях."
- `<title>` — "Промты для фото с нейросетями — готовая библиотека промптов"

### Structured Data (JSON-LD)
```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Промты для фото с нейросетями",
  "description": "...",
  "hasPart": [
    {
      "@type": "CollectionPage",
      "name": "Девушки",
      "url": "https://site.com/promty-dlya-foto-devushki/"
    }
  ]
}
```

### Изображения
- `alt="Промт для фото — {название категории}"`
- `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"`
- Next.js `<Image>` с lazy loading (ниже fold) / eager (первая секция)

## Edge Cases

| Ситуация | Поведение |
|---|---|
| Категория с 0 карточками | Не рендерить блок |
| Категория с 1 карточкой | Показать без задней карты (без стопки) |
| Фото не загрузилось | Gradient placeholder + название |
| RPC упала | `try/catch` → показать fallback (текстовые ссылки на категории) |
| Секция без видимых блоков | Не рендерить секцию целиком |

## Что меняем в Hero

- Убираем `border-b border-zinc-100` (разделитель)
- Убираем `bg-gradient-to-b from-indigo-50/60 via-white to-white` (переносим на корневой контейнер)
- Оставляем `radial-gradient` (декоративное свечение) — только в Hero
- Добавляем meta/JSON-LD

## Не меняем

- Контент Hero (h1, подзаголовок, бейджи) — как есть
- Header / Footer
- Страницы категорий (`[...slug]/page.tsx`)
- Компоненты `PromptCard`, `GroupedCard`, `CardFilters` — переиспользуем стилистику, но не сами компоненты

## Checklist реализации

- [ ] Миграция SQL: RPC `get_homepage_sections`
- [ ] `fetchHomepageSections()` в `supabase.ts`
- [ ] Компонент `CategoryCard`
- [ ] Компонент `CategorySection`
- [ ] Переделать `page.tsx` — секции вместо `FilterableGrid`
- [ ] Шаринг counts → Header (убрать `fetchMenuCounts`)
- [ ] `loading.tsx` skeleton
- [ ] ISR `revalidate = 3600`
- [ ] Meta description + title
- [ ] JSON-LD structured data
- [ ] Alt тексты для изображений
- [ ] Проверить edge cases (0 карточек, ошибки RPC)
- [ ] Обновить `docs/architecture/01-api-bot.md` (или `10-landing.md`)
