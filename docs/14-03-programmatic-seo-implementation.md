# Programmatic SEO — реализация L2/L3 страниц

**Дата:** 14.03.2026  
**Проект:** aiphoto  
**Статус:** implementation-ready  
**Связанные документы:**
- [07-03-prompt-landing-plan.md](./07-03-prompt-landing-plan.md) — общий план лендинга, SEO-дерево, index/noindex правила.
- [11-03-seo-card-retrieval-requirements.md](./11-03-seo-card-retrieval-requirements.md) — архитектура выдачи карточек, RPC `resolve_route_cards`.
- [10-03-hashtag-extraction-tz.md](./10-03-hashtag-extraction-tz.md) — таксономия SEO-измерений.

---

## 1. Контекст и цель

### Текущее состояние

Лендинг уже поддерживает:
- **L1 страницы** (1 тег) через `[...slug]/page.tsx` + `findTagByUrlPath()` — работают.
- **Карточки** `/p/[slug]` — работают.
- **Tag registry** — 100+ тегов в 4 измерениях (`audience_tag`, `style_tag`, `occasion_tag`, `object_tag`).
- **RPC `resolve_route_cards`** — уже поддерживает multi-tag фильтрацию (5 измерений включая `doc_task_tag`).
- **SEO-контент** (`seo-content.ts`) — ручные тексты для ~20 L1 тегов.
- **Sitemap** — L1 теги + карточки.

### Что НЕ работает

URL вида `/promty-dlya-foto-devushki/cherno-beloe/` возвращает 404, потому что `findTagByUrlPath()` ищет точное совпадение пути, а в реестре нет записи для комбинации двух тегов.

### Цель

Реализовать programmatic SEO слой:
- **L2** (2 тега): `/promty-dlya-foto-devushki/cherno-beloe/` — audience + style
- **L3** (3 тега): `/promty-dlya-foto-devushki/cherno-beloe/v-zerkale/` — audience + style + object
- index/noindex по порогам из плана
- шаблонный SEO-контент для комбинаций
- sitemap с L2/L3

---

## 2. GAP-анализ

### 2.1 `doc_task_tag` отсутствует в TypeScript

| Что | Где | Проблема |
|-----|-----|----------|
| Тип `Dimension` | `tag-registry.ts:1-5` | Содержит только 4 значения, нет `doc_task_tag` |
| Теги doc_task | `tag-registry.ts` | Нет записей: `na_pasport`, `na_dokumenty`, `na_avatarku`, `na_rezume`, `na_zagranpasport` |
| RPC | `resolve_route_cards` | Уже поддерживает `p_doc_task_tag` — ОК |
| seo_tags в БД | `prompt_cards.seo_tags` | Уже поддерживает `doc_task_tag` — ОК |

> **Примечание:** `na_avatarku` сейчас живёт в реестре как `object_tag`. Нужно решить: оставить в `object_tag` или перенести в `doc_task_tag`. В Wordstat «фото на аватарку» ближе к задачам (doc_task), но с точки зрения URL уже есть `/foto-na-avatarku` как object_tag.  
> **Решение:** оставить `na_avatarku` в `object_tag` (уже проиндексирован), а `doc_task_tag` — только новые 4 тега: `na_pasport`, `na_dokumenty`, `na_rezume`, `na_zagranpasport`.

### 2.2 URL resolution для L2/L3

`findTagByUrlPath()` принимает полный путь и ищет точное совпадение в `Map<urlPath, TagEntry>`. Для L2/L3 нужна другая логика:

```
URL: /promty-dlya-foto-devushki/cherno-beloe/
     └─── L1 тег ──────────────┘└── L2 slug ──┘

URL: /promty-dlya-foto-devushki/cherno-beloe/v-zerkale/
     └─── L1 тег ──────────────┘└── L2 slug ──┘└ L3 slug┘
```

Нужна функция `resolveUrlToTags(slugSegments: string[])` → `ResolvedRoute | null`.

### 2.3 generateStaticParams

`getAllTagPaths()` возвращает только одиночные теги. L2/L3 комбинации не генерируются.

