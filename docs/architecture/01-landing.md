# 01 — Лендинг (promptshot.ru)

> Последнее обновление: 2026-06-08 (**Debug `/debug`:** изолированный маршрут, UI как search; prod без debug; robots disallow. + `hideHoverChrome` на `PromptCard`/`GroupedCard` в `FilterableGrid` (`/[...slug]`) и `SearchResults` (`/search`) — без оверлея при наведении (копировать, LexyGPT, реакции, стрелки); клик → модалка `/p/[slug]`; loading shell — `ListingCardLoadingShell photoOnly` (без `ListingCardChromeSkeleton` / CTA-pills). На `/favorites` и `/generations` hover chrome сохранён. + **Yandex OAuth на лендинге:** официальная кнопка YaAuthSuggest в `AuthModal`. + **Yandex OAuth на лендинге (2026-06-05):** `AuthModal` — Google + **Яндекс ID** (`signInWithOAuth({ provider: "custom:yandex" })` через `landing/src/lib/auth-oauth.ts`); self-hosted GoTrue ≥ v2.187 + Admin API `custom:yandex`; Redirect URI в Yandex app → `https://<SUPABASE_HOST>/auth/v1/callback`; профиль `landing_users` — миграция `sql/157_landing_users_yandex_provider.sql` (`provider: yandex`, `real_name`, аватар из `default_avatar_id`). STV/extension — только Google. Отдельно от OAuth: Яндекс.Метрика. + **Desktop inline-фильтры листинга:** `ListingDesktopFilters` над сеткой на `lg+`, `useListingFilterCounts`; mobile — `FilterFAB` → `FilterPanel`. + **Loading shell карточек листинга:** `useListingCardImageReady` + `ListingCardLoadingShell` — до `decode()` показывается skeleton (shimmer + chrome-pills без `backdrop-blur` glass); real `.listing-card-chrome` (`z-20`) скрыт (`invisible opacity-0`); после decode — crossfade ~200ms. `priorityLoad` влияет только на `next/image priority`, не на skip shell. `PromptCard` сбрасывает по URL фото; `GroupedCard` — по `activeCard.id`. `ListingGridLoadingSkeleton` переиспользует тот же shell. + **SEO-иллюстрации L1:** `SeoContent.illustrations` (0–4, `alt` / `caption` / `label`), резолв `resolveSeoIllustrations`, UI `SeoHeroWithIllustrations` — единая hero-панель: H1 + intro + карусель в одном `article` (текст слева, фото справа на `sm+`; chips в общем footer панели); `caption` sr-only; без фото в FAQ; JSON-LD `ImageObject`; пилот `/s-mashinoy/`. + **SEO `/s-mashinoy/` v5:** meta (`h1`, `metaTitle`, `metaDescription`) без изменений; семантика Wordstat — в `intro`, `faqItems` (9 вопросов), `howToSteps` в `seo-content.ts` → `s_mashinoy`. Ключи: «промт с машиной», ИИ-фото с машиной, авто/автомобиль, сирень, номера, фотосессия, девушка/мужчина с машиной. Удалён FAQ про GTA. + 2026-06-04 **SEO главной `/`:** кластер «промты для фото» — `homepage-seo-copy.ts`, H1 «Промты для фото и ИИ-фотосессии в нейросетях», intro/HowTo/FAQ в конце страницы (после каталога), JSON-LD `CollectionPage` + `FAQPage`, якоря `CategorySection` `id={dimension}` для FAQ-перелинковки; см. `docs/requirements/03-06-homepage-seo-promty-foto.md`. + 2026-06-02 **`/foto-v-promt/`** — RU-лендинг AI Image Describer в каталоге; live-виджет → **`NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN`** / `POST /api/extension/analyze` на imageprompt.tools; см. `docs/requirements/02-06-foto-v-promt-page.md`. + 2026-05-26 P0+P1 производительность и плавный рендер карточек промта: React.memo + стабильный контекст взаимодействий, кэш соседей в client-модалке, CSS containment + will-change, client-side photo reveal с decode() + shimmer на `PromptCard`/`GroupedCard` (с приоритетом LCP и правильным сбросом в группах). Всё в feature/26-05-prompt-card-render-perf-p0-p1. P2 (виртуализация) отложен. + предыдущая стабилизация Solution B: scroll-preservation.ts, компенсация scrollbar, стрелки в модале, immersive mobile parity, nav context для поиска; feature/fix-solution-b-scroll-arrows-stability. См. план и docs/23-03-listing-performance-requirements.md.) (**Моб. FAB:** `fab-bottom-safe` / `fab-sheet-bottom-safe` в `globals.css`; на **`/p/`** у каталога и фильтра — `bg-zinc-800`, чтобы не выглядели «чёрными овалами» на `zinc-950`.) (**Скелет `/p/[slug]`:** `landing/src/app/p/[slug]/loading.tsx` — `max-md`: fullscreen `bg-zinc-950` + полупрозрачный hero-shimmer; `md+`: шапка и сайдбар как у layout; `CardPageClient` — `dynamic(..., { ssr: true })` без отдельного `loading` props.) (**Данные карточки:** `getCardPageData` — один `select` `prompt_cards` с `author_user_id`.) (**Яндекс.Метрика:** `reachGoal` на «Сгенерировать» LexyGPT — `lexygpt_generate_click`, см. § ниже.) (**LexyGPT — партнёрский CTA:** `LexyGptGenerateButton` + `landing/src/lib/lexygpt-generate.ts`. Кнопка «Сгенерировать» записывает полный текст промпта в буфер обмена и открывает `https://lexygpt.com/playground/image/nano-banana-pro?ref=T25A8Y_add` в новой вкладке (текст в URL не передаётся). Размещение: в hover-оверлее при **`md+`** только на `/favorites` и `/generations` (`PromptCard` без `hideHoverChrome`); каталог `/[...slug]` и `/search` — `hideHoverChrome`, CTA только на **`/p/[slug]`**; при **`max-md`** в ячейке оверлея нет. Нижний фиксированный бар **`/p/[slug]`** (при контексте листинга — сетка «пред. карточка · копировать · Повторить (LexyGPT) · след. карточка», иначе копирование + Повторить (LexyGPT) в ряд; sticky **`z-[240]`**, копирование — см. **`landing/src/lib/copy-text-to-clipboard.ts`** / **`CardPageClient`**).) (**`/extension-stv`:** превью лендинга STV: hero (текст + Chrome badge) → pain + **Reference** → **Accuracy** (VS) → **Testimonials** → **How it works** (4 шага) → FAQ; **Pricing** на **`/extension-stv/pricing`**; header (`ExtensionStvMarketingHeader`), FAB; см. строку маршрута ниже.) (**Docker:** контекст образа — каталог **`landing/`** (`docker build -f landing/Dockerfile landing/`); STV для esbuild — **`landing/stv-web-sidepanel/`** (зеркало `extension/sidepanel`, обновление: **`npm run sync:stv-sidepanel`**). См. § «Сборка Docker (standalone)».) (**Генерация на сайте:** тот же UI и бэкенд, что у Chrome extension Steal This Vibe — панель справа (~528px по умолчанию, как side panel) с iframe на **`/embed/stv`**, бандл `landing/public/stv-panel/boot.mjs` (сборка `npm run build:stv-web` перед `next build`). Исходники панели — `extension/sidepanel/stv-core.js` + `boot-chrome.js` / `boot-web.js`, платформы `extension/sidepanel/platform/`. Query: **`cardId`**, **`sourceImageUrl`** (абсолютный URL референса с карточки). **`POST /api/generate`** получает **`cardId`** из состояния embed для атрибуции UGC.) (**Листинг LCP:** первые `LISTING_LCP_PRIORITY_GRID_ITEMS` (12) ячеек в `FilterableGrid` — `next/image` `priority` + `fetchPriority="high"`, без `transition-opacity` на главном фото (`opacity-100`); остальные ячейки — скелетон **`ListingCardPhotoSkeleton overlay`** до первого `onLoad`; при **листании фото стрелками в листинге** скелетон **не** включается снова (нет вспышки полупрозрачного слоя); в **`GroupedCard`** сброс `imageReady` только при смене варианта (**`activeCard.id`**), не при смене индекса фото. **`useListingCardPhotoReveal`** (`IntersectionObserver`, debounce ~320ms на уход из зоны; при повторном входе — два `rAF`, затем при `complete` вызов **`HTMLImageElement.decode()`** с `setReady(true|false)`: `complete` без декода на GPU даёт пустой `bg-zinc-200` на десктопе). **Стабильный `key`** у `InfiniteGrid` — `stableRpcParamsKey`. См. `landing/src/lib/listing-lcp.ts`, `landing/src/hooks/useListingCardPhotoReveal.ts`.) (**`/p/[slug]`:** герой — `priority` + `fetchPriority="high"`; размытый фон **после** `onLoadingComplete` героя, **CSS `background-image`** (не второй `<img>`, чтобы LCP не уходил на full-bleed blur); `dynamic(CardPageClient)` без вложенного `loading` props (маршрутный `loading.tsx`); `browserslist` в `landing/package.json` — меньше legacy polyfills в чанках. См. `docs/23-03-listing-performance-requirements.md` §10. **Производительность листингов / PSI:** требования `docs/23-03-listing-performance-requirements.md` — Метрика `lazyOnload`, `dynamic()` для `CatalogWithFilters` на `[...slug]`, секция каталога с `h2.sr-only`, a11y кнопок реакций/избранного/навигации по фото, `role="img"` у чипа просмотров, контраст подписей L2-чипов. **Превью в листинге (`PromptCard`, `GroupedCard`):** только фиксированный кадр **`aspect-[3/4]`** + `object-cover` (без inline `aspect-ratio` из БД — ровные ячейки; листинг — **CSS Grid**, порядок строками слева направо, не multicol); до декода — `ListingCardPhotoSkeleton` (shimmer). На **`/p/[slug]`** (`CardPageClient`): desktop/tablet — framed hero + `useCardPhotoFrame`; mobile — при **`photoUrls`**: **`CardPageLayout`** (`landing/src/components/CardPageLayout.tsx`) скрывает на **`max-md`** шапку / сайдбар / футер; клиент **`CardPageClient`** — **`fixed`**-экран: **`Image`** (**`fill`**, **`object-cover`**) на весь viewport, **`bg-zinc-950`**, **`z-[245]`**, нижний градиент; **`blurBackdropReady`** — для десктоп-героя; шапка: «БЫЛО» **`absolute`** слева, ряд **`flex`**: **сегменты** нескольких фото — **сверху** при **фото > 1**; затем одна строка **`grid`**: слева **`w-11`** для симметрии, по центру **пилюля просмотров**, **крестик** справа; **варианты подборки** (>1) — **`aside` слева** (`left-3`), столбик пилюль по вертикали, центр экрана как у реакций справа; низ **`z-[99]`**: реакции (без столбца) + избранное + шэр через **`CARD_OVERLAY_ACTION_PILL`**; превью / теги / подборка — зона над доком; **«Посмотреть промпт»** — chip в стиле тега на **отдельной строке**; по тапу — **затемнение + блок только с текстом** над доком (**без** отдельного sheet-chrome Lexy/copy); края **~34%** для перелистования; блок **`#card-prompt-full`** на мобиле при герое — **`hidden md:block`** в DOM для SEO**. Контекст листинга — **`localStorage`** `promptshot_listing_nav_v1` (**`listing-card-navigation-context`**, **`CardFilters`**) — переход между соседними карточками с листинга: **`router.replace(\`/p/…\`)`** (без **`push`**, история карточек не копится). **Fullscreen моб.** — **`router.replace(breadcrumbTag?.urlPath ?? \`/\`)`** (как первый breadcrumb-тег или главная). Clamp 2:3…3:2 для framed-режима сохранён. **Hover-оверлей листинга:** включается только без пропа **`hideHoverChrome`** (каталог `/[...slug]` и `/search` — отключён); при включении — только при **`(hover: hover) and (pointer: fine) and (min-width: 768px)`** (как Tailwind **`md`**) внутри **`listing-card-chrome`**: **`listing-card-chrome-ambient`** (бейджи сплита/черновика, «БЫЛО», нижний градиент с заголовком/превью) — fade + **`translateY`** ~260ms; **`listing-card-chrome-controls-fast`** и **`listing-card-chrome-actions-fast`** (стрелки фото, счётчик кадра, «Сгенерировать» (LexyGPT) и «Скопировать», на **`GroupedCard`** — кнопка переключения варианта **n/m**; просмотры, реакции/избранное) — opacity ~55ms. На фото — **`listing-card-photo-hover`** (`scale(1.03)` при `prefers-reduced-motion: no-preference`). Показ по `:hover` / `:focus-within` у **`group`** (`landing/src/app/globals.css`). Ниже 768px оверлей не активируется: первый тап по ячейке попадает в фоновую ссылку **`/p/[slug]`**. На touch / coarse pointer — то же. Заголовок, превью, LexyGPT, «Скопировать», стрелки фото помечены **`listing-card-chrome-target`** — при скрытом overlay (`opacity: 0`) они не участвуют в hit-test, чтобы не перехватывать тап перед ссылкой. Полноэкранное «Скопировать» (`expanded`) вне `listing-card-chrome`, `z-30`. **Подгрузка листинга:** `InfiniteGrid` — `ListingGridLoadingSkeleton` (сетка-призрак), не спиннер. **view_count:** миграции `sql/154_*` (сортировки листингов) + `sql/155_increment_prompt_card_view.sql` (RPC `increment_prompt_card_view`); на `/p/[slug]` — `POST /api/card-view` + `useCardViewBeacon`, дедуп `sessionStorage` `promptshot_view_{slug}`. UI превью: `CARD_OVERLAY_PHOTO_COUNTER_CLASS` по центру сверху; `CardOverlayMetricsChips` — просмотры справа при `view_count > 0`; пилюли действий — `CARD_OVERLAY_ACTION_PILL`. Подробнее — `docs/23-03-prompt-card-view-count-requirements.md`. **Промо-фото / сжатие:** цепочка и пресеты — § «Промо-фото карточек: сжатие и пресеты» ниже; детальное ТЗ — `docs/23-03-canonical-image-presets-requirements.md`. **Docker / standalone:** см. § «Сборка Docker (standalone)» ниже.)

