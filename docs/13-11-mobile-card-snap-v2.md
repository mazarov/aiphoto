# Мобильная лента карточек промтов V2: `VirtualSnapTrack` + внешний `CardViewportHud`

> Ветка: `feature/13-11-mobile-card-snap-v2`  
> Статус: реализовано  
> Поверхности: `ClientCardModal` (открытие с любой выдачи/поиска/избранного), `@modal/(.)p/[slug]`, прямой вход `/p/[slug]` на вьюпортах `< 1024px` (`lg:hidden`)

---

## 1. Контекст и целевые требования (SLO)

Вертикальное перелистывание карточек промтов должно работать с нативной физикой ОС во всех целевых браузерах (`browserslist`: iOS Safari `16.0–18+`, iOS WKWebView Telegram / Chrome / Instagram, Android Blink Chrome / Яндекс.Браузер / Samsung Internet, Firefox Android, узкий десктоп / трекпад):

| Показатель (SLI) | Целевой SLO | Механизм гарантии |
|---|---|---|
| Вспышка предыдущей или пустой карточки при свайпе | **0 кадров** | Монотонный трек `key={slug}` без переброски `scrollTop` + единый базовый URL/quality (`q=60`) у соседа и активного кадра |
| Готовность к первому свайпу после открытия | **≤ 16 мс (1-й кадр)** | Синхронный `scrollTop = initialIndex * H` в первом `useLayoutEffect` до отрисовки |
| Доступность `✕ Закрыть` и стрелок `↑ / ↓` | **100% времени (0 мс блокировки)** | Весь HUD вынесен из scroll-контейнера в соседний слой; отсутствие `pointer-events-none` и `passive: false` `touchmove` |
| Отклик счётчиков / заголовка / промпта в HUD | **На 50% хода свайпа** | Пассивный `rAF`-расчёт `visualIndex = clamp(Math.round(scrollTop / H))` |
| Нагрузка на GPU-память WKWebView | **≤ 6 DOM-слайдов + 1 HD-текстура** | Окно виртуализации `[i - 2 .. i + 3]` в абсолютной полосе `N * H`; HD `1920w q=100` монтируется только на активном остановившемся слайде |
| Безопасность `history.replaceState` и чистота CTR | **Дебаунс 200 мс; dwell ≥ 600 мс** | Защита от лимита WebKit (`100 replaceState / 30s`), отмена таймеров при `close()`, исключение пролётных свайпов из `search_click` |

---

## 2. Архитектура и границы ответственности

### 2.1. Двухслойная топология `.ps-mobile-card-stage`

Внутри фиксированной сцены `.ps-mobile-card-stage` (`100svh`, синхронизация пиксельной высоты `H` через `ResizeObserver` + `visualViewport`) располагаются два соседних слоя:

1. **Слой 1 — `VirtualSnapTrack` (`[data-card-snap-viewport]`):**
   - Чистый нативный скролл-контейнер (`overflow-y: auto`, `scroll-snap-type: y mandatory`, `touch-action: pan-y`, `overscroll-behavior-y: contain`, `overflow-anchor: none`).
   - **Ноль** слушателей `touchmove` с `passive: false` — старт ведения пальцем происходит на потоке композитора ОС без ожидания JS main thread.
   - Внутри контейнера — размерная полоса высотой `sessionSlugs.length * H` и до **6 абсолютно позиционированных слайдов** `[centerIndex - 2 .. centerIndex + 3]` (`top: index * H`, `height: H`, `snap-start snap-always`, `key={slug}`).
   - При свайпе с `i` на `i + 1` скроллер остаётся на `(i + 1) * H` без выключения `scrollSnapType` и без телепортации `scrollTop`.
   - Сессионный список `sessionSlugs` работает строго **append-only** (`mergeSessionListingSlugs`): догрузка страниц бесконечного скролла добавляет новые `slug` только в хвост, поэтому координаты `index * H` уже открытых карточек инвариантны даже после обрезки `localStorage` на 500 элементах. Переключение сплит-вариантов подборки (`groupCards`) заменяет текущий слот на месте (`replaceSessionSlugInPlace`).