### 2.4 SEO-контент для комбинаций

Для ~2000 L2 и ~25000 L3 ручное наполнение невозможно. Нужен шаблонный генератор.

### 2.5 Index/noindex

Не реализовано. Все текущие tag-страницы — `index` по умолчанию.

### 2.6 Sitemap

Не включает L2/L3. При масштабировании >50K URL нужен sitemap index.

### 2.7 Internal linking

На L1 есть блок «Ещё разделы» (сиблинги того же измерения). Для L2/L3 нужна навигация вверх/вбок/вниз.

---

## 3. Архитектура решения

### 3.1 Резолвинг URL → теги

Новый модуль `route-resolver.ts`:

```typescript
type ResolvedRoute = {
  tags: TagEntry[];              // 1..3 распознанных тега
  level: 1 | 2 | 3;             // L1, L2, L3
  rpcParams: {                   // параметры для resolve_route_cards
    audience_tag: string | null;
    style_tag: string | null;
    occasion_tag: string | null;
    object_tag: string | null;
    doc_task_tag: string | null;
  };
  canonicalPath: string;         // каноничный URL
  parentPath: string | null;     // URL родительского L1
};
```

**Алгоритм:**

1. Из `slug[]` собрать полный path: `"/" + slug.join("/")`.
2. Попробовать `findTagByUrlPath(fullPath)` — если нашли, это L1.
3. Иначе пробовать разбить slug[] на сегменты:
   - Для L1-тегов URL может содержать `/` (напр. `/stil/cherno-beloe`), поэтому:
     a. Перебираем все возможные точки разбиения slug[].
     b. Первые N сегментов — L1 тег (`findTagByUrlPath`).
     c. Оставшиеся сегменты — L2 slug, затем L3 slug.
   - L2 slug ищется среди всех тегов реестра **кроме** уже найденного измерения.
   - L3 slug ищется аналогично, исключая оба найденных измерения.
4. Валидация: L2/L3 теги должны быть из **разных** измерений.
5. Формируем `rpcParams` из найденных тегов.

**Поиск L2/L3 slug в реестре:**

L2/L3 slug — это последний сегмент URL path тега. Для тега с `urlPath: "/stil/cherno-beloe"` slug = `"cherno-beloe"`. Для тега с `urlPath: "/s-mashinoy"` slug = `"s-mashinoy"`.

Нужен дополнительный индекс: `Map<lastSegment, TagEntry[]>` для быстрого поиска.

### 3.2 Обновление `[...slug]/page.tsx`

Текущий flow:

```
slug[] → findTagByUrlPath → один TagEntry → fetchRouteCards(1 тег)
```

Новый flow:

```
slug[] → resolveUrlToTags → ResolvedRoute (1-3 тега) → fetchRouteCards(multi-tag)
                          ↓
                    404 если не резолвится
```

Основные изменения:
- Заменить `findTagByUrlPath` на `resolveUrlToTags` в page и generateMetadata.
- Передавать все теги в `fetchRouteCards`.
- Breadcrumbs: Главная → L1 → L2 → текущая.
- Шаблонный SEO-контент для L2/L3 (если нет ручного).

### 3.3 Шаблонный SEO-контент

Новый модуль `seo-templates.ts`:

```typescript
function generateSeoForCombo(tags: TagEntry[]): SeoContent;
```

Стратегия по уровням:

**L1** — без изменений, берётся из `seo-content.ts` (ручной).

**L2 (2 тега)** — шаблоны по парам измерений:

| Пара | H1 шаблон | Meta title |
|------|-----------|------------|
| audience + style | `Промты для фото ${audience} в стиле ${style}` | `${audience} ${style} — промты для фото ИИ` |
| audience + occasion | `Промты для фото ${audience} на ${occasion}` | `${audience} на ${occasion} — промты для фото` |
| audience + object | `Промты для фото ${audience} ${object}` | `${audience} ${object} — промты для фото ИИ` |
| style + occasion | `${style} фото на ${occasion} — промты` | `${style} фото ${occasion} — промты для ИИ` |
| style + object | `${style} фото ${object} — промты` | `${style} ${object} — промты для фото ИИ` |
| occasion + object | `Фото на ${occasion} ${object}` | `${occasion} ${object} — промты для фото` |