> UI side panel + content script: см. `docs/extension-ui-spec.md` (три вкладки: промпт по референсу / генерация / история; компактная шапка с кредитами; история включает прогоны «только промпт»; `stv-prompt-assembly.js`); карта файлов и токены — `extension/DEVELOPER.md`.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| Язык | TypeScript |
| Стили | Tailwind CSS |
| Шрифт | Inter (latin + cyrillic) |
| БД / API | Supabase (service role на сервере, anon key в браузере) |
| Хостинг | Vercel |
| Аналитика | Яндекс.Метрика (`layout.tsx`, `strategy="lazyOnload"`) |

### Яндекс.Метрика — цели (`reachGoal`)

- Счётчик: **`107703100`** (дублируется в **`YANDEX_METRIKA_COUNTER_ID`**, файл `landing/src/lib/yandex-metrika.ts`; init — `landing/src/app/layout.tsx`).
- Кнопка «Сгенерировать» → LexyGPT: **`reachGoal('lexygpt_generate_click')`**, в параметрах: **`placement`**: `listing` \| `expanded` \| `sticky` (`LexyGptGenerateButton`). В интерфейсе Метрики создайте **JavaScript-событие** с идентификатором **`lexygpt_generate_click`** (или поменяйте константу **`YM_GOAL_LEXYGPT_GENERATE`** под своё имя цели).
- Мини-баннер «Фото в промт» → **`/foto-v-promt`**: **`reachGoal('foto_v_promt_banner_click')`** и **`foto_v_promt_banner_impression`** с **`placement`**: `listing` \| `card` (`landing/src/lib/foto-v-promt-banner-metrics.ts`, компоненты **`foto-v-promt-promo/`**). Impression — один раз на placement за сессию вкладки. ТЗ — **`docs/requirements/04-06-foto-v-promt-mini-banner.md`**.

---

## Структура маршрутов