2. **Слой 2 — `CardViewportHud` (`[data-card-snap-hud]`, сосед скроллера):**
   - Полноэкранная прозрачная рамка `pointer-events-none absolute inset-0` поверх скроллера; интерактивные капсулы (`✕`, `Все кадры`, полоска кадров фотосессии, левый стек сплит-вариантов, правый стек реакций / избранного / шаринга / стрелок `↑ / ↓`, нижний бар `Промпт` + `Повторить`, полноэкранный диалог текста промпта) имеют `pointer-events-auto` и `touch-action: manipulation`.
   - Джиттер пальца на любой кнопке физически не попадает в `[data-card-snap-viewport]` и не может сдвинуть ленту в Safari iOS.
   - Внутри самих медиа-слайдов остаются только широкие фото-зоны (боковые зоны листания кадров внутри карточки `34%` и сетка 2×2 фотосессии с `data-swipe-ok`), сохраняющие `touch-action: pan-y` и защищённые от ложного клика при сдвиге `≥ 8px`.

### 2.2. Двухслойный прогрессивный пайплайн фото (`SnapMediaSlide`)

- **Базовый слой (Layer 1, постоянный):** рендерит `photoUrl` с `sizes="100vw"` и `quality={60}` (`CARD_IMAGE_NEXT_QUALITY`) одинаково и в состоянии соседа, и в состоянии активного слайда (при `photoIndex === 0`). При пересечении середины экрана React-узел `<Image>` не перемонтируется и не меняет `src`/`quality`.
- **HD-слой (Layer 2, условный оверлей):** монтируется поверх базового слоя только на остановившемся активном слайде после удержания `dwell ≥ 140 мс` (`CARD_IMAGE_HERO_MAX_WIDTH_PX = 1920`, `CARD_IMAGE_HERO_NEXT_QUALITY = 100`), вызывает `img.decode()` в `onLoad` и плавно проявляется (`opacity-0 → opacity-100`). При уходе со слайда HD-текстура размонтируется.
- **Единый нижний градиент `70%`** рендерится на каждом слайде, исключая скачок яркости под кнопками.

### 2.3. Скользящий кэш, батчинг реакций и dwell-гейт аналитики

- `PromptCardModalContext`: LRU-кэш расширен с `9` до `64` карточек; окно предзагрузки `[-2 .. +5]` (`prefetchCardWindow`) срабатывает и при `open()`, и на каждом шаге перелистывания; соседние базовые фото декодируются упреждающе.
- `CardInteractionsProvider` дедуплицирован (один провайдер в `CardPageClientOwned`) и запрашивает реакции/избранное батчем на всё окно видимых и предзагруженных карточек.
- `goToNeighbor` дебаунсит `history.replaceState` на `200 мс`, не отправляет `recordSearchCardClick` на свайпах внутри модалки и засчитывает `trackVirtualPageView` + `useCardViewBeacon` после `600 мс` удержания карточки (при `close()` и `popstate` отложенные таймеры немедленно очищаются).
- **Бесшовный автопейджинг в конце загруженного списка (`useListingNavigationFeed` + `MobileSnapTailLoaderSlide`):**
  - Каждая активная лента (`InfiniteGrid`/`FilterableGrid`, `SearchResults`, `HomepageExamplesExplorer`, `GeneraciyaFotoExamplesExplorer`, inline-поиск `CatalogWithFilters`) регистрирует свой `sourceId`, `hasMore` и `onLoadMore` через `useListingNavigationFeed` (а вторичные карусели `GeneraciyaFotoHeroCarousel` / `FotosessiiPromptsSection` используют `bindOnMount: false`, не затирая основную выдачу при рендере страницы).
  - Упреждающий lookahead за 14 карточек до конца вызывает `requestListingNavigationLoadMore()` сразу при открытии и при листании.
  - Если пользователь открыл последнюю загруженную карточку или долистал быстрее сети (`nextSlug === null`, `canLoadMore === true`): клик по `↓`/`→` (и `ArrowDown`) показывает спиннер в кнопке, грузит следующую порцию и автоматически перелистывает на новую карточку; свайп пальцем вверх на мобайле фиксируется на хвостовом слайде `MobileSnapTailLoaderSlide` (`top = N * H`), который после прихода новой порции на месте превращается в карточку `sessionSlugs[N]` без прыжка `scrollTop`.