Intro: шаблон 60-120 слов с подстановкой тегов.  
FAQ: 3 вопроса из шаблона + 1 общий.  
How-to: общие 4 шага (как у L1).

**L3 (3 тега)** — аналогичная шаблонная генерация, но с тремя переменными.

**Phase 2 (LLM):** batch-генерация уникальных текстов для топ-200 L2 комбинаций → сохранение в таблицу `programmatic_seo_content`. Шаблон как fallback.

### 3.4 Index/noindex

Из плана:

| Уровень | index,follow если | noindex,follow если |
|---------|-------------------|--------------------|
| L1 | `total_count >= 3` | `total_count < 3` |
| L2 | `total_count >= 6` + есть SEO-блок | `total_count < 6` или нет SEO-блока |
| L3 | `total_count >= 6` + есть SEO-блок | `total_count < 6` или нет SEO-блока |
| `/p/[slug]` | всегда | — |

Реализация в `generateMetadata`:

```typescript
const minCards = route.level === 1 ? 3 : 6;
const shouldIndex = totalCount >= minCards;
const robots = shouldIndex
  ? { index: true, follow: true }
  : { index: false, follow: true };
```

При `noindex` — добавить `canonical` на родительский L1.

### 3.5 generateStaticParams

**Phase 1 (MVP):** не генерировать L2/L3 статически. Использовать `dynamicParams = true` (по умолчанию) — Next.js будет рендерить on-demand при первом запросе и кэшировать.

Причина: при 1000 карточках L2 комбинаций ~500, при сборке это +500 страниц. Допустимо, но не обязательно на старте.

**Phase 2:** добавить L2 в `generateStaticParams` через RPC, возвращающий комбинации с `>= min_cards`.

**Phase 3:** L3 — только on-demand (ISR), слишком много для статической генерации.

### 3.6 Sitemap

**Phase 1:** добавить L2 пути в sitemap. Запросить из БД реальные комбинации тегов с count >= 6.

Новый RPC `get_indexable_tag_combos`:

```sql
-- Возвращает пары тегов, где пересечение карточек >= 6
SELECT
  dim1, slug1, dim2, slug2, cards_count
FROM (
  SELECT DISTINCT
    t1.dimension AS dim1, t1.slug AS slug1,
    t2.dimension AS dim2, t2.slug AS slug2,
    COUNT(*) AS cards_count
  FROM prompt_cards c,
    jsonb_array_elements_text(c.seo_tags->'audience_tag') t1_val,
    ...
  GROUP BY dim1, slug1, dim2, slug2
  HAVING COUNT(*) >= 6
);
```

Альтернативно: считать на стороне Next.js при генерации sitemap, кэшировать через `unstable_cache`.

**Phase 2:** sitemap index для >50K URL (разбиение по измерениям).

### 3.7 Internal linking на L2/L3

На странице L2 `audience + style`:

| Блок | Содержание |
|------|-----------|
| Breadcrumbs | Главная → Девушки → Чёрно-белое |
| Родительский L1 | «Все промты для фото девушки» → `/promty-dlya-foto-devushki/` |
| Соседние L2 (тот же L1) | Девушки + Портрет, Девушки + Реалистичное, Девушки + Студийное |
| Соседние L2 (тот же L2 тег) | Мужчины + Чёрно-белое, Пары + Чёрно-белое |
| L3 расширения | Девушки + Чёрно-белое + В зеркале, ... + На море |

---

## 4. Новые файлы и изменения

### 4.1 Новые файлы

| Файл | Назначение |
|------|-----------|
| `landing/src/lib/route-resolver.ts` | Резолвинг URL → массив тегов + RPC params |
| `landing/src/lib/seo-templates.ts` | Шаблонная генерация H1/meta/intro/FAQ для L2/L3 |

### 4.2 Изменения в существующих файлах

