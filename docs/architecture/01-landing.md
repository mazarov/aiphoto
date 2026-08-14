# 01 — Лендинг (promptshot.ru)

> Последнее обновление: 2026-08-14 (**sticky percentage rollout снят:** генерация и `/pricing` доступны всем; feature-flag `prompt_card_generation` / `FeatureAccessProvider` / `/api/feature-access` удалены. Kill switch очереди — `GENERATION_QUEUE_ENABLED`. Internal email allowlist `isStvOpenGenerateDebugEnabled` сохранён для бесплатных кредитов. Таблицы `landing_feature_rollouts` и `landing_user_feature_assignments` не дропаем — unused leftover.)
>
> Предыдущее обновление: 2026-08-14 (**text-only generation:** `CardInlineGeneratePanel` и `POST /api/generate` запускают initial gen по промпту ≥ 8 без фото на модалке карточки, dock `/generate`/листинге и `/generaciya-foto`. Фото опциональны (0–N): пустой вход → worker `sourceType=text_only` + `assembleTextToImageFinalPrompt`; с фото — identity image-to-image. `generationSurface` (`prompt_card` | `seo_page`) — воронка, не гейт входа. STV и admin по-прежнему требуют фото.)
>
> Предыдущее обновление: 2026-08-12 (**YooKassa payment reliability:** create не затирает terminal status; return-poll сверяет и `canceled`; admin/cron stale reconcile догоняет `created|pending` старше N минут; admin UI — «Сверить» / «Сверить зависшие»; creditState `stale` для pending старше 15 мин. Cron: `POST /api/cron/yookassa-reconcile` + `CRON_SECRET`.)
>
> Предыдущее обновление: 2026-08-12 (**SidebarNav:** убран indigo CTA **«Генерация фото»** → `/generate`; пункт меню на SEO-страницу `/generaciya-foto` (treatment) сохранён. Вход в blank generate — mobile tab / FAB dock / card «Повторить» / hard `/generate`.)
>
> Предыдущее обновление: 2026-08-12 (**`/generaciya-foto` Google SEO readiness:** route `robots` при index повторяет root `max-image-preview:large` / `max-snippet:-1` / `max-video-preview:-1`; visible breadcrumb `Главная → Генерация фото` совпадает с JSON-LD `BreadcrumbList`; `GeneraciyaFotoStarter` default = «По описанию» (вкладка первой), «По фото» остаётся вторым режимом с прежней воронкой `generation_photo_prompt_*`; hero/model foreground previews получают contextual `alt`, decorative backdrop остаётся `alt=""`; schema без fake `offers`/`aggregateRating`; `/sitemap.xml` и `/image-sitemap.xml` fail-soft (при ошибке БД — static hubs / пустой urlset вместо 500).)
>
> Предыдущее обновление: 2026-08-12 (**`/generaciya-foto` wide layout + loading:** все visible surfaces используют единый `max-w-7xl` gutter contract и совпадают по ширине на wide desktop. `GeneraciyaFotoStarter` открывался с default-интентом «По фото»: режим лениво импортирует `image-upload-prepare`, вызывает защищённый `/api/extension/analyze`, показывает редактируемый RU photoreal prompt и передаёт его через `seedBlankPrompt` в тот же генератор; воронка измеряется `generation_photo_prompt_{open,upload,ready,start}`. `GenerateListingDockHost` динамически загружает `CardInlineGeneratePanel` только после открытия/активной генерации; requested model хранится в `GenerateDockContext`, поэтому выбор не теряется до mount панели и browser custom event удалён. SSR/RSC передаёт в `GeneraciyaFotoExamplesExplorer` компактный `GenerationExampleCard`, а полный промт запрашивается через `/api/card/[slug]` только по `Повторить`; reactions/favorites для repeat-only grid больше не гидратируются. Hero preview получает отдельную выборку из 5 самых новых карточек (`sort=new`) как compact cards: клик по фото открывает shared prompt-card modal, а CTA «Выбрать» через его cache/dedup loader переносит prompt во вкладку «По описанию»; смена кадра ставится на паузу во время загрузки. Examples остаются popular; обе выборки объединяются перед одним `enrichCardsWithDetails`. Hero/model preview держит один `next/image` layer и меняет source раз в 4 секунды вместо одновременной загрузки composited layers; только первый hero frame priority.)
>
> Предыдущее обновление: 2026-08-11 (**desktop listing shell:** общий desktop `HeaderClient` убран; mobile header сохранён. Логотип PromptShot находится в начале правой content-колонки. `SidebarNav` занимает полную высоту viewport: меню прокручивается отдельно, снизу закреплён единый account-блок с входом либо профилем, текущими кредитами и CTA «Пополнить». Desktop sticky/fixed offsets больше не зависят от высоты header; overlay выровнены по фактической ширине sidebar `w-72`.)
>
> Предыдущее обновление: 2026-08-11 (**`/generaciya-foto` SEO + product page:** кластер «генерация фото ИИ / по описанию / по промту»; один SSR hero объединён с интерактивным `GeneraciyaFotoStarter`: пользователь вводит текст или выбирает пример, а `seedBlankPrompt` передаёт его в floating `CardInlineGeneratePanel chrome=dock`, который стартует как collapsed FAB. Examples, models и HowTo используют общую light indigo/violet product-surface вместо несвязанных white/black секций; HowTo — connected responsive timeline. `GenerationModelsShowcase` серверно получает только enabled-модели из `landing_generation_config`, показывает CSS crossfade/zoom previews без тяжёлых GIF и через `promptshot:generation-model-selection` переключает модель в dock. `GeneraciyaFotoExamplesExplorer` сохраняет SSR initial cards, masonry ratios, mini-search через `/api/search` и crawlable quick links/filters через `/api/listing`. FAQ и JSON-LD WebApplication+BreadcrumbList+HowTo+FAQPage+ItemList сохранены. Text-only blank generation разрешена без reference photo; worker при пустом `inputParts` использует отдельный `assembleTextToImageFinalPrompt` без identity-preservation правил. Auth и кредиты остаются обязательными, rollout проверяется для `generationSurface=seo_page`. Index + sitemap priority **0.9** + inbound из sitewide sidebar, `/`, `/trends`, `/foto-v-promt` включаются только при global rollout `enabled && rollout_bps=10000`; до этого route доступен с `noindex,follow`.)
>
> Предыдущее обновление: 2026-08-11 (**`/trends` SEO hub:** «промты для трендовых фото» / «трендовые фото ИИ»; SSOT **`trends-seo-copy.ts`** — title/H1/intro, outbound popularLinks (др/семья/пары/чёрный фон/портрет/девушка), HowTo + FAQ + 2 seoTextBlocks; JSON-LD CollectionPage+BreadcrumbList+HowTo+FAQPage; `getCachedFirstCardPhotoUrl` dedup metadata+page. Inbound: `/` hero link + `seo-content` popularLinks на `devushka`/`para`/`semya` → `/trends`. Nav label остаётся «Тренды». **Без** `/trends/*`. Catalog `fixedSort=new`.
>
> Предыдущее обновление: 2026-08-11 (**OAuth avatar hotlink:** `UserAvatarImage` — для `*.googleusercontent.com` / `avatars.yandex.net` `referrerPolicy=no-referrer` + `unoptimized` (Google часто отдаёт 403 с Referer / через `/_next/image`). Header / MobileProfileSheet / author chip на карточке. `next.config` `remotePatterns`: `*.googleusercontent.com`.
>
> Предыдущее обновление: 2026-08-11 (**admin listing = user listing:** catalog-admin default `published=yes` (как у пользователей) — без debug-фильтров сетка остаётся на SSR `resolve_route_cards`. Session key `promptshot_admin_filters_v2` сбрасывает старый default `published=all`. `search-cards` только при реальных фильтрах + `sort` с листинга; для корректного ORDER BY в filter-mode нужна миграция **`182`** (пока не применена → fallback `view_count`).
>
> Предыдущее обновление: 2026-08-11 (**sidebar nav:** блок **Инструменты** убран; порядок — **Добавить в Chrome** → [Генерация] → Главная / Тренды / Поиск / **Фото в промт** → accordion-каталог.
>
> Предыдущее обновление: 2026-08-11 (**sidebar Chrome CTA:** кнопка **«Добавить в Chrome»** (`ChromeMark` + border pill) вынесена на самый верх `SidebarNav`. UTM/Metrika без изменений (`desktop_sidebar`).
>
> Предыдущее обновление: 2026-08-11 (**admin listing sort:** catalog-admin `FilterableGrid` больше не форсит `search-cards` только из‑за `isAdmin`; при активных debug-фильтрах (`published=all` и т.п.) `/api/search-cards` передаёт `sort` с листинга. Миграция **`182_search_cards_filtered_listing_sort.sql`** — `search_cards_filtered(p_sort)`: `new` → `created_at DESC`, `popular` → `popularity_score` (раньше всегда `view_count`, из‑за этого `/trends` под admin показывал «не те» карточки).
>
> Предыдущее обновление: 2026-08-11 (**sidebar tools + trends:** «Новое» → **Тренды** (`/trends`); `301` `/new` → `/trends` в `next.config.ts`. В `SidebarNav` постоянный блок **Инструменты** (без collapse): Chrome-расширение (`utm_content=desktop_sidebar`, Metrika `desktop_sidebar_add_to_chrome_click`) + **Фото в промт**. CTA расширения убран из desktop `HeaderClient`. MobileTabBar / sitemap / generate-dock paths обновлены на `/trends`.
>
> Предыдущее обновление: 2026-08-11 (**catalog admin:** `/debug` убран; allowlist-email (`isCatalogAdminEmail` / `INTERNAL_GENERATE_ALLOWLIST`, default `azarov.maxim@gmail.com`) включает admin на всех `FilterableGrid` листингах: панель фильтров, unpublished `/p/[slug]` по auth. Свитч «Тех. информация» (default off) — оверлеи + жёлтая DEBUG-панель. Мутации `set-before` / `debug-delete-card` и unpublished search — только admin.)
>
> Предыдущее обновление: 2026-08-11 (**prefs persist flush:** `CardInlineGeneratePanel` — immediate PUT при любом выходе из шторки фото/модель (Готово, tile toggle, desktop scrim, switch→prompt) + flush snapshot на unmount (`seedToken` remount больше не глотает debounce). Убран auto-switch на дешёвую модель при нехватке кредитов (он перетирал prefs); unaffordable selection остаётся, CTA → `/pricing`.)
>
> Предыдущее обновление: 2026-08-11 (**result clear X:** после `phase=done` в dock крестик → `clearResultAndPrompt`: снимает result chrome, очищает `draftPrompt`, закрывает plate (`onBack`); модель/фото сохраняются. Footer `Повторить` по-прежнему только сбрасывает result, промпт оставляет.)
>
> Предыдущее обновление: 2026-08-11 (**analyze-history remix:** успешный `POST /api/prompt-remix` best-effort пишет в `analyze_history` с `kind=remix` и `change_request` (текст «Что изменить?»); `/admin/analyze-history` показывает бейдж Remix и это значение. Миграция `181`. Extension/foto-v-promt remix на imageprompt.tools не логируется.)
>
> Предыдущее обновление: 2026-08-11 (**prefs SSOT:** model/ratio/size/photos из `landing_generation_preferences`; last-completed hydrate больше не перетирает их; «Готово»/close шторки фото·модель → immediate PUT.)
>
> Предыдущее обновление: 2026-08-11 (**Повторить → compose reset:** footer `Повторить` сбрасывает result/`generationId` в `idle` (промпт/модель/фото сохраняются), не enqueue новую генерацию; новая gen — через `Сгенерировать`.)
>
> Предыдущее обновление: 2026-08-11 (**dock sheets opaque cover:** editor sheets `bg-zinc-950` (без blur); footer/controls `invisible` while `dockExpanded` — нет просвечивания CTA/плиток.)
>
> Предыдущее обновление: 2026-08-11 (**mobile generate tab fullscreen:** tab «Сгенерировать» → `fixed inset-0 z-[122]` поверх tab/nav bar; body scroll lock; desktop FAB collapse-on-generate без изменений.)
>
> Предыдущее обновление: 2026-08-11 (**dock sheets from plate bottom:** prompt/photos/model в `chrome=dock` — `absolute inset-0` от низа пластины (поверх контролов/CTA); не in-flow над кликнутым контролом.)
>
> Предыдущее обновление: 2026-08-11 (**dock reopen restores last gen:** blank listing dock при hydrate тянет `GET /api/generations?limit=12` + preferences — последний `completed` result/prompt/model/ratio и сохранённые фото/size; авто-open plate только после live `generating→done`.)
>
> Предыдущее обновление: 2026-08-11 (**listing FAB/tab progress:** `GenerateDockContext.runBusy/runProgress`; старт gen сворачивает plate → desktop FAB / mobile tab показывают `Генерируем · N%`; по `done` plate снова открывается.)
>
> Предыдущее обновление: 2026-08-11 (**CTA progress sticky:** `busy` лочит tall-plate (`plateLocked`) — без scroll-collapse; заливка на CTA через `scaleX` + `Генерируем · N%`.)
>
> Предыдущее обновление: 2026-08-11 (**CTA generate progress:** во время `uploading|generating` заливка прогресса + `%` на кнопке `Сгенерировать` / `Генерируем`; soft-tick между poll; при повторной генерации предыдущий result остаётся фоном пластины.)
>
> Предыдущее обновление: 2026-08-11 (**result photo clipped in dock plate:** после `phase=done` `resultUrl` рисуется внутри `CardInlineGeneratePanel` (`overflow-hidden` + `rounded-[1.75rem]`); fullscreen host-backdrop убран — фото не выходит за модалку.)
>
> Предыдущее обновление: 2026-08-11 (**generate glass plate restored:** plate = `bg-zinc-950/55 backdrop-blur-xl`; tab `focusBlank` открывает compact glass (без auto prompt sheet). Убран content-filter / чёрный экран.)
>
> Предыдущее обновление: 2026-08-11 (**desktop search nav:** поле поиска убрано из `ListingBottomBar`; desktop — пункт сайдбара **Поиск** → `/search` (Enter/`q` как раньше); поле ввода на `/search` (lg+). Mobile tab/sheet без изменений.)
>
> Предыдущее обновление: 2026-08-11 (**global listing generate dock:** `GenerateDockContext` + `GenerateListingDockHost` в `PageLayout` — плавающий `CardInlineGeneratePanel chrome=dock` на `/`, `/trends`, `/catalog`, тегах, `/search`, `/favorites`, `/generate`, `/generations` (treatment). Tab «Сгенерировать» → `focusBlank` in-place. Card «Повторить» → `seedFromCard` + close modal/`history.back`. Фон dock = `resultUrl` только при `phase=done`. `/generate` = история (`GenerateBlankShell` без nested dock).)
>
> Предыдущее обновление: 2026-08-11 (**один generate-модуль:** `GenerateSurface` — `dock` на `/generate`, `modal` на карточке: desktop — в правой aside поверх описания/«Повторить»; mobile — portal soft `/generate`. Composer = `CardInlineGeneratePanel`. Open: `useGenerateSurface` / `soft|route`.)
>
> Предыдущее обновление: 2026-08-11 (**`/generate` dock surfaces:** SSOT `GenerateDockSurface` = `prompt|photos|model|null` — shell растягивает плавающий composer до хедера для любого редактора; pickers рендерятся внутри dock, без отдельных viewport overlay sheets. Card fullscreen по-прежнему absolute sheets.)
>
> Предыдущее обновление: 2026-08-11 (**`/generate` listing + dock:** blank shell — обычный листинг `GenerationsContent` + плавающий composer `CardInlineGeneratePanel chrome=dock` снизу; история не внутри compose-модалки. Card «Повторить» остаётся fullscreen.)
>
> Предыдущее обновление: 2026-08-11 (**mobile generate tab + `/generate`:** treatment `prompt_card_generation` — center tab «Сгенерировать» и sidebar CTA «Генерация фото»; control — 4 таба без center, CTA скрыт. Профиль убран из tab bar (Избранное/генерации/выход — хедер). Единый `CardInlineGeneratePanel` (`source=card|blank`); mobile soft/route shell `GenerateMobileModalContext` на `/generate` (noindex); desktop PageLayout blank page. Defense-in-depth: UI hide → `open()` no-op → server redirect → API `generationSurface=prompt_card`. Metrika `generate_shell_open` (`entry_source`: tab|card|route|sidebar).)
>
> Предыдущее обновление: 2026-08-10 (**AuthModal UI:** убрана кнопка Telegram; Google и Яндекс — одинаковые кастомные кнопки (`h-12`, общий padding/иконка 20px) в фирменных стилях; виджет YaAuthSuggest удалён.)
>
> Предыдущее обновление: 2026-08-10 (**auth signup trigger FK:** `sql/180_fix_handle_new_auth_user_imageprompt_fk.sql` — `handle_new_auth_user` сначала upsert `imageprompt_users`, потом `landing_users`; иначе после 179 signup падает `landing_users_id_fkey` / `Database error saving new user` → `auth_error=no_code`.)
>
> Предыдущее обновление: 2026-08-10 (**auth signup trigger:** `sql/179_fix_handle_new_auth_user_search_path.sql` — `handle_new_auth_user` с `SET search_path = public` и `public.landing_users`, иначе новый OAuth signup падает `relation "landing_users" does not exist`.)
>
> Предыдущее обновление: 2026-08-10 (**Yandex OAuth host RU:** в GoTrue custom provider `custom:yandex` endpoints должны быть `https://oauth.yandex.ru/authorize` и `https://oauth.yandex.ru/token` (не `.com`); userinfo по-прежнему через адаптер лендинга / `login.yandex.ru`.)
>
> Предыдущее обновление: 2026-08-10 (**OAuth account picker:** `signInWithOAuthProvider` передаёт IdP `queryParams` — Yandex `force_confirm=yes`, Google `prompt=select_account` — чтобы при повторном входе можно было выбрать аккаунт.)
>
> Предыдущее обновление: 2026-08-10 (**OAuth PKCE client finish:** `/auth/callback` — client `page.tsx` + `finishOAuthCodeExchange` (браузерный `exchangeCodeForSession`); server `route.ts` убран — он давал дубль `POST /token` 200→404 `flow_state_not_found` и `auth_error` без session cookies. `AuthProvider` не обменивает `code` на `/auth/callback`.)
>
> Предыдущее обновление: 2026-08-10 (**OAuth return path + pricing UX:** `AuthModal` редиректит на `/auth/callback?next=<path>`; после логина возврат на исходную страницу. Pricing: legal footer без акцента (`mt-auto`), клик по всей карточке тарифа, auth на CTA.)
>
> Предыдущее обновление: 2026-08-10 (**paid generation CTA + credit costs:** inline generator читает текущий баланс через `/api/me` и при `0` кредитов заменяет действия, создающие generation job, на «Пополнить баланс» → `/pricing`; balance refresh event синхронизирует панель после списания/refund. Миграция `177` устанавливает стоимость Nano Banana / Nano Banana 2 Lite = 5 кредитов, Nano Banana PRO / Nano Banana 2 = 10 кредитов; API fallbacks используют те же значения.)
>
> Предыдущее обновление: 2026-08-10 (**admin payment/user generation operations:** `/admin/payments` показывает server-only YooKassa ledger с payer identity, provider/local status и независимым состоянием credit fulfillment. В `/admin/analyze-history` добавлен cursor-list всех non-admin `landing_generations` со статусами, короткими signed source previews и модераторской публикацией completed results. Миграция `178` добавляет service-role read RPC и индексы.)
>
> Предыдущее обновление: 2026-08-09 (**YooKassa checkout:** `/pricing` создаёт одностадийный redirect-платёж в RUB; подтверждённый через provider GET webhook атомарно и идемпотентно начисляет токены в `landing_users.credits`. Для СМЗ чеки регистрируются вручную в «Мой налог».)
>
> Предыдущее обновление: 2026-08-08 (**local image edit contract:** initial generation по-прежнему получает пользовательские фото + полный prompt. После success footer `Что изменить` открывает двухблочную шторку; `Применить и сгенерировать` сохраняет переписанный полный `prompt_text` для history/copy/UGC, но image worker получает только completed parent result + отдельную `edit_instruction` + preserve-everything-else rules. Миграция `172` добавляет nullable delta-поле; legacy child jobs без него временно используют full-prompt fallback. Fingerprint включает parent ID и edit instruction.)
>
> Дополнение 2026-08-08 (**PromptShot admin/analyze migration, code complete — rollout pending:** `/foto-v-promt` переведён на same-origin `/api/extension/analyze`; добавлены Supabase Auth + `ANALYTICS_ADMIN_EMAILS` gated `/admin/analytics`, `/admin/analyze-history` и `/api/admin/*`; analyze использует атомарный reserve/confirm/release rate limit и приватную 30-дневную history. Admin generation переиспользует durable worker queue, а публикация analyze/generation идемпотентно создаёт `prompt_cards` и запускает общий SEO tagging. Extension Lite и remix остаются на `imageprompt.tools`. SQL `175` и production deploy этим изменением документации не применялись.)
>
> Дополнение 2026-08-08 (**auth-scoped generation preferences + Nano Banana 2 Lite:** миграция `173` добавляет `landing_generation_preferences` с последними model / aspect ratio / image size / выбранными photo IDs. Inline compose восстанавливает настройки для auth-пользователя на любом браузере и обновляет их с debounce; если сохранённых доступных фото нет, выбирается самое свежее. Глобальные defaults: Nano Banana (`gemini-2.5-flash-image`) и `9:16`. В models config добавлен официальный stable ID Nano Banana 2 Lite — `gemini-3.1-flash-lite-image`; актуальная стоимость моделей задаётся последующими миграциями.)
>
> Дополнение 2026-08-08 (**sticky percentage rollout prompt-card generation:** миграция `174` добавляет `landing_feature_rollouts` (глобальный `enabled` + `rollout_bps`) и `landing_user_feature_assignments` (стабильный bucket auth-пользователя). Анонимный bucket вычисляется по годовой HttpOnly-cookie `promptshot_vid`, а при первом login атомарно закрепляется за `auth.users.id`. Единый server resolver управляет inline generation, prompt remix, балансом и `/pricing`; `POST /api/generate` повторно проверяет rollout для `generationSurface=prompt_card`. При нуле кредитов генерация блокируется и ведёт на preview тарифов; checkout пока не создаётся.)
>
> Дополнение 2026-08-08 (**sticky percentage rollout prompt-card generation:** миграция `174` добавляет `landing_feature_rollouts` (глобальный `enabled` + `rollout_bps`) и `landing_user_feature_assignments` (стабильный bucket auth-пользователя). Анонимный bucket вычисляется по годовой HttpOnly-cookie `promptshot_vid`, а при первом login атомарно закрепляется за `auth.users.id`. Единый server resolver управляет inline generation, prompt remix, балансом и `/pricing`; `POST /api/generate` повторно проверяет rollout для `generationSurface=prompt_card`. При нуле кредитов генерация блокируется и ведёт на preview тарифов; checkout пока не создаётся.)
>
> Коррекция 2026-08-07 (**post-result apply generates:** первый textarea можно менять вручную, второй `changeRequest` переписывает его. В initial state apply не enqueue-ит job. В completed state успешный remix немедленно передаёт новый prompt в `POST /api/generate` вместе с текущим `parentGenerationId`; кнопка и progress используют единый busy-state.)
>
> Коррекция 2026-08-07 (**compact inline generation controls:** result stage и mobile sheet сохраняют прозрачный glass-слой над generated backdrop; prompt card и square controls собраны в bottom-aligned foreground-группу рядом с CTA. `Ваши фото` и `Модель` открываются как взаимоисключающие iOS-style sheets на всю ширину compose-блока: sheet начинается от его нижней границы, перекрывает CTA, а отдельный backdrop затемняет весь остальной compose. Surface белая и непрозрачная, с верхним drag indicator и safe-area padding. При запуске sheet закрывается, а progress bar и проценты рендерятся внутри CTA `Сгенерировать`.)
> Коррекция 2026-08-07 (**collapsed prompt + light compose:** до первого результата compose surface белый, без внешнего светлого ring/border. Prompt по умолчанию занимает одну строку с truncated preview; по клику открывается полноразмерной шторкой `inset-0` на всю ширину и высоту compose, поверх header/CTA, с safe-area padding, drag indicator и внутренним scroll для длинного текста. После генерации compose surface снова становится прозрачным glass-overlay над result backdrop.)
> Коррекция 2026-08-07 (**mobile compose viewport contract:** обе mobile-точки монтирования inline generation — immersive card с фото и fallback без фото — передают панели полный viewport (`inset-0`, `h-full`/`100dvh`) вместо content-sized bottom sheet с `max-height: 88dvh`. Внешний wrapper больше не дублирует vertical scroll и safe-area bottom padding: scroll остаётся во внутренних областях prompt/picker, top safe area обрабатывает header, bottom safe area — CTA footer. Это сохраняет один height contract и предотвращает незаполненную верхнюю часть экрана и двойной нижний отступ.)

> Последнее обновление: 2026-08-07 (**inline generation result UI:** `CardInlineGeneratePanel` использует result image как full-bleed backdrop со scrim и glass-контролами; foreground показывает точный отправленный промпт, persistent-карусель пользовательских фото и квадратные model tiles. После enqueue клиент сохраняет `generationId`; меню результата переиспользует действия `/generations` — share, download, copy prompt, save to photo library, publish и delete.)

> Последнее обновление: 2026-08-07 (**publish/open generated cards:** `GET /api/generations` batch-обогащает history полями `cardId/cardSlug/isPublished`; клик по completed result открывает обычную modal-карточку с URL `/p/[slug]`, а отсутствующий после best-effort worker draft идемпотентно восстанавливается через `POST /api/generations/[id]/ensure-card`. Меню ⋮ публикует через `POST /api/generations/[id]/publish`: ensure draft → общий SEO publish service → `is_published=true` → revalidate card + sitemap. Удаление generation сохраняет result object, если на него ссылается `prompt_card_media`.)
>
> Коррекция 2026-08-07 (**UGC auth identity contract:** `landing_generations.user_id` остаётся shared billing/profile id (`imageprompt_users`), а `requester_auth_user_id` — канонический автор UGC и viewer id (`auth.users`). Worker, ensure-card, vibe save, `/p` draft access, visibility и `/api/my-prompt-cards` больше не подставляют shared id в `prompt_cards.author_user_id`. Backfill обрабатывает только строки с явным requester auth id.)

> Последнее обновление: 2026-08-07 (**`/generations` listing chrome + actions:** сетка как у каталога (`ListingGrid`, карточки `aspect-[3/4]` photo-only); overflow-меню ⋮ — Выбрать / Поделиться / Скачать / Скопировать промпт / Использовать / Удалить (без «Оживить»). «Выбрать» — bulk-select с чекбоксами и нижним баром «Удалить (N) / Отмена». API: `DELETE /api/generations/[id]`, bulk `DELETE /api/generations` `{ ids }`, `POST /api/generations/[id]/save-to-library` копирует result в `landing_user_photos`. UGC-карточки при удалении истории не трогаем.)

> Последнее обновление: 2026-08-06 (**durable web-generation queue:** `POST /api/generate` атомарно списывает кредиты и создаёт `pending` job через `landing_enqueue_generation`; отдельный `web-generation-worker` забирает batch через `FOR UPDATE SKIP LOCKED`, держит lease/heartbeat, ограничивает concurrency, повторяет временные 429/5xx и возвращает кредит строго один раз после terminal failure. Публичный `/api/generate-process` закрыт с 410; миграция `170_landing_generation_queue.sql`.)

> Последнее обновление: 2026-08-06 (**generation history + balance sync:** `/generations` читает канонические `landing_generations`, поэтому готовый результат не зависит от best-effort создания UGC-карточки. Бесплатный open-debug теперь выключен по умолчанию и включается только явным `STV_OPEN_GENERATE_DEBUG=true`; inline-клиент после списания/refund отправляет общий browser event, по которому navbar повторно читает `/api/me`.) + (**Yandex Metrika early queue:** root layout до hydration создаёт только лёгкий bounded `window.ym` queue и сразу ставит `init`; `tag.js` по-прежнему загружается через `lazyOnload`. До готовности SDK виртуальные `hit` и `reachGoal` не теряются; очередь ограничена init + 100 событий.)

> Дополнение 2026-08-06 (**desktop extension header CTA — superseded 2026-08-11:** CTA перенесён в сайдбар → блок **Инструменты**; см. последнее обновление про `desktop_sidebar`.)

> Дополнение 2026-08-02 (**fix/card-modal-backdrop-dismiss:** общий `CardModal` закрывает оба варианта модалки карточки по клику на визуальный backdrop, включая прозрачные промежутки desktop split; реальные поверхности помечены `data-card-modal-surface` и не закрывают экран.)

> Дополнение 2026-08-02 (**pricing-link-preview:** неавторизованный пользователь в любом окружении может открыть `/pricing?test=true`; без точного параметра действует общий email allowlist и маршрут отвечает 404.)

> Коррекция 2026-08-04 (**always-floating Chrome CTA:** inline CTA удалены из desktop hero и mobile-шапки. `FotoVPromtFloatingCta` всегда закреплён снизу desktop-страницы, без `IntersectionObserver`; `FotoVPromtMobileModal` показывает тот же CTA фиксированно над safe area (`foto_v_promt_mobile_floating_cta`). Цвет — контрастный графитовый с белой обводкой и усиленной тенью.)

> Коррекция 2026-08-05 (**native mobile card scroll-snap:** ручной Pointer Events track заменён на браузерный вертикальный `scroll-snap` с тремя виртуализированными viewport-слайдами `prev/current/next`. Соседи предварительно загружаются как полные `CardPageData` через единый promise-based LRU-кэш на 9 карточек в `PromptCardModalContext`; in-flight запросы дедуплицируются. После settle готовый сосед атомарно становится активной карточкой и обновляет URL, недогруженный сосед делает snap-back. `scrollend` дополнен debounce fallback для Safari 16.4. Chrome скрывается только во время touch/scroll и не зависит от decode hero, поэтому cache-hit изображения не могут оставить кнопки невидимыми. Стрелки используют тот же программный smooth-scroll; desktop-навигация не изменилась. iOS callout / selection / drag / context menu по-прежнему отключены. Общая правка действует для client modal, intercepted modal и direct `/p/`.)

> Последнее обновление: 2026-08-05 (**inline user photo library:** `CardInlineGeneratePanel` загружает сохранённые фото пользователя newest-first, автоматически выбирает самое свежее, поддерживает выбор 1–10 фото, немедленное сохранение новых загрузок и удаление из private Storage. Таблица `landing_user_photos`, API `/api/user-generation-photos`, миграция `169`; STV/extension UI остаётся с отдельным лимитом 4.)

> Коррекция 2026-08-05 (**scroll-snap pagination bridge:** когда активная карточка достигает последнего загруженного slug, `CardPageClient` через общий event-контракт `listing-card-navigation-context` просит mounted `InfiniteGrid` / `SearchResults` загрузить следующую страницу. После `writeListingNavigationContext` feed пересчитывает соседей без смены карточки. Несуществующие крайние snap-слайды не рендерятся, поэтому у фактического конца выдачи нет чёрного экрана и rollback.)

> Последнее обновление: 2026-08-05 (**mobile /p card swipe:** на mobile immersive карточки с фото — стрелки листинга ↑/↓ в правом стеке под реакциями; свайп вверх/вниз перелистывает соседей (`useVerticalCardSwipe`); нижний бар — только «Копировать» + LexyGPT (`grid-cols-2`); one-time онбординг-тултип (`promptshot_card_swipe_onboarding_v1` в localStorage). Desktop ↑↓ без изменений.) + предыдущее 2026-08-04 (**fix/foto-v-promt-first-screen-cta:** общий `FotoVPromtChromeCta` рендерится в hero `/foto-v-promt`, поэтому Chrome CTA виден на первом экране desktop/mobile; после ухода виджета из viewport сохраняется floating-вариант. Hero и floating имеют отдельный `utm_content`, но общую цель Метрики.) + предыдущее 2026-08-02 (**feature/pricing-legal-pages:** preview `/pricing`, баланс и CTA «Пополнить» доступны только сессии `azarov.maxim@gmail.com` через общий `canAccessPricingPreview`; для остальных `/pricing` отвечает 404, ссылка скрыта, маршрут исключён из sitemap и закрыт в robots. Страница содержит 4 пакета токенов Basic / Standard / Pro / Ultimate и реквизиты СМЗ Азаровой Марии Петровны; `/terms` и `/policy` остаются публичными и открывают готовые PDF из `public/docs` (редактируемые источники — `landing/legal-source`), `/privacy` → permanent redirect `/policy`; checkout ЮKassa пока не реализован.) + предыдущее 2026-08-01 (**feature/fix-generations-shared-db-author:** `/generations` → `/api/my-prompt-cards` фильтрует по shared db id (`resolveViewerDbUserId`); ownership `/api/my-cards/.../visibility`, `/api/card/[slug]`, SSR `/p/[slug]` и vibe save `author_user_id` — тот же резолв. Предыдущее: **feature/resolve-imageprompt-db-user:** общая БД с imageprompts — `landing_users`/`landing_generations` FK → `imageprompt_users`; JWT `auth.users.id` может ≠ `imageprompt_users.id` при том же Google. Резолв `resolveSharedDbUserId` по `google_sub` (fallback email) в `/api/me`, `/api/generate` (`ensureLandingUserForGeneration`), `/api/generations`. Open-debug пишет на shared db id, не требует `dbUserId === JWT`. Предыдущее: **fix/gemini-error-passthrough:** `generate-process` пишет в `error_message` сырой Gemini (`finishReason`/`blockReason`/`error.message`) без RU-подмены. Предыдущее: **listing sort default → new:** дефолт `/[...slug]` — **`new`**. Предыдущее: **fix/open-debug-allowlist-default:** allowlisted email → open-debug on по умолчанию на prod; kill-switch `STV_OPEN_GENERATE_DEBUG=0`; FK-fail upsert `landing_users` → guest-owner fallback. Предыдущее: **feature/internal-generate-allowlist:** inline + open-debug только для allowlist. Предыдущее: **client_source на генерациях:** `landing_generations.client_source` — всегда `site` при `POST /api/generate`; миграция `sql/168_landing_generations_client_source.sql`. Предыдущее: **feature/internal-generation-repeat:** inline compose на `/p/[slug]`; `STV_OPEN_GENERATE_DEBUG`. Предыдущее: STV web LexyGPT-style canvas + `STV_GUEST_MODE`.)

> Последнее обновление: 2026-07-24 (**feature/desktop-prompt-card-ui:** desktop `md+` карточка промта — split layout: крупное фото слева + тёмная панель справа (автор, промпт + «Скопировать», теги, reactions/favorite/share/views, текстовая ссылка FotoVPromt, mint CTA `LexyGptGenerateButton` variant `desktop-panel`); listing ↑↓ между колонками; модалка (`CardModal`/`ClientCardModal`) — прозрачный wide shell без белой карточки; mobile immersive без изменений; SEO/URL/API не трогали.) + предыдущее 2026-07-24 (**feature/foto-v-promt-mobile-modal:** на **max-lg** immersive-модалка всегда: soft `pushState` с таба **или** auto `route`-mode при hard `/foto-v-promt` (ссылка с главной, refresh, поиск); close soft → `history.back()`, route → `router.replace('/')`; SSR SEO-страница и desktop без изменений; `FotoVPromtMobileModal` в root layout.) + предыдущее 2026-07-24 (**feature/new-tab:** маршрут **`/new`** — глобальный фид карточек по `created_at` (`resolve_route_cards` `p_sort=new`), фильтры как на `[...slug]`, без `ListingSortToggle` (`CatalogWithFilters` `fixedSort="new"`); **MobileTabBar:** Новое → Каталог → Фото в промт (center accent pill + подпись) → Поиск → Профиль; LexyGPT «Сгенерировать» убран из таббара (`lexygpt_generate_tabbar` deprecated); **SidebarNav:** пункт «Новое» между Главная и Фото в промт; sitemap `/new` priority 0.85.) + предыдущее 2026-07-02 (**feature/foto-v-promt-lexygpt-cta:** `/foto-v-promt` — кнопка «Сгенерировать» (LexyGPT) в результате и истории; цели Метрики разделены по placement.) + предыдущее 2026-07-02 (**fix/foto-v-promt-no-model-picker:** `/foto-v-promt` — без выбора модели в UI, всегда `style: photoreal`; extension/STV на imageprompt — без изменений.) + предыдущее 2026-07-02 (**fix/foto-v-promt-photoreal-base:** `/foto-v-promt` — UI «Фотореализм» (база) + «Оптимизировать под модель»; backend imageprompt — всегда полный 12-section photoreal prompt, non-photoreal styles только internal model-tuning wording.) + предыдущее 2026-07-02 (**feature/foto-v-promt-generation-models:** …) мигр. `165` — `indexable_tag_combos_cache` + `refresh_indexable_tag_combos()`; RPC `get_indexable_tag_combos` читает кеш (self-join убран из SSR hot-path). Мигр. `166` — `resolve_route_cards` снова сортирует `popular` по **материализованному** `prompt_cards.popularity_score` (индекс `158`); `recalculate_popularity_scores()` пересчитывает формулу мигр. `163` по cron. SSR `[...slug]`: `getCachedRouteCards` (`cache()` + try/catch), единые параметры metadata/page, неблокирующие enrich/L2/illustrations; `error.tsx` backstop. **pg_cron (prod):** `refresh_indexable_tag_combos` */30, `recalculate_popularity_scores` hourly, `refresh_tag_counts` */30; после миграций — `NOTIFY pgrst, 'reload schema'`. Follow-up: `is_listing_eligible` для удешевления `COUNT(*)`.) + предыдущее 2026-06-22 (**fix/category-scroll-jump:** `useListingScrollOnRouteChange` в `PageLayout` — сброс `#listing-scroll-root` при смене pathname; `cancelListingScrollRestore` + generation guard в `scheduleListingScrollRestore` (отмена stale timers/rAF); убран restore-on-mount из `CatalogWithFilters`/`SearchResults`; sidebar category links `scroll={false}`. Scroll policy: новая категория → top; restore только после закрытия модалки на том же pathname; Back → top (trade-off).) + предыдущее (**feature/listing-popularity-ranking:** сортировка листинга `sort=popular` была сломана — `popularity_score` материализовался hourly job'ом `recalculate_popularity_scores`, но cron на DO не был настроен → score завис в 0 у всех 7585 карточек, и `popular` совпадал с `new`. Миграция `163` переводит score на **query-time** в `resolve_route_cards`: `(view_count + react_weight·(likes-dislikes)) / (1 + age_days/half_life_days)^decay_exponent`, константы в `photo_app_config`. Зависимость от cron убрана. Наследие 158–160 (`views_7d`, `prompt_card_view_events`, job, standalone) в ранжировании не участвует — follow-up на чистку. **Главная выровнена под листинг:** миграция `164` — `get_homepage_sections` сортирует карточки по той же popularity-формуле (топ-10 на тег); кросс-категорийный дедуп обложек (`buildCategorySectionBlocks` / `pickDeduplicatedPhotos`, общий `usedCardIds`) — без повторяющихся фото между блоками: каждый блок берёт первую ещё не занятую популярную карточку.) + предыдущее 2026-06-20 (**Фильтры листинга:** scroll в `FilterPanel` / `ListingDesktopFilters` — `FILTER_MODAL_LAYOUT` + `FILTER_MODAL_BODY` на dialog root; desktop dialog `lg:flex` (не `lg:block`); mobile-shell CSS только `@media (max-width: 1023px)`; сброс `--ps-listing-shell-height` на desktop в `PageLayout`.) + предыдущее (**Chrome Web Store UTM** на ссылки `getAiImageDescriberChromeUrl()` с `/foto-v-promt` — атрибуция install в GA4 листинга.) + предыдущее (**Яндекс.Метрика:** `foto_v_promt_add_to_chrome_click` — floating CTA Chrome на `/foto-v-promt`.) + 2026-06-14 (**feature/seo-fixes:** soft-404 → `notFound()` в `generateMetadata` для `[...slug]` и `p/[slug]`; кастомный `not-found.tsx` с `robots: noindex`; `/embed/stv` → noindex через `embed/layout.tsx`; sitemap L1 фильтруется по `getFilterCounts` (порог ≥ 1 карточки); JSON-LD переведён на inline `<script>` во всех SSR-страницах; trailing slash убран из всех внутренних ссылок (menu.ts, homepage-sections, [...slug]); `foto-v-promt` canonical без слэша, согласован с sitemap; `robots.ts` заменён текстовым route handler `robots.txt/route.ts` с расширенным `Disallow` + `Clean-param` для Яндекса; L3 BreadcrumbList — позиция 3 теперь L2 URL, позиция 4 — canonicalUrl; `doc_task_tag` добавлен в DIMENSIONS чипов `/p/[slug]`; `site.webmanifest` заполнен name/short_name.) + **feature/fix-listing-scroll-restore:** фикс потери позиции скролла и «подскрола» при закрытии модалки карточки. `scroll-preservation.ts` — модульный флаг `restoreInProgress` + экспортируемый геттер `isListingScrollRestoreInProgress()`; `scheduleListingScrollRestore` расширен до 500 мс (было 320 мс): 6 дискретных reapply на 0/rAF/rAF²/50/150/320 мс + финальный таймаут 500 мс — там же сбрасывается флаг и `scrollRestoration = "auto"`. Флаг блокирует авто-loadMore в `InfiniteGrid` и `SearchResults` (ранний `return` в `IntersectionObserver`-callback) — предотвращает загрузку 48 карточек во время восстановления: именно этот fetch + пересчёт `listing-grid-clamp` (скрытие неполного ряда) вызывал reflow уже после окончания прежнего окна 320 мс и двигал позицию. Fix type: architectural — общий слой `scroll-preservation` + оба грида.) + предыдущее 2026-06-13 (**feature/image-seo:** Image SEO для Google Images / Яндекс.Картинок — `getIndexableImageUrl(bucket, path)` в `supabase.ts` (URL картинок на основном домене `promptshot.ru/img/:bucket/:path*` через rewrite в `next.config.ts`); `getPublishedCardImagesForSitemap()` с join `prompt_card_media`; кастомный роут `GET /image-sitemap.xml` (XML с `<image:title>/<image:caption>`, чанкинг по 5000 карточек + `<sitemapindex>` при превышении); `robots.ts` — массив из двух sitemap; `src/lib/image-alt.ts` — `buildCardImageAlt/buildBeforeAlt/buildAfterAlt/buildThumbAlt`; keyword-rich alt во всех карточках (`PromptCard`, `GroupedCard`, `CardPageClient`) и `PhotoCarousel`; `ImageObject` JSON-LD на `/p/[slug]` (все фото карточки с `contentUrl` на основном домене, `representativeOfPage`); `og:image` / `twitter:image` — тоже через `getIndexableImageUrl`.) + предыдущее **feature/mobile-tab-bar:** мобильный 5-вкладочный таб-бар `MobileTabBar` на `max-lg` — Каталог (`/catalog`) / Фото→промт / Сгенерировать (center pill → LexyGPT, `reachGoal lexygpt_generate_click placement:tabbar`) / Поиск (open `ListingMobileSearchSheet` или `/search`) / Профиль (auth → `openAuthModal` или `MobileProfileSheet`); `ListingBottomBar` — только desktop portal; `PageLayout` — `hideBottomBar` prop удалён, всегда рендерится и `ListingBottomBar` (desktop) и `MobileTabBar` (mobile); новый маршрут `/catalog` (ISR revalidate=3600, noindex), хелпер `buildCategorySectionBlocks` в `src/lib/homepage-sections.ts`; `SearchResults` — `FilterFAB` controlled, `onOpenMobileFilters` передан в `ListingDesktopFilters`.) + предыдущее** единый грид каталога и поиска — `ListingGrid` (единый источник классов `grid grid-cols-2…xl:grid-cols-5`); `listing-grid-clamp` (CSS nth-child, per-breakpoint) скрывает неполный последний ряд пока `hasMore=true`; `FilterableGrid` принимает `clamp` prop, `InfiniteGrid` передаёт `clamp={hasMore}`; `SearchResults` мигрирован на `ListingGrid`, `PAGE_SIZE` 24→48, spinner→`ListingGridLoadingSkeleton`, sentinel `rootMargin` 400→600px; `PromptGrid.tsx` удалён (мёртвый код); фикс «белой плашки»: `useListingCardImageReady` — derived-state reset вместо `useEffect` (устранена гонка для кешированных фото), `imageRef` callback (немедленный reveal при `img.complete`); skeleton `z-[3]`→`z-[1]` (defense-in-depth: фото `z-[2]` закрывает skeleton после decode); `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` на `/api/listing`, `s-maxage=30 swr=120` на `/api/search`; `<link rel="preconnect">` к `NEXT_PUBLIC_SUPABASE_URL` в `layout.tsx`.) + предыдущее (**feature/card-modal-instant-open:** мгновенное открытие карточки без мигания — 1) `CardModalSeed` (photoUrl/photoCount/hasPrompts) из листинга передаётся в `open()`, `PromptCardModalContext` хранит `currentSeed`; 2) `prefetchCard(slug)` с in-flight дедупом — запускается на `onPointerEnter`/`onTouchStart` в `PromptCard`/`GroupedCard`; 3) `ClientCardModal` переключает `immersiveMobile=true` сразу при наличии `seed.photoUrl` (не ждёт загрузки данных) и показывает тёмный loading-шелл с grid-фото (`SIZES_CARD_GRID`, `CARD_IMAGE_LISTING_NEXT_QUALITY` — те же пресеты, что грид, → browser cache hit); белый «Загрузка…» только для карточек без фото / desktop; 4) `CardPageClient` (mobile immersive): `useListingCardImageReady({ resetKey: currentPhoto })` → `heroImageReady`; `mobileChromeClass` (`transition-opacity duration-200 opacity-0→opacity-100`) применён ко всем glass-элементам мобильного хрома (tap-кнопки, before-photo, header, group-nav aside, reactions aside, bottom content, bottom bar) — кнопки невидимы до `decode()` героя, затем появляются сразу в корректном glass-состоянии без промежуточного чёрного флеша. + **SEO v2 (аудит):** canonical без трейлинг-слеша сайтвайд (`stripTrailingSlash` в `route-resolver.ts` — был конфликт canonical-со-слешем vs 308 vs sitemap); поля `howToTitle` / `seoTextBlocks` в `SeoContent`, рендер SEO-текста после FAQ в `[...slug]/page.tsx`; devushka — точное «промты для девушки» в intro, текстовый блок «Как составить промт для фотосессии девушки», 4/4 иллюстраций через `cardSlug`; журнал — `seo/promty-dlya-foto-devushki/2026-06-11-v2-audit-fixes.md`. + **SEO `/promty-dlya-foto-devushki/` L1:** кураторский блок `devushka` в `seo-content.ts` — H1 «фото и ИИ-фотосессия», `popularLinks`, `featuredL2Slugs`, 4 `illustrations`, 8 FAQ; UI — `SeoPopularLinks` / chips L2 по Wordstat; журнал — `seo/promty-dlya-foto-devushki/`. + предыдущее 2026-06-08:** изолированный маршрут, UI как search; prod без debug; robots disallow. + `hideHoverChrome` на `PromptCard`/`GroupedCard` в `FilterableGrid` (`/[...slug]`) и `SearchResults` (`/search`) — без оверлея при наведении (копировать, LexyGPT, реакции, стрелки); клик → модалка `/p/[slug]`; loading shell — `ListingCardLoadingShell photoOnly` (без `ListingCardChromeSkeleton` / CTA-pills). На `/favorites` и `/generations` hover chrome сохранён. + **Yandex OAuth на лендинге:** официальная кнопка YaAuthSuggest в `AuthModal`. + **Yandex OAuth на лендинге (2026-06-05):** `AuthModal` — Google + **Яндекс ID** (`signInWithOAuth({ provider: "custom:yandex" })` через `landing/src/lib/auth-oauth.ts`); self-hosted GoTrue ≥ v2.187 + Admin API `custom:yandex`; Redirect URI в Yandex app → `https://<SUPABASE_HOST>/auth/v1/callback`; профиль `landing_users` — миграция `sql/157_landing_users_yandex_provider.sql` (`provider: yandex`, `real_name`, аватар из `default_avatar_id`). STV/extension — только Google. Отдельно от OAuth: Яндекс.Метрика. + **Desktop inline-фильтры листинга:** `ListingDesktopFilters` над сеткой на `lg+`, `useListingFilterCounts`; mobile — `FilterFAB` → `FilterPanel`. + **Loading shell карточек листинга:** `useListingCardImageReady` + `ListingCardLoadingShell` — до `decode()` показывается skeleton (shimmer + chrome-pills без `backdrop-blur` glass); real `.listing-card-chrome` (`z-20`) скрыт (`invisible opacity-0`); после decode — crossfade ~200ms. `priorityLoad` влияет только на `next/image priority`, не на skip shell. `PromptCard` сбрасывает по URL фото; `GroupedCard` — по `activeCard.id`. `ListingGridLoadingSkeleton` переиспользует тот же shell. + **SEO-иллюстрации L1:** `SeoContent.illustrations` (0–4, `alt` / `caption` / `label`), резолв `resolveSeoIllustrations`, UI `SeoHeroWithIllustrations` — единая hero-панель: H1 + intro + карусель в одном `article` (текст слева, фото справа на `sm+`; chips в общем footer панели); `caption` sr-only; без фото в FAQ; JSON-LD `ImageObject`; пилот `/s-mashinoy/`. + **SEO `/s-mashinoy/` v5:** meta (`h1`, `metaTitle`, `metaDescription`) без изменений; семантика Wordstat — в `intro`, `faqItems` (9 вопросов), `howToSteps` в `seo-content.ts` → `s_mashinoy`. Ключи: «промт с машиной», ИИ-фото с машиной, авто/автомобиль, сирень, номера, фотосессия, девушка/мужчина с машиной. Удалён FAQ про GTA. + 2026-06-04 **SEO главной `/`:** кластер «промты для фото» — `homepage-seo-copy.ts`, H1 «Промты для фото и ИИ-фотосессии в нейросетях», intro/HowTo/FAQ в конце страницы (после каталога), JSON-LD `CollectionPage` + `FAQPage`, якоря `CategorySection` `id={dimension}` для FAQ-перелинковки; см. `docs/requirements/03-06-homepage-seo-promty-foto.md`. + 2026-06-02 **`/foto-v-promt/`** — RU-лендинг AI Image Describer в каталоге; live-виджет → **`NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN`** / `POST /api/extension/analyze` на imageprompt.tools; см. `docs/requirements/02-06-foto-v-promt-page.md`. + 2026-05-26 P0+P1 производительность и плавный рендер карточек промта: React.memo + стабильный контекст взаимодействий, кэш соседей в client-модалке, CSS containment + will-change, client-side photo reveal с decode() + shimmer на `PromptCard`/`GroupedCard` (с приоритетом LCP и правильным сбросом в группах). Всё в feature/26-05-prompt-card-render-perf-p0-p1. P2 (виртуализация) отложен. + предыдущая стабилизация Solution B: scroll-preservation.ts, компенсация scrollbar, стрелки в модале, immersive mobile parity, nav context для поиска; feature/fix-solution-b-scroll-arrows-stability. См. план и docs/23-03-listing-performance-requirements.md.) (**Моб. FAB:** `fab-bottom-safe` / `fab-sheet-bottom-safe` в `globals.css`; на **`/p/`** у каталога и фильтра — `bg-zinc-800`, чтобы не выглядели «чёрными овалами» на `zinc-950`.) (**Скелет `/p/[slug]`:** `landing/src/app/p/[slug]/loading.tsx` — `max-md`: fullscreen `bg-zinc-950` + полупрозрачный hero-shimmer; `md+`: шапка и сайдбар как у layout; `CardPageClient` — `dynamic(..., { ssr: true })` без отдельного `loading` props.) (**Данные карточки:** `getCardPageData` — один `select` `prompt_cards` с `author_user_id`.) (**Яндекс.Метрика:** `reachGoal` на «Сгенерировать» LexyGPT — `lexygpt_generate_click`, см. § ниже.) (**LexyGPT — партнёрский CTA:** `LexyGptGenerateButton` + `landing/src/lib/lexygpt-generate.ts`. Кнопка «Сгенерировать» записывает полный текст промпта в буфер обмена и открывает `https://lexygpt.com/playground/image/nano-banana-pro?ref=T25A8Y_add` в новой вкладке (текст в URL не передаётся). Размещение: в hover-оверлее при **`md+`** только на `/favorites` и `/generations` (`PromptCard` без `hideHoverChrome`); каталог `/[...slug]` и `/search` — `hideHoverChrome`, CTA только на **`/p/[slug]`**; при **`max-md`** в ячейке оверлея нет. Нижний фиксированный бар **`/p/[slug]`** (при контексте листинга — сетка «пред. карточка · копировать · Повторить (LexyGPT) · след. карточка», иначе копирование + Повторить (LexyGPT) в ряд; sticky **`z-[240]`**, копирование — см. **`landing/src/lib/copy-text-to-clipboard.ts`** / **`CardPageClient`**).) (**`/extension-stv`:** превью лендинга STV: hero (текст + Chrome badge) → pain + **Reference** → **Accuracy** (VS) → **Testimonials** → **How it works** (4 шага) → FAQ; **Pricing** на **`/extension-stv/pricing`**; header (`ExtensionStvMarketingHeader`), FAB; см. строку маршрута ниже.) (**Docker:** контекст образа — каталог **`landing/`** (`docker build -f landing/Dockerfile landing/`); STV для esbuild — **`landing/stv-web-sidepanel/`** (зеркало `extension/sidepanel`, обновление: **`npm run sync:stv-sidepanel`**). См. § «Сборка Docker (standalone)».) (**Генерация на сайте:** тот же UI и бэкенд, что у Chrome extension Steal This Vibe — панель справа (~528px по умолчанию, как side panel) с iframe на **`/embed/stv`**, бандл `landing/public/stv-panel/boot.mjs` (сборка `npm run build:stv-web` перед `next build`). Исходники панели — `extension/sidepanel/stv-core.js` + `boot-chrome.js` / `boot-web.js`, платформы `extension/sidepanel/platform/`. Query: **`cardId`**, **`sourceImageUrl`** (абсолютный URL референса с карточки). **`POST /api/generate`** получает **`cardId`** из состояния embed для атрибуции UGC.) (**Листинг LCP:** первые `LISTING_LCP_PRIORITY_GRID_ITEMS` (12) ячеек в `FilterableGrid` — `next/image` `priority` + `fetchPriority="high"`, без `transition-opacity` на главном фото (`opacity-100`); остальные ячейки — скелетон **`ListingCardPhotoSkeleton overlay`** до первого `onLoad`; при **листании фото стрелками в листинге** скелетон **не** включается снова (нет вспышки полупрозрачного слоя); в **`GroupedCard`** сброс `imageReady` только при смене варианта (**`activeCard.id`**), не при смене индекса фото. **`useListingCardPhotoReveal`** (`IntersectionObserver`, debounce ~320ms на уход из зоны; при повторном входе — два `rAF`, затем при `complete` вызов **`HTMLImageElement.decode()`** с `setReady(true|false)`: `complete` без декода на GPU даёт пустой `bg-zinc-200` на десктопе). **Стабильный `key`** у `InfiniteGrid` — `stableRpcParamsKey`. См. `landing/src/lib/listing-lcp.ts`, `landing/src/hooks/useListingCardPhotoReveal.ts`.) (**`/p/[slug]`:** герой — `priority` + `fetchPriority="high"`; размытый фон **после** `onLoadingComplete` героя, **CSS `background-image`** (не второй `<img>`, чтобы LCP не уходил на full-bleed blur); `dynamic(CardPageClient)` без вложенного `loading` props (маршрутный `loading.tsx`); `browserslist` в `landing/package.json` — меньше legacy polyfills в чанках. См. `docs/23-03-listing-performance-requirements.md` §10. **Производительность листингов / PSI:** требования `docs/23-03-listing-performance-requirements.md` — Метрика `lazyOnload`, `dynamic()` для `CatalogWithFilters` на `[...slug]`, секция каталога с `h2.sr-only`, a11y кнопок реакций/избранного/навигации по фото, `role="img"` у чипа просмотров, контраст подписей L2-чипов. **Превью в листинге (`PromptCard`, `GroupedCard`):** только фиксированный кадр **`aspect-[3/4]`** + `object-cover` (без inline `aspect-ratio` из БД — ровные ячейки; листинг — **CSS Grid**, порядок строками слева направо, не multicol); до декода — `ListingCardPhotoSkeleton` (shimmer). На **`/p/[slug]`** (`CardPageClient`): desktop/tablet — framed hero + `useCardPhotoFrame`; mobile — при **`photoUrls`**: **`CardPageLayout`** (`landing/src/components/CardPageLayout.tsx`) скрывает на **`max-md`** шапку / сайдбар / футер; клиент **`CardPageClient`** — **`fixed`**-экран: **`Image`** (**`fill`**, **`object-cover`**) на весь viewport, **`bg-zinc-950`**, **`z-[245]`**, нижний градиент; **`blurBackdropReady`** — для десктоп-героя; шапка: «БЫЛО» **`absolute`** слева, ряд **`flex`**: **сегменты** нескольких фото — **сверху** при **фото > 1**; затем одна строка **`grid`**: слева **`w-11`** для симметрии, по центру **пилюля просмотров**, **крестик** справа; **варианты подборки** (>1) — **`aside` слева** (`left-3`), столбик пилюль по вертикали, центр экрана как у реакций справа; низ **`z-[99]`**: реакции (без столбца) + избранное + шэр через **`CARD_OVERLAY_ACTION_PILL`**; превью / теги / подборка — зона над доком; **«Посмотреть промпт»** — chip в стиле тега на **отдельной строке**; по тапу — **затемнение + блок только с текстом** над доком (**без** отдельного sheet-chrome Lexy/copy); края **~34%** для перелистования; блок **`#card-prompt-full`** на мобиле при герое — **`hidden md:block`** в DOM для SEO**. Контекст листинга — **`localStorage`** `promptshot_listing_nav_v1` (**`listing-card-navigation-context`**, **`CardFilters`**) — переход между соседними карточками с листинга: **`router.replace(\`/p/…\`)`** (без **`push`**, история карточек не копится). **Fullscreen моб.** — **`router.replace(breadcrumbTag?.urlPath ?? \`/\`)`** (как первый breadcrumb-тег или главная). Clamp 2:3…3:2 для framed-режима сохранён. **Hover-оверлей листинга:** включается только без пропа **`hideHoverChrome`** (каталог `/[...slug]` и `/search` — отключён); при включении — только при **`(hover: hover) and (pointer: fine) and (min-width: 768px)`** (как Tailwind **`md`**) внутри **`listing-card-chrome`**: **`listing-card-chrome-ambient`** (бейджи сплита/черновика, «БЫЛО», нижний градиент с заголовком/превью) — fade + **`translateY`** ~260ms; **`listing-card-chrome-controls-fast`** и **`listing-card-chrome-actions-fast`** (стрелки фото, счётчик кадра, «Сгенерировать» (LexyGPT) и «Скопировать», на **`GroupedCard`** — кнопка переключения варианта **n/m**; просмотры, реакции/избранное) — opacity ~55ms. На фото — **`listing-card-photo-hover`** (`scale(1.03)` при `prefers-reduced-motion: no-preference`). Показ по `:hover` / `:focus-within` у **`group`** (`landing/src/app/globals.css`). Ниже 768px оверлей не активируется: первый тап по ячейке попадает в фоновую ссылку **`/p/[slug]`**. На touch / coarse pointer — то же. Заголовок, превью, LexyGPT, «Скопировать», стрелки фото помечены **`listing-card-chrome-target`** — при скрытом overlay (`opacity: 0`) они не участвуют в hit-test, чтобы не перехватывать тап перед ссылкой. Полноэкранное «Скопировать» (`expanded`) вне `listing-card-chrome`, `z-30`. **Подгрузка листинга:** `InfiniteGrid` — `ListingGridLoadingSkeleton` (сетка-призрак), не спиннер. **view_count:** миграции `sql/154_*` (сортировки листингов) + `sql/155_increment_prompt_card_view.sql` (RPC `increment_prompt_card_view`); на `/p/[slug]` — `POST /api/card-view` + `useCardViewBeacon`, дедуп `sessionStorage` `promptshot_view_{slug}`. UI превью: `CARD_OVERLAY_PHOTO_COUNTER_CLASS` по центру сверху; `CardOverlayMetricsChips` — просмотры справа при `view_count > 0`; пилюли действий — `CARD_OVERLAY_ACTION_PILL`. Подробнее — `docs/23-03-prompt-card-view-count-requirements.md`. **Промо-фото / сжатие:** цепочка и пресеты — § «Промо-фото карточек: сжатие и пресеты» ниже; детальное ТЗ — `docs/23-03-canonical-image-presets-requirements.md`. **Docker / standalone:** см. § «Сборка Docker (standalone)» ниже.)

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
| Аналитика | Яндекс.Метрика (`layout.tsx`: bounded queue/init — `beforeInteractive`, тяжёлый `tag.js` — `lazyOnload`) |

### Яндекс.Метрика — цели (`reachGoal`)

- Счётчик: **`107703100`** (дублируется в **`YANDEX_METRIKA_COUNTER_ID`**, файл `landing/src/lib/yandex-metrika.ts`; init — `landing/src/app/layout.tsx`).
- **Загрузка без потери ранних событий:** до hydration создаётся совместимая с SDK очередь `window.ym` и первым элементом ставится `init`; максимум — 100 последующих событий с сохранением init. Внешний `tag.js` остаётся `lazyOnload`, поэтому не конкурирует с LCP; после загрузки SDK обрабатывает накопленные открытия карточек и цели по порядку.
- **Переход в карточку промта:** **`reachGoal('prompt_card_open')`**, параметры: **`entry`**: `modal` (клик с листинга → `PromptCardModalContext.open`) \| `page` (прямой заход на `/p/[slug]`); **`referer`** — путь до открытия (только `modal`); **`slug`**. Дополнительно для модалки — виртуальный hit `ym('hit')` на `/p/[slug]`.
- **Soft-open «Фото в промт» (mobile tab):** виртуальный hit `ym('hit')` на `/foto-v-promt` из `FotoVPromtMobileModalContext.open` (без Next-навигации). Hard mobile `/foto-v-promt` — auto `route`-mode shell (обычный page hit Метрики).
- **Кнопка «Сгенерировать» → LexyGPT** (отдельные цели JS в Метрике): **`lexygpt_generate_promptcard`** (`LexyGptGenerateButton` на листинге / `/p/[slug]`); **`lexygpt_generate_photovprompt`** (результат и история на `/foto-v-promt`). Legacy **`lexygpt_generate_tabbar`** (таббар больше не вызывает) и **`lexygpt_generate_click`** + `placement` — deprecated.
- **Генерация на сайте (продуктовая воронка):** `prompt_card_generation_accepted`, `prompt_card_generation_no_credits`, `prompt_card_generation_pricing`. Без `feature_key` / `variant` / `bucket_band`.
- **Открытие generate shell:** `generate_shell_open` — только `entry_source` (`tab` \| `card` \| `route` \| `sidebar`).
- **Deprecated (не вызываются):** `prompt_card_generation_exposure`, `prompt_card_generation_auth` — leftover константы после снятия percentage rollout.
- **Баннер «Фото в промт»** (листинг): **`reachGoal('foto_v_promt_banner_click')`** (`ListingFotoVPromtBanner`, sticky над сеткой).
- **Баннер «Фото в промт»** отображается только на листингах. Варианты `card` / `cardImmersive` сняты с `/p/[slug]`; legacy-цель **`foto_v_promt_banner_click_card`** больше не вызывается из детальной карточки. ТЗ — **`docs/requirements/04-06-foto-v-promt-mini-banner.md`**.
- **CTA установки расширения**: сайдбар (**Инструменты**) вызывает **`reachGoal('desktop_sidebar_add_to_chrome_click')`**. CTA страницы `/foto-v-promt` используют **`reachGoal('foto_v_promt_add_to_chrome_click', { placement })`**. UTM для GA4 Chrome Web Store остаются общими: `utm_source=promptshot.ru`, `utm_medium=cpc`, `utm_campaign=foto_v_promt`, `utm_content` по placement (`desktop_sidebar` \| `foto_v_promt_floating_cta` \| `foto_v_promt_mobile_floating_cta` \| `foto_v_promt_remix_hint` \| `foto_v_promt_json_ld`).

---

## Структура маршрутов

```
/                       → Главная (категории + поиск)
/trends                 → SEO-hub «промты для трендовых фото» + глобальный фид по `created_at DESC` (`resolve_route_cards` без path-тегов, `p_sort=new`); тексты/FAQ/HowTo — **`trends-seo-copy.ts`**; popularLinks на существующие L1/L2 (др, семья, пары, чёрный фон, портрет, девушка); JSON-LD CollectionPage+HowTo+FAQPage; фильтры `audience|style|occasion|object` как на `[...slug]`; **без** переключателя Популярное/Новое (`CatalogWithFilters` `fixedSort="new"`); ISR `revalidate=3600`; index на чистом `/trends` (при query-фильтрах — noindex, canonical `/trends`); sitemap priority **0.85**. Legacy **`/new` → 301 `/trends`** (`next.config.ts`). **Не** плодить `/trends/*` subpages
/catalog                → Каталог промтов (категориальная сетка, noindex, revalidate=3600)
/p/[slug]               → Карточка промта
/[...slug]              → Листинг по тегу (напр. /promty-dlya-foto-devushki, /stil/cherno-beloe)
/search                 → Поиск (клиентский)
/generaciya-foto         → SEO/product page «генерация фото ИИ онлайн по описанию/промту»; copy SSOT **`generaciya-foto-seo-copy.ts`**; SSR hero + visible breadcrumb + real starter form (default «По описанию») передаёт prompt в global image dock через `seedBlankPrompt`; dock стартует как collapsed FAB (`chrome=dock`, `generationSurface=seo_page`) и загружает тяжёлую panel chunk только после user intent/активной генерации. Все surfaces выровнены единым wide-container contract. Ниже — searchable masonry examples, enabled model showcase и connected HowTo timeline. Initial examples сериализуются как compact `GenerationExampleCard`; full prompt грузится через `/api/card/[slug]` только по `Повторить`, после чего `seedFromCard` открывает dock. Model CTA пишет requested model в `GenerateDockContext`, поэтому lazy mount не теряет selection. Hero/models анимируют один image layer с deferred frame switching и contextual `alt`. Explorer ищет через `/api/search`, быстрые фильтры используют `/api/listing` и остаются crawlable ссылками на L1 без JS. Reference photo optional для blank text-to-image. Canonical и JSON-LD WebApplication+BreadcrumbList+HowTo+FAQPage+ItemList всегда (без fake offers/ratings); `robots` index + `max-image-preview:large`; sitemap **0.9** и inbound SEO-links всегда. Sitemap endpoints fail-soft. Отдельные `/generaciya-foto/*` не создаются
/foto-v-promt           → «Фото в промт» — SEO-кластер image-to-prompt (ВЧ «фото в промт», СЧ «промт из фото», «промт по картинке»); тексты — **`foto-v-promt-copy.ts`**, ТЗ — **`docs/requirements/02-06-foto-v-promt-seo-copy.md`**. RU-маркетинг AI Image Describer в **`PageLayout`**; при входе **`useListingScrollOnRouteChange`** сбрасывает `#listing-scroll-root` (моб.) и stale sessionStorage — страница всегда с hero; **`metadata.robots` index**; sitemap **0.8**; JSON-LD **WebApplication** + **FAQPage**; H2 над виджетом; перелинковка с **`/`** («Фото в промт»). Общий Chrome CTA **`FotoVPromtChromeCta`** виден в hero на первом экране; **`FotoVPromtFloatingCta`** появляется после ухода виджета из viewport; обе ссылки ведут в Chrome Web Store через **`getAiImageDescriberChromeUrl()`** (id `bebnhekhnoaacojmbjoajndkankmppoj`). **`ListingSearch`** без нижней панели поиска (как на `/` и `/p/`). Live-виджет → **`getImagePromptAnalyzeUrl()`** (prod cross-origin, dev **`/api/imageprompt-proxy/`**); CORS на imageprompt. **Analyze:** landing всегда шлёт **`style: photoreal`**, **`locale: ru`** (описания секций на русском; заголовки Visual Hook / Scene / … и CRITICAL RULES — на EN/RU по backend), без pill-переключателя модели в UI. **Mobile modal:** на max-lg всегда immersive shell — soft `pushState` с таба **или** auto route при hard `/foto-v-promt` (главная, refresh, поиск); close soft → back, route → `/`; desktop SidebarNav / SSR — светлая SEO-страница (`variant="catalog"`). **Режим Prompt Remix (`?card=<slug>`):** при наличии query-параметра `card` **`PromptSceneLiteWidgetGate`** монтирует **`PromptRemixWidget`** (вместо обычного анализа фото): грузит промт через `GET /api/card/[slug]`, пользователь описывает изменения, результат — переписанный промт через `imageprompt.tools/api/extension/remix`. **Точка входа с `/p/[slug]` скрыта** (нет CTA и нет `FotoVPromtMiniBanner` на карточке); режим доступен только по прямому URL `/foto-v-promt?card=<slug>`. ТЗ — **`docs/requirements/02-07-prompt-remix.md`**.
/pricing                → Публичная страница тарифов для всех. `?test=true` читает клиент `PricingCards` (test-mode checkout). Пакеты: Проба, Старт, Про, Максимум; auth-only разовая оплата в RUB через hosted redirect-страницу YooKassa
/generate               → История генераций (`robots: noindex`). Composer = глобальный dock из `PageLayout`. Card «Повторить» → seed dock + закрытие карточки
/terms                  → Страница публичной оферты; ссылка на `/docs/offer.pdf`, если утверждённый файл присутствовал при сборке
/policy                 → Страница политики обработки данных; ссылка на `/docs/privacy.pdf`, если утверждённый файл присутствовал при сборке
/privacy                → Permanent redirect на `/policy`
/favorites              → Избранное (требует авторизации)
/generations            → Мои генерации (auth): канонический список `landing_generations` текущего shared DB user; UGC-карточка необязательна
/admin/analytics        → Закрытый analytics dashboard и admin generation modal; Supabase Auth + email allowlist `ANALYTICS_ADMIN_EMAILS`
/admin/analyze-history  → Закрытая история analyze/remix + все non-admin user generations; remix помечается бейджем и `change_request`; private source previews выдаются signed, completed results публикуются идемпотентно
/admin/payments         → Закрытый cursor-реестр YooKassa: payer identity, RUB/status/test, ожидаемые credits и факт `credited_at`
/auth/callback          → OAuth callback (client page); PKCE exchange в браузере; `?next=` — возврат на страницу старта логина
/embed/stv              → Steal This Vibe (клиент подгружает `/stv-panel/boot.mjs` + `styles.css`; та же логика, что side panel расширения)
/extension-stv          → Превью маркетингового лендинга расширения (спека `docs/extension-landing-pain-hope-solution.md`); **`metadata.title` / `description`** — SEO; `metadata.robots` noindex; шапка **`ExtensionStvMarketingHeader`** (логотип + «Image to prompt» → `/extension-stv`, **Pricing** → `/extension-stv/pricing`, Chrome Web Store); FAB **`ExtensionStvFloatingCta`**. Порядок секций: hero (H1 + лид + `ExtensionStvChromeBadge`) → pain + **Reference** (`PainReferenceVsDraftMock`) → **Accuracy** (`ExtensionStvAccuracySection`) → **Testimonials** → **How it works** (`ExtensionStvHowItWorks`, 4 шага) → **FAQ** (`ExtensionStvFaq`). Футер **`ExtensionStvMarketingFooter`**. Блок **Reference**: upload → extract → expand. Общие константы: `landing/src/components/extension-stv/stv-marketing-shared.ts`.
/extension-stv/pricing  → Только тарифы: **`ExtensionStvPricing`** ($0 / $14.99/mo), та же шапка/футер/FAB, ссылка «← Image to prompt»; `metadata.robots` noindex.
```

> Актуальная коррекция для `/foto-v-promt` (2026-08-08): упомянутый выше legacy
> cross-origin analyze заменён на same-origin `POST /api/extension/analyze`.
> Cross-origin `imageprompt.tools` сохраняется только для Extension Lite и remix.

### UGC (веб-генерация, Steal This Vibe)

- Колонка `prompt_cards.author_user_id` — канонический **`auth.users.id`** владельца пользовательской карточки (FK); новые карты из worker/ensure-card и из `/api/vibe/save` создаются с **`is_published=false`** до явной публикации.
- Страница **`/p/[slug]`** — `export const dynamic = "force-dynamic"`; `getCardPageData(slug, { viewerUserId })` отдаёт черновик только если `viewerUserId === author_user_id`; для неопубликованных в metadata — **`robots: noindex`**.

### Генерация и оплата (GA)

- Генерация на сайте и `/pricing` доступны всем. Sticky percentage rollout `prompt_card_generation` снят: нет `FeatureAccessProvider`, `/api/feature-access` и visitor cookie.
- Операционный kill switch очереди — `GENERATION_QUEUE_ENABLED` (`false`/`0`/`off` → `POST /api/generate` отвечает 503 до списания).
- Бесплатные кредиты для внутренней отладки — email allowlist `isStvOpenGenerateDebugEnabled` (`STV_OPEN_GENERATE_DEBUG`). Это не product feature flag.
- Таблицы `landing_feature_rollouts` и `landing_user_feature_assignments` (миграция `174`) остаются в БД как unused leftover; код их больше не читает. SQL не дропаем.

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
| `/api/listing` | Листинг категории по тегам (`resolve_route_cards` RPC): `limit`, `offset`, `strict=1`, tag-фильтры, **`sort=popular\|new`** (default `new`; невалидный → **400**). Ответ: `{ cards, total_count, ranked_batch_size, sort }` |
| `/api/filter-counts` | Счётчики тегов для текущей выборки (`get_filter_counts` RPC) |
| `/api/card-view` | POST: инкремент `view_count` + событие в `prompt_card_view_events` по `slug` (beacon `/p/[slug]`, дедуп `sessionStorage`; RPC `increment_prompt_card_view`) |
| `/api/search-card` | Карточка по ID / prefix / batch |
| `/api/search-cards` | Фильтрованный поиск (`search_cards_filtered` RPC); query: `limit` (до 48), `offset`, `includeTotal=1` → `{ cards, total?, hasMore }` |
| `/api/datasets` | Список датасетов (debug) |
| `/api/set-before` | Before/after медиа |
| `/api/debug-delete-card` | POST (catalog admin): удаление строки `prompt_cards` (+ строки `slug_redirects` для slug карточки); body: `cardId`, `confirmSlug` (должен совпасть со slug в БД). После удаления — `revalidatePath('/sitemap.xml')` и `/p/[slug]`, чтобы URL сразу исчез из sitemap и кеша страницы (источник URL в sitemap — `getPublishedCardsForSitemap()`). Объекты в Storage не трогает |
| `/api/generation-config` | Конфиг генерации (модели, лимиты); `modality=image` (default), иные modality пока возвращают `unsupported_modality`; ratio/size — общий SSOT `lib/generation/image-options.ts` |
| `/api/generation-preferences` | GET/PUT (auth): последние model / aspect ratio / image size / выбранные owned photo IDs текущего JWT user |
| `/api/generation-prompt` | EN промпт карточки по cardId |
| `/api/prompt-remix` | POST (auth): принимает текущий editable `prompt + changeRequest` и optional owned completed `parentGenerationId`, возвращает только переписанный prompt без создания generation. Успех best-effort сохраняется в `analyze_history` (`kind=remix`, `change_request`, итоговый `prompt`, без image). System instruction требует интегрировать изменение во все затронутые секции и удалить противоречия, а не дописывать финальную строку. Модель `GEMINI_PROMPT_REMIX_MODEL` (default `gemini-2.5-flash`), `temperature=0.3`, `thinkingBudget=0`, `maxOutputTokens=8192`; ответ с `MAX_TOKENS` не принимается как готовый. Proxy определяется через `photo_app_config.gemini_use_proxy` + `GEMINI_PROXY_BASE_URL` |
| `/api/upload-generation-photo` | Загрузка фото для генерации; `saveToLibrary=true` дополнительно регистрирует загрузку в `landing_user_photos` и возвращает объект `photo` с signed preview URL |
| `/api/upload-generation-photo/signed-url` | GET: подписанный URL превью загруженного фото (auth, path в query) |
| `/api/user-generation-photos` | GET (auth): библиотека inline-фото текущего JWT user, newest-first, с signed preview URL |
| `/api/user-generation-photos/[id]` | DELETE (auth): удаление принадлежащего пользователю фото из private Storage и библиотеки |
| `/api/generate` | Auth enqueue: initial — 1–10 owned upload-фото без `editInstruction`; local edit — owned completed `parentGenerationId` + обязательная `editInstruction` (1–1000) + полный `prompt` snapshot. Fingerprint включает parent и delta; атомарные source validation + deduct + insert через `landing_enqueue_generation`; ответ `202 { id, status: pending }` |
| `/api/generate-process` | Tombstone `410`: обработка перенесена в отдельный `web-generation-worker` |
| `/api/generations` | Auth-список строк `landing_generations` текущего shared DB user для `/generations`; batch lookup связанных `prompt_cards` → `cardId/cardSlug/isPublished`; private no-store. **DELETE** `{ ids: uuid[] }` (≤50) — bulk hard-delete owned rows; result object удаляется только если не используется `prompt_card_media` |
| `/api/generations/[id]` | GET: статус/результат генерации. **DELETE**: hard-delete owned row; `409 generation_in_use`, если result нужен active child; object сохраняется при ссылке из `prompt_card_media` (UGC `prompt_cards` не удаляется) |
| `/api/generations/[id]/ensure-card` | POST (auth owner): идемпотентно возвращает или создаёт draft `prompt_cards` для completed result; восстанавливает best-effort сбой worker |
| `/api/generations/[id]/publish` | POST (auth owner): ensure draft → общий SEO publish service → `is_published=true`; идемпотентный success для уже опубликованной карточки |
| `/api/generations/[id]/save-to-library` | POST (auth): completed result → JPEG в `web-generation-uploads` + insert `landing_user_photos` (как upload с `saveToLibrary`) |
| `/api/my-prompt-cards` | GET (auth): карточки `prompt_cards` с `author_user_id = auth.users.id` текущей JWT-сессии, включая черновики (`is_published=false`) |
| `/api/my-cards/[slug]/visibility` | PATCH (auth): `{ published: boolean }` — владелец переключает видимость; при `published: true` — LLM/regex тегирование (`landing/src/lib/seo-tags-classify.ts`), затем `revalidatePath` |
| `/api/me` | Текущий пользователь + credits; авторизованная глобальная шапка использует ответ для отображения баланса |
| `/api/buy-credits-link` | Deep link в Telegram-бота для покупки web-кредитов |
| `/api/payments/yookassa/create` | POST (auth): серверный plan lookup → локальная операция → `POST /v3/payments` с `capture=true`, `confirmation=redirect`; update ledger только из `created|pending`; при ошибке update — 502 без fake success |
| `/api/payments/yookassa/[id]` | GET (auth owner): статус операции; best-effort reconcile для `created|pending|canceled` без `credited_at` |
| `/api/payments/yookassa/webhook` | POST public callback: принимает `payment.succeeded` / `payment.canceled`, перечитывает объект через YooKassa API и идемпотентно обновляет ledger/баланс |
| `/api/cron/yookassa-reconcile` | POST, `Authorization: Bearer $CRON_SECRET`: batch `reconcileStaleYooKassaPayments` для `created|pending` старше 5 мин (limit 20) |
| `/api/extension/analyze` | Same-origin analyze для site `/foto-v-promt`: validation/SSRF protection → optional Auth/shared identity → atomic rate-limit reserve → Gemini proxy/direct → confirm при success или release при error; успешный результат best-effort сохраняется в private 30-day `analyze_history` |
| `/api/admin/analytics` | GET, admin auth: no-store analytics rollups за `1…90` дней |
| `/api/admin/payments` | GET, admin auth: cursor YooKassa ledger с status/test filters, payer auth/billing identity и credit fulfillment state (`credited` / `not_due` / `discrepancy` / `stale`) |
| `/api/admin/payments/reconcile` | POST, admin auth: `{ paymentId \| yookassaPaymentId }` или `{ stale: true }` — ручной/batch reconcile через YooKassa GET |
| `/api/admin/analyze-history` | GET, admin auth: cursor pagination private analyze/remix history (`kind`, `change_request`), optional `client_source`, signed image URL (analyze only) |
| `/api/admin/analyze-history/[id]/publish` | POST, admin auth: private analyze image → public result object → idempotent `prompt_cards` draft → общий SEO publish service |
| `/api/admin/user-generations` | GET, admin auth: cursor всех `client_source != admin` generation statuses, identity, public result и 15-минутные signed source previews |
| `/api/admin/user-generations/[id]/publish` | POST, admin auth: completed non-admin generation → idempotent UGC draft исходного `requester_auth_user_id` → общий SEO publish service |
| `/api/admin/generation-photo` | GET/POST, admin auth: чтение signed URL или замена закреплённого reference photo для admin generation |
| `/api/admin/generate` | POST, admin auth: idempotent enqueue `1…4` jobs в durable `landing_enqueue_generation`, `client_source=admin`, без списания кредитов |
| `/api/admin/generations` | GET, admin auth: cursor-paginated durable generation queue (`unpublished` / `published` / `all`) |
| `/api/admin/generations/[id]` | GET, admin auth: no-store polling статуса/result/error только для `client_source=admin` |
| `/api/admin/generations/[id]/publish` | POST, admin auth: completed generation → idempotent `prompt_cards` draft → общий SEO publish service |
| `/api/imageprompt-proxy/extension/remix` | Dev-only same-origin прокси к `imageprompt.tools/api/extension/remix`; prod remix — прямой cross-origin через `getPromptRemixUrl()`. Site analyze этот proxy больше не использует: он обслуживается локальным `/api/extension/analyze`. Сам remix реализован в проекте **imageprompt.tools**; см. `docs/requirements/02-07-prompt-remix.md` |
| `/api/vibe/extract` | Извлечение style JSON из URL изображения (auth) |
| `/api/vibe/expand` | Один rich prompt из style JSON (auth) |
| `/api/vibe/assemble-prompt` | Legacy-only: **409** для всех вибров (grooming assemble отключён; см. ответ `assemble_not_applicable_legacy` / `vibe_not_legacy`) |
| `/api/vibe/save` | Сохранение выбранной vibe-генерации (auth) |

### Модуль генерации (карточка → inline / STV)

- **Allowlist:** `isInternalGenerateAllowlistedEmail` (`landing/src/lib/internal-generate-allowlist.ts`) — default `azarov.maxim@gmail.com`, расширяется через `INTERNAL_GENERATE_ALLOWLIST`.
- **Точка входа карточки `/p`:** treatment — `CardPageClient` → `onInternalGenerate` → `GenerateDock.seedFromCard` + close card (`PromptCardModal.close` / `router.back`). Control — LexyGPT.
- **Глобальный generate-dock:** `GenerateDockContext` + `GenerateListingDockHost` в `PageLayout` (allowlist листингов, treatment). Composer = `CardInlineGeneratePanel chrome=dock`. Expand surfaces (`prompt|photos|model`) растягивают плашку. После `phase=done` `resultUrl` — фон **внутри** пластины (clip + radius) через `GenerationResultBackdrop`: follow-up gen держит предыдущий кадр в CSS-pixelate, по completed — preload + clip-path reveal нового (reduced-motion: blur + opacity). `needsCredits` / `credits===0` → soft-rose CTA на FAB, mobile tab и footer compose («Недостаточно кредитов») → `/pricing`, без error-баннера. Mobile tab open → fullscreen `inset-0 z-[122]` поверх tab/nav; desktop: старт gen → collapse + FAB progress, `done` → reopen (+ reveal). Повторное открытие blank-dock восстанавливает последний completed + prefs. Tab → `focusBlank`. Guest tab/FAB → auth. Sidebar indigo CTA на `/generate` убран.
- **Inline photo library:** `CardInlineGeneratePanel` при открытии параллельно читает `GET /api/user-generation-photos` и `GET /api/generation-preferences`, показывает persistent-карусель квадратных preview по `created_at DESC` и восстанавливает доступные выбранные photo IDs. Если preference отсутствует или выбранные фото удалены, автоматически выбирается самое свежее. Карусель остаётся доступна поверх готового result backdrop для повторной генерации. Плитка «Добавить» всегда первая; новые файлы сразу проходят client prepare → `POST /api/upload-generation-photo` с `saveToLibrary=true`; выбор отмечается галочками, для одной генерации разрешено **0–10** фото (0 = text-to-image). Удаление идёт через `DELETE /api/user-generation-photos/[id]`.
- **Inline generation preferences:** SSOT = `landing_generation_preferences` (model / aspect / size / photo IDs). Hydrate через GET; debounce PUT (300ms) + immediate flush при любом выходе из шторки фото·модель и на unmount (защита от потери правок при `seedToken` remount). Нельзя auto-switch модель из-за кредитов — это писало чужой model в prefs; при `cannotAffordSelected` CTA ведёт на `/pricing`. Last-completed restore подставляет только result/prompt, не model/ratio. Owner-check photo IDs на сервере. Default: Nano Banana + `9:16` + самое свежее фото.
- **Inline compose UI:** исходный `promptText` карточки инициализирует локальный draft. Одна iOS-style prompt-шторка показывает два блока: flex-height editable `Текущий промпт` и compact `Что изменить?`. До первого result её CTA называется `Применить изменение` и только обновляет draft; initial generation запускает отдельный footer `Сгенерировать`. После completion footer: `Посмотреть` / `Скачать` / `Повторить` / `Что изменить`. `Повторить` сбрасывает в idle compose (очищает result, сохраняет prompt/model/photos); новая генерация — снова через `Сгенерировать`. `Что изменить` — remix editor + `Применить и сгенерировать` (parent-result edit). Controls `Ваши фото` / `Модель` используют текущий draft без мутации `prompt_cards`.
- **Inline engine:** initial prompt edit: `POST /api/prompt-remix { prompt: draft, changeRequest }` → только новый draft; initial generation отдельно отправляет draft + выбранные `storagePath[]` в `POST /api/generate`. Completed edit: `POST /api/prompt-remix { prompt: draft, changeRequest, parentGenerationId }` → новый prompt → сразу `POST /api/generate { parentGenerationId }`; worker использует parent result object. Enqueue сохраняет фактически отправленный текст в `landing_generations.prompt_text`, клиент синхронизирует `draftPrompt/submittedPrompt`. Result menu переиспользует `GenerationCardMenu` без bulk-select: share/download/copy, `save-to-library`, `publish`, `DELETE`.
- **`LexyGptGenerateButton`:** internal path (inline override или STV drawer по `cardId`) только для allowlisted; иначе всегда LexyGPT. CTA `/foto-v-promt` без `cardId` → LexyGPT.
- **STV drawer (legacy):** `GenerationContext.openGenerationModal` → **`GenerationModal`** (`/embed/stv`) — только allowlisted при `cardId` без inline override. Chrome extension без изменений.

#### Open-generate debug (карточка)

- **Условия:** обязательная auth-сессия + email в allowlist; режим по умолчанию выключен и включается только явным `STV_OPEN_GENERATE_DEBUG=1`/`true`. Без логина → 401 (анонимный open-debug нет).
- **Эффект:** generate с `creditsCharged=0`; `landing_generations.user_id` = shared `imageprompt_users.id` сессии (через `resolveSharedDbUserId` / `ensureLandingUserForGeneration`, не guest-owner); Storage upload по JWT; poll `/api/generations/:id` по shared db id.
- **Обычный режим:** allowlisted inline UI остаётся доступен, но при выключенном debug использует транзакционный `landing_enqueue_generation`; navbar обновляет `/api/me` по `promptshot:credit-balance-refresh` после списания и refund.
- **Ошибки Gemini:** worker пишет в `error_message` / `error_type` сырые сигналы ответа (`error.message`, `blockReason`, `finishReason`) и повторяет только временные ошибки.

#### Shared DB identity (imageprompts + promptshot)

- **Корень:** `imageprompt_users` (`google_sub` UNIQUE). `landing_users.id` и `landing_generations.user_id` → FK на `imageprompt_users`.
- **Расхождение:** один Google-аккаунт может иметь `auth.users.id` (JWT PromptShot) ≠ `imageprompt_users.id` (создан раньше на imageprompts).
- **Резолв shared id:** `landing/src/lib/resolve-db-user-id.ts` — `landing_users`/`imageprompt_users` по JWT id → иначе `google_sub` из OAuth identity → иначе email. Используется только там, где FK/баланс принадлежат shared namespace: `/api/me`, `ensureLandingUserForGeneration`, list/get generations и profile lookup. UGC ownership не резолвится: `prompt_cards.author_user_id`, draft viewer, visibility и `/api/my-prompt-cards` всегда используют исходный `auth.users.id`.
- **Создание:** если shared row нет — insert `imageprompt_users` (jwt id + `google_sub`) затем `landing_users`; при конфликте `google_sub` — повторный resolve на существующий id.

### PromptShot analyze и admin

- **Граница доступа:** страницы `/admin/analytics`, `/admin/analyze-history`,
  `/admin/payments` и каждый
  `/api/admin/*` проверяют Supabase Auth session, затем нормализованный email против
  `ANALYTICS_ADMIN_EMAILS`. Пустой allowlist означает fail-closed; service-role key
  остаётся только на сервере.
- **Analyze site flow:** `/foto-v-promt` всегда вызывает same-origin
  `POST /api/extension/analyze`. До Gemini route валидирует единственный image input,
  MIME/size и URL redirects против private/link-local/metadata адресов. Для
  authenticated request `auth.users.id` резолвится в shared
  `imageprompt_users.id`; anonymous request использует daily salted IP hash.
- **Квота:** preflight объединяет IP usage с shared user bucket, затем атомарный
  `reserve` проверяет `count + pending < max`. Успех выполняет `confirm`
  (`pending - 1`, `count + 1`), timeout/upstream/error — `release`
  (`pending - 1`), поэтому failed call не расходует дневной лимит.
- **История:** успешный analyze best-effort сохраняет уменьшенный JPEG и prompt
  в private bucket/table `analyze-history` / `analyze_history` (`kind=analyze`).
  Успешный site `POST /api/prompt-remix` пишет туда же `kind=remix` + `change_request`
  (без image). Admin UI показывает бейдж Remix и текст «Что изменить?».
  Signed previews выдаются только admin API; retention — 30 дней с opportunistic cleanup.
- **Admin generation:** `/api/admin/generate` резолвит отдельно requester
  `auth.users.id` и shared `imageprompt_users.id`, ставит `client_source='admin'` job
  через существующий `landing_enqueue_generation`. Job обрабатывает тот же durable
  `web-generation-worker`; admin UI только enqueue-ит и poll-ит status.
- **Оплаты:** `/admin/payments` читает `landing_yookassa_payments` только через
  service-role RPC `admin_yookassa_payments`. Keyset cursor использует
  `(created_at,id)`; identity собирается одним SQL-read model из `auth.users`,
  `landing_users` и shared `imageprompt_users`. Credit state: `credited`,
  `discrepancy` (`succeeded` без `credited_at`), `stale` (`created|pending` старше
  15 мин без начисления), иначе `not_due`. Ручная сверка —
  `POST /api/admin/payments/reconcile`.
- **Генерации пользователей:** `admin_user_generations_queue` возвращает все
  `client_source IS DISTINCT FROM 'admin'` и terminal/non-terminal statuses.
  Private input paths не отдаются клиенту: API проверяет path, batch-подписывает до
  четырёх preview на 15 минут и возвращает только URL. Публикация доступна лишь для
  `completed` с явным `requester_auth_user_id`; автор карточки не подменяется admin.
- **Публикация:** analyze history и completed admin generation создают/восстанавливают
  draft в `prompt_cards`, затем вызывают общий publish service: prompt variants →
  SEO tags/readiness → `is_published=true` → revalidate card/sitemap. Связь с
  `ugc_card_id` и publish service делают повторный запрос идемпотентным.
- **Не перенесено:** Extension Lite analyze и prompt remix продолжают использовать
  `imageprompt.tools`; перенос касается site analyze на PromptShot.

```text
site /foto-v-promt
  → /api/extension/analyze
  → auth/shared identity + reserve quota
  → Gemini
  ├─ success → confirm → analytics → private analyze_history (30 days)
  └─ failure → release → outcome analytics

admin pages
  → Supabase Auth + ANALYTICS_ADMIN_EMAILS
  ├─ analytics/history → server-only reads + signed previews
  └─ generate → landing_enqueue_generation → durable worker → landing_generations
       → publish → prompt_cards → SEO tagging → public card
```

**Cutover / rollback:** после применения миграции и деплоя site analyze должен
оставаться на same-origin route. Для аварийного отката вернуть site resolver на
`NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN` (`imageprompt.tools/api/extension/analyze`),
проверить CORS и передеплоить landing; аддитивные таблицы миграции `175` удалять не
нужно. На 2026-08-08 production cutover, deploy и применение SQL в рамках этой работы
не выполнялись.

#### Временный гостевой режим STV

- **Флаг:** `STV_GUEST_MODE=1`; если переменная не задана, режим включён только при `NODE_ENV=development`. `0`/`false` принудительно возвращают обычный OAuth gate.
- **Сессия:** только web embed (`/embed/stv`) при отсутствии сессии вызывает Supabase `signInAnonymously()`. Chrome extension сохраняет обычный OAuth flow. В Supabase Auth / GoTrue должны быть включены anonymous sign-ins.
- **API и изоляция:** это не unauthenticated bypass — upload/vibe/generate routes получают обычный anonymous JWT и используют отдельный `auth.users.id` для Storage, `vibes`, generations и UGC.
- **Кредиты / guest identity:** `/api/me` показывает гостю виртуальный баланс `999`; `/api/generate` при `user.is_anonymous=true` ставит `credits_spent=0` и пропускает `landing_deduct_credits`. **Guest owner:** берёт **уже существующий** `landing_users.id` (кэш `photo_app_config.stv_guest_owner_user_id` / `STV_GUEST_OWNER_USER_ID` / oldest row) как `landing_generations.user_id` (должен быть FK-валиден в `imageprompt_users`). Storage paths остаются под anonymous JWT `user.id`.
- **Ограничение MVP:** rate limit и защита от abuse не добавлены; production-флаг нельзя включать надолго без отдельного лимитирования.

### Durable очередь web-генерации

- **Flow после `POST /api/generate`:** API через один SECURITY DEFINER RPC проверяет `Idempotency-Key`, списывает кредиты и создаёт `pending`; отдельный `web-generation-worker` poll-ит очередь, атомарно claim-ит batch, вызывает Gemini и сохраняет результат. HTTP self-fetch отсутствует.
- **Claim / backpressure:** миграция `sql/170_landing_generation_queue.sql`; `FOR UPDATE SKIP LOCKED`, advisory lock для глобального cap, default worker concurrency 10, global processing cap 50, per-user cap 3.
- **Lease / recovery:** lease 180 секунд, heartbeat 30 секунд, reaper 30 секунд. Потерянная job возвращается в `pending`, после `max_attempts=3` становится `failed`.
- **Fencing:** каждый claim получает новый `lease_token`; heartbeat/retry/complete/fail требуют точного `worker_id + lease_token`. Result path immutable (`user/job/lease.png`), поэтому stale attempt не перезаписывает результат новой попытки.
- **Retry:** 429, 5xx, network/timeout и временный Storage upload/reference download → 30/90 секунд с jitter; safety/config/input errors завершаются без retry. Refund выполняется только при terminal failure и защищён `credits_refunded`.
- **Requester vs billing:** `requester_auth_user_id` определяет API/RLS access, idempotency, per-user cap и `prompt_cards.author_user_id`; `user_id` остаётся владельцем кредитов/shared DB. Для guest `create_ugc=false`, поэтому общий billing-owner не получает чужие UGC-карточки. Legacy fallback действует только для доступа к старым платным generation-строкам без requester, но не для создания новой UGC-карточки.
- **Идемпотентность:** уникальный `(requester_auth_user_id, idempotency_key)` + `request_fingerprint` возвращает исходный generation id без повторного списания и даёт 409 при повторном ключе с другим payload.
- **Эксплуатация:** `/health/live`, `/health/ready`, `/metrics`; JSON-логи содержат generation/trace/worker/attempt/duration/error. Kill switches: `GENERATION_QUEUE_ENABLED` на Landing и `WORKER_PROCESSING_ENABLED` на worker.
- **Атрибуция клиента (`client_source`):** при create всегда пишется **`site`** (PromptShot paid generate — site-only; без резолвера / `X-Client`). Миграция: `sql/168_landing_generations_client_source.sql`.
- **Текст в Gemini (без `vibe_id`):** если есть входные фото — worker склеивает **`prompt_text`** + **`GENERATE_LANDING_CARD_CRITICAL_RULES`** (`assembleLandingCardFinalPrompt`) — идентичность с фото, **гардероб по тексту промпта**. Если фото нет (`sourceType=text_only`) — **`assembleTextToImageFinalPrompt`** без identity-preservation. Pure source of truth: `landing/src/lib/image-generation-prompt.ts`, он же компилируется в worker.
- **Gemini routing:** worker читает `photo_app_config.gemini_use_proxy`; при `true` использует `GEMINI_PROXY_BASE_URL`, при `false` ходит напрямую в `generativelanguage.googleapis.com`.
- **Таблицы:** `landing_users.credits`, `landing_generations` (+ `client_source`), `landing_generation_config`, `landing_user_photos` (server-only индекс private uploads по `auth_user_id`, newest-first).
- **Storage:** `web-generation-uploads` (входные фото; inline-библиотека хранит ссылки, удаление синхронно удаляет объект), `web-generation-results` (результаты).
- **Страница:** `/generations` — «Мои генерации» в меню пользователя; source of truth — auth API `/api/generations` и строки `landing_generations` по shared DB user. UI — тот же photo-listing chrome, что каталог (`ListingGrid` + `GenerationHistoryCard` 3:4 `object-cover`); статусы `pending` / `processing` / `failed` как плейсхолдер в том же фрейме. Completed-карточка открывается через общий `PromptCardModalContext`: URL становится `/p/[slug]`, back закрывает modal и сохраняет позицию history; при пустом `ugc_card_id` первый клик делает owner-only ensure-card. Overflow-меню: выбрать (bulk delete), поделиться, скачать, скопировать промпт, использовать (в библиотеку для генерации), опубликовать, удалить. Ответ списка не кешируется.
- **Polling:** inline-клиент продолжает polling через временные network/5xx без создания второй job; STV после timeout/status ambiguity перепроверяет серверный статус и автоматически возобновляет polling. Новый idempotency key создаётся только после подтверждённого server-side `failed`.
- **UGC-карточка:** после успешного worker complete best-effort создаётся черновик в `prompt_cards` (`author_user_id = landing_generations.requester_auth_user_id`, `is_published=false`, датасет `web_generation_ugc`), связь `landing_generations.ugc_card_id`. Это производный объект: его отсутствие не скрывает результат в `/generations`; `ensure-card` идемпотентно восстанавливает draft по пользовательскому клику. Публикация доступна на `/p/[slug]` и прямо в history; оба пути используют общий publish service (variants → SEO tags/readiness → `is_published=true` → revalidate). В индекс попадают только `is_published=true` (sitemap, поиск, RPC листингов).
- **Бэкфилл до релиза UGC:** скрипт `landing/scripts/backfill-ugc-from-generations.ts` — для строк `landing_generations` со статусом `completed`, явным `requester_auth_user_id`, пустым `ugc_card_id` и заполненным результатом в Storage создаёт те же `prompt_cards`, что и runtime (`createUgcCardForCompletedGeneration`). Строки без requester намеренно пропускаются: shared `user_id` нельзя безопасно использовать как FK на `auth.users`. Запуск из корня репо: `npm run backfill:ugc-from-generations:dry` затем `npm run backfill:ugc-from-generations` (или из `landing/`: `npm run backfill:ugc-from-generations:dry`). Env: **`SUPABASE_SERVICE_ROLE_KEY`**, URL (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`). Аргументы: `--dry-run`, `--limit N`, `--user-id <uuid>`.

### Vibe Pipeline (Steal This Vibe)

- **Единственный путь:** **legacy chain** из коммита `2c23ce94` — см. `landing/src/lib/vibe-legacy-prompt-chain.ts`, колонка **`vibes.prompt_chain` = `legacy_2c23`** (миграция **`sql/152_*.sql`**). Флаг **`photo_app_config.vibe_legacy_prompt_chain_2c23ce94`** больше не переключает поведение extract (ключ в БД может оставаться для истории).
- **Extract:** `POST /api/vibe/extract` — body: **`imageUrl`** + опционально **`extractTemperature`** + опционально **`extractInstructionOverride`** (строка **80–48 000** символов после trim; пусто/слишком коротко — как без поля). Если override задан — vision-инструкция **вместо** **`LEGACY_EXTRACT_PROMPT_2C23CE94`** (для A/B сравнения промптов); JSON по-прежнему должен укладываться в **`coerceLegacyVibeStylePayload`**. В ответе — **`extractInstructionCustom`**: `true` при override. **`imageUrl`** — публичный HTTP(S); панель extension/embed может передать URL с сайта или **свежий signed URL** для пути в `web-generation-uploads` после загрузки референса с ПК (`GET /api/upload-generation-photo/signed-url`). По умолчанию Vision → JSON **9 строковых полей** по legacy-инструкции: **`scene`** — место/действие, без волос/лица/телосложения модели (нейтральный субъект); **`pose`** — геометрия тела; **`camera`**, **`composition`** (passthrough expand), остальные как раньше. Строки в БД без **`pose`**: при expand **`coerceLegacyVibeStylePayload`** подставляет **`LEGACY_POSE_MISSING_BACKFILL`**. Extension: пресеты **extractTemperature** в настройках на вкладке «Генерация»; вкладка **Промпт** — кнопка **«Извлечь / обновить промпт»** (полный extract → expand [→ assemble]), без UI для **`extractInstructionOverride`**. Провайдеры: **`vibe_extract_llm`**, модели (`sql/150_*.sql`). Insert **`vibes.style`**, **`prompt_chain` = `legacy_2c23`**, **`legacyPromptChain: true`**.
- **Expand:** `POST /api/vibe/expand` — legacy **`style`** из body и/или строки vibe; **`vibeId`** + владелец + **`prompt_chain` = `legacy_2c23`** (иначе **404** / **409** как раньше). **Без text LLM:** база = **`buildLegacyVibeFullPromptBody(style)`**; опционально **`groomingPolicy`** `{ applyHair, applyMakeup }` (дефолт **true**) → **`appendLegacyGroomingPolicyBlocks`** добавляет англ. секции про перенос укладки/макияжа с референса; оба **false** — только поля стиля. **`mergedPrompt`** = итоговое тело; **`finalPromptForGeneration`** = **`assembleVibeFinalPrompt(...)`** (при прикреплении референса и grooming в теле — хвост **LAST** после **CRITICAL RULES**). Extension шлёт **`groomingPolicy`** вместе с expand и при смене чекбоксов делает debounce **повторного expand** (assemble для legacy по-прежнему **409**).
- **Assemble:** `POST /api/vibe/assemble-prompt` — всегда **409**: для **`legacy_2c23`** — **`assemble_not_applicable_legacy`**; для старых строк без legacy — **`vibe_not_legacy`** (нужен повторный extract).
- **Pipeline spec:** `GET /api/vibe/pipeline-spec` — **`extract`** как раньше; **`expand.mode`** = **`scene_literal`**, без моделей expand в ответе; исторический текст accent-expand — поле **`historicalAccentExpandInstruction`**.
- **Save:** `POST /api/vibe/save` — owner-check generation выполняется по `requester_auth_user_id` с legacy shared fallback; сохраняет completed-генерацию в `landing_vibe_saves`, связывает с `vibe_id`/`card_id`, пишет `auto_seo_tags` и, если `card_id` отсутствует, пытается автосоздать `prompt_cards` + `prompt_card_media` + `prompt_variants` из `landing_generations.result_storage_*` с `author_user_id = auth.users.id`. После этого обогащает `prompt_cards.seo_tags` на основе `vibes.style` (через `TAG_REGISTRY`).
- **Generate:** `POST /api/generate` — по умолчанию расширение вызывает **один раз** за запуск (`prompts[0]` после expand/assemble, либо **`mergedPrompt`** из expand если поле задано). **`photoStoragePaths`**: панель может передать **1–4** пути (сетка «Ваше фото»), см. **`docs/23-03-stv-multi-user-photos-ui.md`**. Если в панели включён флаг **`stv_triple_variant_flow`** (`localStorage` = `1` / чекбокс «Для разработчиков»), за один запуск — **до трёх** параллельных вызовов при **ровно 3** элементах в `prompts`; детали — **`docs/22-03-stv-single-generation-flow.md`**.
- **Панель extension/embed — промпт:** вкладка **«Промпт»** — превью собранного текста для генерации, **«Копировать»**, **«Редактировать блоки»** (девять полей стиля + **«Сохранить»** через **`stv-prompt-assembly.js`**), кнопка **«Извлечь / обновить промпт»** (extract → expand [/ assemble при необходимости] без image-gen). **`mergedForSingleGeneration`** и **`prompts`** приходят с сервера после expand; правки блоков обновляют цепочку на клиенте. Режима «свой текст» и UI для **`extractInstructionOverride`** в панели нет.
- **Generation worker (vibe):** при `vibe_id` и **`photo_app_config.vibe_attach_reference_image_to_generation`** = `true` worker качает `vibes.source_image_url` и шлёт в Gemini **два** изображения с метками **`VIBE_IMAGE_PART_LABEL_REFERENCE`**, референс, **`VIBE_IMAGE_PART_LABEL_SUBJECT`**, фото пользователя из Storage и текст. Если обязательный референс недоступен — terminal `vibe_reference_missing` с refund. **Сборка текста** — **`assembleVibeFinalPrompt(rawPrompt, hasTwoImages)`** из общего pure-модуля `image-generation-prompt.ts`.
- **Логи worker:** JSON stdout без base64/full prompt: `generation_started`, `gemini_request_started`, `result_uploaded`, `generation_completed`, retry/fail/lease/reaper events; корреляция по `generationId`, `pipelineTrace`, `workerId`, `attempt`.
- **Gemini routing:** при провайдере **gemini** для **extract** используют `photo_app_config.gemini_use_proxy` и `GEMINI_PROXY_BASE_URL`. **Expand** LLM не вызывает. OpenAI extract ходит на **`OPENAI_BASE_URL`** (или `https://api.openai.com/v1`) с **`Authorization: Bearer`**, proxy не используется.
- **Сквозной trace STV:** панель (`extension/sidepanel/stv-core.js`, зеркало `landing/stv-web-sidepanel/`) создаёт **`pipelineTraceId`** и стабильный per-job **`Idempotency-Key`**. API сохраняет trace в `landing_generations.pipeline_trace_id`; worker включает его во все processing logs.
- **Логи (extract/expand):** extract: `gemini_request` / `gemini_response` / `extract_parse_ok` и аналоги OpenAI. expand: **`[vibe.expand] legacy_full_style_passthrough_ok`**. Общие: **`PIPELINE_FAIL`**, `extract_pipeline_failed` / `expand_failed` (unhandled). При `GEMINI_VIBE_DEBUG=1` — превью текста extract и для OpenAI (`landing/src/lib/gemini-vibe-debug-log.ts`).
- **Extension / embed — референс с ПК:** в той же колонке, что превью стиля с сайта, можно выбрать **одно** фото референса с диска («+») и снять «×»; состояние **`referencePhoto`** в `stv-core.js`, persist в **`stv_state_v2.referencePhoto`**; взаимоисключение с URL из Steal/embed.
- **Extension (grooming):** блок **«Внешний вид (референс)»** (чекбоксы волосы/макияж) в UI **выше** полосы прогресса и кнопок «Сгенерировать» / «Купить кредиты». Прогресс покрывает extract → expand → enqueue → polling **`/api/generations/:id`**. `generate` шлёт unprefixed `prompt`; worker добавляет общий image-generation prompt.
- **Extension (история запусков):** листинг карточек в side panel: превью по сохранённому **`resultUrl`**, чипы **модель / aspect ratio / image size**, действия **скачать** (fetch→blob при успешном CORS, иначе открытие URL), **открыть**, **промпт** (копирование в буфер + раскрытие `<details>` с текстом). Персистенция в **`chrome.storage.local`** (`stv_state_v2.runHistory`), лимит **`MAX_RUN_HISTORY`** (10): только метаданные и строки (**`prompt`**, URL), **без** бинарников; опционально **`generationId`** для возможного будущего re-sign. Записи до этого изменения без **`resultUrl`/`prompt`** показывают заглушку и disabled-кнопки.
- **Extension (прогресс):** общая полоса показывается только при **`generating` / `resuming`** или пока есть строки результата в **`queued` / `creating` / `processing`**. Расчёт: **0–50%** — этапы extract/expand/assemble по **`pipelinePrepPercent`** (на этих этапах **не** смешивают со старыми строками с прошлого запуска); **50–100%** — средний **`progress`** по строкам (polling **`/api/generations/:id`**). После завершения всех строк полоса скрывается (не залипает на 100%).

### Покупка токенов через YooKassa (`/pricing`)

- **Сценарий:** «Умный платёж» с `confirmation.type=redirect` и `capture=true`. PromptShot не собирает реквизиты карты: клиент получает `confirmation_url` и уходит на hosted-страницу YooKassa.
- **Mobile UI:** страница живёт в общем listing shell (`Header` + `listing-scroll-root` + `MobileTabBar`). Main на max-lg имеет `min-h` = высота над tab bar; legal footer (`mt-auto`, без border/blur) при достаточном месте сидит внизу, иначе скроллится вместе с карточками. Карточки — 2×2 до `xl`, клик по всей карточке.
- **Каталог:** `landing/src/lib/pricing-plans.ts` — единый server-safe источник `plan_id`, RUB-цены и числа токенов. API никогда не принимает цену/credits от клиента.
- **Auth/identity:** checkout требует Google/Yandex OAuth. Операция хранит исходный `auth_user_id`, а баланс начисляется на shared `landing_user_id`, полученный через `ensureLandingUserForGeneration`.
- **Ledger:** `landing_yookassa_payments` (миграция `176`) фиксирует план, сумму, credits, idempotency key, provider ID/status и `credited_at`; RLS включён без client policies.
- **Подтверждение (три consumer’а):** (1) webhook, (2) return-poll на `/pricing?payment=`, (3) cron/admin stale sweep. Все пути делают `GET /v3/payments/{id}`, сверяют provider ID, metadata, RUB-сумму и статус. `landing_fulfill_yookassa_payment` блокирует ledger row и в одной транзакции начисляет сохранённые credits ровно один раз.
- **Create-guard:** финальный update локальной операции только при `status in (created, pending)` — не затирает уже `succeeded`/`canceled` после гонки с webhook.
- **Return UX:** клиент polling с backoff ~2→5→10 с до ~20 попыток (~2–3 мин). Сервер reconcile’ит и локальный `canceled`, если ещё нет `credited_at`.
- **Stale sweep:** `reconcileStaleYooKassaPayments` — `created|pending` с `yookassa_payment_id`, старше 5 мин, batch ≤20. Admin: кнопки «Сверить» / «Сверить зависшие». Cron: `POST /api/cron/yookassa-reconcile` с `Authorization: Bearer $CRON_SECRET` каждые 5 мин (Dockhost cron или DO `curl`).
- **Webhook:** в кабинете YooKassa (Basic Auth shop) подписать `https://promptshot.ru/api/payments/yookassa/webhook` на `payment.succeeded` и `payment.canceled`.
- **Ops checklist после инцидента «YK succeeded / DB pending»:** проверить подписки webhook → выставить `CRON_SECRET` и cron → admin reconcile по provider id / «Сверить зависшие» → сверить счётчики `pending`/`canceled`/`succeeded`.
- **Чеки СМЗ:** объект `receipt` не отправляется. С 29.12.2025 YooKassa не регистрирует чеки самозанятых; каждую успешную оплату нужно вручную зарегистрировать в «Мой налог» и передать чек покупателю.

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

**Flow (Google и Yandex — одинаковый в коде):**

```
AuthModal → signInWithOAuth(redirectTo: /auth/callback?next=<path>)
  → remember path (sessionStorage + cookie ps_auth_next)
  → Supabase /auth/v1/authorize → IdP → /auth/v1/callback
  → promptshot.ru/auth/callback?code=…&next=/pricing?test=true
  → client page: finishOAuthCodeExchange (browser cookies) → redirect на next
```

Почему не server route: дублирующий `GET /auth/callback` делал второй `POST /token` (`user_agent=node`) → `404 flow_state_not_found`, а ответ дубля отдавал `?auth_error=` без session cookies. В браузере первый обмен пишет cookies в document; replay с `invalid flow state` проверяет `getUser()` и при активной сессии считается успехом.

Fallback: если `code` пришёл на произвольную страницу (не `/auth/callback`), `AuthProvider` делает client `exchangeCodeForSession` и при наличии сохранённого return path уводит туда. На `/auth/callback` `AuthProvider` **не** обменивает code (избегаем второго `/token`).

- Хелпер: `landing/src/lib/auth-oauth.ts` + `auth-return-path.ts` + `auth-finish-oauth.ts` (`getOAuthCallbackUrl`, `signInWithOAuthProvider`, `finishOAuthCodeExchange`, sanitize `next`). При старте OAuth: Yandex → `force_confirm=yes`, Google → `prompt=select_account` (выбор аккаунта при повторном логине).
- **UI кнопок в `AuthModal`:** две кастомные кнопки одной сетки (`h-12`, `px-4`, иконка 20×20, `rounded-xl`, белый фон) — Google (цветной G) и Яндекс (красный круг + «Я»); обе вызывают `signInWithOAuthProvider`. Виджет YaAuthSuggest больше не используется.
- `/auth/callback` (Next.js **client page**) — основной return URL модалки; `next` обязан быть same-origin relative path.
- **Self-hosted auth:** GoTrue **≥ v2.187.0**, `GOTRUE_CUSTOM_OAUTH_ENABLED=true`, `GOTRUE_SITE_URL=https://promptshot.ru`, `GOTRUE_URI_ALLOW_LIST=https://promptshot.ru/**` (должен включать `/auth/callback`).
- **Yandex OAuth app** (отдельно от API Метрики): Redirect URI `https://<NEXT_PUBLIC_SUPABASE_HOST>/auth/v1/callback`, scopes `login:info login:email login:avatar`.
- **GoTrue custom provider endpoints (RU):** `authorization_url=https://oauth.yandex.ru/authorize`, `token_url=https://oauth.yandex.ru/token`. Не использовать `oauth.yandex.com` — RU-доки и консоль приложения на `.ru`; иначе пользователь уходит на `.com`.
- **Userinfo adapter (обязательно):** GoTrue custom OAuth читает claim `email`, Яндекс отдаёт `default_email` + заголовок `Authorization: OAuth` (не `Bearer`). `attribute_mapping` в Admin API **не спасает** — поле теряется при разборе JSON в GoTrue. Поэтому в custom provider `userinfo_url` = `https://promptshot.ru/api/auth/yandex-userinfo` (`yandex-userinfo-proxy.ts`: JSON → при отсутствии email JWT `format=jwt` → fallback `{login}@yandex.ru`; ответ `{ sub, id, email, … }`). Повторный вход без `login:email` в токене иначе даёт auth log `422 yandex_email_missing` → `Error getting user profile from external provider`. Fallback co-host: `src/standalone/yandex-userinfo-proxy.mjs` + Kong `/yandex-userinfo`.
- **Self-hosted auth env:** на auth-сервисе `API_EXTERNAL_URL` должен быть `https://<SUPABASE_HOST>/auth/v1` (не `$SUPABASE_PUBLIC_URL` без `/auth/v1`), иначе custom:yandex шлёт `redirect_uri=…/callback` → Kong 401.
- **Профиль:** trigger `handle_new_auth_user` на `auth.users` INSERT → сначала `public.imageprompt_users`, затем `public.landing_users` (`landing_users.id` FK → `imageprompt_users`, не `auth.users`). Нормализация Yandex (`custom:yandex` → `yandex`, `real_name` / аватар) — `sql/157_*`; `SET search_path = ''` + schema-qualified names — `sql/179_*` / `sql/180_*`. Без `imageprompt_users` GoTrue даёт `500 Database error saving new user` / `landing_users_id_fkey` → клиент видит `auth_error=no_code`.
- **Аватары OAuth в UI:** `components/UserAvatarImage.tsx` + `lib/oauth-avatar-url.ts` — URL из `user_metadata.avatar_url` / `landing_users.avatar_url`. Для Google/Yandex CDN: `referrerPolicy=no-referrer` + `unoptimized` (hotlink 403 при Referer / через `/_next/image`). `images.remotePatterns` включает `*.googleusercontent.com` и `avatars.yandex.net`.

### 301 редиректы карточек `/p/[slug]`

- `middleware.ts` проверяет `slug_redirects` для любого URL вида `/p/:slug`.
- При наличии записи `old_slug -> new_slug` выполняется `301` на `/p/new_slug`.
- Это покрывает как старые slug без short-id, так и slug после массового ре-тайтла карточек.

### 301 редирект `www` → apex

- `middleware.ts` в начале цепочки: если `Host` (или `X-Forwarded-Host`) = `www.<NEXT_PUBLIC_SITE_URL hostname>`, ответ **301** на тот же path/query на apex (`promptshot.ru`).
- Работает на Dockhost без nginx/Cloudflare; покрывает страницы и `/api/*`.

### Try This Look (карточка промта)

- Карточный маршрут (`/p/[slug]`, модалка листинга): allowlisted → **inline compose**; остальные → LexyGPT. Не зависит от `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK`.
- Legacy-компонент `GenerateButton` по-прежнему управляется флагом `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK=true`, но сейчас не смонтирован на карточных страницах.
- CTA `/foto-v-promt` не имеют карточного контекста и продолжают открывать LexyGPT для всех пользователей.

### Статические файлы

- `sitemap.ts` — динамический sitemap (L1 теги, фильтрованные по `getFilterCounts` с порогом ≥ 1 карточки, + L2 комбинации + карточки)
- `image-sitemap.xml/route.ts` — image sitemap для Google Images / Яндекс.Картинок; XML с `xmlns:image`; `<image:loc>` через `getIndexableImageUrl` (основной домен, без query); `<image:title>` + `<image:caption>`; чанкинг по 5000 карточек, при `totalPages > 1` — `<sitemapindex>` с `?page=N`; `revalidate = 3600`
- `robots.txt/route.ts` — текстовый route handler; расширенный `Disallow` (`/api/`, `/admin/`, `/embed/`, `/auth/`, `/search`, `/favorites`, `/generations`, `/generate`, `/pricing`); `Clean-param` для Яндекса (`audience&style&occasion&object&sort`); две ссылки на sitemap

---

## Рендеринг и кеширование

### Стратегия: ISR (Incremental Static Regeneration)

Все основные страницы используют `revalidate = 3600` (1 час):

| Страница | Рендеринг | Кеш |
|----------|-----------|-----|
| `/` (главная) | ISR | `revalidate = 3600` |
| `/trends` | ISR | `revalidate = 3600`, index (noindex при query-фильтрах), `fixedSort=new`; SEO copy `trends-seo-copy.ts` + FAQ/HowTo JSON-LD; `/new` → 301 |
| `/catalog` | ISR | `revalidate = 3600`, `robots: noindex` |
| `/p/[slug]` (карточка) | **Dynamic** | `dynamic = force-dynamic` (доступ владельца к черновикам UGC + cookies) |
| `/[...slug]` (листинг) | ISR | `revalidate = 3600` |
| `/search` | CSR | `robots: noindex` |
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

### `/generaciya-foto`: превью моделей

`GenerationModelsShowcase` получает для каждой enabled-модели последнюю завершённую генерацию, связанную с опубликованной `prompt_cards` через `landing_generations.ugc_card_id`. Приватные и неопубликованные пользовательские результаты не попадают в SSR. Запросы по моделям выполняются параллельно, изображение строится из `result_storage_bucket/result_storage_path`; если опубликованной генерации для модели нет или БД недоступна, карточка использует общий каталоговый fallback.

Отдельного блока связанных ссылок перед FAQ нет; перелинковка на `/foto-v-promt`, `/trends` и каталог остаётся в общей навигации и релевантных контентных поверхностях.

Страница передаёт `showFooterWithGenerateDock` в общий `PageLayout`: поэтому единый `Footer` сайта отображается и при активном floating generate dock, тогда как остальные listing-маршруты сохраняют прежнее скрытие футера.

Компактный `GenerationExampleCard` включает размеры первого изображения из `photoDimensions`. Examples masonry использует реальное `width / height` карточки на mobile и desktop (fallback — портретный набор пропорций), поэтому сетка сохраняет естественные квадраты и прямоугольники без искусственного responsive-паттерна; CTA поверх фото показывается только при hover/focus.

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
  → getCachedRouteCards (React cache + try/catch)  ← dedup metadata + page; empty on DB error
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

**Index/noindex:** L1 >= 1 карточки, L2/L3 >= 6 карточек. При noindex — canonical на родительский L1.

**L2 чипы на L1:** На L1 страницах отображаются чипы-ссылки на L2 комбинации, сгруппированные по измерениям. Данные из RPC `get_indexable_tag_combos(min_cards=6)` — **чтение из `indexable_tag_combos_cache`** (мигр. `165`, refresh `refresh_indexable_tag_combos()` по pg_cron */30 мин); фильтруются для текущего L1 тега. Чипы показывают label + количество карточек.

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

- **`getCardPageData`:** в ответе для клиента — `photoMeta[]` (bucket/path/url, параллельно `photoUrls`) для admin-действий. Жёлтая DEBUG-панель на `CardPageClient` — catalog admin + включённый свитч «Тех. информация» (`promptshot_admin_tech_info`). Unpublished `/p/[slug]` — по auth email allowlist (`isCatalogAdminEmail`).
- **Mobile SEO (Яндекс «мелкий текст»):** на `< md` при наличии фото — immersive fullscreen (`CardPageLayout` скрывает header/sidebar/footer). Оверлей: **`text-[13px]`** (`MOBILE_FS_*`), промпт за кнопкой «Посмотреть промт» (overlay по клику), `CARD_OVERLAY_ACTION_PILL` **`min-h-11`**. Нижний glass-бар — **«Копировать» + LexyGPT** (`grid-cols-2`); стрелки листинга **не** в доке. Дублирующий fixed sticky `z-[240]` с **`max-md:hidden`** при `hasPhotos`; колонка контента **`max-md:pb-6`** вместо `pb-28`. Desktop (`md+`): framed hero + sticky-bar как раньше. См. `.cursor/rules/ui-typography-icons-consistency.mdc` (tier A).
- **Mobile listing nav (карточки с фото):** правый стек по центру — реакции → избранное → шаринг → ↑ prev / ↓ next (`StickyListingNavButton` `orientation="vertical"`). Свайп **вверх** → следующая карточка, **вниз** → предыдущая. `useMobileCardSnapFeed` управляет нативным `overflow-y-auto snap-y snap-mandatory` viewport максимум из трёх `100dvh` слайдов. Центральный содержит полный UI, существующие соседние — предзагруженные hero; отсутствующий крайний слайд не рендерится. Стрелки делают smooth-scroll к тем же snap-points. После `scrollend` (или debounce fallback) готовый `CardPageData` атомарно становится активным и URL обновляется; cache miss возвращает viewport в центр. При достижении последнего загруженного slug feed отправляет `promptshot:listing-navigation-load-more`; mounted `InfiniteGrid` / `SearchResults` использует свой единый `loadMore`, а событие `promptshot:listing-navigation-updated` добавляет нового соседа без закрытия модалки. Chrome скрывается на время touch/scroll и не зависит от image decode. Соседи — `promptshot_listing_nav_v1` / `resolveListingNavNeighbors`, загрузка — общий LRU на 9 записей с in-flight dedup в `PromptCardModalContext`. One-time тултип у стрелок (`CardSwipeOnboarding`, ключ `promptshot_card_swipe_onboarding_v1`) — скрытие по свайпу / клику стрелки / «Понятно» / таймауту 8с / клику вне.
- **Закрытие модалки:** `CardModal` обрабатывает клик по backdrop для intercepting route и `ClientCardModal`. В desktop split кликабельным фоном считаются также прозрачные промежутки между фото, вертикальной навигацией и dark panel; сами поверхности помечены `data-card-modal-surface`. `Escape` и крестик используют тот же `handleClose`.

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

### Catalog admin (вместо `/debug`)

- **Кто:** email в `INTERNAL_GENERATE_ALLOWLIST` / default `azarov.maxim@gmail.com` (`isCatalogAdminEmail` → `isInternalGenerateAllowlistedEmail`).
- **Листинги:** на любом `FilterableGrid` для admin — панель «Фильтры» (всегда); default `published=yes` → тот же SSR-фид/`resolve_route_cards`, что у пользователей. `search-cards` только при debug-фильтрах (`published=all` и т.п.) с `sort` листинга; датасеты `includeUnpublished=1`. Session: `promptshot_admin_filters_v2`.
- **Свитч «Тех. информация»** (default off, `sessionStorage` `promptshot_admin_tech_info`): оверлеи на `PromptCard`/`GroupedCard` + жёлтая DEBUG-панель (мета + «Сделать было» / удаление) на `CardPageClient`.
- **Unpublished карточки:** `/p/[slug]` и `/api/card/[slug]` — `allowDebugUnpublished` по auth email, не cookie.
- **API:** `published≠yes` в `/api/search-cards`, `includeUnpublished` в `/api/datasets`, ID-поиск unpublished в `/api/search-card`, `POST /api/set-before`, `POST /api/debug-delete-card` — только catalog admin.
- **Удалено:** маршрут `/debug`, cookie/session `promptshot_debug_tools`.

---

## Ключевые компоненты

### Server Components

| Компонент | Файл | Роль |
|-----------|------|------|
| PageLayout | `components/PageLayout.tsx` | Клиентский shell: `listing-mobile-shell` + `#listing-scroll-root`; моб. высота через `--ps-listing-shell-height` (`listing-shell-viewport.ts`, нижняя граница `visualViewport = offsetTop + height`), повторная синхронизация после клавиатуры, browser chrome, history и смены маршрута; in-flow `ListingBottomBar`; **`useListingScrollOnRouteChange(pathname)`** — сброс скролла при смене маршрута |
| Header | `components/Header.tsx` | Legacy серверный (заменён PageLayout) |
| Footer | `components/Footer.tsx` | Статический |
| CardPage | `app/p/[slug]/page.tsx` | Серверный, SSR карточки |

### Client Components

| Компонент | Файл | Роль |
|-----------|------|------|
| HeaderClient | `components/HeaderClient.tsx` | Только mobile sticky header: menu trigger + логотип + баланс + вход/avatar; на desktop не рендерит визуальный chrome |
| SidebarNav | `components/SidebarNav.tsx` | Сквозной левый sidebar: desktop `h-screen` с `SidebarAccountPanel` сверху и отдельно прокручиваемым меню ниже; mobile drawer содержит меню. Сверху меню pill **«Добавить в Chrome»** → CWS; Главная / **Тренды** / (treatment) **Генерация фото** → `/generaciya-foto` / **Поиск** / **Фото в промт**; далее accordion-секции. Indigo CTA на `/generate` убран. |
| SidebarAccountPanel | `components/AccountControls.tsx` | Единый desktop account-блок: для гостя — вход; для пользователя — профиль, текущие кредиты, «Пополнить», избранное, генерации и выход |
| SiteBrandLink | `components/SiteBrandLink.tsx` | Общий home-link бренда; mobile — в header, desktop — в начале правой content-колонки `PageLayout` / `CardPageLayout` |
| PromptCard | `components/PromptCard.tsx` | Карточка в листинге; двухфазный render: `ListingCardLoadingShell` → real chrome после `imageReady` |
| GroupedCard | `components/GroupedCard.tsx` | Группа split-карточек; тот же loading shell, сброс `imageReady` по `activeCard.id` |
| ListingCardLoadingShell | `components/ListingCardLoadingShell.tsx` | Единый loading shell (`ListingCardPhotoSkeleton overlay` + `ListingCardChromeSkeleton`) для карточек и pagination |
| useListingCardImageReady | `hooks/useListingCardImageReady.ts` | `onLoadingComplete` → `decode()` → `imageReady`; всегда стартует `false` (в т.ч. LCP/priority) |
| useMobileCardSnapFeed | `hooks/useMobileCardSnapFeed.ts` | Native mobile `prev/current/next` scroll-snap, prefetch полных соседей, settle fallback и атомарный commit |
| CardOverlayMetricsChips | `components/CardOverlayMetricsChips.tsx` | Чип просмотров (база `CARD_OVERLAY_ACTION_PILL`); счётчик фото — `card-overlay-photo-counter.ts` (тот же pill) + разметка по центру |
| CardPageClient | `components/CardPageClient.tsx` | Клиентская часть карточки; desktop `md+` (модалка и `/p/[slug]`): split photo \| ↑↓ listing nav \| dark panel; mobile — fullscreen immersive |
| CardModal | `components/CardModal.tsx` | Overlay карточки; desktop — transparent wide shell (`max-w-7xl`), клик по backdrop/промежуткам закрывает модалку, `data-card-modal-surface` защищает контент; mobile — white card / immersive |
| PhotoCarousel | `components/PhotoCarousel.tsx` | Карусель фото |
| CardFilters | `components/CardFilters.tsx` | `FilterableGrid`: для catalog admin — панель фильтров + tech-info свитч на всех листингах |
| catalog-admin | `lib/catalog-admin.ts` | `isCatalogAdminEmail` (allowlist) |
| debug-tools-session | `lib/debug-tools-session.ts` | persistence фильтров admin + tech-info preference + delete event |
| FotoVPromtMiniBanner | `components/foto-v-promt-promo/FotoVPromtMiniBanner.tsx` | Промо «Промпт не попадает в фото?»; смонтировано только на листингах (`variant="listing"`), на `/p/[slug]` скрыто |
| ListingFotoVPromtBanner | `components/foto-v-promt-promo/ListingFotoVPromtBanner.tsx` | Sticky + IntersectionObserver hide после первого экрана |
| ListingBottomBar | `components/ListingBottomBar.tsx` | No-op (desktop search → SidebarNav **Поиск** + поле на `/search`). |
| MobileTabBar | `components/MobileTabBar.tsx` | Tab bar (max-lg): **Тренды** (`/trends`) / Каталог / [treatment: raised **Сгенерировать** → `GenerateDock.focusBlank`] / Поиск / **Фото в промт**. Control — 4 таба без center. |
| GenerateDockContext | `context/GenerateDockContext.tsx` | SSOT seed/focus/dockSurface/historyRefresh для listing dock. |
| GenerateListingDockHost | `components/generate/GenerateListingDockHost.tsx` | Плавающий composer на allowlist листингов (treatment); collapse FAB для гостя / при скролле. |
| GenerationResultBackdrop | `components/generate/GenerationResultBackdrop.tsx` | Фон result: pixelate previous → reveal next (CSS); shared dock/card. |
| useListingScrollActivity | `hooks/useListingScrollActivity.ts` | Скролл листинга с опциональным `minDeltaPx` (dock collapse только после заметного сдвига). |
| GenerateBlankShell | `components/generate/GenerateBlankShell.tsx` | Только история `/generate` (без nested dock). |
| GenerateMobileModalContext | `context/GenerateMobileModalContext.tsx` | Legacy soft card portal; blank compose → global dock / hard `/generate`. |
| SidebarNav generate link | `components/SidebarNav.tsx` | Treatment: обычный пункт **«Генерация фото»** → SEO `/generaciya-foto` (не `/generate`). |
| FotoVPromtMobileModal | `components/foto-v-promt/FotoVPromtMobileModal.tsx` | Mobile fullscreen dialog (`lg:hidden`, root layout); host для `PromptSceneLiteWidget variant="immersive"`. |
| FotoVPromtMobileModalContext | `context/FotoVPromtMobileModalContext.tsx` | Soft: scroll lock + `pushState` + virtual hit, close → `history.back()`. Route (hard mobile `/foto-v-promt`): auto-open, close → `replace('/')`. Desktop — без модалки. |
| MobileProfileSheet | `components/MobileProfileSheet.tsx` | Legacy sheet профиля (Избранное / Мои генерации / Выйти); tab bar больше не открывает — доступ через хедер. |
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
| AuthModal | `components/AuthModal.tsx` | Модалка: Google + Яндекс (единый UI кнопок) |
| UserAvatarImage | `components/UserAvatarImage.tsx` | OAuth-аватар: no-referrer + unoptimized для Google/Yandex CDN |
| auth-oauth | `lib/auth-oauth.ts` | `signInWithOAuthProvider`, `custom:yandex` |
| auth-finish-oauth | `lib/auth-finish-oauth.ts` | `finishOAuthCodeExchange` (browser PKCE) |
OAuth completion: `/auth/callback` page вызывает `finishOAuthCodeExchange`; `AuthProvider` — только legacy fallback вне этого пути.

---

## SEO

### Метаданные

- **Root layout:** fallback title + description из `homepage-seo-copy.ts` (`HOMEPAGE_SEO`)
- **Главная (`/`):** `generateMetadata` → `HOMEPAGE_SEO.title` / `description`; canonical; H1 + hero из copy-модуля; блоки **intro**, **HowTo**, **FAQ** (`HomeSeoBlocks.tsx`) после `CategorySection` в конце страницы; JSON-LD **`CollectionPage`** (`isPartOf: WebSite`, `hasPart[].name` = «Промты для фото {label}») + **`FAQPage`** (plain text в schema, ссылки в HTML FAQ); якоря каталога: `#audience_tag`, `#style_tag`, `#occasion_tag`, `#object_tag`
- **Листинг L1:** `generateMetadata` → title/description из `getSeoContent(tag.slug)`
- **Листинг L2/L3:** `generateMetadata` → title/description из `getSeoForRoute(route)` (шаблоны)
- **JSON-LD:** `BreadcrumbList` + `FAQPage` на всех листингах; на главной — `CollectionPage` + `FAQPage`; все JSON-LD вставляются как inline `<script type="application/ld+json">` в SSR HTML (не через `next/script strategy="afterInteractive"`)
- **Trailing slash:** единая политика — **без trailing slash** во всех внутренних ссылках; canonical и sitemap тоже без slash; `menu.ts`, `homepage-sections.ts`, `[...slug]/page.tsx`, `page.tsx` — все `href` без `/` в конце
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
- `popularLinks` (опционально) — keyword-rich ссылки на L2/L1 в hero (`SeoPopularLinks` / `SeoHeroWithIllustrations`)
- `featuredL2Slugs` (опционально) — порядок L2 chips по search volume (`getL2ChipsForTag` в `[...slug]/page.tsx`)
- `howToTitle` (опционально) — кастомный H2 блока «Как использовать промт» (ключ в заголовке)
- `seoTextBlocks` (опционально) — SEO-текст после FAQ: `{ h2, paragraphs[] }[]` (текстовая релевантность L1)

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

#### Кластер `/promty-dlya-foto-devushki/` (L1 `audience_tag:devushka`, 2026-06-11)

| Зона | Статус | Назначение |
|------|--------|------------|
| `h1`, `metaTitle`, `metaDescription` | обновлено | ВЧ: «промты для фото девушки», «ИИ-фотосессия», «женские», «готовые», «на русском» |
| `intro` | обновлено | Nano Banana / Gemini / ChatGPT, селфи, реалистичные и студийные кадры |
| `popularLinks` | 7 ссылок | L2: ДР, цветы, портрет, студия, машина, ч/б; L1: пары |
| `featuredL2Slugs` | 8 slug | Порядок chips: den_rozhdeniya → … → v_forme |
| `faqItems` | 8 вопросов | ИИ-фотосессия RU, Nano/Gemini/ChatGPT, ДР, реализм, сценарии, обработка фото, пары |
| `illustrations` | 4 шт. | Фотосессия, День рождения (`cardSlug`), С машиной, Портрет |
| `howToTitle` | v2 | «Как использовать промт для фото девушки» |
| `seoTextBlocks` | v2, 1 блок | «Как составить промт для фотосессии девушки» — 3 абзаца, «нейрофотосессия» / «селфи» / «на море» / «деловой» |

**Перелинковка:** парные запросы → `/promty-dlya-foto-par/`; обработка → `/promty-dlya-obrabotki-foto/`. NSFW не таргетируется в copy. Спеки: `seo/promty-dlya-foto-devushki/2026-06-11-l1-semantic-core-and-improvements.md`, `…/2026-06-11-v2-audit-fixes.md` (canonical-фикс сайтвайд, intro, текстовый блок).

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
| `landing_generations` | История web-генераций (`vibe_id`, `client_source` — сейчас всегда `site`) |
| `landing_vibe_saves` | Сохранённые выборы пользователя по vibe-генерациям (`vibe_id`, `card_id`, `auto_seo_tags`) |
| `landing_user_telegram_links` | Привязка web-пользователя к Telegram (`landing_user_id` ↔ `telegram_id`) |
| `landing_link_tokens` | Одноразовые OTP для deep-link привязки (TTL 10 мин) |
| `landing_web_transactions` | Платежи web-кредитов через Telegram Stars |
| `landing_yookassa_payments` | Server-only ledger разовых RUB-покупок токенов через YooKassa |

### RPC

| RPC | Назначение |
|-----|-----------|
| `resolve_route_cards` | Карточки по тегам (листинг + меню); **`p_sort`**: `new` (app default) \| `popular`. `popular` — **materialized** `prompt_cards.popularity_score` (мигр. `166`, индекс `158`) |
| `recalculate_popularity_scores` | Hourly batch: пересчёт `popularity_score` по формуле мигр. `163` (мигр. `166`); pg_cron `0 * * * *` |
| `refresh_indexable_tag_combos` | Rebuild `indexable_tag_combos_cache` (мигр. `165`); pg_cron `*/30 * * * *` |
| `refresh_tag_counts` | Rebuild `tag_counts_cache` (мигр. `137`); pg_cron `*/30 * * * *` |
| `get_indexable_tag_combos` | L2-комбо для sitemap и L1 chips — **SELECT из кеша** (мигр. `165`) |
| `get_filter_counts` | Счётчики тегов для текущей выборки (`useListingFilterCounts`) |
| `get_homepage_sections` | Секции главной |
| `search_cards_filtered` | Фильтрованный поиск |
| `search_cards_text` | Полнотекстовый поиск |
| `landing_add_credits` | Начисление кредитов в `landing_users.credits` после web-оплаты |
| `landing_fulfill_yookassa_payment` | Атомарное идемпотентное завершение YooKassa-платежа и начисление сохранённых в ledger токенов |

**Сортировка листингов категорий (`/[...slug]/`, миграции `158–161`):** UI — переключатель **`ListingSortToggle`** («Новое» \| «Популярное»), выбор в **`sessionStorage`** `promptshot_listing_sort` + опционально **`?sort=popular`** в URL (default `new` — без query-параметра). SSR и API читают **`sort`**. Страница **`/trends`** всегда `sort=new` (`fixedSort`), без переключателя и без sessionStorage-sync (`useListingSort({ disabled: true })`).

| `sort` | ORDER BY в `resolve_route_cards` |
|--------|----------------------------------|
| `new` (default) | **`created_at` DESC**, `id` DESC |
| `popular` | **`popularity_score` DESC**, `created_at` DESC, `id` DESC |

**`popularity_score`** (миграция `166`, **материализован в `prompt_cards.popularity_score`**, refresh cron): `(view_count + react_weight·(likes_count − dislikes_count)) / (1 + age_days/half_life_days)^decay_exponent`; пересчёт — `recalculate_popularity_scores()` (формула как в мигр. `163`); константы в **`photo_app_config`**. `resolve_route_cards` ORDER BY stored column → индекс `idx_prompt_cards_published_popularity` (мигр. `158`). Свежесть age-decay зависит от частоты cron (рекомендуется hourly). UI показывает **`view_count`** (lifetime). **Наследие:** `views_7d`, `prompt_card_view_events` — follow-up на чистку. **Follow-up:** `is_listing_eligible` + partial index для удешевления `COUNT(*)` в `resolve_route_cards`.

**pg_cron на prod (после мигр. `165`/`166`, расширение pg_cron в Dashboard):**

```sql
SELECT cron.schedule('refresh-indexable-tag-combos', '*/30 * * * *', 'SELECT refresh_indexable_tag_combos()');
SELECT cron.schedule('recalc-popularity', '0 * * * *', 'SELECT recalculate_popularity_scores()');
SELECT cron.schedule('refresh-tag-counts', '*/30 * * * *', 'SELECT refresh_tag_counts()');
NOTIFY pgrst, 'reload schema';
```

Fallback без pg_cron: standalone `.mjs` на DO (`src/standalone/recalculate-popularity-scores-standalone.mjs` + аналоги для refresh).

**Блоки категорий на главной (`get_homepage_sections`, миграция `164`):** топ-**10** карточек на тег сортируются по **той же query-time popularity-формуле**, что листинг (мигр. `163`). **Кросс-категорийный дедуп обложек** (`buildCategorySectionBlocks` + `pickDeduplicatedPhotos`, общий `usedCardIds` в порядке `SECTION_ORDER`): один и тот же популярный кадр — #1 сразу в нескольких тегах, поэтому каждый блок берёт первую **ещё не использованную** карточку (передняя = первая свободная, задняя декоративная = следующая свободная), без повторов между блоками. Топ-10 (вместо 5) даёт дедупу запас кандидатов. Обложка блока = #1 листинга категории, если она не занята более ранним блоком; иначе — следующая по популярности.

**`search_cards_text`:** по-прежнему **`view_count`** / relevance (154). **`search_cards_filtered`:** с миграцией **`182`** — `p_sort` как у `resolve_route_cards` (`new` / `popular`); до применения 182 — legacy `view_count`.

**Scroll policy листинга (`scroll-preservation.ts`, fix/category-scroll-jump):** SSOT для позиции скролла каталога. На mobile скролл в **`#listing-scroll-root`** (shell переживает soft navigation между категориями в `[...slug]`).

| Event | Action |
|-------|--------|
| pathname change (Next router) | `cancelListingScrollRestore()` + `scrollCatalogToTop()` (`PageLayout` → `useListingScrollOnRouteChange`) |
| card route `/p/...` (modal pushState или direct) | route hook **игнорирует** (`isCardPath`) — позицию листинга не трогаем |
| modal open | `saveListingScroll()` + lock inner root |
| modal close (back на тот же pathname) | `scheduleListingScrollRestore()` — единственный restore path (`CardModal` unmount) |
| sort change | `resetListingScroll()` (`useListingSort`) |
| filter/query on same path | scroll не меняем |

`lastListingNavPath` (module-level, переживает remount `PageLayout`) + `scheduleRouteScrollToTop` (rAF/50/150 ms) — сброс и `#listing-scroll-root`, и `window`; category links `scroll={false}`. **Next 15** обновляет `usePathname()` на `history.pushState`, поэтому открытие модалки (`pushState /p/slug`) даёт смену пути — `useListingScrollOnRouteChange` ранним выходом по `isCardPath` не сбрасывает позицию (иначе `scrollCatalogToTop` стёр бы `SCROLL_KEY` сразу после `lockListingScrollForModal`).

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
│   ├── not-found.tsx           ← Кастомный 404 (robots noindex)
│   ├── robots.txt/
│   │   └── route.ts            ← robots.txt handler (Clean-param, расширенный Disallow)
│   ├── catalog/
│   │   └── page.tsx            ← Каталог (ISR, noindex)
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
│   ├── auth/callback/page.tsx  ← client PKCE finish + redirect ?next=
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
│   ├── auth-finish-oauth.ts    ← finishOAuthCodeExchange (browser PKCE)
│   ├── supabase-browser.ts     ← Браузерный клиент (auth, reactions)
│   ├── supabase-server-auth.ts ← Серверная авторизация
│   ├── tag-registry.ts         ← Реестр SEO-тегов (5 измерений, 100+ тегов)
│   ├── route-resolver.ts       ← Резолвинг URL → теги (L1/L2/L3)
│   ├── seo-templates.ts        ← Шаблонный SEO для L2/L3
│   ├── seo-content-from-tag.ts ← Шаблон L1 из TagEntry (npm run seo:sync)
│   ├── seo-content.ts          ← SEO для L1 (кураторский + автодобавленный)
│   ├── homepage-sections.ts    ← buildCategorySectionBlocks(), SECTION_ORDER, SectionBlock
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
| Generation worker | Отдельный Dockhost service, контекст = корень репозитория: `docker build -f Dockerfile.worker .`. Образ содержит `web-generation-worker` и pure helper `landing/src/lib/image-generation-prompt.ts`; health: `:3003/health/ready`. |

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
| `NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID` | Опционально; ещё отдаётся в `GET /api/public-config` (UI модалки больше не зависит от YaAuthSuggest) |
| `NEXT_PUBLIC_YANDEX_OAUTH_REDIRECT_URI` | Опционально; по умолчанию `{NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback` |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный клиент |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, OG |
| `GEMINI_API_KEY` | Landing: `vibe/extract`; generation worker: image generation |
| `GEMINI_PROXY_BASE_URL` | Landing/worker прокси-маршрутизация Gemini при `gemini_use_proxy=true` |
| `GENERATION_QUEUE_ENABLED` | Landing admission kill switch; `false` → `/api/generate` отвечает 503 до списания |
| `WORKER_PROCESSING_ENABLED` | Worker shadow/maintenance switch; `false` → health работает, claim/reaper выключены |
| `WORKER_CONCURRENCY` | Локальный in-flight cap worker; default 10 |
| `WORKER_GLOBAL_CAP` | Глобальный DB processing cap для всех реплик; default 50 |
| `WORKER_PER_USER_CAP` | Одновременные processing jobs одного user; default 3 |
| `WORKER_LEASE_SECONDS`, `WORKER_HEARTBEAT_MS` | Lease и период heartbeat; defaults 180s / 30s |
| `photo_app_config.vibe_extract_model` | ID модели Gemini для `/api/vibe/extract` (дефолт `gemini-2.5-pro`, см. `sql/148_*.sql`) |
| `photo_app_config.vibe_expand_model` | ID модели для `/api/vibe/expand` (дефолт `gemini-2.5-flash`) |
| `GEMINI_VIBE_EXTRACT_MODEL` | Fallback, если строка в `photo_app_config` пуста или чтение не удалось |
| `GEMINI_VIBE_EXPAND_MODEL` | То же для expand |
| `GEMINI_VIBE_DEBUG` | `1` / `true` — расширенные логи Gemini для vibe extract/expand |
| `photo_app_config.vibe_attach_reference_image_to_generation` | `true` / `false` — слать пиксели референса в web image-gen (ключ в БД, см. `sql/147_*.sql`) |
| `VIBE_ATTACH_REFERENCE_IMAGE_TO_GENERATION` | Fallback, если строка в `photo_app_config` недоступна или пуста (`0` = выкл.) |
| `CORS_ALLOWED_ORIGINS` | CSV allowlist origins для CORS API |
| `CHROME_EXTENSION_ID` | Extension ID для `chrome-extension://` CORS origin |
| `NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK` | Если `true` и **`GenerateButton`** смонтирован на странице — Steal This Vibe (иначе только в debug FAB). Страница **`/p/[slug]`** в sticky-баре использует **LexyGPT** (`LexyGptGenerateButton`), не STV |
| `TELEGRAM_BOT_LINK` | `https://t.me/...`, `@bot` или `bot` — нормализуется до абсолютного URL для `/api/buy-credits-link` |
| `YOOKASSA_SHOP_ID` | Server-only идентификатор магазина для Basic Auth YooKassa API |
| `YOOKASSA_SECRET_KEY` | Server-only секрет магазина YooKassa; не передаётся клиенту и не логируется |
| `CRON_SECRET` | Bearer-секрет для `POST /api/cron/yookassa-reconcile` (stale payment sweep) |