```
/                       → Главная (категории + поиск)
/p/[slug]               → Карточка промта
/[...slug]              → Листинг по тегу (напр. /promty-dlya-foto-devushki, /stil/cherno-beloe)
/search                 → Поиск (клиентский)
/foto-v-promt           → «Фото в промт» — SEO-кластер image-to-prompt (ВЧ «фото в промт», СЧ «промт из фото», «промт по картинке»); тексты — **`foto-v-promt-copy.ts`**, ТЗ — **`docs/requirements/02-06-foto-v-promt-seo-copy.md`**. RU-маркетинг AI Image Describer в **`PageLayout`**; при входе **`useStandalonePageScrollTop`** сбрасывает `#listing-scroll-root` (моб.) и stale sessionStorage — страница всегда с hero; **`metadata.robots` index**; sitemap **0.8**; JSON-LD **WebApplication** + **FAQPage**; H2 над виджетом; перелинковка с **`/`** («Фото в промт»). Live-виджет → **`getImagePromptAnalyzeUrl()`** (prod cross-origin, dev **`/api/imageprompt-proxy/`**); CORS на imageprompt.
/favorites              → Избранное (требует авторизации)
/generations            → Мои генерации (auth): листинг как в каталоге (`PromptCard`), карточки UGC из `prompt_cards` с `author_user_id`
/auth/callback          → OAuth callback (server-side)
/embed/stv              → Steal This Vibe (клиент подгружает `/stv-panel/boot.mjs` + `styles.css`; та же логика, что side panel расширения)
/extension-stv          → Превью маркетингового лендинга расширения (спека `docs/extension-landing-pain-hope-solution.md`); **`metadata.title` / `description`** — SEO; `metadata.robots` noindex; шапка **`ExtensionStvMarketingHeader`** (логотип + «Image to prompt» → `/extension-stv`, **Pricing** → `/extension-stv/pricing`, Chrome Web Store); FAB **`ExtensionStvFloatingCta`**. Порядок секций: hero (H1 + лид + `ExtensionStvChromeBadge`) → pain + **Reference** (`PainReferenceVsDraftMock`) → **Accuracy** (`ExtensionStvAccuracySection`) → **Testimonials** → **How it works** (`ExtensionStvHowItWorks`, 4 шага) → **FAQ** (`ExtensionStvFaq`). Футер **`ExtensionStvMarketingFooter`**. Блок **Reference**: upload → extract → expand. Общие константы: `landing/src/components/extension-stv/stv-marketing-shared.ts`.
/extension-stv/pricing  → Только тарифы: **`ExtensionStvPricing`** ($0 / $14.99/mo), та же шапка/футер/FAB, ссылка «← Image to prompt»; `metadata.robots` noindex.
```

### UGC (веб-генерация, Steal This Vibe)

- Колонка `prompt_cards.author_user_id` — владелец пользовательской карточки; новые карты из `generate-process` и из `/api/vibe/save` создаются с **`is_published=false`** до явной публикации.
- Страница **`/p/[slug]`** — `export const dynamic = "force-dynamic"`; `getCardPageData(slug, { viewerUserId })` отдаёт черновик только если `viewerUserId === author_user_id`; для неопубликованных в metadata — **`robots: noindex`**.

## Промо-фото карточек: сжатие и пресеты

Источник констант и сборки URL: `landing/src/lib/card-image-presets.ts`, обёртка `getStorageCardMediaUrl(bucket, path, preset)` в `landing/src/lib/supabase.ts`.

### Два этапа отдачи в браузер

1. **Опционально — Supabase Storage Image Transformation** (`/storage/v1/render/image/public/…`): при `NEXT_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM=1` вместо прямого `…/object/public/…` подставляется URL с параметрами **`width`** и **`quality`**. На стороне хостинга Storage запрос обрабатывает **imgproxy** (ресайз + перекодирование в JPEG/WebP и т.д.). Это первое ограничение по пикселям и первое сжатие по качеству.
2. **Всегда для `<Image />` — оптимизатор Next.js** (`/_next/image?…`): по `src` (уже может быть `render/image` или полный объект) сервер лендинга отдаёт формат (часто WebP/AVIF) и размер, согласованный с атрибутом **`sizes`** (подсказка для `srcset` / выбора ширины `w=`) и явным **`quality={…}`** на компоненте. В Next 15 разрешённые значения `quality` заданы в **`next.config.ts`** → `images.qualities` (сейчас **45**, **60**, **75**).

Итоговый вес файла задаётся **произведением** решений обоих этапов: узкий `width` на шаге 1 уменьшает вход для шага 2; низкий `quality` на шаге 2 даёт дополнительное сжатие уже после imgproxy.

### Пресеты (`preset` в коде: `grid` | `listing` | `hero`)

| Имя в доках | `preset` | `width` × `quality` в `render/image` | Где формируются URL | `next/image` quality в UI |
|-------------|----------|--------------------------------------|----------------------|---------------------------|
| **A (grid)** | `grid` | 512 × 68 | `fetchHomepageSections`, `getFirstCardPhotoUrl`, миниатюры/врезки на `/p/[slug]` (before, siblings, карусель), всё, что явно остаётся на «сеточном» URL | `CARD_IMAGE_NEXT_QUALITY` (**60**) — `CategoryCard`, `CardPageClient`, `PhotoCarousel` |
| **L (listing)** | `listing` | 512 × 58 | **`enrichCardsWithDetails`** — единый путь для карточек каталога: SSR `[...slug]`, `/api/listing`, `/api/search`, `/api/search-cards`, `/api/search-card` (в т.ч. избранное) | `CARD_IMAGE_LISTING_NEXT_QUALITY` (**45**) — `PromptCard`, `GroupedCard`, превью в `SearchBar` |
| **B (hero)** | `hero` | 768 × 70 | **`fetchCardPageData`**: основные `photoUrls` / главное фото страницы карточки | `CARD_IMAGE_NEXT_QUALITY` (**60**) |

Если **`NEXT_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM` не `1`**, шаг 1 пропускается: в `src` попадает полный **`object/public`** объект; сжатие и уменьшение размера выполняет в основном только **Next Image** (важны `sizes` и `quality`).

### Подсказки `sizes`

Строки **`SIZES_CARD_GRID`**, **`SIZES_CARD_HERO`**, **`SIZES_CARD_HERO_VIEWPORT`** в том же модуле пресетов описывают **реальный CSS-размер** слота, чтобы браузер запрашивал у `/_next/image` не завышенную ширину `w` (лишний `w` = лишние байты при том же отображении).

### Связанные документы

- `docs/23-03-canonical-image-presets-requirements.md` — требования и таблица констант.
- Инфраструктура imgproxy / порты / `IMGPROXY_URL` — в операционных заметках деплоя Storage (см. также обсуждения в репозитории).

## API Routes

| Путь | Назначение |
|------|-----------|
| `/api/search` | Текстовый поиск (`search_cards_text` RPC) |
| `/api/listing` | Листинг категории по тегам (`resolve_route_cards` RPC): `limit`, `offset`, `strict=1`, tag-фильтры, **`sort=popular\|new`** (default `popular`; невалидный → **400**). Ответ: `{ cards, total_count, ranked_batch_size, sort }` |
| `/api/filter-counts` | Счётчики тегов для текущей выборки (`get_filter_counts` RPC) |
| `/api/card-view` | POST: инкремент `view_count` + событие в `prompt_card_view_events` по `slug` (beacon `/p/[slug]`, дедуп `sessionStorage`; RPC `increment_prompt_card_view`) |
| `/api/search-card` | Карточка по ID / prefix / batch |
| `/api/search-cards` | Фильтрованный поиск (`search_cards_filtered` RPC); query: `limit` (до 48), `offset`, `includeTotal=1` → `{ cards, total?, hasMore }` |
| `/api/datasets` | Список датасетов (debug) |
| `/api/set-before` | Before/after медиа |
| `/api/debug-delete-card` | POST: удаление строки `prompt_cards` (+ строки `slug_redirects` для slug карточки); body: `cardId`, `confirmSlug` (должен совпасть со slug в БД). После удаления — `revalidatePath('/sitemap.xml')` и `/p/[slug]`, чтобы URL сразу исчез из sitemap и кеша страницы (источник URL в sitemap — `getPublishedCardsForSitemap()`). Объекты в Storage не трогает |
| `/api/generation-config` | Конфиг генерации (модели, лимиты) |
| `/api/generation-prompt` | EN промпт карточки по cardId |
| `/api/upload-generation-photo` | Загрузка фото для генерации |
| `/api/upload-generation-photo/signed-url` | GET: подписанный URL превью загруженного фото (auth, path в query) |
| `/api/generate` | Запуск генерации (auth) |
| `/api/generate-process` | Внутренний: обработка генерации |
| `/api/generations` | Список строк `landing_generations` (legacy / отладка) |
| `/api/generations/[id]` | Статус/результат генерации |
| `/api/my-prompt-cards` | GET (auth): карточки `prompt_cards` с `author_user_id = user`, включая черновики (`is_published=false`), для `/generations` |
| `/api/my-cards/[slug]/visibility` | PATCH (auth): `{ published: boolean }` — владелец переключает видимость; при `published: true` — LLM/regex тегирование (`landing/src/lib/seo-tags-classify.ts`), затем `revalidatePath` |
| `/api/me` | Текущий пользователь + credits |
| `/api/buy-credits-link` | Deep link в Telegram-бота для покупки web-кредитов |
| `/api/vibe/extract` | Извлечение style JSON из URL изображения (auth) |
| `/api/vibe/expand` | Один rich prompt из style JSON (auth) |
| `/api/vibe/assemble-prompt` | Legacy-only: **409** для всех вибров (grooming assemble отключён; см. ответ `assemble_not_applicable_legacy` / `vibe_not_legacy`) |
| `/api/vibe/save` | Сохранение выбранной vibe-генерации (auth) |

### Модуль генерации (карточка → STV)

- **Точка входа (embed / модалка):** `GenerateButton` → `GenerationContext.openGenerationModal` → **`GenerationModal`** (панель + iframe **`/embed/stv?…`**); на **`/p/[slug]`** эта кнопка в нижнем sticky-баре **не рендерится** — для исходящего действия там **LexyGPT** (`LexyGptGenerateButton`, подпись **«Повторить»** при `variant="sticky"`, см. шапку файла). Сам **`GenerateButton`** и модалка в корневом layout сохранены в кодовой базе для переиспользования.
- **UI модалки:** выезжающая панель справа; внутри тот же пайплайн, что в расширении (extract → expand → generate, см. § Vibe Pipeline ниже).
- **Параметры iframe при открытии модалки:** `cardId`, `sourceImageUrl` (герой карточки) — см. `GenerationContext`, ранее **CardPageClient** прокидывал их в **`GenerateButton`**.

### Модуль генерации (legacy-описание процесса без vibe)

- **Flow после `POST /api/generate`:** создание записи → fire-and-forget fetch на /api/generate-process → Gemini → результат в Storage.
- **Текст в Gemini (без `vibe_id`):** `generate-process` склеивает **`prompt_text`** + **`GENERATE_LANDING_CARD_CRITICAL_RULES`** (`assembleLandingCardFinalPrompt`) — идентичность с фото, **гардероб по тексту промпта**, не копировать одежду с загрузки.
- **Gemini routing:** `generate-process` читает `photo_app_config.gemini_use_proxy`; при `true` использует `GEMINI_PROXY_BASE_URL`, при `false` ходит напрямую в `generativelanguage.googleapis.com`.
- **Таблицы:** `landing_users.credits`, `landing_generations`, `landing_generation_config`.
- **Storage:** `web-generation-uploads` (входные фото), `web-generation-results` (результаты).
- **Страница:** `/generations` — «Мои генерации» в меню пользователя; сетка `PromptCard` как в избранном.
- **UGC-карточка:** после успешного `generate-process` создаётся черновик в `prompt_cards` (`author_user_id`, `is_published=false`, датасет `web_generation_ugc`), связь `landing_generations.ugc_card_id`. Публикация — на `/p/[slug]` (кнопка владельца) или PATCH visibility API; в индекс попадают только `is_published=true` (sitemap, поиск, RPC листингов).
- **Бэкфилл до релиза UGC:** скрипт `landing/scripts/backfill-ugc-from-generations.ts` — для строк `landing_generations` со статусом `completed`, пустым `ugc_card_id` и заполненным результатом в Storage создаёт те же `prompt_cards`, что и runtime (`createUgcCardForCompletedGeneration`). Запуск из корня репо: `npm run backfill:ugc-from-generations:dry` затем `npm run backfill:ugc-from-generations` (или из `landing/`: `npm run backfill:ugc-from-generations:dry`). Env: **`SUPABASE_SERVICE_ROLE_KEY`**, URL (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`). Аргументы: `--dry-run`, `--limit N`, `--user-id <uuid>`.