| Файл | Что меняется |
|------|-------------|
| `landing/src/lib/tag-registry.ts` | Добавить `doc_task_tag` в `Dimension`, добавить 4 тега, добавить индекс по последнему сегменту |
| `landing/src/app/[...slug]/page.tsx` | Заменить `findTagByUrlPath` на `resolveUrlToTags`, multi-tag breadcrumbs, robots meta, шаблонный контент |
| `landing/src/app/sitemap.ts` | Добавить L2 пути с `>= min_cards` |
| `landing/src/lib/seo-content.ts` | Fallback на шаблоны для unknown slugs |

### 4.3 SQL миграции

| Миграция | Назначение |
|----------|-----------|
| `125_get_indexable_tag_combos.sql` | RPC для sitemap: пары тегов с count >= threshold |

---

## 5. Поэтапный план реализации

### Phase 1 — MVP (L2 работают, noindex пока)

**Цель:** URL `/promty-dlya-foto-devushki/cherno-beloe/` перестаёт быть 404, показывает карточки.

| # | Задача | Файл |
|---|--------|------|
| 1.1 | Добавить `doc_task_tag` в `Dimension` | `tag-registry.ts` |
| 1.2 | Добавить 4 тега doc_task в реестр | `tag-registry.ts` |
| 1.3 | Добавить индекс `byLastSegment` в реестр | `tag-registry.ts` |
| 1.4 | Реализовать `resolveUrlToTags()` | `route-resolver.ts` (новый) |
| 1.5 | Обновить `[...slug]/page.tsx` — резолвинг | `page.tsx` |
| 1.6 | Обновить `generateMetadata` — multi-tag | `page.tsx` |

**Результат:** L2/L3 URL резолвятся → карточки отображаются → SEO пока fallback (дефолтные шаблоны).

### Phase 2 — SEO + Index/Noindex

**Цель:** L2 страницы получают уникальный контент и правильные meta robots.

| # | Задача | Файл |
|---|--------|------|
| 2.1 | Реализовать `seo-templates.ts` | `seo-templates.ts` (новый) |
| 2.2 | Интегрировать шаблоны в page | `page.tsx` |
| 2.3 | Реализовать index/noindex логику | `page.tsx` generateMetadata |
| 2.4 | Canonical на L1 при noindex | `page.tsx` generateMetadata |
| 2.5 | JSON-LD `FAQPage` для L2 | `page.tsx` |

**Результат:** L2 страницы с уникальными H1/meta/intro/FAQ, правильные robots.

### Phase 3 — Sitemap + Static Params

**Цель:** L2 страницы попадают в sitemap и предгенерируются.

| # | Задача | Файл |
|---|--------|------|
| 3.1 | SQL миграция `get_indexable_tag_combos` | `sql/125_*.sql` |
| 3.2 | Обновить `sitemap.ts` — добавить L2 | `sitemap.ts` |
| 3.3 | (optional) Добавить L2 в `generateStaticParams` | `page.tsx` |

**Результат:** Индексируемые L2 в sitemap. Поисковики начинают обход.

### Phase 4 — Internal Linking

**Цель:** Перелинковка между L1 ↔ L2 ↔ L3.

| # | Задача | Файл |
|---|--------|------|
| 4.1 | Breadcrumbs для L2/L3 (Главная → L1 → L2) | `page.tsx` |
| 4.2 | Блок «Соседние комбинации» | `page.tsx` |
| 4.3 | Ссылка на родительский L1 | `page.tsx` |
| 4.4 | Чипы L2 расширений на L1 странице | `page.tsx` |

**Результат:** Полная навигация по SEO-дереву.

### Phase 5 — LLM-generated SEO-контент (отложенная)

**Цель:** Уникальные тексты для топ L2 комбинаций.

| # | Задача |
|---|--------|
| 5.1 | Таблица `programmatic_seo_content` (slug_combo, h1, meta, intro, faq) |
| 5.2 | Скрипт batch-генерации через Gemini/GPT |
| 5.3 | Fallback: шаблон → БД → ручной |

---

## 6. Детальная спецификация `route-resolver.ts`

### Входные данные

