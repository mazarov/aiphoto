# OAuth return: карточка промта остаётся открытой

Ветка: `feature/26-08-auth-return-screen`.
Архитектура: [`docs/architecture/01-landing.md`](architecture/01-landing.md).

## Зачем

После Google/Yandex закрывалась карточка промта и открывался листинг сверху. Первый заход (`24-08`) уводил на listing origin и ждал `AuthReturnScreenRestorer` по cookie/`?ps_auth=1`. Restorer часто не срабатывал:

- GoTrue срывает `redirectTo?next=` и падает на `SITE_URL=/`
- на `/` + `?code=` не было второго `location.replace` с маркером
- overlay жил только в sessionStorage/cookie

Класс: post-OAuth **card overlay must survive**, не «вернуть URL листинга».

Повторный заход (localhost «Повторить» → Яндекс): пользователь приходил **залогиненным** на `/?auth_error=PKCE code verifier not found…` без карточки. Это не потерянный overlay, а **ложный fail второго PKCE**. `@supabase/ssr` `createBrowserClient` сам меняет `?code=` (`detectSessionInUrl` нельзя выключить). `/auth/callback` делает второй `exchangeCodeForSession`, verifier уже стёрт. Finish идемпотентен: сессия есть → тот же `path?ps_auth=1&ps_ov=card:<slug>`. Return path peek до успеха.

## Контракт

- `redirectTo` = `{origin}/auth/callback` без `next` (allowlist-стабильный).
- Destination после PKCE: `path?ps_auth=1&ps_ov=card:<slug>&ps_sy=<y>`.
- `/p/slug` без live overlay всё равно overlay `card`. Нет listing origin → остаёмся на `/p/slug`.
- SITE_URL `/?code=` всегда делает `location.replace` с `ps_auth` + `ps_ov` + `ps_sy`, даже если path уже `/`.
- Restorer читает `ps_ov` / `ps_sy` из URL первым, потом cookie. Пока overlay открыт, `remember` не затирает сохранённый Y текущим `window.scrollY === 0`.
- Y после полного reload **не клампить** к подвалу первой страницы. Пока карточка открыта — fill: грузить страницы, пока `maxScroll >= ps_sy`, затем применить Y один раз. Close = unlock + pin против позднего `scroll=0`.
- Close `history.back()` даёт Next popstate. `html { scroll-behavior: smooth }` анимирует наверх 1–2 с, если кто-то пишет 0. После overlay: `scrollRestoration=manual`, html `auto`, отбивать только срыв в top ~2.2 с. Не возвращать `scrollRestoration=auto` на finish.
- Desktop overlay → сжатие окна / DevTools mobile: тот же slug и chrome. Snap-feed не коммитит соседа из `scrollTop=0`. Width-only (высота та же): usable считает stage `md:hidden`, snap CSS только после pin на текущий slug.
- После OAuth slug из `ps_ov` — **пин** (`auth-return-card-pin.ts`), не окно 500 мс. Пока пин жив, `goToNeighbor` / snap-commit / `open(other)` не меняют карточку. Пин **не** снимается от «current slug === pin»: это как раз момент, когда старый код вставлял prev-слайды при `scrollTop=0` и коммитил соседа.
- **Один viewer:** `ClientCardModal` владеет карточкой (`client-card-overlay.ts`, флаг до `pushState('/p/slug')`). Next 15 после overlay-URL рематчит `@modal/(.)p/[slug]` и может подменить `children` на hard `/p/[slug]` — второй `CardPageClient` без `onListingNeighborGo` делает `router.replace` соседа. `@modal` рендерит `InterceptedCardModalGate`; secondary viewer без listing-handler не монтируется и не навигирует.
- **Snap:** первый кадр — только current (`index=0`, `scrollTop=0` верен). Соседи (`neighborsAttached`) появляются в том же commit, что прыжок на `prevCount * H`, затем `snapArmed`. Не «сначала 8 prev, потом доскроллить».
- **Capture:** «Повторить» пишет `bindAuthReturnOverlay(card.slug)`. `ps_ov` не берётся из live overlay, который snap уже мог сменить на соседа.
- Пин снимается после attach+arm или desktop. `lockListingScrollForModal` не пишет inline overflow до hydrate `#listing-scroll-root`.

Карточка не дропается ради generate-dock pending.