### Vibe Pipeline (Steal This Vibe)

- **Единственный путь:** **legacy chain** из коммита `2c23ce94` — см. `landing/src/lib/vibe-legacy-prompt-chain.ts`, колонка **`vibes.prompt_chain` = `legacy_2c23`** (миграция **`sql/152_*.sql`**). Флаг **`photo_app_config.vibe_legacy_prompt_chain_2c23ce94`** больше не переключает поведение extract (ключ в БД может оставаться для истории).
- **Extract:** `POST /api/vibe/extract` — body: **`imageUrl`** + опционально **`extractTemperature`** + опционально **`extractInstructionOverride`** (строка **80–48 000** символов после trim; пусто/слишком коротко — как без поля). Если override задан — vision-инструкция **вместо** **`LEGACY_EXTRACT_PROMPT_2C23CE94`** (для A/B сравнения промптов); JSON по-прежнему должен укладываться в **`coerceLegacyVibeStylePayload`**. В ответе — **`extractInstructionCustom`**: `true` при override. **`imageUrl`** — публичный HTTP(S); панель extension/embed может передать URL с сайта или **свежий signed URL** для пути в `web-generation-uploads` после загрузки референса с ПК (`GET /api/upload-generation-photo/signed-url`). По умолчанию Vision → JSON **9 строковых полей** по legacy-инструкции: **`scene`** — место/действие, без волос/лица/телосложения модели (нейтральный субъект); **`pose`** — геометрия тела; **`camera`**, **`composition`** (passthrough expand), остальные как раньше. Строки в БД без **`pose`**: при expand **`coerceLegacyVibeStylePayload`** подставляет **`LEGACY_POSE_MISSING_BACKFILL`**. Extension: пресеты **extractTemperature** в настройках на вкладке «Генерация»; вкладка **Промпт** — кнопка **«Извлечь / обновить промпт»** (полный extract → expand [→ assemble]), без UI для **`extractInstructionOverride`**. Провайдеры: **`vibe_extract_llm`**, модели (`sql/150_*.sql`). Insert **`vibes.style`**, **`prompt_chain` = `legacy_2c23`**, **`legacyPromptChain: true`**.
- **Expand:** `POST /api/vibe/expand` — legacy **`style`** из body и/или строки vibe; **`vibeId`** + владелец + **`prompt_chain` = `legacy_2c23`** (иначе **404** / **409** как раньше). **Без text LLM:** база = **`buildLegacyVibeFullPromptBody(style)`**; опционально **`groomingPolicy`** `{ applyHair, applyMakeup }` (дефолт **true**) → **`appendLegacyGroomingPolicyBlocks`** добавляет англ. секции про перенос укладки/макияжа с референса; оба **false** — только поля стиля. **`mergedPrompt`** = итоговое тело; **`finalPromptForGeneration`** = **`assembleVibeFinalPrompt(...)`** (при прикреплении референса и grooming в теле — хвост **LAST** после **CRITICAL RULES**). Extension шлёт **`groomingPolicy`** вместе с expand и при смене чекбоксов делает debounce **повторного expand** (assemble для legacy по-прежнему **409**).
- **Assemble:** `POST /api/vibe/assemble-prompt` — всегда **409**: для **`legacy_2c23`** — **`assemble_not_applicable_legacy`**; для старых строк без legacy — **`vibe_not_legacy`** (нужен повторный extract).
- **Pipeline spec:** `GET /api/vibe/pipeline-spec` — **`extract`** как раньше; **`expand.mode`** = **`scene_literal`**, без моделей expand в ответе; исторический текст accent-expand — поле **`historicalAccentExpandInstruction`**.
- **Save:** `POST /api/vibe/save` — сохраняет выбранную completed-генерацию в `landing_vibe_saves`, связывает с `vibe_id`/`card_id`, пишет `auto_seo_tags` и, если `card_id` отсутствует, пытается автосоздать `prompt_cards` + `prompt_card_media` + `prompt_variants` из `landing_generations.result_storage_*`. После этого обогащает `prompt_cards.seo_tags` на основе `vibes.style` (через `TAG_REGISTRY`).
- **Generate:** `POST /api/generate` — по умолчанию расширение вызывает **один раз** за запуск (`prompts[0]` после expand/assemble, либо **`mergedPrompt`** из expand если поле задано). **`photoStoragePaths`**: панель может передать **1–4** пути (сетка «Ваше фото»), см. **`docs/23-03-stv-multi-user-photos-ui.md`**. Если в панели включён флаг **`stv_triple_variant_flow`** (`localStorage` = `1` / чекбокс «Для разработчиков»), за один запуск — **до трёх** параллельных вызовов при **ровно 3** элементах в `prompts`; детали — **`docs/22-03-stv-single-generation-flow.md`**.
- **Панель extension/embed — промпт:** вкладка **«Промпт»** — превью собранного текста для генерации, **«Копировать»**, **«Редактировать блоки»** (девять полей стиля + **«Сохранить»** через **`stv-prompt-assembly.js`**), кнопка **«Извлечь / обновить промпт»** (extract → expand [/ assemble при необходимости] без image-gen). **`mergedForSingleGeneration`** и **`prompts`** приходят с сервера после expand; правки блоков обновляют цепочку на клиенте. Режима «свой текст» и UI для **`extractInstructionOverride`** в панели нет.
- **generate-process (vibe):** при `vibe_id` и **`photo_app_config.vibe_attach_reference_image_to_generation`** = `true` (дефолт в миграции `sql/147_*.sql`) сервер качает `vibes.source_image_url` и шлёт в Gemini **два** изображения с метками **`VIBE_IMAGE_PART_LABEL_REFERENCE`**, референс, **`VIBE_IMAGE_PART_LABEL_SUBJECT`** (B = кто + натуральный цвет волос; укладка/макияж с A только если в тексте есть секции `Hair styling (transfer from reference)` / `Makeup and skin (transfer from reference)`), фото пользователя из Storage, затем **текстовую** часть. Если прикрепление референса **включено**, но скачать/закодировать пиксели не удалось — генерация **не вызывается**, **`vibe_reference_missing`**, кредиты возвращаются. **Сборка текста** — **`assembleVibeFinalPrompt(rawPrompt, hasTwoImages)`**: **(1)** тело (`prompt_text`), **(2)** **CRITICAL RULES** (**dual** / **single**), **(3)** при **dual** и наличии в теле маркеров grooming (legacy `Hair styling (transfer…)` / `Makeup and skin (transfer…)` или split-path `match reference shoot`) — короткий хвост **LAST — must show in the output image** (recency для image-моделей вроде Gemini 3.x Flash). Лог **`vibe_generation_layout`**: `architecture`, **`vibePromptChain`**, **`legacyPromptChain`**. Чтение: `getVibeAttachReferenceImageToGeneration` в `vibe-gemini-instructions.ts`.
- **Логи полного промпта:** перед вызовом Gemini `generate-process` пишет **`console.warn` `[generation.process] full_prompt_text`** с полем `text` (весь `fullPrompt`) и метаданными. Отключить: `LANDING_LOG_FULL_GENERATION_PROMPT=0` (см. `.env.example`).
- **Логи картинок в Gemini:** **`[generation.process] gemini_multimodal_images`** — `imagesSentToGemini` (роли `IMAGE_A_style_reference` / `IMAGE_B_user_subject_*` или `user_subject_*`, `storagePath`, URL превью референса, mime, bytes), плюс **`partsSequence`**.
- **Gemini routing:** при провайдере **gemini** для **extract** используют `photo_app_config.gemini_use_proxy` и `GEMINI_PROXY_BASE_URL`. **Expand** LLM не вызывает. OpenAI extract ходит на **`OPENAI_BASE_URL`** (или `https://api.openai.com/v1`) с **`Authorization: Bearer`**, proxy не используется.
- **Сквозной trace STV:** панель (`extension/sidepanel/stv-core.js`, зеркало `landing/stv-web-sidepanel/`) при смене референса (upload с ПК или новый URL Steal/embed) выставляет **`pipelineTraceId`** (UUID), шлёт заголовок **`X-STV-Pipeline-Trace`** на API и **`pipelineTraceId`** в теле **`POST /api/generate`**. Сервер пишет **`[stv.pipeline]`** (`landing/src/lib/stv-pipeline-log.ts`: `stvLog`) на шагах upload / signed-url / extract / expand / assemble / create generation; **`POST /api/generate-process`** получает тот же id в JSON (внутренний `fetch` без браузерных заголовков). В логах Vercel/CLI фильтр по одному UUID связывает цепочку до **`generation.process.completed`**. Опционально: **`LANDING_LOG_GEMINI_GENERATE_CONTENT_BODY_REDACTED=1`** — redacted тело `generateContent` перед image-gen (`redactGenerateContentBody`).
- **Логи (extract/expand):** extract: `gemini_request` / `gemini_response` / `extract_parse_ok` и аналоги OpenAI. expand: **`[vibe.expand] legacy_full_style_passthrough_ok`**. Общие: **`PIPELINE_FAIL`**, `extract_pipeline_failed` / `expand_failed` (unhandled). При `GEMINI_VIBE_DEBUG=1` — превью текста extract и для OpenAI (`landing/src/lib/gemini-vibe-debug-log.ts`).
- **Extension / embed — референс с ПК:** в той же колонке, что превью стиля с сайта, можно выбрать **одно** фото референса с диска («+») и снять «×»; состояние **`referencePhoto`** в `stv-core.js`, persist в **`stv_state_v2.referencePhoto`**; взаимоисключение с URL из Steal/embed.
- **Extension (grooming):** блок **«Внешний вид (референс)»** (чекбоксы волосы/макияж) в UI **выше** полосы прогресса и кнопок «Сгенерировать» / «Купить кредиты». При запуске генерации: после **`expand`**, если **`vibeGroomingControlsAvailable`**, side panel **сразу** вызывает **`assemble-prompt`** с текущими чекбоксами (без паузы и без обязательного «Продолжить»). Debounced **`assemble-prompt`** остаётся для правок чекбоксов **вне** активного запуска. Прогресс и подпись primary-кнопки покрывают весь пайплайн: extract → expand → assemble (если есть) → polling **`/api/generations/:id`**. **`generate`** по-прежнему шлёт unprefixed **`prompt`** из `prompts[0]`; префикс добавляет **`generate-process`**. Детали v1 — **`docs/20-03-vibe-grooming-extension-controls.md` §3.4** (кнопка «Продолжить» — только для старых сохранённых сессий с **`awaitingContinueGenerate`**).
- **Extension (история запусков):** листинг карточек в side panel: превью по сохранённому **`resultUrl`**, чипы **модель / aspect ratio / image size**, действия **скачать** (fetch→blob при успешном CORS, иначе открытие URL), **открыть**, **промпт** (копирование в буфер + раскрытие `<details>` с текстом). Персистенция в **`chrome.storage.local`** (`stv_state_v2.runHistory`), лимит **`MAX_RUN_HISTORY`** (10): только метаданные и строки (**`prompt`**, URL), **без** бинарников; опционально **`generationId`** для возможного будущего re-sign. Записи до этого изменения без **`resultUrl`/`prompt`** показывают заглушку и disabled-кнопки.
- **Extension (прогресс):** общая полоса показывается только при **`generating` / `resuming`** или пока есть строки результата в **`queued` / `creating` / `processing`**. Расчёт: **0–50%** — этапы extract/expand/assemble по **`pipelinePrepPercent`** (на этих этапах **не** смешивают со старыми строками с прошлого запуска); **50–100%** — средний **`progress`** по строкам (polling **`/api/generations/:id`**). После завершения всех строк полоса скрывается (не залипает на 100%).