```typescript
function resolveUrlToTags(slugSegments: string[]): ResolvedRoute | null;
```

`slugSegments` — массив из `params.slug` в `[...slug]/page.tsx`.

Примеры:
- `["promty-dlya-foto-devushki"]` → L1
- `["stil", "cherno-beloe"]` → L1 (двухсегментный tag path)
- `["promty-dlya-foto-devushki", "cherno-beloe"]` → L2
- `["stil", "cherno-beloe", "v-zerkale"]` → L2 (двухсегментный L1 + L2 slug)
- `["promty-dlya-foto-devushki", "cherno-beloe", "v-zerkale"]` → L3

### Алгоритм разбора

```
1. fullPath = "/" + slugSegments.join("/")
2. if findTagByUrlPath(fullPath) → return L1

3. for splitAt = slugSegments.length - 1 downto 1:
     headPath = "/" + slugSegments.slice(0, splitAt).join("/")
     tailSlugs = slugSegments.slice(splitAt)
     
     tag1 = findTagByUrlPath(headPath)
     if !tag1 → continue
     
     tag2 = findTagByLastSegment(tailSlugs[0], excludeDimensions=[tag1.dimension])
     if !tag2 → continue
     
     if tailSlugs.length === 1:
       return L2(tag1, tag2)
     
     if tailSlugs.length === 2:
       tag3 = findTagByLastSegment(tailSlugs[1], excludeDimensions=[tag1.dimension, tag2.dimension])
       if tag3 → return L3(tag1, tag2, tag3)

4. return null (404)
```

### Приоритет измерений (для canonical URL)

При формировании canonical URL порядок сегментов фиксирован:

```
1. audience_tag  (L1 path)
2. style_tag     (L1 path или slug)
3. occasion_tag  (L1 path или slug)
4. object_tag    (slug)
5. doc_task_tag  (L1 path или slug)
```

Если пользователь заходит на `/stil/cherno-beloe/promty-dlya-foto-devushki/` (стиль первый, audience второй), canonical должен указывать на `/promty-dlya-foto-devushki/cherno-beloe/`.

> **Решение Phase 1:** не делать redirect, показывать контент, но canonical всегда в каноничном порядке. В Phase 2 — 301 redirect на каноничный URL.

---

## 7. Детальная спецификация `seo-templates.ts`

### Интерфейс

```typescript
function getSeoForRoute(route: ResolvedRoute): SeoContent;
```

Логика:
1. Если L1 → `getSeoContent(tag.slug)` из `seo-content.ts`.
2. Если L2/L3 → проверить БД/кэш на наличие LLM-контента (Phase 5).
3. Fallback → шаблонная генерация.

### Примеры шаблонов L2

**audience + style:**

```
H1: "Промты для фото ${audience.labelRu.toLowerCase()} — ${style.labelRu.toLowerCase()}"
Meta title: "${audience.labelRu} ${style.labelRu.toLowerCase()} — промты для фото ИИ | 2026"
Meta description: "Готовые промты для ${audience.labelRu.toLowerCase()} в стиле ${style.labelRu.toLowerCase()}. Скопируй бесплатно и создай фото за секунды в Nano Banana и других ИИ-нейросетях."
Intro: "Подборка промтов для создания фото ${audience.labelRu.toLowerCase()} в стиле ${style.labelRu.toLowerCase()} с помощью ИИ. Все промпты проверены в Nano Banana и других нейросетях. Скопируй подходящий промт бесплатно, вставь в генератор и получи результат за секунды."
```

**audience + occasion:**

```
H1: "Промты для фото ${audience.labelRu.toLowerCase()} на ${occasion.labelRu.toLowerCase()}"
...
```

### Шаблоны FAQ

3 вопроса формируются из шаблонов:

```
Q1: "Как создать фото ${combo_description} в нейросети?"
A1: "Скопируйте промт с этой страницы, откройте Nano Banana или другую нейросеть..."

Q2: "Какие промты подходят для ${combo_description}?"
A2: "На странице собраны проверенные промты для ${combo_description}..."

Q3: "Промты бесплатные?"
A3: "Да. Все промты на сайте можно копировать и использовать бесплатно..."
```

