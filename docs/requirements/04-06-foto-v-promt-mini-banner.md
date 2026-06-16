# Требования: мини-баннер «Фото в промт»

> **Дата:** 2026-06-04  
> **Статус:** реализовано  
> **Ветка:** `feature/04-06-foto-v-promt-mini-banner`  
> **Целевая страница:** `/foto-v-promt` (same-origin, `next/link`)

---

## 1. Продукт

| Место | Поведение |
|-------|-----------|
| **Листинг** (каталог, SEO-разделы) | Полная ширина **над** grid. `sticky top-[57px]`. После скролла мимо первого экрана — **unmount** (IntersectionObserver). При смене фильтров / маршрута — remount → баннер снова виден. |
| **Поиск** `/search` | То же, что листинг (`ListingFotoVPromtBanner`). |
| **Карточка** `/p/[slug]` + модалка | Блок `min-h-12`, full width `max-w-2xl`. Варианты `card` (светлый sticky-бар) и `cardImmersive` (glass над фото на mobile). Только при `hasPrompts`. |

**Вне scope:** главная (`CategorySection`), избранное, генерации, Chrome Store.

---

## 2. Копирайт

Источник: `landing/src/lib/foto-v-promt-banner-copy.ts`.

| Ключ | Listing | Карточка |
|------|---------|----------|
| title | Промпт из любого фото за секунды — без регистрации | Фото в промт |
| subtitle | — | Нужен промт с **другого** снимка? Загрузите фото |
| cta | Попробовать (везде) | Попробовать |

---

## 3. Компоненты

| Файл | Назначение |
|------|------------|
| `landing/src/lib/foto-v-promt-banner-copy.ts` | Тексты и path |
| `landing/src/lib/foto-v-promt-banner-metrics.ts` | Метрика клика |
| `landing/src/components/foto-v-promt-promo/FotoVPromtMiniBanner.tsx` | UI: `listing` \| `card` \| `cardImmersive` |
| `landing/src/components/foto-v-promt-promo/ListingFotoVPromtBanner.tsx` | Sticky + IO hide |

**Встраивание:**

- `CardFilters.tsx` → `FilterableGrid` (только `gridItems.length > 0`)
- `SearchResults.tsx` (только при результатах)
- `CardPageClient.tsx` — sticky `card` + mobile immersive `cardImmersive`

---

## 4. Метрика (Яндекс.Метрика)

Константы: `landing/src/lib/yandex-metrika.ts`.

| Цель | Где |
|------|-----|
| `foto_v_promt_banner_click` | Sticky-баннер над grid каталога / поиска |
| `foto_v_promt_banner_click_card` | Баннер на `/p/[slug]` (модалка и full page) |

---

## 5. NFR

- Без `<Image>` в баннере — только CSS/Tailwind.
- Баннер **вне** grid — LCP первой карточки: `priorityLoad={index === 0}` без изменений.
- `IntersectionObserver`: `root` = `#listing-scroll-root` при `max-width: 1023px`, иначе viewport; при смене breakpoint observer пересоздаётся; `disconnect` в cleanup.
- После hide — **unmount** (collapse grid без дубля при infinite scroll).
- `prefetch={false}` на `Link`; клик — **`target="_blank"`** (новая вкладка).
- Sticky listing: **`max-lg:top-0`** (скролл в `#listing-scroll-root`), **`lg:top-[var(--ps-header-height)]`** (высота из `HeaderClient` ResizeObserver).
- Одна CTA-кнопка (без стрелок), без дубля text+pill.
- Hit area ≥ 44px (`min-h-11` / `min-h-12`).
- `cardImmersive`: `z-[99]`, не перекрывает Lexy (`z-[240]` sticky отдельно).
- Fail-open: при сбое IO баннер остаётся sticky до remount.

---

## 6. Приёмка

- [ ] Листинг: баннер на первом экране, sticky под шапкой; исчезает после скролла; при смене фильтра/раздела снова сверху.
- [ ] Infinite scroll не добавляет второй баннер.
- [ ] Поиск: баннер над результатами при непустой выдаче.
- [ ] Карточка: клик → `/foto-v-promt`; immersive читаем на фото; Lexy визуально primary.
- [ ] Пустой листинг/поиск — баннер не показывается.
- [ ] `npx tsc --noEmit` в `landing/` без ошибок.

---

## 7. Design acceptance

- [ ] Listing: контраст subtitle на indigo-50.
- [ ] Tap targets ≥ 44px на iOS.
- [ ] Immersive: не перекрывает Copy/Lexy.
- [ ] Скриншот-regression: catalog mobile, `/p/[slug]` mobile immersive, desktop.