### Покупка web-кредитов через Telegram Stars

- **Endpoint:** `POST /api/buy-credits-link` (auth required).
- **Bot runtime:** обработка платежей выполняется отдельным сервисом `payment-bot` (standalone Telegram bot).
- **Если привязка уже есть:** возвращает `?start=webcredits`.
- **Если привязки нет:** создаёт OTP в `landing_link_tokens`, возвращает `?start=weblink_<otp>`.
- **Связка аккаунтов:** `landing_user_telegram_links` (1 Telegram ↔ 1 landing user).
- **Оплата:** Telegram callback `webpack_*` создаёт `landing_web_transactions`, `successful_payment` завершает транзакцию и начисляет кредиты через RPC `landing_add_credits`.
- **`TELEGRAM_BOT_LINK`:** в API нормализуется до абсолютного `https://t.me/<bot>` (можно задать полный URL, `@username` или голый username). Иначе `window.open` из sidepanel разрешал бы относительную строку как `chrome-extension://.../sidepanel/...` без перехода в Telegram.

### CORS for Extension

- API теперь обрабатывает CORS в `middleware.ts` для `chrome-extension://` origin.
- Allowlist источников формируется из `CORS_ALLOWED_ORIGINS` и `CHROME_EXTENSION_ID`.
- Поддерживается preflight (`OPTIONS`) + credentialed requests (`Access-Control-Allow-Credentials: true`).

### Extension auth (Bearer) и public-config

- **`GET /api/public-config`** — публично отдаёт `supabaseUrl` + `supabaseAnonKey` (те же `NEXT_PUBLIC_*`, что уже в браузере лендинга) для инициализации Supabase Client в расширении.
- **Route Handlers** vibe/generate/me/upload/buy-credits/generations: авторизация через `getSupabaseUserForApiRoute(request)` — если в запросе есть **`Authorization: Bearer <access_token>`**, пользователь берётся из JWT; иначе — сессия по **cookies** (как на сайте).
- Расширение: Google OAuth в отдельной вкладке, redirect на `chrome-extension://<id>/sidepanel/auth-callback.html` (URL нужно добавить в Supabase **Redirect URLs**).

### OAuth на лендинге (модалка `AuthModal`)

| Провайдер | SDK `provider` | Где настроен |
|-----------|----------------|--------------|
| Google | `google` | `GOTRUE_EXTERNAL_GOOGLE_*` в env auth (Dockhost) |
| Yandex ID | `custom:yandex` | Custom OAuth Provider в GoTrue (Admin API `POST /auth/v1/admin/custom-providers`) |
| Telegram | — | запланирован, кнопка disabled |

**Flow (Google и Yandex — одинаковый в коде):**

```
AuthModal → signInWithOAuth(redirectTo: текущая страница)
  → Supabase /auth/v1/authorize → IdP → /auth/v1/callback
  → promptshot.ru/…?code=… → AuthProvider.exchangeCodeForSession()
```