---

## 8. Index/noindex — детали реализации

### В generateMetadata

```typescript
const minCards = route.level === 1 ? 3 : 6;
const shouldIndex = totalCount >= minCards;

return {
  title: seo.metaTitle,
  description: seo.metaDescription,
  robots: shouldIndex
    ? { index: true, follow: true }
    : { index: false, follow: true },
  alternates: {
    canonical: shouldIndex
      ? `${SITE_URL}${route.canonicalPath}`
      : `${SITE_URL}${route.parentPath}`,  // canonical на L1 при noindex
  },
};
```

### В sitemap.ts

Исключить URL с `noindex` (cards_count < threshold). Для этого sitemap строится на основе RPC `get_indexable_tag_combos`, а не на основе всех теоретических комбинаций.

---

## 9. SQL миграция: `get_indexable_tag_combos`

```sql
CREATE OR REPLACE FUNCTION get_indexable_tag_combos(
  p_min_cards int DEFAULT 6,
  p_site_lang text DEFAULT 'ru'
)
RETURNS TABLE (
  dim1 text, slug1 text,
  dim2 text, slug2 text,
  cards_count bigint
)
LANGUAGE sql STABLE
AS $$
  WITH tag_pairs AS (
    SELECT
      d1.dim AS dim1, d1.val AS slug1,
      d2.dim AS dim2, d2.val AS slug2,
      c.id
    FROM prompt_cards c
    CROSS JOIN LATERAL (
      SELECT 'audience_tag' AS dim, v FROM jsonb_array_elements_text(c.seo_tags->'audience_tag') v
      UNION ALL
      SELECT 'style_tag', v FROM jsonb_array_elements_text(c.seo_tags->'style_tag') v
      UNION ALL
      SELECT 'occasion_tag', v FROM jsonb_array_elements_text(c.seo_tags->'occasion_tag') v
      UNION ALL
      SELECT 'object_tag', v FROM jsonb_array_elements_text(c.seo_tags->'object_tag') v
      UNION ALL
      SELECT 'doc_task_tag', v FROM jsonb_array_elements_text(c.seo_tags->'doc_task_tag') v
    ) d1
    CROSS JOIN LATERAL (
      SELECT 'audience_tag' AS dim, v FROM jsonb_array_elements_text(c.seo_tags->'audience_tag') v
      UNION ALL
      SELECT 'style_tag', v FROM jsonb_array_elements_text(c.seo_tags->'style_tag') v
      UNION ALL
      SELECT 'occasion_tag', v FROM jsonb_array_elements_text(c.seo_tags->'occasion_tag') v
      UNION ALL
      SELECT 'object_tag', v FROM jsonb_array_elements_text(c.seo_tags->'object_tag') v
      UNION ALL
      SELECT 'doc_task_tag', v FROM jsonb_array_elements_text(c.seo_tags->'doc_task_tag') v
    ) d2
    WHERE c.is_published = true
      AND d1.dim < d2.dim  -- unique pairs, ordered
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND (
        (p_site_lang = 'ru' AND EXISTS (
          SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''
        ))
        OR
        (p_site_lang = 'en' AND EXISTS (
          SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_en IS NOT NULL AND v.prompt_text_en != ''
        ))
      )
  )
  SELECT dim1, slug1, dim2, slug2, COUNT(DISTINCT id) AS cards_count
  FROM tag_pairs
  GROUP BY dim1, slug1, dim2, slug2
  HAVING COUNT(DISTINCT id) >= p_min_cards
  ORDER BY cards_count DESC;
$$;
```

---

## 10. Примеры URL и ожидаемое поведение

| URL | Резолвинг | Level | RPC params |
|-----|-----------|-------|------------|
| `/promty-dlya-foto-devushki/` | `audience_tag: devushka` | L1 | `{ audience_tag: "devushka" }` |
| `/stil/cherno-beloe/` | `style_tag: cherno_beloe` | L1 | `{ style_tag: "cherno_beloe" }` |
| `/promty-dlya-foto-devushki/cherno-beloe/` | devushka + cherno_beloe | L2 | `{ audience_tag: "devushka", style_tag: "cherno_beloe" }` |
| `/promty-dlya-foto-devushki/den-rozhdeniya/` | devushka + den_rozhdeniya | L2 | `{ audience_tag: "devushka", occasion_tag: "den_rozhdeniya" }` |
| `/sobytiya/23-fevralya/v-forme/` | 23_fevralya + v_forme | L2 | `{ occasion_tag: "23_fevralya", object_tag: "v_forme" }` |
| `/promty-dlya-foto-devushki/cherno-beloe/v-zerkale/` | devushka + cherno_beloe + v_zerkale | L3 | `{ audience_tag: "devushka", style_tag: "cherno_beloe", object_tag: "v_zerkale" }` |
| `/foto-na-pasport/realistichnoe/` | na_pasport + realistichnoe | L2 | `{ doc_task_tag: "na_pasport", style_tag: "realistichnoe" }` |
| `/promty-dlya-foto-devushki/neizvestnyy-slug/` | tag2 не найден | — | **404** |

---

## 11. Ограничения и решения

| Проблема | Решение |
|----------|---------|
| URL с обратным порядком измерений (`/stil/X/promty-dlya-foto-Y/`) | Резолвим → canonical на правильный порядок. Phase 2: 301 redirect. |
| Дублирование контента L2 ↔ L1 | Уникальные H1/meta/intro для каждой комбинации через шаблоны |
| Thin content на L2/L3 с мало карточек | noindex + canonical на L1 |
| Слишком много L3 для sitemap | L3 только on-demand (ISR), в sitemap только при Phase 5 и >5000 карточек |
| Performance sitemap при 10K+ URL | Sitemap index: `/sitemap/0.xml`, `/sitemap/1.xml`, ... |

---

## 12. Зависимости от данных

| Метрика | Текущее | Для MVP L2 | Для цели 10K страниц |
|---------|---------|-----------|---------------------|
| Опубликованных карточек | ? (уточнить) | >= 300 | >= 5 000 |
| L1 с >= 3 карточек | ? | >= 30 | >= 72 |
| L2 с >= 6 карточек | ? | >= 50 | >= 1 850 |
| L3 с >= 6 карточек | ? | 0 (noindex) | >= 3 500 |

**Вывод:** Phase 1-2 можно реализовать при любом количестве карточек. L2 без карточек будут noindex, но URL будут работать (не 404). По мере наполнения БД страницы автоматически получат index.

---

## 13. Чеклист реализации

### Phase 1 (MVP)

- [ ] `doc_task_tag` добавлен в `Dimension`
- [ ] 4 тега doc_task добавлены в `TAG_REGISTRY`
- [ ] Индекс `byLastSegment` добавлен в `tag-registry.ts`
- [ ] `route-resolver.ts` создан, покрывает L1/L2/L3
- [ ] `[...slug]/page.tsx` использует `resolveUrlToTags`
- [ ] `generateMetadata` работает для L2/L3
- [ ] L2 URL не возвращают 404
- [ ] Unit-тесты для `resolveUrlToTags`

### Phase 2 (SEO)

- [ ] `seo-templates.ts` создан
- [ ] Шаблоны для всех пар измерений
- [ ] Шаблоны для L3
- [ ] Index/noindex в `generateMetadata`
- [ ] Canonical на L1 при noindex
- [ ] JSON-LD `FAQPage` для L2

### Phase 3 (Sitemap)

- [ ] SQL миграция `get_indexable_tag_combos`
- [ ] `sitemap.ts` включает L2
- [ ] (optional) `generateStaticParams` для L2

### Phase 4 (Linking)

- [ ] Breadcrumbs Главная → L1 → L2
- [ ] Блок «Соседние комбинации»
- [ ] Ссылка на родительский L1
- [ ] Чипы L2 расширений на L1

### Phase 5 (LLM SEO)

- [ ] Таблица `programmatic_seo_content`
- [ ] Скрипт batch-генерации
- [ ] Интеграция с fallback-цепочкой