- Хелпер: `landing/src/lib/auth-oauth.ts` (`getOAuthReturnUrl`, `signInWithOAuthProvider`).
- **Кнопка Яндекс ID:** официальный виджет [конструктора YaAuthSuggest](https://yandex.ru/dev/id/doc/ru/suggest/but-const) — `YandexAuthSuggestButton` (`sdk-suggest-with-polyfills-latest.js`; `YANDEX_AUTH_SUGGEST_BUTTON_PARAMS`: `buttonView: main`, `buttonSize: xxl`, `buttonTheme: light`, `buttonBorderRadius: 22`, `buttonIcon: ya`); клик перенаправляется в Supabase OAuth (`custom:yandex`), не в suggest-token flow. Env: `NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID` (публичный client_id из oauth.yandex.ru) — в **Docker build** (`landing/Dockerfile` ARG) и/или runtime env лендинга; если в клиентском бандле пусто, `client_id` подтягивается из `GET /api/public-config`.
- `/auth/callback` (Next.js) модалкой **не** используется — только extension/STV.
- **Self-hosted auth:** GoTrue **≥ v2.187.0**, `GOTRUE_CUSTOM_OAUTH_ENABLED=true`, `GOTRUE_SITE_URL=https://promptshot.ru`, `GOTRUE_URI_ALLOW_LIST=https://promptshot.ru/**`.
- **Yandex OAuth app** (отдельно от API Метрики): Redirect URI `https://<NEXT_PUBLIC_SUPABASE_HOST>/auth/v1/callback`, scopes `login:info login:email login:avatar`.
- **Userinfo adapter (обязательно):** GoTrue custom OAuth читает claim `email`, Яндекс отдаёт `default_email` + заголовок `Authorization: OAuth` (не `Bearer`). `attribute_mapping` в Admin API **не спасает** — поле теряется при разборе JSON в GoTrue. Поэтому в custom provider `userinfo_url` = `https://promptshot.ru/api/auth/yandex-userinfo` (`landing/src/app/api/auth/yandex-userinfo/route.ts` → `yandex-userinfo-proxy.ts`: прокси на `login.yandex.ru/info?format=json`, ответ `{ sub, id, email, … }`). Если auth-контейнер **не достучится** до promptshot.ru → `Error getting user profile from external provider` (в т.ч. инкогнито): fallback — `src/standalone/yandex-userinfo-proxy.mjs` на том же стеке Supabase, Kong route `/yandex-userinfo`, `userinfo_url` = `https://<SUPABASE_HOST>/yandex-userinfo`. Диагностика из auth: `wget -qO- --header="Authorization: Bearer test" https://promptshot.ru/api/auth/yandex-userinfo` (ожидаемо `missing_bearer_token`, не timeout).
- **Self-hosted auth env:** на auth-сервисе `API_EXTERNAL_URL` должен быть `https://<SUPABASE_HOST>/auth/v1` (не `$SUPABASE_PUBLIC_URL` без `/auth/v1`), иначе custom:yandex шлёт `redirect_uri=…/callback` → Kong 401.
- **Профиль:** trigger `handle_new_auth_user` — `sql/157_landing_users_yandex_provider.sql` нормализует `custom:yandex` → `yandex`, маппит `real_name` / аватар Yandex.

### 301 редиректы карточек `/p/[slug]`

- `middleware.ts` проверяет `slug_redirects` для любого URL вида `/p/:slug`.
- При наличии записи `old_slug -> new_slug` выполняется `301` на `/p/new_slug`.
- Это покрывает как старые slug без short-id, так и slug после массового ре-тайтла карточек.

### Try This Look (карточка промта)

- Кнопка на карточке использует существующий `GenerationModal` (`GenerationContext.openGenerationModal`).
- Публичная видимость управляется флагом `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK=true`.
- Если флаг выключен, кнопка Steal This Vibe скрыта (ранее — также на `/debug`; сейчас debug изолирован на `/debug`, `GenerateButton` не используется там).

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
| `/p/[slug]` (карточка) | **Dynamic** | `dynamic = force-dynamic` (доступ владельца к черновикам UGC + cookies) |
| `/[...slug]` (листинг) | ISR | `revalidate = 3600` |
| `/search` | CSR | `robots: noindex` |
| `/debug` | CSR | internal tools; `robots: noindex, nofollow`; `Disallow` in robots.txt |
| `/favorites` | CSR | требует auth |
| `/generations` | CSR | требует auth, `robots: noindex` |

### Слои кеширования

```
┌─────────────────────────────────────────────┐
│  1. Next.js ISR Cache (revalidate=3600)     │ ← страница целиком
├─────────────────────────────────────────────┤
│  2. unstable_cache (revalidate=3600)        │ ← fetchMenuCounts (Header)
├─────────────────────────────────────────────┤
│  3. React.cache (per-request dedup)         │ ← getCardPageData(slug, viewerUserId) (metadata + page)
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

**Фильтрация:** query params `?audience=devushka&style=portret` — **одно значение на измерение**. На tag-страницах измерения, уже заданные URL-путём, скрыты. Каталог: серверный merge `route.rpcParams` + `searchParams`, refetch при смене фильтров. **Desktop (`lg+`):** `ListingDesktopFilters` — кнопка на измерение (`Label: Value`); модалка с чипсами (поиск при >10), выбор сразу пишет URL и закрывает модалку (`setFilter`). **Mobile:** `FilterFAB` → `FilterPanel` (draft + «Применить»). **Применимые теги:** `useListingFilterCounts`; каталог — `/api/filter-counts`; поиск — client-side по `seo_tags`.

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

- **`getCardPageData`:** в ответе для клиента — `photoMeta[]` (bucket/path/url, параллельно `photoUrls`) для debug-действий. Жёлтая DEBUG-панель на `CardPageClient` — только при открытии карточки из вкладки `/debug` (`debug-tools-session`).
- **Mobile SEO (Яндекс «мелкий текст»):** на `< md` при наличии фото — immersive fullscreen (`CardPageLayout` скрывает header/sidebar/footer). Оверлей: **`text-[13px]`** (`MOBILE_FS_*`), промпт за кнопкой «Посмотреть промт» (overlay по клику), `CARD_OVERLAY_ACTION_PILL` **`min-h-11`**. Нижний glass-бар (копировать / Lexy / prev-next) — единственный CTA; дублирующий fixed sticky `z-[240]` с **`max-md:hidden`** при `hasPhotos`; колонка контента **`max-md:pb-6`** вместо `pb-28`. Desktop (`md+`): framed hero + sticky-bar как раньше. См. `.cursor/rules/ui-typography-icons-consistency.mdc` (tier A).

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

### Debug-режим (`/debug`)

- **Маршрут:** `/debug` — изолированный internal catalog; prod-страницы (главная, листинги, поиск) **без** debug-overlays и без toggle.
- **UI:** тот же shell, что у `/search` — `PageLayout` + `listing-main-bottom-pad` + grid (`FilterableGrid` с `variant="debug"`, `hideHoverChrome`).
- **Фильтры:** панель справа (ID, warnings, score, RU prompt, тег, «было», **датасет**); глобальный `/api/search-cards` с пагинацией (48, «Загрузить ещё»). Prefill: `/debug?dataset=slug`.
- **Карточка из `/debug`:** `sessionStorage` (`debug-tools-session.ts`) — жёлтая панель на `CardPageClient` только пока открыта вкладка `/debug`.
- **SEO:** `robots.ts` — `Disallow: /debug`; metadata `noindex, nofollow`.

---

## Ключевые компоненты

### Server Components

| Компонент | Файл | Роль |
|-----------|------|------|
| PageLayout | `components/PageLayout.tsx` | Клиентский shell: `listing-mobile-shell` + `#listing-scroll-root`; моб. высота через `--ps-listing-shell-height` (`listing-shell-viewport.ts`, `visualViewport`); in-flow `ListingBottomBar` |
| Header | `components/Header.tsx` | Legacy серверный (заменён PageLayout) |
| Footer | `components/Footer.tsx` | Статический |
| CardPage | `app/p/[slug]/page.tsx` | Серверный, SSR карточки |

### Client Components

| Компонент | Файл | Роль |
|-----------|------|------|
| HeaderClient | `components/HeaderClient.tsx` | Тонкий sticky header: логотип + SearchBar + UserMenu |
| SidebarNav | `components/SidebarNav.tsx` | Сквозной левый sidebar (desktop sticky, mobile FAB+slide-over): accordion-секции, подсветка активного URL |
| PromptCard | `components/PromptCard.tsx` | Карточка в листинге; двухфазный render: `ListingCardLoadingShell` → real chrome после `imageReady` |
| GroupedCard | `components/GroupedCard.tsx` | Группа split-карточек; тот же loading shell, сброс `imageReady` по `activeCard.id` |
| ListingCardLoadingShell | `components/ListingCardLoadingShell.tsx` | Единый loading shell (`ListingCardPhotoSkeleton overlay` + `ListingCardChromeSkeleton`) для карточек и pagination |
| useListingCardImageReady | `hooks/useListingCardImageReady.ts` | `onLoadingComplete` → `decode()` → `imageReady`; всегда стартует `false` (в т.ч. LCP/priority) |
| CardOverlayMetricsChips | `components/CardOverlayMetricsChips.tsx` | Чип просмотров (база `CARD_OVERLAY_ACTION_PILL`); счётчик фото — `card-overlay-photo-counter.ts` (тот же pill) + разметка по центру |
| CardPageClient | `components/CardPageClient.tsx` | Клиентская часть карточки |
| PhotoCarousel | `components/PhotoCarousel.tsx` | Карусель фото |
| CardFilters | `components/CardFilters.tsx` | `FilterableGrid`: prod listings (`variant="listing"`); debug at `/debug` (`variant="debug"`) |
| DebugPageContent | `components/debug/DebugPageContent.tsx` | Client-обёртка `/debug`: session + grid |
| debug-tools-session | `lib/debug-tools-session.ts` | `sessionStorage` для debug-tools на карточке из `/debug` |
| FotoVPromtMiniBanner | `components/foto-v-promt-promo/FotoVPromtMiniBanner.tsx` | Промо «Фото в промт» → `/foto-v-promt` (`listing` \| `card` \| `cardImmersive`) |
| ListingFotoVPromtBanner | `components/foto-v-promt-promo/ListingFotoVPromtBanner.tsx` | Sticky + IntersectionObserver hide после первого экрана |
| ListingBottomBar | `components/ListingBottomBar.tsx` | Моб. dock (read-only trigger → `ListingMobileSearchSheet`); desktop — portal `fixed` |
| CatalogWithFilters | `components/CatalogWithFilters.tsx` | Листинг + `ListingDesktopFilters` (desktop) + FilterFAB (mobile), useListingFilters |
| ListingDesktopFilters | `components/ListingDesktopFilters.tsx` | Desktop: кнопки по измерениям → модалка, single-select (`setFilter`) |
| FilterFAB | `components/FilterFAB.tsx` | Mobile: регистрация кнопки в bottom bar + `FilterPanel` |
| FilterPanel | `components/FilterPanel.tsx` | Mobile sheet с чипсами (draft + «Применить») |
| FilterChips | `components/FilterChips.tsx` | Строка чипсов для одного измерения |
| useListingFilterCounts | `hooks/useListingFilterCounts.ts` | Счётчики тегов: API или агрегация из cards |
| HomeSearch | `components/HomeSearch.tsx` | Поиск на главной |
| ReactionButtons | `components/ReactionButtons.tsx` | Like/dislike |
| FavoriteButton | `components/FavoriteButton.tsx` | Избранное |
| CopyPromptButton | `components/CopyPromptButton.tsx` | Копирование промта |
| AuthModal | `components/AuthModal.tsx` | Модалка: Google + Yandex (+ Telegram скоро) |
| YandexAuthSuggestButton | `components/YandexAuthSuggestButton.tsx` | Официальная кнопка YaAuthSuggest → Supabase OAuth |
| auth-oauth | `lib/auth-oauth.ts` | `signInWithOAuthProvider`, `custom:yandex` |
| yandex-auth-suggest | `lib/yandex-auth-suggest.ts` | URL SDK, client_id, redirect_uri для YaAuthSuggest |
OAuth completion: `AuthProvider` завершает `code -> session` на клиенте через `exchangeCodeForSession()` и очищает auth-параметры из URL.

---

## SEO

### Метаданные

- **Root layout:** fallback title + description из `homepage-seo-copy.ts` (`HOMEPAGE_SEO`)
- **Главная (`/`):** `generateMetadata` → `HOMEPAGE_SEO.title` / `description`; canonical; H1 + hero из copy-модуля; блоки **intro**, **HowTo**, **FAQ** (`HomeSeoBlocks.tsx`) после `CategorySection` в конце страницы; JSON-LD **`CollectionPage`** (`isPartOf: WebSite`, `hasPart[].name` = «Промты для фото {label}») + **`FAQPage`** (plain text в schema, ссылки в HTML FAQ); якоря каталога: `#audience_tag`, `#style_tag`, `#occasion_tag`, `#object_tag`
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
- `illustrations` (опционально, 0–4) — SEO-фото: `alt`, `caption` (schema/sr-only), `label` (chip UI); `cardSlug` или `titleIncludes` для подбора кадра

**Синхронизация с реестром:** у каждого уникального `slug` из `TAG_REGISTRY` должна быть запись в `seo-content.ts`. Шаблон для новых slug строится в `seo-content-from-tag.ts`; скрипт `npm run seo:sync` дописывает недостающие блоки в конец объекта `SEO`, `npm run seo:check` падает с кодом 1 при пропусках (удобно для CI). Кураторские страницы можно править вручную в том же файле — повторный `--write` не перезаписывает существующие ключи.

#### Кластер `/s-mashinoy/` (L1 `object_tag:s_mashinoy`, v5)

| Зона | Статус | Назначение |
|------|--------|------------|
| `h1`, `metaTitle`, `metaDescription` | frozen | ВЧ «промты для фото с машиной» (703 WS) — уже в индексе, ~14% входов Yandex |
| `intro` | v5 | «промт с машиной» (2375), ИИ-фото с машиной, авто, нейрофотосессия, сирень, номера |
| `faqItems` | 9 вопросов | авто → ответ «автомобиль»; сирень; номера; фотосессия; девушка; мужчина; марка; бесплатно |
| `howToSteps` | v5 | «промт с машиной», нано банана / ChatGPT, своя машина |
| `illustrations` | 4 шт. | `SeoHeroWithIllustrations`: chips «С машиной», «Авто», «Сирень», «Номера»; alt полный в `img` |

**Рендер иллюстраций:** только L1; `SeoHeroWithIllustrations` — один `article` (текст + карусель + footer chips). Все кадры в DOM для `alt`. FAQ без фото. Резолв: `getCardPhotosBySlugs` → `titleIncludes`. Schema: `ImageObject` на каждую иллюстрацию.

**Карточки (аудит трендов):** в кластере ~2042 карточки (`prompt_clusters`, `s-mashinoy`). Тег `s_mashinoy` матчит `/с машин|авто|тачк/i` в `tag-registry.ts`; тренды «сирень + машина» и «номера» часто попадают в L1 по тексту промта без отдельного тега. Дотегирование `title_ru` — только при ingest новых карточек или если SQL-проверка на проде покажет пустую выдачу по `сирен`/`номер` в топе листинга; в рамках v5 правок кода тегов не было.

### SEO Templates (`src/lib/seo-templates.ts`)

Шаблонная генерация SEO-контента для L2/L3:
- Приоритет: контент из `seo-content.ts` (L1 по `primaryTag.slug`) → шаблон по паре измерений → generic fallback
- Шаблоны для всех пар измерений (audience+style, audience+occasion, style+object и т.д.)
- Шаблонные `metaTitle` для fallback-страниц приведены к единому формату: `... — Nano Banana, ИИ-генератор | Бесплатно 2026`
- JSON-LD: `BreadcrumbList` + `FAQPage` на всех листингах

---

## Таблицы БД (чтение)

| Таблица | Что читает лендинг |
|---------|-------------------|
| `prompt_cards` | Основные карточки (slug, title, seo_tags, is_published, **view_count**, **views_7d**, **popularity_score**, likes/dislikes, …) |
| `prompt_card_view_events` | События просмотров (`card_id`, `viewed_at`); агрегируются в `views_7d` job'ом `recalculate_popularity_scores` |
| `slug_redirects` | Карта 301 редиректов старых slug на новые |
| `prompt_variants` | Тексты промтов (prompt_text_ru, prompt_text_en) |
| `prompt_card_media` | Фото (storage_bucket, storage_path, is_primary) |
| `prompt_card_before_media` | Before/after фото |
| `card_reactions` | Лайки/дизлайки (через supabase-browser) |
| `card_favorites` | Избранное (через supabase-browser) |
| `vibes` | Сохранённые extracted style JSON для Steal This Vibe |
| `landing_generations` | История web-генераций (добавлена связь `vibe_id`) |
| `landing_vibe_saves` | Сохранённые выборы пользователя по vibe-генерациям (`vibe_id`, `card_id`, `auto_seo_tags`) |
| `landing_user_telegram_links` | Привязка web-пользователя к Telegram (`landing_user_id` ↔ `telegram_id`) |
| `landing_link_tokens` | Одноразовые OTP для deep-link привязки (TTL 10 мин) |
| `landing_web_transactions` | Платежи web-кредитов через Telegram Stars |

### RPC

| RPC | Назначение |
|-----|-----------|
| `resolve_route_cards` | Карточки по тегам (листинг + меню); **`p_sort`**: `popular` (default) \| `new` |
| `recalculate_popularity_scores` | Hourly batch: `views_7d` + `popularity_score` для опубликованных карточек; prune events >14d |
| `get_filter_counts` | Счётчики тегов для текущей выборки (`useListingFilterCounts`) |
| `get_homepage_sections` | Секции главной |
| `search_cards_filtered` | Фильтрованный поиск |
| `search_cards_text` | Полнотекстовый поиск |
| `landing_add_credits` | Начисление кредитов в `landing_users.credits` после web-оплаты |

**Сортировка листингов категорий (`/[...slug]/`, миграции `158–161`):** UI — переключатель **`ListingSortToggle`** («Популярное» \| «Новое»), выбор в **`sessionStorage`** `promptshot_listing_sort` + опционально **`?sort=new`** в URL. SSR и API читают **`sort`**.

| `sort` | ORDER BY в `resolve_route_cards` |
|--------|----------------------------------|
| `popular` (default) | **`popularity_score` DESC**, `created_at` DESC, `id` DESC |
| `new` | **`created_at` DESC**, `id` DESC |

**`popularity_score`** (материализованное поле, не считается на запросе): `views_7d / (age_hours + offset)^exponent`, где `age_hours` от `created_at`, `offset`/`exponent` — **`photo_app_config`** (`listing_popularity_age_offset_hours`=48, `listing_popularity_age_exponent`=1.2). **`views_7d`** — COUNT событий за 7 суток из **`prompt_card_view_events`**. Job: **`recalculate_popularity_scores()`** (hourly; standalone `src/standalone/recalculate-popularity-scores-standalone.mjs` на DO). UI по-прежнему показывает **`view_count`** (lifetime).

**Не менялись:** `search_cards_text`, `search_cards_filtered`, `get_homepage_sections` — по-прежнему **`view_count`** (154).

**Пагинация листинга (`InfiniteGrid` + `GET /api/listing`):** константы **`LISTING_SSR_INITIAL_LIMIT` (10)** и **`LISTING_INFINITE_PAGE_SIZE` (48)** в `landing/src/lib/listing-pagination.ts` — первая порция с SSR на `[...slug]`, следующие запросы клиента по 48. В ответе API есть **`ranked_batch_size`** (число строк из RPC до `expandCardGroups`) и **`sort`**. Следующий **`offset`** увеличивается на это значение, а не на `cards.length`: иначе split-группы раздувают массив, OFFSET в SQL перескакивает через «недопоказанные» ранги и сетка листинга визуально «перемешивается». Условие «есть ещё страницы»: `offset + ranked_batch_size < total_count`. Смена **`sort`** → remount `InfiniteGrid` (key включает sort), **`offset=0`**, **`resetListingScroll()`**. Empty state при `sort=new` и `total_count=0`: «Пока нет новых». Риск дубликатов/пропусков при живом **`popularity_score`** + OFFSET — как с `view_count`; follow-up: keyset pagination.

**Loading shell карточек (`PromptCard` / `GroupedCard`):** двухфазный render — пока фото не декодировано, показывается **`ListingCardLoadingShell`** (photo shimmer `[bottom:32%]` + chrome-skeleton pills без glass-кнопок); real **`.listing-card-chrome`** скрыт (`invisible opacity-0 pointer-events-none`). После `onLoadingComplete` → **`HTMLImageElement.decode()`** → `imageReady=true` → crossfade ~200ms в hover-chrome. Хук **`useListingCardImageReady`**: reset по URL фото (`PromptCard`) или **`activeCard.id`** (`GroupedCard`). **`priorityLoad`** (`LISTING_LCP_PRIORITY_GRID_ITEMS` = 12) — только `next/image priority` / `fetchPriority`, shell **не** пропускается. Pagination: **`ListingGridLoadingSkeleton`** использует тот же shell.

**Инкремент `view_count`:** клиент на `/p/[slug]` → `POST /api/card-view` + `useCardViewBeacon` (дедуп в `sessionStorage`); RPC `increment_prompt_card_view` — **`view_count += 1`** + INSERT в **`prompt_card_view_events`** (`sql/160_*`).

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
│   ├── layout.tsx              ← Root layout (Inter, AuthProvider)
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
├── scripts/
│   ├── sync-seo-content.ts     ← npm run seo:sync / seo:check
│   └── verify-docker-image.sh  ← smoke: есть ли /app/server.js в собранном образе
├── lib/
│   ├── supabase.ts             ← Серверный клиент + data fetching
│   ├── auth-oauth.ts           ← signInWithOAuthProvider (google, custom:yandex)
│   ├── supabase-browser.ts     ← Браузерный клиент (auth, reactions)
│   ├── supabase-server-auth.ts ← Серверная авторизация
│   ├── tag-registry.ts         ← Реестр SEO-тегов (5 измерений, 100+ тегов)
│   ├── route-resolver.ts       ← Резолвинг URL → теги (L1/L2/L3)
│   ├── seo-templates.ts        ← Шаблонный SEO для L2/L3
│   ├── seo-content-from-tag.ts ← Шаблон L1 из TagEntry (npm run seo:sync)
│   ├── seo-content.ts          ← SEO для L1 (кураторский + автодобавленный)
│   └── menu.ts                 ← Структура меню
├── context/
│   ├── AuthContext.tsx          ← Контекст авторизации
│   └── CardInteractionsContext.tsx
├── hooks/
│   └── useUserInteractions.ts
└── middleware.ts
```

---

## Сборка Docker (standalone)

**Почему ломалось (история):** (1) контекст только `landing/` при Dockerfile с путями `COPY landing/...` из корня репо → **`/landing`: not found**; (2) контекст корня репо при Dockhost, который шлёт только `landing/` → пустой/не тот контекст; (3) без копии `extension/sidepanel` внутри `landing/` шаг **`build:stv-web`** не находил entry.

**Контракт сейчас**

| Где собираете | Поведение |
|---------------|-----------|
| Dockhost / CI | Контекст = каталог **`landing/`**. Команда: **`docker build -f landing/Dockerfile landing/`** (из корня клона) или эквивалент с путём к контексту `./landing`. В дереве есть **`landing/stv-web-sidepanel/`** (зеркало **`extension/sidepanel`**, в git). Трейсинг Next: обычно плоский **`standalone/server.js`**; runner Dockerfile копирует в **`/app`**. |
| Локально `next build` из `landing/` | Если в родителе репо есть **`package-lock.json`** → **`next.config.ts`** может трейсить от корня монорепо → **`standalone/landing/server.js`**. **`build-stv-web`** сначала пробует **`../extension/sidepanel`**, иначе **`./stv-web-sidepanel`**. |

### Правила сборки (чеклист)

1. **`npm run build` в `landing/`** — **`build:stv-web`** + **`next build`**.
2. **Docker** — контекст **`landing/`**; не вызывать **`docker build -f landing/Dockerfile .`** из корня репо (в контекст попадёт неверный **`package.json`**).
3. После правок **`extension/sidepanel/`**, влияющих на веб-embed: из **`landing/`** — **`npm run sync:stv-sidepanel`**, закоммитить **`landing/stv-web-sidepanel/`**.
4. После смены образа — **`landing/scripts/verify-docker-image.sh IMAGE:TAG`**.
5. Правила для агента — **`.cursor/rules/landing-docker-next-standalone.mdc`**.

**Как не повторить**

1. Не путать контекст: Dockhost чаще всего передаёт **только `landing/`** — Dockerfile рассчитан на это (**`COPY . .`** в **`/app`**).
2. Не удалять **`stv-web-sidepanel`** из репозитория — без него падает CI без полного монорепо в контексте.
3. **После каждого изменения образа:** `landing/scripts/verify-docker-image.sh IMAGE:TAG` — падает, если нет `/app/server.js`.
4. **В CI / перед деплоем:** `docker build` → `verify-docker-image.sh` → (опционально) `docker run` + `curl` на `:3001`.
5. **Нестандартный CI:** при необходимости задать **`NEXT_STANDALONE_TRACING_ROOT`** на этапе `next build` (см. `next.config.ts`).

`landing/Dockerfile` при отсутствии `server.js` падает на этапе сборки с `find` — это предпочтительнее, чем «зелёный» билд и падение в рантайме.

---

## Env Variables

| Переменная | Где используется |
|-----------|-----------------|
| `NEXT_STANDALONE_TRACING_ROOT` | Опционально при **`next build`** / Docker build: явный корень file tracing для `output: standalone` (см. § «Сборка Docker») |
| `NEXT_PUBLIC_SUPABASE_URL` | Браузерный клиент |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Браузерный клиент |
| `NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID` | Официальная кнопка YaAuthSuggest (`YandexAuthSuggestButton`, `GET /api/public-config`) |
| `NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI` | Опционально; по умолчанию `{NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback` |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный клиент |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, OG |
| `GEMINI_API_KEY` | Gemini вызовы в `generate-process`, `vibe/extract`, `vibe/expand` |
| `GEMINI_PROXY_BASE_URL` | Прокси-маршрутизация Gemini при `gemini_use_proxy=true` |
| `photo_app_config.vibe_extract_model` | ID модели Gemini для `/api/vibe/extract` (дефолт `gemini-2.5-pro`, см. `sql/148_*.sql`) |
| `photo_app_config.vibe_expand_model` | ID модели для `/api/vibe/expand` (дефолт `gemini-2.5-flash`) |
| `GEMINI_VIBE_EXTRACT_MODEL` | Fallback, если строка в `photo_app_config` пуста или чтение не удалось |
| `GEMINI_VIBE_EXPAND_MODEL` | То же для expand |
| `GEMINI_VIBE_DEBUG` | `1` / `true` — расширенные логи Gemini для vibe extract/expand |
| `photo_app_config.vibe_attach_reference_image_to_generation` | `true` / `false` — слать пиксели референса в web image-gen (ключ в БД, см. `sql/147_*.sql`) |
| `VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION` | Fallback, если строка в `photo_app_config` недоступна или пуста (`0` = выкл.) |
| `LANDING_LOG_FULL_GENERATION_PROMPT` | `0` — не логировать полный текст в `generate-process` |
| `LANDING_LOG_GEMINI_GENERATE_CONTENT_BODY_REDACTED` | `1` — redacted JSON `generateContent` (image-gen) без base64 |
| `CORS_ALLOWED_ORIGINS` | CSV allowlist origins для CORS API |
| `CHROME_EXTENSION_ID` | Extension ID для `chrome-extension://` CORS origin |
| `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK` | Если `true` и **`GenerateButton`** смонтирован на странице — Steal This Vibe (иначе только в debug FAB). Страница **`/p/[slug]`** в sticky-баре использует **LexyGPT** (`LexyGptGenerateButton`), не STV |
| `TELEGRAM_BOT_LINK` | `https://t.me/...`, `@bot` или `bot` — нормализуется до абсолютного URL для `/api/buy-credits-link` |
