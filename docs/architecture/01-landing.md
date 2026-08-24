# 01 — Лендинг (promptshot.ru)

> Последнее обновление: 2026-08-24 (**camera orbit panel:** бейдж — задание следующего кадра, не live-3D. После съёмки не сбрасывать позу в нейтраль, если у orbit-ряда нет `camera_pose`. Снимок меняет фото, не клик оси. Спека `docs/24-08-camera-orbit.md`.
>
> Последнее обновление: 2026-08-24 (**camera orbit SQL 213:** повторный прогон `212` падает с `42723` — `CREATE FUNCTION` после DROP только старой 22-arg сигнатуры. На проде гонять `sql/213_camera_orbit_enqueue_replace.sql` (`CREATE OR REPLACE` + DROP обеих сигнатур). `212` не перезапускать.
>
> Последнее обновление: 2026-08-24 (**camera orbit I2I:** после верной классификации `camera_orbit` Gemini Flash всё ещё копировал кроп (джоб `55f97a43`, корень `8dcda05d`). Контракт орбиты теперь описывает walk/reveal, MUST CHANGE раньше LOCK; Gemini: systemInstruction + текст до картинки. Local-edit не трогаем. Спека `docs/24-08-camera-orbit.md`.
>
> Последнее обновление: 2026-08-24 (**worker Docker camera-orbit:** Dockhost собирает `docker build -f Dockerfile.worker .`. В образ надо копировать каждый файл из `web-generation-worker/tsconfig.json` include, включая `camera-orbit.ts`. Иначе `tsc` в образе — `TS2307`. Тот же список — в `web-generation-worker/Dockerfile`.
>
> Последнее обновление: 2026-08-24 (**camera orbit UI:** оверлей ракурса использует тот же `GenerationResultActionRail`. Клик оси += 30° (повтор копит, clamp ±60). Ghost по центру на подложке (`Камера слева 30°, высота как была`). Одна CTA `Снять кадр · N`. «Выйти» / X возвращают на исходник сцены. Спека `docs/24-08-camera-orbit.md`.
>
> Последнее обновление: 2026-08-24 (**camera orbit classify:** worker берёт `camera_orbit` по `edit_kind` **или** префиксу `CAMERA ORBIT` в `edit_instruction`. Local-edit assembler не оборачивает орбиту правилами «keep camera». Футер «Что изменить» скрыт, пока открыт оверлей ракурса. Спека `docs/24-08-camera-orbit.md`.
>
> Последнее обновление: 2026-08-24 (**camera orbit:** после готового фото rail «Камера» открывает оверлей орбиты вокруг человека. Взгляд/поза lock, цена как у image-модели корня. `POST /api/generate` `editKind=camera_orbit` + `cameraPose`; I2I всегда с scene root. Worker — отдельный orbit-промпт (не local-edit keep camera). Флаг `camera_orbit_enabled` (default false) + internal allowlist. SQL `212`. Спека `docs/24-08-camera-orbit.md`.
>
> Последнее обновление: 2026-08-24 (**worker replica identity:** JSON-логи, `/health/live`, `/health/ready` и `/metrics` всегда отдают `workerId` этой реплики. Пустой `WORKER_ID` → `hostname:pid:hex`. Очередь уже multi-replica (`SKIP LOCKED` + lease); вторая Dockhost-реплика того же образа не меняет claim RPC. `WORKER_GLOBAL_CAP` / `WORKER_VIDEO_GLOBAL_CAP` не умножать на число реплик.
>
> Последнее обновление: 2026-08-24 (**SEO traffic attribution:** органика/direct/referral пишутся в те же `utm_*`, что и Директ. Source `yandex_seo`/`google_seo`/`bing_seo`/`direct`/`referral`, medium `organic`/`none`/`referral`, страница только в `utm_landing_path`. Приоритет пустой < бесплатный < платный: `yclid`/`cpc` может перетереть SEO, обратно нельзя. SSOT `isPaidAttribution` / SQL `landing_should_replace_attribution` (`sql/211_seo_traffic_attribution_upgrade.sql`). `yandex_seo` не Директ. Спека `docs/24-08-seo-traffic-attribution.md`.
>
> Последнее обновление: 2026-08-24 (**OAuth return screen:** после Google/Yandex пользователь остаётся на том же листинге / карточке. SSOT `auth-return-screen.ts`: `path` = listing origin (или hard `/p/slug`), overlay = `card:<slug>` / `pricing` / `foto-v-promt`. Cookie `ps_auth_next` **читается**, если sessionStorage пуст. `?next=` пустой или `/p/slug` при живом overlay → listing path. `AuthReturnScreenRestorer` открывает модалку; `useListingScrollOnRouteChange` не скроллит наверх при `?ps_auth=1`. Generate-from-card overlay не восстанавливает карточку (dock pending). Спека `docs/24-08-auth-return-screen.md`.
>
> Последнее обновление: 2026-08-23 (**cookie auth + Next cache cap:** все серверные `createServerClient` / Bearer `createClient` берут `SUPABASE_SERVER_AUTH` (`autoRefreshToken=false`) через `supabase-cookie-client.ts`. Иначе каждый `/api/me`, `open-reconcile`, SSR `/p` оставлял GoTrue timer. `next.config.ts` `cacheMaxMemorySize` = 32 МБ (`next-cache-memory.ts`) — потолок in-process ISR/image cache в 2 GiB контейнере.
>
> Последнее обновление: 2026-08-23 (**scout analyze:** `POST /api/scout/analyze` — открытая ручка без auth и без `landing_users.credits`. Квота 100 успешных / UTC-сутки на бакет `scout:v1` (`analyze_quota_reserve`); сверх лимита `429`. Gemini extract общий с `/api/extension/analyze`. History `client_source=scout`. Публичную analyze-квоту не меняет. Спека `docs/23-08-scout-analyze.md`.
>
> Последнее обновление: 2026-08-23 (**generaciya-foto chip scroll:** клик по чипу `/generaciya-foto/*` больше не показывает подвал и не анимирует возврат наверх. Next 15 `handlePotentialScroll` делал `scrollIntoView` на `<next-route-announcer>` (в потоке у конца `body`); `html { scroll-behavior: smooth }` + `writeScrollTop(0)` давали видимый подскрол. SSOT: `LISTING_SHELL_LINK_SCROLL` на чипах explorer, announcer `position: fixed` в `globals.css`, `writeScrollTop` через `pinInstantDocumentScroll`.
>
> Последнее обновление: 2026-08-23 (**service-role client singleton:** `createSupabaseServer` — один процесс-wide клиент (`supabase-server-client.ts`), `autoRefreshToken/persistSession/detectSessionInUrl=false`. Новый `createClient` на каждый вызов оставлял GoTrue `setInterval` → OOM (~1 ГБ / 20–40 мин). Импорты `@/lib/supabase` без изменений.
>
> Последнее обновление: 2026-08-23 (**Direct birthday landing title:** посадочная кампании — `/sobytiya/den-rozhdeniya`. При `yclid` или `utm_source=yandex&utm_medium=cpc` клиент подменяет H1 и `document.title` на заголовок объявления на всём кластере `/sobytiya/den-rozhdeniya/*`. `generateMetadata` / `og:title` не трогаем. Органика без меток — SEO H1 страницы.
>
> Последнее обновление: 2026-08-23 (**Metrika MP purchase claim:** PostgREST PATCH фильтрует *новую* строку — нельзя писать `yandex_conversion_claimed_at`/`sent_at` и фильтровать те же колонки, плюс `.or()` с ISO-временем ломал claim с 17.08. Claim: `id` + `sent_at IS NULL`. Mark/release: только `id`. Cron `yookassa-reconcile` после stale sweep досылает unsent YooKassa/Robokassa (limit 20). JS `purchase` на возврате без изменений.
>
> Последнее обновление: 2026-08-23 (**OAuth return hydrate without F5:** после PKCE `finishOAuthCodeExchange` уводит на `next?ps_auth=1` + cookie `ps_auth_done` (60 с), чтобы не восстановить гостевой bfcache того же URL. `AuthProvider` — SSOT: `getSession` overlay → `getUser` JWT; сеть к GoTrue упала, cookie живы → UI не гость. `pageshow` (`persisted` / живой `ps_auth_done`) и `visibilitychange` при `user === null` перечитывают сессию; маркер сразу `replaceState`. Спека `docs/23-08-oauth-return-session-hydrate.md`.
>
> Последнее обновление: 2026-08-23 (**YooKassa open-reconcile + cron 1 мин:** четвёртый consumer того же `reconcileYooKassaPayment` — `POST /api/payments/yookassa/open-reconcile` на возврат без `?payment=` (auth + visibility, debounce 30 с). Create перед новым checkout сверяет открытые; тот же план только что credited → `alreadyCredited`, без второго `confirmation_url`. Stale cron default 1 мин (limit 20). Не вешать на `GET /api/me`. Спека `docs/23-08-yookassa-return-reconcile.md`. Ops: сменить pg_cron `yookassa-reconcile` с `*/5` на `* * * * *`.
>
> Последнее обновление: 2026-08-22 (**admin mail daily stats:** `/admin/mail` → вкладка «Статистика». `GET /api/admin/mail/stats?days=1…30` (default 14, `Cache-Control: no-store`). RPC `landing_mail_admin_daily_stats` (`sql/210`) группирует `landing_mail_outbox` по `landing_mail_moscow_day`: sent по `sent_at`, skip/fail по `updated_at`. `queued` / `remaining` только у сегодняшней строки из `landing_mail_daily_budget`. Partial indexes `sent_at` и skip/fail `updated_at`. JSON без email / user id / payload. Спека `docs/22-08-mail-admin-daily-stats.md`.
>
> Последнее обновление: 2026-08-22 (**Google SERP favicon pack:** SSOT `public/favicon.svg`. Растры `favicon.ico` (16/32/48 PNG), `favicon-48x48.png`, `favicon-96x96.png`, `apple-touch-icon.png` (180), `icon-192.png` / `icon-512.png`. `layout.tsx` metadata + `site.webmanifest`. Редиректа `/favicon.ico` → SVG больше нет — Googlebot-Image и неявный `/apple-touch-icon.png` должны получать картинку, не HTML/308. Пересборка: `node scripts/build-favicons.mjs`.)
>
> Последнее обновление: 2026-08-22 (**library add ≠ generate job:** плитка «Добавить» в шторке фото пишет только `libraryUploading` + `POST /api/upload-generation-photo`. Не ставит `phase=uploading` — иначе desktop dock считает это стартом генерации и закрывает пластину (`setPlateOpen(false)` + FAB progress). Overlay dismiss шторки/scrim — `pointerdown`, не `click` (ghost-click после file picker). SSOT `generate-compose-job.ts`.)
>
> Последнее обновление: 2026-08-22 (**`/generations` click → result chrome:** клик по completed фото или видео открывает тот же generate-dock `intent=result` (`seedCompletedResult`), что после генерации: кадр + rail Посмотреть / Скачать / Повторить / Оживить / Что изменить. Карточка `/p/[slug]` с клика больше не открывается; publish остаётся в ⋮.)
>
> Последнее обновление: 2026-08-22 (**composer prefs SSOT:** последний выбор фото / image-модели / video-модели / aspect / size / duration живёт в `landing_generation_preferences` + write-through `localStorage`. Hydrate через `resolveComposerPreferences` (LWW cache vs server). PUT больше не 400-ит весь снимок из-за одной мёртвой photo id или stale model — клампит к enabled. Гидрация сама не пишет дефолт «первое фото». SQL `209` добавляет video-колонки. «Оживить» берёт последний video-model, иначе Veo 3.1 Lite.)
>
> Последнее обновление: 2026-08-22 (**result chrome: no photo scrim, actions on the right:** после генерации `GenerationResultBackdrop` больше не кладёт затемняющий градиент на кадр. Действия Посмотреть / Скачать / Повторить / Оживить / Что изменить — один rail `GenerationResultActionRail` справа внизу (`bottom` + safe-area). Все кнопки одного размера (`min-h-12`, 13px). Glass как у чипов карточки; «Оживить» сразу над «Что изменить»: доступность кэшируется (`video-animate-availability`, sessionStorage), чтобы кнопка не всплывала после fetch. Акцент один раз — мягкий glow + sheen (~1.6с) и полоска по контуру 8с с fade, без hover-loop. «Что изменить» — фирменный indigo→violet. Footer на result скрыт, кроме «Недостаточно кредитов».)
>
> Последнее обновление: 2026-08-22 (**Veo 3.1 Lite default + label:** `DEFAULT_VIDEO_MODEL` = `veo-3.1-lite-generate-preview`. «Оживить» и `defaults.model` берут его через `resolveVideoModelId` (код, не stale DB). UI-лейбл `Veo 3.1 Lite`. SQL `208` выравнивает `default_video_model`.)
>
> Последнее обновление: 2026-08-22 (**model sheet photo/video split:** шторка «Модель генерации» делит карточки на блоки «Фото» и «Видео». Тексты video-моделей как у Lexy: Grok Imagine 1.5 — «Динамичное видео из фото», Veo Omni Flash — «Фото оживает по твоему сценарию», Veo 3.1 Lite — «Озвученное видео из фото». SSOT `GENERATION_MODEL_DISPLAY`.)
>
> Последнее обновление: 2026-08-22 (**Grok Imagine image = 10 кредитов:** `GROK_IMAGINE_IMAGE_CREDIT_COST` в `image-options.ts`. `parseEnabledGenerationModels` всегда ставит 10 для `grok-imagine-image*` (пикер и `POST /api/generate`), даже если в `landing_generation_config.models` ещё 5. SQL `207` выравнивает JSON в БД. Фолбек на Grok по-прежнему не меняет `credits_spent`.)
>
> Последнее обновление: 2026-08-22 (**compose video models in photo sheet:** в `CardInlineGeneratePanel` видео-модели стоят в той же шторке «Модель генерации», что и фото. Выбор видео-модели = `composeModality=video` + `POST /api/generate/animate-scenario`; возврат на фото-модель восстанавливает stash image-промпта (`lib/compose-modality-prompt.ts`). Отдельной плитки «Видео» / `VideoComposeBar` / ссылки «Оживить фото» нет. Компактная плитка модели показывает выбранную модель и бейдж «Видео». На готовом фото по-прежнему glass-кнопка «Оживить».)
>
> Последнее обновление: 2026-08-22 (**mobile generate preference sheets:** выбор фото и модели в `CardInlineGeneratePanel` на mobile занимает всю высоту compose viewport в `chrome=dock` и `chrome=fullscreen`. Header и нижняя CTA фиксированы, прокручивается средняя область; в photo sheet контролы добавления закреплены снизу. Инструкция — тот же 13px / indigo-zinc слой, что и шторка: заголовок, одна строка правила, локальный портрет `public/generate/photo-guide-portrait.webp` (карточка `visual-hook-yarkiy-neonovo-rozovyy-tsvet-volos-i-makiyazha-sozdaet-smelyy-stiliz-42add`), без emerald-бейджей. Показывается в dock и mobile/desktop sheet независимо от библиотеки.)
>
> Последнее обновление: 2026-08-22 (**admin image generate/edit:** `/admin/analyze-history` → «Генерации других пользователей» показывает бейдж `Gemini generate` / `Gemini edit` / `xAI generate` / `xAI edit`. SSOT `inferProviderImageMode`: фото/parent/vibe/local edit → edit, иначе generate; вендор по `executed_model` / `fallback_used`. Поле `providerImageMode` в `GET /api/admin/user-generations`.)
>
> Последнее обновление: 2026-08-22 (**lifecycle-почта в коде:** `sql/206`, `mail-catalog.ts`, due-очередь `POST /api/cron/mail-due`, гранты `landing_pricing_offers` 10/20%, приоритетный claim outbox, бюджет кампаний, вкладка «Каталог» на `/admin/mail`. Welcome/402/ЮKassa/gen/credited ставят due, не SMTP. Спека `docs/22-08-lifecycle-mail.md`. Транспорт: `docs/21-08-yandex-postbox-mail.md`, ops `docs/ops/yandex-cloud-postbox.md`.)
>
> Последнее обновление: 2026-08-22 (**Yandex Cloud Postbox:** исходящая почта через SESv2 `postbox.cloud.yandex.net` (без `GEMINI_PROXY`). Outbox `sql/205`, cron `POST /api/cron/mail-outbox`, enqueue после YooKassa/Robokassa `credited` и one-shot welcome. Админка `/admin/mail` (dry-run → send), `/unsubscribe` + `POST /api/mail/unsubscribe`, bounce `POST /api/mail/postbox-events`. Спека `docs/21-08-yandex-postbox-mail.md`, ops `docs/ops/yandex-cloud-postbox.md`. GoTrue auth-письма и MCP `support_ru` не трогаем.)
>
> Последнее обновление: 2026-08-21 (**`/generaciya-foto` starter restored:** `GeneraciyaFotoStarter` снова под H1 — карточки «По описанию» / «По фото» и pill-CTA `#generaciya-foto-starter-cta`. Desktop FAB прячется, пока CTA в зоне видимости (`heroCtaInView`). Eyebrow библиотеки: «Библиотека образов». Photo→prompt канон остаётся `/foto-v-promt`.)
>
> Последнее обновление: 2026-08-21 (**SEO watchlist:** `/admin/seo` — топ-30 URL Вебмастера, раскрытие запросов, дневные показы/спрос/CTR/клики, фильтр дней и график динамики по запросу. Запросы: complementary URL = страница, до 100 строк, сорт по показам/кликам. Снимок `landing/src/data/seo-watchlist-snapshot.json`, refresh `src/standalone/refresh-seo-watchlist.mjs`, API `GET /api/admin/seo-watchlist`. Спека `docs/21-08-seo-page-watchlist.md`.)
>
> Последнее обновление: 2026-08-21 (**admin payments CSV:** `/admin/payments` кнопка «Скачать CSV» → `GET /api/admin/payments?format=csv` с теми же фильтрами status/test/source/campaign. Сервер листает `admin_landing_payments` до 10 000 строк, UTF-8 BOM + `;`, formula-safe quoting.)
>
> Последнее обновление: 2026-08-21 (**foto-v-promt SEO copy:** Title/H1 = «фото в промт»; H2 виджета = «промт по фото». Hero укорочен. FAQ без синонимов-вопросов. SSOT `landing/src/lib/foto-v-promt-copy.ts`, спека `docs/21-08-foto-v-promt-seo.md`. URL, виджет и лимиты без изменений.)
>
> Последнее обновление: 2026-08-21 (**prompt remix section patches:** `POST /api/prompt-remix` больше не просит Flash переписать весь 4k+ промпт. SSOT `lib/prompt-remix.ts`: JSON-правки секций → детерминированный merge. Structured analyze-промпт → attempt 1 `section_edits` (`thinkingBudget=256`, JSON schema); echo/no-op → attempt 2 `full_rewrite`. Эхо после двух попыток → `422 unchanged_prompt`. Логи: `remixMode`, `appliedHeadings`, `unchanged_attempt`.)
>
> Последнее обновление: 2026-08-21 (**Grok image fallback = any Gemini fail:** после ошибки Gemini на фото (`IMAGE_OTHER`, safety, 5xx, …) тот же job один раз зовёт Grok. Skip только `shutdown` / уже Grok / circuit / нет `XAI_*` / выключенный fallback.)
>
> Последнее обновление: 2026-08-21 (**Grok Imagine image:** `grok-imagine-image-2.0` в пикере за 5 кредитов. Worker `xai-image.ts` через `XAI_BASE_URL` (`/v1/images/generations|edits`), без fallback на `api.x.ai`. Eligible fail другой image-модели → тот же job один раз пробует Grok (`fallback_used`, `requested_model`/`executed_model`). 4K clamp в 2K, вход clamp до 3 фото. SQL `204`.)
>
> Последнее обновление: 2026-08-21 (**prompt remix always generates:** CTA `Применить и сгенерировать` после успешного remix сразу зовёт `POST /api/generate`. Без parent — обычный enqueue, с completed result — continuation. Prefs API деградирует в defaults, если нет `landing_generation_preferences`.)
>
> Последнее обновление: 2026-08-21 (**prompt remix observability + identity:** `POST /api/prompt-remix` логирует `gemini_request` (полный SOURCE_PROMPT + CHANGE_REQUEST) и `gemini_response` (extracted prompt + Google candidates/usage). Эхо исходного промпта → `422 unchanged_prompt`. History пишет `resolveSharedDbUserId` (`dbUserId`), не сырой JWT. Persist-ошибки сериализуются как `{ message, code, details }`.)
>
> Последнее обновление: 2026-08-20 (**`/generations` video opens result dock:** клик по completed video → `seedCompletedResult` (`intent=result`) открывает generate-dock с result chrome: Посмотреть / Скачать / Повторить, без «Оживить». Lightbox нет. «Оживить» на готовом фото — glass-кнопка поверх кадра.)
>
> Последнее обновление: 2026-08-20 (**video открыто всем:** `landing_generation_config.video_animate_enabled=true`, SQL `203`. CTA «Оживить» и `POST /api/generate?modality=video` больше не только allowlist.)
>
> Последнее обновление: 2026-08-20 (**`/generations` video + animate chrome:** клик по completed video открывает lightbox (`<video controls>`), без UGC/`/p/[slug]`. «Оживить» на готовом фото — glass-кнопка поверх кадра (не в ⋮); флаг `GET /api/generation-config?modality=video`.)
>
> Последнее обновление: 2026-08-20 (**video source cover-crop:** worker `sharp` обрезает входной кадр под 9:16/16:9 (`fit: cover`) перед Grok, Veo Lite и Omni, чтобы 1:1 не растягивался. SSOT `video-source-frame.ts`.)
>
> Последнее обновление: 2026-08-20 (**Veo 3.1 Lite:** третья video-модель `veo-3.1-lite-generate-preview`, база 15 кредитов + 0/10/20 за 4/6/8 сек. 10 сек нет (clamp). Worker: Gemini `predictLongRunning` через `GEMINI_PROXY_BASE_URL`. SQL `202`. Дефолт остаётся Grok 1.5.)
>
> Последнее обновление: 2026-08-20 (**Grok Imagine Video 1.5:** второй video-провайдер в том же job. Дефолт `grok-imagine-video-1.5`, Omni в пикере. Worker: `XAI_BASE_URL` + signed URL кадра, без fallback на `api.x.ai`. SQL `201`. Кредиты те же 30+длительность.)
>
> Последнее обновление: 2026-08-20 (**video compose params:** кликабельные формат / длительность / 720p в шите «Параметры видео». Цена = `video_models.cost` + +0/+10/+20/+30 за 4/6/8/10 сек (`calculateVideoCreditCost`). Worker шлёт `response_format.duration`. SQL `200`. UI: одна плитка кадра (Omni `image_to_video` = 1 фото). `promptExpanded` прячет compose/footer через `hidden`.)
>
> Последнее обновление: 2026-08-20 (**animate scenario starts on still:** `video-animate-scenario` требует, чтобы сюжет открывался этим кадром (frame 0), без lead-in / нового ракурса. User-текст: «Сюжет начинается с этого кадра фотографии».)
>
> Последнее обновление: 2026-08-20 (**video image_to_video = 1 image:** Gemini `task=image_to_video` отвечает `invalid_request` на второе фото («does not support more than 1 image»). «Оживить» шлёт ровно Image1 + `[# Sources @Image1]`. Официальные `[# References @Image2]` относятся к `reference_to_video`, не к оживлению кадра.)
>
> Последнее обновление: 2026-08-20 (**worker Docker helpers:** в образ копируется только pure `user-generation-photo-paths.ts` (без `@supabase/supabase-js`). `user-generation-photos.ts` остаётся landing-only: signed URL + реэкспорт path helpers.)
>
> Последнее обновление: 2026-08-20 (**worker Docker copy:** `Dockerfile.worker` копирует `user-generation-photos.ts` вместе с другими landing helpers — иначе `tsc` в образе падает на `TS2307`.)
>
> Последнее обновление: 2026-08-20 (**video library→generation:** «Оживить фото» по копии из «Использовать» (`generation-<uuid>.jpg` / `source_generation_id`, SQL 199) поднимает исходную генерацию: Image1 = result, Image2 = исходный аплоад. Обычный аплоад без генерации шлёт то же фото и как Source, и как Reference. UI: `resolveVideoEnqueueParentGenerationId`.)
>
> Последнее обновление: 2026-08-20 (**video identity reference:** при `sourceType=generation_result` worker шлёт Image1 = готовый кадр (`[# Sources]`) и Image2 = первый owned аплоад с родителя / цепочки parent (`[# References]`, бакет `web-generation-uploads`). Прямое оживление аплоада Image2 не дублирует. Логи: `hasIdentityReference`, `identityPath`, `identityBytes`. Если референс не скачался — warn `video_identity_reference_missing` и fallback на один кадр.)
>
> Последнее обновление: 2026-08-20 (**video source logs:** worker пишет `video_input_resolved` + те же поля в `video_submit` / `video_submit_response`: `sourceType` (`user_photos` | `generation_result`), `sourcePath`, `sourceBucket`, `parentGenerationId`. По логу видно, ушёл исходный аплоад или уже сгенерированный кадр.)
>
> Последнее обновление: 2026-08-20 (**birthday sitemap + L3 301:** `sitemap.ts` добавляет хаб/L2/L3 кластера и `/sobytiya/1-sentyabrya` по SSOT + FTS-хитам (`getMinCardsForLevel`), без Gemini. `DEN_ROZHDENIYA_PERMANENT_REDIRECTS` включает L3 wildcard `/:object` (occasion в середине и в конце) в `next.config.ts`.)
>
> Последнее обновление: 2026-08-20 (**listing hybrid hardening:** birthday `q` allowlist (`isBirthdayListingSearchQuery`); in-memory result cache 1h только для `outcome=hybrid`; Gemini budget actor `system` (не IP `unknown` / user-60); fallback не кэшируется. `/api/listing?q=` чужой запрос — FTS-only. Логи `[listing-search:fallback|slow]` без текста q + `Server-Timing`. `InfiniteGrid` для `q=` больше не шлёт `cache: no-store`.)
>
> Последнее обновление: 2026-08-20 (**birthday listing = hybrid search:** search-backed листинги (`birthdayListingSearchQuery`) идут через `searchListingCardsHybrid` — тот же `runHybridCardSearch`, что `GET /api/search` (FTS + Gemini embeddings / `search_cards_visual` при `SEARCH_VISUAL_ENABLED=1`). SSR и `GET /api/listing?q=` больше не зовут только `search_cards_text`; peek `limit+1` и `has_more` сохранены. Без флага — text fallback, как у сайта.)
>
> Последнее обновление: 2026-08-19 (**birthday search pagination:** search-backed листинги (`birthdayListingSearchQuery` → `search_cards_text`) больше не обрываются на SSR-срезе. Первая страница — `LISTING_SEARCH_PAGE_SIZE` (48) с peek `limit+1`; `GET /api/listing?q=` отдаёт `has_more`; `InfiniteGrid` грузит следующие offset-страницы (RPC `search_cards_text` режет только порцию, не всю выдачу, cap 100/request) и показывает «Показать ещё».)
>
> Последнее обновление: 2026-08-19 (**birthday anti-cannibal copy:** title/description/H2 хаба больше не перечисляют «девушке / детям / с тортом» и do-глаголы. Каждый L2 держит свой модификатор; «девушке с тортом» только на L3; генерация — `/generaciya-foto/na-den-rozhdeniya`. H1 хаба не менялся.)
>
> Последнее обновление: 2026-08-19 (**stable masonry cqw split restored:** `container-type: inline-size` на `.stable-listing-masonry`, `height: *cqw` на внутреннем `.stable-listing-masonry-canvas`. На `origin/main` CSS-часть фикса `a2dcde00` была случайно откатана pricing-коммитом `09663124`, из-за этого explorer снова держал пустой хвост под последним рядом.)
>
> Последнее обновление: 2026-08-19 (**birthday listing = search query:** сетка хаба и детей `/sobytiya/den-rozhdeniya*` строится через поисковый запрос, не через AND `seo_tags`. SSOT запросов — `birthdayListingSearchQuery` (`день рождения`, `день рождения девушке`, …). С 2026-08-20 путь тот же hybrid, что `/search`. SSR и `InfiniteGrid` пагинируют `GET /api/listing?q=`; категорийные фильтры на этих URL скрыты. Index/noindex смотрит на число поисковых хитов первой страницы. Sitemap кластера — SSOT + FTS-хиты, не только теговый combo-кэш.)
>
> Последнее обновление: 2026-08-19 (**birthday cluster hub:** URL хаба `/sobytiya/den-rozhdeniya` не меняется. Дети occasion-first: `/devushki`, `/deti`, `/muzhchiny`, `/s-tortom`, `/s-detskim-foto`, `/s-shampanskim`, `/so-lvom`. SSOT — `den-rozhdeniya-cluster.ts`. Audience-first L2 (`/promty-dlya-foto-devushki/den-rozhdeniya` и узкие детские) — 301 на детей хаба. `getSeoForRoute` сначала ищет combo-ключ в `seo-content.ts`. Хаб остаётся листингом; под H1 — видимые чипы сценариев + generate `/generaciya-foto/na-den-rozhdeniya`. Новые object-теги `s_detskim_foto`, `so_lvom`; у `s_bokalom` убран паттерн «шампанск».)
>
> Последнее обновление: 2026-08-19 (**Yandex birthday launch:** `landing_view` до OAuth создаёт `landing_acquisition_visitors`, поэтому cohort date соответствует первому визиту; `/admin/finance` показывает delivery с live revenue, полное data quality и launch scorecard. Тест сужен до одной кампании / группы / объявления «Создать фото на день рождения»; SSOT — `yandex-two-cluster-launch.ts`, `CAC_max=82 ₽`, scale gate требует mature D30. Миграции `196` → `197` → `198` применены; browser, visitor/link, funnel, ledger/admin и ads replace smoke пройдены с очисткой данных. До расхода остаются web deploy, внешний test purchase/MP и настройка кабинета. Спека: `docs/19-08-yandex-two-cluster-launch.md`.)
>
> Последнее обновление: 2026-08-19 (**pricing mobile trust strip:** на viewport ≤639px блок «Разовая / Без срока / Без подписки» стоит над каруселью тарифов, поэтому пакеты смещаются ближе к центру между trust и CTA. На `sm+` полоса остаётся под сеткой 2×2.)
>
> Последнее обновление: 2026-08-19 (**pricing mobile swipe:** на viewport ≤639px тарифы идут горизонтальной каруселью, не сеткой 2×2. `getPaywallSwipePlans` ставит сначала более дорогой пакет, затем самый дешёвый. Карточка по центру, соседние тарифы выглядывают с двух сторон; стрелки и snap работают влево и вправо и синхронизируют выбранный пакет с CTA. Ряд тарифов и CTA остаются shrink-0, benefits/trust скроллятся под ними. На `sm+` сетка 2×2 и прежний default plan сохранены.)
>
> Последнее обновление: 2026-08-18 (**pricing layout contract:** compact paywall во всех A/B-вариантах и в page/modal layout использует единый bounded shell из трёх зон: фиксированный hero, внутренний scroll-region предложения и независимый shrink-0 purchase footer. `ClientPricingModal` задаёт surface явную высоту (`100dvh - 1.5rem`, на `sm+` — `min(94dvh, 60rem)`), а не только `max-height`: flex-chain получает definite height, поэтому offer-region действительно прокручивается и CTA не уходит за clip. Оферта/политика доступны в полном layout, но не занимают первый экран. Responsive-правила централизованы в `globals.css` через `pricing-paywall-*`: при viewport height ≤720px тарифная область заходит поверх hero, карточки уплотняются, а benefits/trust/legal скрываются; при ≤620px декоративный photo hero полностью скрывается и тарифная область занимает всю доступную высоту. Поэтому все 4 тарифа и CTA помещаются даже на 320×568 без page overflow или перекрытия.)
>
> Последнее обновление: 2026-08-18 (**pricing offer A/B:** `/pricing` и глобальный pricing overlay закрепляют браузер в `localStorage` за `control` или `treatment` с равным 50/50 split (`pricing_paywall_2026_08`). Оба варианта используют один и тот же compact UI: белая modal-card в стиле главной, hero-коллаж, сетка 2×2, выбор пакета, benefits и единая CTA. Отличается только предложение: control сохраняет прежние 70/199 ₽, 175/399 ₽, 700/899 ₽, 1550/1499 ₽ (default — 1550 токенов); treatment показывает 30/99 ₽, 100/299 ₽, 200/469 ₽, 500/990 ₽ (default — 100 токенов). `pricing-plans.ts` — единый server-side SSOT с двумя variant-каталогами; YooKassa и Robokassa выбирают цену и начисляемые токены только после server-side sanitization `paywall_variant`, поэтому UI и платёж совпадают. Общий auth/payment flow передаёт `experiment_id` + `paywall_variant` в цели показа/начала checkout и client-side purchase. Экономика фото вычисляется через `getPricingPlanPhotoEconomics` из стоимости моделей 5/10 токенов. Backend first-touch сохраняет вариант в `landing_yookassa_payments` / `landing_robokassa_payments`; SQL `195`, RPC `admin_landing_payments` и `/admin/payments` показывают «A · старый», «B · новый» или legacy «Не определён». QA override: `?paywall=control|treatment` без перезаписи assignment.)
>
> Последнее обновление: 2026-08-18 (**listing explorer Suspense SSOT:** RSC-вход в ленту — `CatalogExplorer` (`Suspense` вокруг `CatalogWithFilters`). `useListingFilters` / `useListingSort` читают `useSearchParams`; без parent boundary Next 15 валит prerender (`/sobytiya/1-sentyabrya`). `[...slug]`, `/trends` и `/sobytiya/1-sentyabrya` монтируют explorer только так. Event-page принимает `searchParams` и noindex при query-фильтрах, как `/trends`.)
>
> Последнее обновление: 2026-08-18 (**listing hover без «Повторить»:** `ListingPhotoTile` больше не рисует hover-кнопку. На `/generaciya-foto` и сценариях клик по плитке открывает модалку карточки, как на остальных лентах.)
>
> Последнее обновление: 2026-08-18 (**stable masonry cqw split:** `StableListingMasonry` держит `container-type: inline-size` на внешней обёртке, а `height: *cqw` — на внутреннем `.stable-listing-masonry-canvas`. Иначе браузер считает `cqw` высоты от viewport, и под последним рядом карточек остаётся пустой хвост внутри explorer-рамки.)
>
> Последнее обновление: 2026-08-18 (**cluster chips «Ещё»:** `ListingClusterChipGroup` сравнивает `scrollHeight` с высотой 3 строк (`chipHeight * 3 + gap * 2`). Тот же компонент стоит над masonry и в L2-группах под сеткой.)
>
> Последнее обновление: 2026-08-18 (**search listing position:** `/search` не перезапускает выдачу при `pushState /p/slug`. Next 15 синхронизирует overlay в `useSearchParams` (пустой `q`) — `resolveSearchUrlSync` игнорирует overlay, snapshot (`search-listing-session.ts`) ключуется `searchRequestKey` и переживает remount, `resetListingScroll()` только на новый запрос/фильтр. `useListingFilters` замораживает query-фильтры на overlay.)
>
> Последнее обновление: 2026-08-18 (**cluster chips above grid:** на L1 «Люди и отношения», «Стили», «Сцены и объекты» и `/sobytiya/*` перелинковка внутри кластера — над masonry (`getClusterChipNavigation` + `preGrid`). Если чипы занимают больше 3 строк, `ListingClusterChipGroup` показывает «Ещё». Тексты страниц не менялись.)
>
> Последнее обновление: 2026-08-18 (**`/sobytiya/1-sentyabrya`:** L1 кластера «Промты для фото» (`CatalogWithFilters`, copy из `seo-content.ts`). Стартовая masonry — `search_cards_text("1 сентября")`. Чипы событий — над сеткой; стили — под ней. На `/stil/*` L1 в группу «События» добавляется чип на этот URL без смены текстов.)
>
> Последнее обновление: 2026-08-18 (**embedding after publish:** общий `publishPromptCard` покрывает analyze/admin/user-generation/visibility publish routes: DB trigger создаёт visual job, а Next `after()` best-effort обрабатывает один job после HTTP-ответа. Ошибка Gemini не откатывает публикацию; `/api/cron/visual-embeddings` остаётся обязательным retry/backlog consumer.)
>
> Последнее обновление: 2026-08-17 (**search filters before rank:** `/search` передаёт `audience/style/occasion/object` в `/api/search`; overload-RPC из миграции `194` ограничивают text и visual candidates по `seo_tags` до hybrid ranking и pagination. Client-side проверка остаётся защитной, но больше не формирует выборку из обрезанного top-N.)
>
> Последнее обновление: 2026-08-17 (**SEO-сценарии генерации фото:** `/generaciya-foto/[scenario]` обслуживает allowlist из 22 страниц: все 20 популярных чипов хаба плюс портрет и аниме. SSOT маршрутов/тегов — `generaciya-foto-routes.ts`, copy/FAQ/HowTo — `generaciya-foto-scenario-copy.ts`. Начальная SSR-выдача содержит до 16 карточек только своего тега; поле поиска от 2 символов может временно заменить её результатами `/api/search`, очистка возвращает тематическую выдачу. Чипы не меняют фильтр in-place, а ведут на `/generaciya-foto/*`. Self-canonical и JSON-LD; `index` и sitemap включаются от 8 карточек. Blank Generate Dock разрешён только для allowlist.)
>
> Последнее обновление: 2026-08-17 (**listing filter scroll:** смена query-фильтра на том же pathname вызывает `resetListingScroll()` в `useListingFilters`, как сортировка. Иначе remount `InfiniteGrid` схлопывает masonry и браузер зажимает старый `scrollTop` в низ страницы.)
>
> Последнее обновление: 2026-08-17 (**visual search RPC fix:** миграция `193` квалифицирует `prompt_card_visual_search_config.id` в `search_cards_visual`; без неё PL/pgSQL конфликтует с output-колонкой `id` (`SQLSTATE 42702`) и hybrid search уходит в text fallback.)
>
> Последнее обновление: 2026-08-17 (**visual embeddings via Gemini proxy:** query/image `embedContent` идёт на `GEMINI_PROXY_BASE_URL` по умолчанию, как generate/analyze. Opt-out: `GEMINI_EMBEDDING_USE_PROXY=0`.)
>
> Последнее обновление: 2026-08-17 (**hybrid visual search:** `GET /api/search` параллельно вызывает `search_cards_text` и Gemini Embedding 2 → `search_cards_visual`. Ranker: exact title / strong FTS выше visual-only, иначе weighted RRF. Gemini timeout 800 мс, IP/global budget, in-memory cache/single-flight, circuit breaker. Flag `SEARCH_VISUAL_ENABLED` (default off). SQL `192`, jobs/cron `POST /api/cron/visual-embeddings`. Спека `docs/17-08-gemini-visual-search.md`.)
>
> Последнее обновление: 2026-08-17 (**Yandex Direct purchases:** YooKassa fulfillment шлёт Measurement Protocol `purchase` с ClientID; return-poll дублирует JS-цель + ecommerce `dataLayer`. Спека `docs/17-08-yandex-direct-purchases.md`, SQL `191`.)
>
> Последнее обновление: 2026-08-17 (**Robokassa iFrame:** новые оплаты переключаются серверным `PAYMENT_PROVIDER`; Robokassa открывается официальным `Render` в `Mode=modal` без ухода со страницы. Подтверждение — только подписанный ResultURL, ledger/RPC — SQL `194`; YooKassa сохранена как fallback и для истории.)
>
> Последнее обновление: 2026-08-17 (**homepage examples sort:** блок «Готовые промты для ИИ-фотосессии» на `/` ранжирует `resolve_route_cards` / `/api/listing` по `sort=new` (`created_at DESC`), не `popular`. `/catalog` explorer без изменений — `sort=popular`.)
>
> Последнее обновление: 2026-08-16 (**search latency:** миграция `190_search_cards_text_fast_path.sql` убрала дублирующий fuzzy-scan длинных `prompt_variants`: тексты промтов уже входят в `prompt_cards.fts`. Поиск объединяет GIN FTS с trigram только по коротким заголовкам; API ограничивает запрос 160 символами, отдаёт `Server-Timing` и пишет `[search:slow]` без текста запроса. Все публичные search surfaces используют debounce 500 мс и отменяют устаревшие browser requests.)
>
> Последнее обновление: 2026-08-16 (**card viewer close:** свайп/стрелки соседей — `replace`, не `push`. Крестик закрывает весь просмотр (все snap-слайды = один экран), а не предыдущую карточку в истории. `goToNeighbor` игнорируется после close.)
>
> Последнее обновление: 2026-08-16 (**animate identity lock:** worker помечает фото как `[# Sources @Image1]` starting frame и держит identity lock в `video-motion-prompt.ts`. При оживлении результата генерации добавляется Image2 = исходный аплоад (`[# References]`). Flash-сценарий описывает только motion, без внешности и без смены ракурса; исходный image-промпт в сценарий больше не подмешивается. Temperature 0.4.)
>
> Последнее обновление: 2026-08-16 (**network-independent mobile swipes:** все публичные listing explorers передают уже загруженные карточки в session-scoped in-memory navigation cache; modal синхронно получает из него `CardPageData`, поэтому swipe commit не ждёт `/api/card/[slug]`. Native viewport держит до восьми snap-слайдов в каждую сторону. Если инерционный scroll пересёк несколько экранов, hook одним commit активирует фактически остановившийся slug, не проигрывая промежуточные карточки. При lookahead меньше 16 underlying infinite listing заранее запрашивает следующую порцию.)
>
> Последнее обновление: 2026-08-16 (**mobile prompt overlay:** открытие «Промпт» блокирует gesture handling, но сохраняет прежний snap-window и `currentSlideIndex`; отключение свайпа больше не центрирует feed на соседней карточке. Локальный Next.js route indicator отключён, чтобы не перекрывать нижнюю кнопку.)
>
> Последнее обновление: 2026-08-16 (**card split siblings:** in-memory listing adapter повторяет API-контракт: `siblings` формируются только при `card_split_total > 1`, текущая карточка исключается. `CardPageClient` дополнительно дедуплицирует ID; ложный растущий блок «Варианты подборки» у обычных карточек не рендерится.)
>
> Последнее обновление: 2026-08-16 (**overlay continuity invariant:** дочерние auth/pricing/confirm overlays не размонтируют экран-источник и не меняют его scroll/snap position. Guest «Повторить» держит prompt-card mounted под auth; dismiss возвращает тот же slug и `scrollTop`, успешный login продолжает intent и только затем открывает generator.)
>
> Последнее обновление: 2026-08-16 (**iOS swipe compositor continuity:** mobile card chrome не переключает opacity на каждом жесте — во время scroll отключаются только pointer events. Atomic recenter временно отключает `scroll-snap`, но больше не меняет `overflow-y`; WebKit scroll layer не пересоздаётся и не даёт белый/чёрный кадр между карточками.)
>
> Последнее обновление: 2026-08-16 (**listing viewport fill:** пейджинг больше не ждёт пересечения 1px-sentinel. SSOT `ensureFilled` меряет низ последней карточки (`[data-listing-fill-item]`) относительно scroll root. Если `hasMore` и до низа карточек меньше 1200px — грузим следующую порцию (10, затем по 24), даже когда masonry-box или HowTo ещё далеко внизу. Это убирает белую дыру «листни ещё — когда-нибудь догрузится». Цепочка ограничена 3 страницами за проход; scroll/resize сбрасывают счётчик. Каталог и `/search` делят один хук.)
>
> Последнее обновление: 2026-08-16 (**mobile card swipe quality:** `useMobileCardSnapFeed` сохраняет native CSS scroll-snap, но управляет жестом через `idle → interacting → settling → committing`. `scrollend` дедуплицирован token-guard; Safari 16.4–26.1 использует release + stable-position fallback. `visualViewport.resize` сохраняет нормализованный progress активного свайпа, idle-feed центрируется; programmatic smooth отключается при `prefers-reduced-motion`. Pure math — `mobile-card-snap.ts` + unit tests.)
>
> Последнее обновление: 2026-08-16 (**desktop `/search` chrome:** `/search` использует тот же `ListingExplorerFrame`, что листинги: H1 + поле `ListingExplorerSearch`. Компактный оверлей в шапке снят — иначе на десктопе было два поля. `ListingDesktopFilters` и `FilterFAB` только после выдачи (`searched && cards.length > 0`); до запроса и при пустом результате фильтры скрыты.)
>
> Последнее обновление: 2026-08-16 (**mobile listing intro:** SEO-intro внутри listing explorer на max-sm свёрнут до 2 строк с доступной кнопкой «Подробнее» / «Свернуть»; полный текст остаётся в DOM и доступен одинаково пользователям и роботам. Desktop показывает текст полностью.)
>
> Последнее обновление: 2026-08-16 (**admin video thumbs:** `/admin/analyze-history` очереди генераций рендерят mp4 через `<video>`, не `<img>`. SSOT `isVideoGenerationResult` + `AdminResultMedia`.)
>
> Последнее обновление: 2026-08-16 (**stable masonry pagination:** `InfiniteGrid` и `/search` сохраняют page boundaries для дедупликации, а `StableListingMasonry` раскладывает общий поток по детерминированным 2/3/4 lanes. Append продолжает самые короткие колонки: существующий prefix не меняет координаты, а между порциями нет горизонтальных дыр. Позиции выражены в container-query units и рассчитываются SSR без измерения DOM.)
>
> Последнее обновление: 2026-08-16 (**listing explorer chrome:** `/[...slug]`, `/trends`, `/search` — тот же блок, что «Готовые промты для ИИ-фотосессии» на главной: SEO-текст (H1 + intro) внутри рамки, поле поиска, фильтры листинга вместо Wordstat-чипов, затем masonry. Крошки остаются над блоком; HowTo/FAQ — под ним. `CatalogWithFilters` больше не `dynamic()`.)
>
> Последнее обновление: 2026-08-16 (**listing masonry SSOT:** публичные ленты промтов — `/[...slug]`, `/trends`, `/search`, `/favorites`, главная и `/generaciya-foto` — рисуют одну и ту же CSS-columns masonry (`ListingMasonry` + `ListingPhotoTile`). Пропорция = первое фото (`listingPhotoAspectRatio`), без 3:4-кропа и без `GroupedCard`. Клик открывает модалку; hover-кнопки «Повторить» нет ни на одной ленте. Infinite scroll / sort / admin-фильтры без изменений. `ListingGrid` 3:4 остаётся для `/generations` и `/analyses`.)
>
> Последнее обновление: 2026-08-16 (**mobile header burger:** на всех max-lg экранах слева в шапке бургер → `MobileCatalogMenuDrawer` (`SidebarContent`). Иконка поиска из навбара снята; на `/catalog` поиск остаётся в контенте и выезжает вместо лого при скролле.)
>
> Последнее обновление: 2026-08-16 (**animate scenario:** клик «Оживить» вызывает `POST /api/generate/animate-scenario` — Gemini 2.5 Flash смотрит только фото и подставляет короткий RU motion-сценарий. Исходный image-промпт не подмешивается. Кредиты не списывает. Fallback `Оживи изображение`.)
>
> Последнее обновление: 2026-08-16 (**catalog sticky search:** на `/catalog` max-lg, когда поле поиска уходит под шапку, в навбаре вместо лого выезжает то же поле (`ListingSearchField` compact). IntersectionObserver по `#listing-scroll-root` + `holdListingChromeAutoHide("catalog-search")`, чтобы шапка не пряталась. Бургер и баланс остаются.)
>
> Последнее обновление: 2026-08-16 (**catalog mobile explorer:** `/catalog` на max-lg — `HomepageExamplesExplorer variant="catalog"`: поиск + Wordstat-чипы + 16 popular-карточек. Fade/CTA только при чипе («Все промты категории» → L1) или поиске («Все результаты» → `/search`). Desktop — плитки `CategorySection`. Шапка на `/catalog` — бургер → `MobileCatalogMenuDrawer` (`SidebarContent`). Таб / H1 / CTA главной: «Каталог и поиск». SEO title `/catalog` без изменений, `noindex`.)
>
> Последнее обновление: 2026-08-16 (**оживить фото / Veo Omni Flash:** sibling video job на `landing_generations`. `POST /api/generate` принимает `modality=video` (1 фото или owned completed image parent, без `editInstruction`, 30 кредитов из `video_models`). Config `?modality=video` отдаёт Veo Omni Flash / 9:16 / 4 сек / 720p; флаг `video_animate_enabled`. Worker claim отдельно (`p_modality=video`, cap 2). UI: «Оживить» после фото, dock-режим для одного фото, `<video>` в истории. UGC/библиотека для video в v1 выключены. SQL `189`.)
>
> Последнее обновление: 2026-08-16 (**listing card id dedup:** `expandCardGroups` может подтянуть sibling, который на следующей странице снова приходит как ranked row. `InfiniteGrid` / `SearchResults` / admin filter append склеивают порции через `appendUniqueCardsById`; `FilterableGrid` собирает ячейки через `buildListingGridItems`, чтобы React key и swipe-order не повторяли `card.id`.)
>
> Последнее обновление: 2026-08-16 (**homepage chips:** в блоке «Готовые промты для фото» сняты кнопка «Ещё» и чип «На паспорт»; видны «Все» + топ Wordstat, остальные категории включая паспорт — `sr-only` ссылки.)
>
> Последнее обновление: 2026-08-16 (**homepage footer:** `/` передаёт `showFooterWithGenerateDock` в `PageLayout`, чтобы общий `Footer` был виден вместе с generate dock — как на `/generaciya-foto` и `/foto-v-promt`.)
>
> Последнее обновление: 2026-08-16 (**homepage examples explorer:** `/` больше не показывает `HomeSearch` и `CategorySection`. После hero destinations — `HomepageExamplesExplorer`: карточки `sort=new`, Wordstat-чипы + «Ещё», in-place `/api/search` и `/api/listing?sort=new`. Клик по карточке открывает модалку (без «Повторить»). Новые тексты только в блоке (`HOMEPAGE_SEO.examplesTitle/Intro`); title/H1/intro/FAQ не менялись. `get_homepage_sections` остаётся для счётчиков, OG и JSON-LD `hasPart`; добавлен `ItemList` на 16 карточек. FAQ-якоря `#audience_tag` заменены на L1 / `#primery`.)
>
> Последнее обновление: 2026-08-16 (**analyze quota GET window:** `readUsage` больше не сравнивает `window_start` строками. Postgres `+00:00` < JS `.000Z`, из-за этого GET `/api/extension/analyze/quota` для гостя всегда отдавал 10/10. Сравнение — `Date.parse`, как SQL timestamptz в reserve.)
>
> Последнее обновление: 2026-08-16 (**YooKassa return to origin:** checkout из оверлея запоминает listing-path (`promptshot:pricing-return-path`), `return_url` = origin + `?payment=`, не hard `/pricing`. Перед редиректом оверлей закрывается без `history.back()`, URL возвращается на origin. Poll статуса — `YooKassaReturnStatus` в root layout. Hard `/pricing` и прямые заходы без origin по-прежнему возвращаются на `/pricing`.)
>
> Последнее обновление: 2026-08-16 (**dock «Повторить» dismiss SSOT:** `GenerateDockContext.lastDockResultDismissed` переживает unmount панели. «Повторить» / delete / result X не дают last-completed hydrate на следующем открытии; новый completed снова разрешает resume.)
>
> Последнее обновление: 2026-08-16 (**`/generaciya-foto` без стартера:** `GeneraciyaFotoStarter` снят. Hero = крошки + H1 + intro (`#generator`). Desktop CTA — FAB `GenerateListingDockHost` сразу при collapsed (без `heroCtaInView`). Mobile — таб «Сгенерировать». Photo→prompt канон — `/foto-v-promt`. Eyebrow библиотеки: «Онлайн-генератор».)
>
> Последнее обновление: 2026-08-16 (**foto-v-promt → Generate Dock + Мои анализы:** CTA «Сгенерировать» после анализа копирует промт и открывает фирменный dock через `seedBlankPrompt(intent=photo_prompt)`. `/foto-v-promt` и `/analyses` в listing-path dock. Guest OAuth: pending seed в sessionStorage, виджет восстанавливает result snapshot. Профиль: «Мои анализы» → `/analyses` + `GET /api/analyses` (только свой `user_id`, signed preview). SQL `188`. LexyGPT на `/foto-v-promt` снят.)
>
> Последнее обновление: 2026-08-16 (**admin analyze-history email:** вкладка «Анализы» показывает email авторизованного, как в генерациях; гости без строки.)
>
> Последнее обновление: 2026-08-16 (**foto-v-promt floating CTA снят:** плавающая кнопка «Установить расширение» (`FotoVPromtFloatingCta`) больше не рендерится на `/foto-v-promt`. Установка расширения остаётся в сайдбаре и remix-hint.)
>
> Последнее обновление: 2026-08-16 (**desktop listing logo:** логотип PromptShot на `lg+` в начале `SidebarNav` (над аккаунтом), не в content-колонке. На `/p/[slug]` бренда нет (`showBrand={false}`). Mobile header без изменений.)
>
> Последнее обновление: 2026-08-16 (**analyze quota credits:** site `POST /api/extension/analyze` — 10 бесплатных успешных разборов на идентичность в UTC-сутки, дальше 1 токен с `landing_users.credits` только у авторизованного. Гость после 10 → 401 + AuthModal PromptShot. Fail-closed `503 quota_unavailable`. SQL `187`. GET `/api/extension/analyze/quota`. imageprompt.tools / extension — без изменений.)
>
> Последнее обновление: 2026-08-16 (**admin analytics expandable cards:** динамика кредитов, разбивка, топ пользователей и analyze-события свёрнуты; клик раскрывает раскладку.)
>
> Последнее обновление: 2026-08-16 (**admin user-generations credits remaining:** `/admin/analyze-history` вкладка «Генерации других пользователей» показывает live-остаток `landing_users.credits` рядом со списанием по job.)
>
> Последнее обновление: 2026-08-16 (**analyze client_source by page:** `POST /api/extension/analyze` больше не пишет один `promptshot` для всего promptshot.ru. Source режется по странице вызова: `/foto-v-promt` → `foto_v_promt`, `/generaciya-foto` → `generaciya_foto`, `/admin/*` → `admin`, иначе `promptshot`. Клиент шлёт `x-client` из `window.location.pathname`; сервер принимает только эти page-бакеты и иначе мапит `Referer`. Генерации по-прежнему `site` / `admin`.)
>
> Последнее обновление: 2026-08-16 (**admin analytics period users:** «Топ пользователей» и «Разбивка по пользователям» режутся фильтром Сегодня/7/30/90; SQL `186`.)
>
> Последнее обновление: 2026-08-16 (**admin credit liability cost:** обязательство = live-кредиты × 0,5 ₽; 1 генерация = 5 кр. = 2,5 ₽, не blended ЮKassa.)
>
> Последнее обновление: 2026-08-16 (**admin finance daily chart:** `/admin/finance` график выручка / косты / прибыль + затраты Gemini по моделям по дням; пунктир live-обязательств.)
>
> Последнее обновление: 2026-08-16 (**admin finance page:** касса выгрузок на `/admin/finance` в AdminNav после «Оплаты»; `/admin/analytics?tab=finance` редиректит туда. Кредиты остаются на Обзоре.)
>
> Последнее обновление: 2026-08-16 (**admin credit dynamics:** график остатка кредитов по дням + разбивка «осталось / доля / начислено-потрачено»; RPC `admin_credit_daily_flow`, SQL `185`.)
>
> Последнее обновление: 2026-08-16 (**admin finance reporting:** `/admin/analytics` live кредиты; `/admin/finance` импорт ЮKassa/GCP; Gemini $1=90₽ статика; чистый доход = gross − комиссия ЮKassa − УСН 6% − Gemini; миграция `184`.)
>
> Последнее обновление: 2026-08-15 (**web-generation results JPEG:** worker пишет новые объекты в `web-generation-results` как JPEG q=85 (`user/job/lease.jpg`). Старые `.png` валидны. Encode fail / no-gain заливает исходник с честным mime. Alpine worker ставит musl `sharp@0.33.5`.)
>
> Последнее обновление: 2026-08-15 (**analyze-history retention:** private `analyze_history` / bucket `analyze-history` хранятся 5 дней; cleanup на каждом admin read, до 1000 строк за запрос.)
>
> Последнее обновление: 2026-08-14 (**iOS focus zoom:** на touch (`hover: none` + `pointer: coarse`) у `input`/`textarea`/`select` минимум `font-size: 16px`, иначе Safari зумит страницу. Без `maximum-scale=1`. Hero search больше не `focus-within:scale-[1.005]`.)
>
> Последнее обновление: 2026-08-14 (**Safari iPhone prompt card:** immersive stage uses `100svh` + pixel-synced snap slides (`--card-snap-slide-h` = `visualViewport.height`), not `min-h-[100dvh]` / nested `overflow-y-auto`. Bottom chrome («Промпт» / «Повторить») and the action stack stay in the visible window. After a swipe settle the 3-slide window recenters (`scroll-snap` briefly off, `scrollTop` assignment) so listing neighbors keep advancing past the first three cards.)
>
> Последнее обновление: 2026-08-14 (**header pay CTA:** в мобильной шапке `HeaderBalancePayChip` справа «+» вместо «Пополнить» / «Купить кредиты»; `aria-label` по-прежнему «пополнить».)
>
> Последнее обновление: 2026-08-14 (**pricing overlay:** `/pricing` как карточка промта — hard URL (refresh, YooKassa `?payment=`) + клиентская модалка `history.pushState` с любого места; close → `history.back()`. In-app CTA (чип баланса, «Пополнить», недостаточно кредитов, футер «Тарифы») открывают оверлей, не `router.push`.)
>
> Последнее обновление: 2026-08-14 (**mobile auth sheet SSOT:** `openAuthModal` на max-lg открывает ту же `MobileProfileSheet`, что таб Войти/Профиль — в т.ч. «Войти» на карточке промта. Desktop `AuthModal` без изменений.)
>
> Предыдущее обновление: 2026-08-14 (**header balance+pay:** у авторизованного в шапке split-pill баланс + «Оплатить» → `/pricing` (Lexy-схема, PromptShot frost/indigo; 0 кредитов — rose).)
>
> Предыдущее обновление: 2026-08-14 (**mobile chrome slots:** шапка — поиск слева \| логотип; таббар — Тренды / Каталог / Сгенерировать / Фото в промт / Войти·Профиль (`MobileProfileSheet`). Поиск из таббара снят.)
>
> Предыдущее обновление: 2026-08-14 (**guest profile sheet OAuth:** `SidebarAccountPanel` для гостя сразу показывает Google / Яндекс (`OAuthSignInButtons`, тот же SSOT что `AuthModal`); промежуточная кнопка «Войти» снята.)
>
> Предыдущее обновление: 2026-08-14 (**chrome reverse-scroll:** autohide как Ozon — накопленный сдвиг, hide ≥24px вниз, show ≥4px вверх / верх ленты; грид по-прежнему без setState на скролле.)
>
> Предыдущее обновление: 2026-08-14 (**listing chrome scale-fix:** hide-on-scroll пишет `.listing-chrome-hidden` на `.listing-shell-root` через ref + rAF, без `setState` в `PageLayout` (грид не ре-рендерится на каждый скролл). Отступ шапки — in-flow spacer в `#listing-scroll-root` (уходит со скроллом, без дыры и без смены padding mid-fling). Guest compose SSOT: `GenerateDockGuestAuthReactor` (`plateOpen && !authed` → auth; dismiss без логина закрывает plate). Мёртвые `registerMenu` / mobile catalog drawer сняты. Чип и profile sheet делят кэш `GET /api/me`.)
>
> Предыдущее обновление: 2026-08-14 (**mobile chrome как Дзен:** шапка — поиск | логотип | аккаунт (гость — иконка входа; юзер — аватар, при `credits > 0` ещё чип баланса). Клик по аккаунту открывает `MobileProfileSheet` с `SidebarAccountPanel` (баланс + Пополнить + меню). Поиск в шапке = таб «Поиск» (`useOpenMobileSearchEntry`: sheet или `/search`). Скролл вниз по `#listing-scroll-root` прячет шапку и таббар (`.listing-chrome-hidden`); вверх / верх ленты / шторки / generate dock / клавиатура — показывают. Гамбургер каталога из шапки снят.)
>
> Предыдущее обновление: 2026-08-14 (**mobile card prompt overlay:** нижний glass-бар — **«Промпт» + LexyGPT**; клик «Промпт» открывает полноэкранный экран с текстом, крестик справа сверху и «Скопировать промпт» внизу. Чип «Посмотреть промт» снят.)
>
> Предыдущее обновление: 2026-08-14 (**mobile search below midpoint:** Safari nudges a focused field in the lower half (~20–40px). Snapshot `#listing-scroll-root` scroll on touchstart, lock overflow, cancel `visualViewport.offsetTop` pan while focused. Keyboard still overlays; content does not move up.)
>
> Предыдущее обновление: 2026-08-14 (**mobile keyboard overlay, no content shift:** listing shell не сжимается под клавиатуру; таббар остаётся в подвале. Тап по полю в `#listing-scroll-root` — `focus({preventScroll:true})` + lock overflow (без translate/доскролла). Клавиатура оверлеем поверх chrome.)
>
> Предыдущее обновление: 2026-08-14 (**mobile tab bar vs keyboard:** listing shell больше не сжимается под `visualViewport` при клавиатуре (`interactive-widget=overlays-content`). `--ps-listing-shell-height` держит layout/`innerHeight` (клавиатура = оверлей); iOS `offsetTop`-pan компенсируется, инпут доскролливается внутри `#listing-scroll-root`. Таббар остаётся `absolute bottom` подвала, не всплывает над клавиатурой и не залипает до жеста.)
>
> Предыдущее обновление: 2026-08-14 (**Docker Alpine sharp:** `next build` падал на collect page data `/api/admin/generate` — `libvips-cpp.so.42` не найден. `landing/Dockerfile` ставит `libc6-compat` и после `npm ci` доустанавливает musl `sharp@0.33.5` (`--include=optional`); `next.config.ts` выносит `sharp` в `serverExternalPackages`.)
>
> Предыдущее обновление: 2026-08-14 (**mobile generate tab on `/generaciya-foto`:** таб «Сгенерировать» открывает/закрывает тот же dock, что и на листингах (`focusBlank`); больше не скроллит к `#generator`. SEO-страница не помечает таб активным сама по себе.)
>
> Предыдущее обновление: 2026-08-14 (**mobile generate dock portal:** `GenerateListingDockHost` на max-lg монтируется в `document.body` (`100dvh`), как `GenerateMobileModal` — шторки prompt/photos/model не сжимаются listing visualViewport/клавиатурой. Photo→prompt не autoFocus-ит textarea на мобиле.)
>
> Предыдущее обновление: 2026-08-14 (**`/generaciya-foto` photo→prompt:** стартер «По фото» повторяет `/foto-v-promt` — ephemeral file → `analyzeImageToPrompt` (`image_base64`) → `seedBlankPrompt` с готовым промтом в шторку `prompt`. Фото не пишется в `landing_user_photos` и не цепляется к генерации (`shouldAttachLibraryPhotos` false при `intent=photo_prompt`). Библиотека пользователя остаётся только generation-reference.)
>
> Предыдущее обновление: 2026-08-14 (**`/generaciya-foto` starter control:** две карточки входа «По описанию» / «По фото» + pill-CTA как у FAB, без градиентной оболочки и textarea. `seed.intent` (`resume` | `text` | `photo_prompt`) в `generate-dock-seed.ts` — SSOT шторки и last-completed hydrate. Analyze как на `/foto-v-promt` только при `intent=photo_prompt` и промте < 8 (`image-prompt-analyze-client.ts`, `image_base64`); не гейтить pathname / `generationSurface`. FAB `focusBlank` сбрасывает photo-сессию через `isResumeComposeSeed`.)
>
> Предыдущее обновление: 2026-08-14 (**photo-tab analyze:** вкладка «По фото» на `/generaciya-foto` вызывает тот же `getImagePromptAnalyzeUrl()`, что и `/foto-v-promt`. В `next dev` это `/api/imageprompt-proxy/extension/analyze` → `imageprompt.tools` (локальный Gemini proxy с localhost часто timeout 503); в prod — same-origin `/api/extension/analyze`.)
>
> Предыдущее обновление: 2026-08-14 (**`/generaciya-foto` examples:** блок «Выберите образ и повторите» ранжирует `resolve_route_cards` / `/api/listing` по `sort=new` (`created_at DESC`), не `popular`.)
>
> Предыдущее обновление: 2026-08-14 (**text-only RPC 183 применена:** `landing_enqueue_generation` принимает пустой `input_photo_paths`; запасной 409 `input_photos_required` снят с `POST /api/generate`.)
>
> Предыдущее обновление: 2026-08-14 (**text-only reliability:** `phase=generating` только после `202` + `id`; явный пустой `selectedPhotoIds` не перетирается автовыбором фото; `generationSurface` пишется в `generation.create` как воронка, не гейт. RPC **183** по-прежнему нужна на БД лендинга.)
>
> Предыдущее обновление: 2026-08-14 (**text-only enqueue:** миграция **183** убирает `input_photos_required` из `landing_enqueue_generation`; пустой `input_photo_paths` — валидный text-to-image. Hero `/generaciya-foto` auto-start больше не упирается в RPC.)
>
> Предыдущее обновление: 2026-08-14 (**`/generaciya-foto` hero auto-start:** «Создать изображение» / «Сгенерировать по этому промту» вызывает `seedBlankPrompt({ autoStart: true })`. Панель не восстанавливает last-completed поверх нового промпта и сразу enqueue text-only (без фото из библиотеки). Auth-гейт прежний: гость → auth modal, после входа панель стартует сама.)
>
> Предыдущее обновление: 2026-08-14 (**sticky percentage rollout снят:** генерация и `/pricing` доступны всем; feature-flag `prompt_card_generation` / `FeatureAccessProvider` / `/api/feature-access` удалены. Kill switch очереди — `GENERATION_QUEUE_ENABLED`. Internal email allowlist `isStvOpenGenerateDebugEnabled` сохранён для бесплатных кредитов. Таблицы `landing_feature_rollouts` и `landing_user_feature_assignments` не дропаем — unused leftover.)
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
- **Кнопка «Сгенерировать»:** на `/foto-v-promt` и `/analyses` — внутренний dock (`generate_shell_open`, `entry_source=foto_v_promt|analyses`). LexyGPT остаётся на листинге / `/p/[slug]`: **`lexygpt_generate_promptcard`**. Legacy **`lexygpt_generate_photovprompt`** / **`lexygpt_generate_tabbar`** / **`lexygpt_generate_click`** — deprecated.
- **Генерация на сайте (продуктовая воронка):** `prompt_card_generation_accepted`, `prompt_card_generation_no_credits`, `prompt_card_generation_pricing`. Без `feature_key` / `variant` / `bucket_band`.
- **Открытие generate shell:** `generate_shell_open` — только `entry_source` (`tab` \| `card` \| `route` \| `sidebar` \| `foto_v_promt` \| `analyses`).
- **Deprecated (не вызываются):** `prompt_card_generation_exposure`, `prompt_card_generation_auth` — leftover константы после снятия percentage rollout.
- **Баннер «Фото в промт»** (листинг): **`reachGoal('foto_v_promt_banner_click')`** (`ListingFotoVPromtBanner`, sticky над сеткой).
- **Баннер «Фото в промт»** отображается только на листингах. Варианты `card` / `cardImmersive` сняты с `/p/[slug]`; legacy-цель **`foto_v_promt_banner_click_card`** больше не вызывается из детальной карточки. ТЗ — **`docs/requirements/04-06-foto-v-promt-mini-banner.md`**.
- **CTA установки расширения**: сайдбар (**Инструменты**) вызывает **`reachGoal('desktop_sidebar_add_to_chrome_click')`**. Remix-hint на `/foto-v-promt?card=` использует **`reachGoal('foto_v_promt_add_to_chrome_click', { placement })`**. Плавающая кнопка на `/foto-v-promt` снята. UTM для GA4 Chrome Web Store: `utm_source=promptshot.ru`, `utm_medium=cpc`, `utm_campaign=foto_v_promt`, `utm_content` по placement (`desktop_sidebar` \| `foto_v_promt_remix_hint` \| `foto_v_promt_json_ld`).
- **Checkout YooKassa (воронка):** `yookassa_checkout_started`, `yookassa_checkout_redirect`, `yookassa_payment_succeeded` (return-poll, параметр `credits`). Не класть в автостратегию Директа.
- **Покупка для Директа:** `reachGoal('purchase')` + `dataLayer` ecommerce `purchase` на возврате (`order_id`, `price`, `plan_id`, `credits`). Серверный дубль — Measurement Protocol из `reconcileYooKassaPayment` (антидубль `yandex_conversion_sent_at`). Спека **`docs/17-08-yandex-direct-purchases.md`**.

---

## Структура маршрутов

```
/                       → Главная (категории + поиск)
/trends                 → SEO-hub «промты для трендовых фото» + глобальный фид по `created_at DESC` (`resolve_route_cards` без path-тегов, `p_sort=new`); тексты/FAQ/HowTo — **`trends-seo-copy.ts`**; popularLinks на существующие L1/L2 (др, семья, пары, чёрный фон, портрет, девушка); JSON-LD CollectionPage+HowTo+FAQPage; фильтры `audience|style|occasion|object` как на `[...slug]`; **без** переключателя Популярное/Новое (`CatalogWithFilters` `fixedSort="new"`); ISR `revalidate=3600`; index на чистом `/trends` (при query-фильтрах — noindex, canonical `/trends`); sitemap priority **0.85**. Legacy **`/new` → 301 `/trends`** (`next.config.ts`). **Не** плодить `/trends/*` subpages
/catalog                → Каталог и поиск: mobile — explorer (поиск + чипы + 16 промтов, без fade); desktop — категориальная сетка; шапка mobile — бургер категорий; noindex, revalidate=3600
/p/[slug]               → Карточка промта
/[...slug]              → Листинг по тегу (напр. /promty-dlya-foto-devushki, /stil/cherno-beloe)
/sobytiya/1-sentyabrya  → L1 кластера «Промты для фото» (не catch-all). Copy — **`seo-content.ts`** (`1_sentyabrya`). Explorer — **`CatalogExplorer`**. Стартовая masonry — **`search_cards_text("1 сентября")`**. Принимает `searchParams` (noindex при query-фильтрах). Чипы над сеткой — события своего кластера; под сеткой — стили. На `/stil/*` L1 — чип «1 сентября» → этот URL.
/search                 → Поиск (клиентский)
/generaciya-foto         → SEO/product page «генерация фото ИИ онлайн по описанию/промту»; copy SSOT **`generaciya-foto-seo-copy.ts`**; SSR hero = visible breadcrumb + H1 + intro (`#generator`) + `GeneraciyaFotoStarter` (карточки «По описанию» / «По фото», pill-CTA). «По описанию» пишет `seed.intent=text` и открывает шторку `prompt`. «По фото» = ephemeral analyze → `seedBlankPrompt(..., intent=photo_prompt)` **без** записи в `landing_user_photos`. Desktop FAB прячется, пока `#generaciya-foto-starter-cta` в зоне видимости (`heroCtaInView`); mobile — таб «Сгенерировать». Photo→prompt канон — `/foto-v-promt`. Last-completed hydrate только при `intent=resume` и без `lastDockResultDismissed` (`shouldHydrateLastDockResult`). `photo_prompt` compose не восстанавливает library photos (`shouldAttachLibraryPhotos`). Все surfaces выровнены единым wide-container contract. Ниже — searchable masonry examples (eyebrow «Библиотека образов», H2 «Выберите образ и повторите»), enabled model showcase и connected HowTo timeline. Initial examples сериализуются как compact `GenerationExampleCard`; клик по плитке открывает модалку карточки без hover-кнопки «Повторить». Model CTA пишет requested model в `GenerateDockContext`, поэтому lazy mount не теряет selection. Models анимируют один image layer с deferred frame switching и contextual `alt`. Explorer ищет через `/api/search`, быстрые фильтры используют `/api/listing` и остаются crawlable ссылками на L1 без JS. Reference photo optional для blank text-to-image. Canonical и JSON-LD WebApplication+BreadcrumbList+HowTo+FAQPage+ItemList всегда (без fake offers/ratings); `robots` index + `max-image-preview:large`; sitemap **0.9** и inbound SEO-links всегда. Sitemap endpoints fail-soft. Отдельные `/generaciya-foto/*` не создаются
/foto-v-promt           → «Фото в промт» — SEO-кластер image-to-prompt (ВЧ «фото в промт», СЧ «промт из фото», «промт по картинке»); тексты — **`foto-v-promt-copy.ts`**, ТЗ — **`docs/requirements/02-06-foto-v-promt-seo-copy.md`**. RU-маркетинг AI Image Describer в **`PageLayout`**; при входе **`useListingScrollOnRouteChange`** сбрасывает `#listing-scroll-root` (моб.) и stale sessionStorage — страница всегда с hero; **`metadata.robots` index**; sitemap **0.8**; JSON-LD **WebApplication** + **FAQPage**; H2 над виджетом; перелинковка с **`/`** («Фото в промт»). Плавающая кнопка «Установить расширение» снята. Установка расширения — сайдбар и remix-hint через **`getAiImageDescriberChromeUrl()`** (id `bebnhekhnoaacojmbjoajndkankmppoj`). **`ListingSearch`** без нижней панели поиска (как на `/` и `/p/`). CTA «Сгенерировать» → фирменный Generate Dock (`FotoVPromtGenerateButton` + `seedBlankPrompt`), не LexyGPT; страница в listing-path dock + `showFooterWithGenerateDock`. Live-виджет → **`getImagePromptAnalyzeUrl()`** (prod cross-origin, dev **`/api/imageprompt-proxy/`**); CORS на imageprompt. **Analyze:** landing всегда шлёт **`style: photoreal`**, **`locale: ru`** (описания секций на русском; заголовки Visual Hook / Scene / … и CRITICAL RULES — на EN/RU по backend), без pill-переключателя модели в UI. **Mobile modal:** на max-lg всегда immersive shell — soft `pushState` с таба **или** auto route при hard `/foto-v-promt` (главная, refresh, поиск); close soft → back, route → `/`; desktop SidebarNav / SSR — светлая SEO-страница (`variant="catalog"`). **Режим Prompt Remix (`?card=<slug>`):** при наличии query-параметра `card` **`PromptSceneLiteWidgetGate`** монтирует **`PromptRemixWidget`** (вместо обычного анализа фото): грузит промт через `GET /api/card/[slug]`, пользователь описывает изменения, результат — переписанный промт через `imageprompt.tools/api/extension/remix`. **Точка входа с `/p/[slug]` скрыта** (нет CTA и нет `FotoVPromtMiniBanner` на карточке); режим доступен только по прямому URL `/foto-v-promt?card=<slug>`. ТЗ — **`docs/requirements/02-07-prompt-remix.md`**.
/pricing                → Публичные тарифы. Hard page (refresh, прямой заход). In-app — клиентская модалка (`PricingModalContext` + `pushState /pricing`, как карточка `/p/[slug]`). Return YooKassa: origin listing + `?payment=` если checkout открыли с оверлея; иначе `/pricing?payment=`. `?test=true` читает клиент `PricingCards`. Пакеты: Проба, Старт, Про, Максимум; auth-only разовая оплата в RUB через hosted redirect YooKassa
/generate               → История генераций (`robots: noindex`). Composer = глобальный dock из `PageLayout`. Card «Повторить» → seed dock + закрытие карточки
/terms                  → Страница публичной оферты; ссылка на `/docs/offer.pdf`, если утверждённый файл присутствовал при сборке
/policy                 → Страница политики обработки данных; ссылка на `/docs/privacy.pdf`, если утверждённый файл присутствовал при сборке
/privacy                → Permanent redirect на `/policy`
/unsubscribe            → Публичная отписка от маркетинга (`?t=` HMAC). One-click POST — `/api/mail/unsubscribe`. noindex
/favorites              → Избранное (требует авторизации)
/generations            → Мои генерации (auth): канонический список `landing_generations` текущего shared DB user; UGC-карточка необязательна
/analyses               → Мои анализы (auth, noindex): свои строки `analyze_history` (`user_id` = JWT или shared db id); signed preview из private bucket; CTA копирует промт и открывает dock. Гостевые анализы (`user_id` null) не попадают. SQL `188`
/admin/analytics        → Закрытый analytics dashboard: пользователи/клиенты + live непотраченные кредиты; таблицы кредитов/топа/analyze свёрнуты до клика; admin generation modal; Supabase Auth + email allowlist `ANALYTICS_ADMIN_EMAILS`
/admin/analyze-history  → Закрытая история analyze/remix + все non-admin user generations; remix помечается бейджем и `change_request`; image job — бейдж `Gemini|xAI generate|edit`; private source previews выдаются signed, completed results публикуются идемпотентно
/admin/payments         → Закрытый cursor-реестр YooKassa/Robokassa: payer identity, RUB/status/test, credits/`credited_at`; кнопка «Скачать CSV» выгружает все строки текущих фильтров
/admin/finance          → Касса выгрузок: импорт ЮKassa/GCP, чистый доход; `?tab=finance` с аналитики редиректит сюда
/admin/seo              → Вотчлист топ-30 URL: фильтр дней, таблица + раскрытие запросов и график динамики
/admin/mail             → Три вкладки: «Каталог» (превью `renderMailTemplate` + правила `mail-catalog.ts`, без отправки), «Кампании» (dry-run → send) и «Статистика» (14 суток Moscow, sent/skip/fail по шаблону, сегодня ещё queued и остаток / 5000). Сегменты: `all_email`, `paid`, `exploring`, `paid_active`, `paid_quiet`, `empty`, `trial_only`. Тот же admin allowlist. Очередь outbox + due/квота внизу страницы не зависит от вкладки статистики
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
| **L (listing)** | `listing` | 512 × 58 | **`enrichCardsWithDetails`** — единый путь для карточек каталога: SSR `[...slug]`, `/api/listing`, `/api/search`, `/api/search-cards`, `/api/search-card` (в т.ч. избранное) | `CARD_IMAGE_LISTING_NEXT_QUALITY` (**45**) — `ListingPhotoTile`, превью в `SearchBar` |
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
| `/api/search` | Гибридный поиск: `search_cards_text` + optional Gemini Embedding 2 / `search_cards_visual`; `audience/style/occasion/object` применяются в RPC до rank/pagination (миграция `194`). Fallback на FTS. `Server-Timing`: `search-text`, `search-embed`, `search-vector`, `search-rank`, `search-enrich` |
| `/api/listing` | Листинг категории по тегам (`resolve_route_cards` RPC): `limit`, `offset`, `strict=1`, tag-фильтры, **`sort=popular\|new`** (default `new`; невалидный → **400**). Если есть **`q`** (≥2 символа, ≤160) — `searchListingCardsHybrid`: birthday SSOT → hybrid + result cache 1h + system budget; любой другой `q` → FTS-only. Peek `limit+1`, ответ `{ cards, total_count, ranked_batch_size, has_more, query, matchType }`. `limit` для `q` ≤ 99. |
| `/api/filter-counts` | Счётчики тегов для текущей выборки (`get_filter_counts` RPC) |
| `/api/card-view` | POST: инкремент `view_count` + событие в `prompt_card_view_events` по `slug` (beacon `/p/[slug]`, дедуп `sessionStorage`; RPC `increment_prompt_card_view`) |
| `/api/search-card` | Карточка по ID / prefix / batch |
| `/api/search-cards` | Фильтрованный поиск (`search_cards_filtered` RPC); query: `limit` (до 48), `offset`, `includeTotal=1` → `{ cards, total?, hasMore }` |
| `/api/datasets` | Список датасетов (debug) |
| `/api/set-before` | Before/after медиа |
| `/api/debug-delete-card` | POST (catalog admin): удаление строки `prompt_cards` (+ строки `slug_redirects` для slug карточки); body: `cardId`, `confirmSlug` (должен совпасть со slug в БД). После удаления — `revalidatePath('/sitemap.xml')` и `/p/[slug]`, чтобы URL сразу исчез из sitemap и кеша страницы (источник URL в sitemap — `getPublishedCardsForSitemap()`). Объекты в Storage не трогает |
| `/api/generation-config` | Конфиг генерации; `modality=image` (default) или `video`. Image: модели из `models` (Nano Banana / PRO / 2 / Lite + **Grok Imagine** `grok-imagine-image-2.0`, 10 кредитов), `cameraOrbitEnabled` из `camera_orbit_enabled` **или** allowlist. Video: модели из `video_models` (Grok 1.5 + Veo Omni Flash + Veo 3.1 Lite), `defaults.model` = `DEFAULT_VIDEO_MODEL` (`veo-3.1-lite-generate-preview`) через `resolveVideoModelId`, 9:16/16:9, 4/6/8/10 сек (Lite без 10), 720p, `enabled` из `video_animate_enabled` **или** allowlist (`azarov.maxim@gmail.com`). SSOT `lib/generation/image-options.ts` |
| `/api/generation-preferences` | GET/PUT (auth): SSOT последних compose-настроек JWT user — image model / aspect / size, video model / aspect / duration, owned photo IDs. PUT клампит stale model и отбрасывает чужие/удалённые photo IDs, не валит весь снимок. Клиент: `lib/generation-preferences.ts` + LWW `localStorage`. SQL `173` + `209`. |
| `/api/generation-prompt` | EN промпт карточки по cardId |
| `/api/prompt-remix` | POST (auth): принимает текущий editable `prompt + changeRequest` и optional owned completed `parentGenerationId`, возвращает только переписанный prompt без создания generation. SSOT `lib/prompt-remix.ts`. Structured analyze-промпт (Visual Hook…CRITICAL RULES) → Gemini JSON `edits[]` + детерминированный merge секций; иначе / retry → JSON `{prompt}`. Нормализованное эхо после 2 попыток → `422 unchanged_prompt` (история не пишется). Успех best-effort в `analyze_history` (`kind=remix`, `change_request`, итоговый `prompt`, `user_id` = shared `dbUserId`). Логи `[prompt.remix]`: `remixMode`, `appliedHeadings`, `unchanged_attempt`, полный source/change, Google candidates/usage. Модель `GEMINI_PROMPT_REMIX_MODEL` (default `gemini-2.5-flash`), `thinkingBudget=256`, JSON schema; `MAX_TOKENS` не принимается. Proxy: `photo_app_config.gemini_use_proxy` + `GEMINI_PROXY_BASE_URL` |
| `/api/upload-generation-photo` | Загрузка фото для генерации; `saveToLibrary=true` дополнительно регистрирует загрузку в `landing_user_photos` и возвращает объект `photo` с signed preview URL |
| `/api/upload-generation-photo/signed-url` | GET: подписанный URL превью загруженного фото (auth, path в query) |
| `/api/user-generation-photos` | GET (auth): библиотека inline-фото текущего JWT user, newest-first, с signed preview URL |
| `/api/user-generation-photos/[id]` | DELETE (auth): удаление принадлежащего пользователю фото из private Storage и библиотеки |
| `/api/generate/animate-scenario` | POST (auth): по выбору видео-модели в шторке «Модель генерации» или кнопке «Оживить» на готовом фото — `gemini-2.5-flash` смотрит owned image (parent generation XOR upload path), возвращает короткий RU-сценарий (1–2 предложения) **с этого кадра** (frame 0, без lead-in). Исходный image-промпт не подмешивается, а stash-ится и возвращается при выборе фото-модели. Не списывает кредиты. SSOT `lib/video-animate-scenario.ts` + `lib/compose-modality-prompt.ts`. Proxy как у remix. |
| `/api/generate` | Auth enqueue: image — **0–10** owned upload-фото без `editInstruction` (0 = text-only) или local edit (`parentGenerationId` + `editInstruction`). Camera orbit: `editKind=camera_orbit` + `cameraPose` + parent image; сервер резолвит `scene_root_id`, сериализует instruction, I2I с корня, кредиты = cost модели корня; флаг `camera_orbit_enabled`. `GET /api/generations/:id/camera-scene` — плёнка. Image-модель должна быть из enabled `models` (неизвестный id → 400, не `models[0]`; у orbit fallback на default). Grok Imagine: 10 кредитов, 4K clamp в 2K. Video — `modality=video`, ровно одно фото **или** owned completed image parent, без edit; 4/6/8/10 сек / 720p / модель из `video_models` (дефолт Grok 1.5, Lite max 8 сек); кредиты = база + доплата за длительность; `create_ugc=false`. Fingerprint включает modality, duration и для orbit — pose/root. RPC `landing_enqueue_generation` (миграции **189**, **200**, **201**, **202**, **204**, **207**, **212**); ответ `202 { id, status: pending }` |
| `/api/generate-process` | Tombstone `410`: обработка перенесена в отдельный `web-generation-worker` |
| `/api/analyses` | GET, auth: cursor-список своих `analyze_history` (`user_id` in auth/shared db id), signed image URL, no-store |
| `/api/generations` | Auth-список строк `landing_generations` текущего shared DB user для `/generations`; batch lookup связанных `prompt_cards` → `cardId/cardSlug/isPublished`; private no-store. **DELETE** `{ ids: uuid[] }` (≤50) — bulk hard-delete owned rows; result object удаляется только если не используется `prompt_card_media` |
| `/api/generations/[id]` | GET: статус/результат генерации. **DELETE**: hard-delete owned row; `409 generation_in_use`, если result нужен active child; object сохраняется при ссылке из `prompt_card_media` (UGC `prompt_cards` не удаляется) |
| `/api/generations/[id]/ensure-card` | POST (auth owner): идемпотентно возвращает или создаёт draft `prompt_cards` для completed result; восстанавливает best-effort сбой worker |
| `/api/generations/[id]/publish` | POST (auth owner): ensure draft → общий SEO publish service → `is_published=true`; идемпотентный success для уже опубликованной карточки |
| `/api/generations/[id]/save-to-library` | POST (auth): completed **image** result → JPEG в `web-generation-uploads` + insert `landing_user_photos`; video отвечает `400 video_not_supported` |
| `/api/my-prompt-cards` | GET (auth): карточки `prompt_cards` с `author_user_id = auth.users.id` текущей JWT-сессии, включая черновики (`is_published=false`) |
| `/api/my-cards/[slug]/visibility` | PATCH (auth): `{ published: boolean }` — владелец переключает видимость; при `published: true` — LLM/regex тегирование (`landing/src/lib/seo-tags-classify.ts`), затем `revalidatePath` |
| `/api/me` | Текущий пользователь + credits + живой грант `{ offer: { percent, expiresAt } \| null }`. Гость — полная цена, `offer: null`. Шапка читает баланс; `PricingCards` рисует зачёркнутый каталог |
| `/api/buy-credits-link` | Deep link в Telegram-бота для покупки web-кредитов |
| `/api/payments/yookassa/create` | POST (auth): сначала `reconcileOpenYooKassaPaymentsForAuthUser`; если тот же `plan_id` только что credited — `{ alreadyCredited: true }` без нового redirect; иначе plan lookup → локальная операция → `POST /v3/payments` с `capture=true`, `confirmation=redirect`; update ledger только из `created|pending`; при ошибке update — 502 без fake success |
| `/api/payments/yookassa/open-reconcile` | POST (auth, не anonymous): сверка своих `created|pending` с `yookassa_payment_id` (limit 5, cooldown 15 с). Prefetch-safe (не GET). Ошибка ЮKassa → 200 `{ credited: [] }` |
| `/api/payments/yookassa/[id]` | GET (auth owner): статус операции; best-effort reconcile для `created|pending|canceled` без `credited_at` |
| `/api/payments/yookassa/webhook` | POST public callback: принимает `payment.succeeded` / `payment.canceled`, перечитывает объект через YooKassa API и идемпотентно обновляет ledger/баланс |
| `/api/cron/yookassa-reconcile` | POST, `Authorization: Bearer $CRON_SECRET`: batch `reconcileStaleYooKassaPayments` для `created|pending` старше 1 мин (limit 20), затем `flushUnsentYandexPurchaseConversions` |
| `/api/cron/visual-embeddings` | POST, `Authorization: Bearer $CRON_SECRET`: enqueue missing canonical-photo embeddings + claim/lease Gemini Embedding 2 batch |
| `/api/cron/mail-outbox` | POST, `Authorization: Bearer $CRON_SECRET`: claim/lease `landing_mail_outbox` → Postbox SESv2 (1 To / call, ≥1.1s gap, circuit 3/60s). Claim: transactional → lifecycle marketing → campaign. Без ключей — `{ configured: false }` |
| `/api/cron/mail-due` | POST, `Authorization: Bearer $CRON_SECRET`: claim `landing_mail_due` (один user / тик) → `evaluateMailDue` → грант при % → `landing_enqueue_mail`. Generate SMTP не ждёт |
| `/api/admin/mail/catalog` | GET, admin: превью всех писем из `mail-catalog.ts` |
| `/api/admin/mail/stats` | GET, admin, no-store: дневные агрегаты outbox за `days=1…30` (default 14). RPC `landing_mail_admin_daily_stats` + `landing_mail_daily_budget` для сегодняшнего queued/remaining. Без PII |
| `/api/mail/postbox-events` | POST, `POSTBOX_WEBHOOK_SECRET`: hard bounce / complaint → `landing_mail_suppress`. Transient bounce игнорируется |
| `/api/mail/unsubscribe` | POST one-click (`List-Unsubscribe=One-Click` или `t=`): `landing_mail_unsubscribe` |
| `/api/admin/mail/campaigns` | GET/POST, admin auth: список кампаний + stats; `action=preview` (dry-run, 5 адресов) затем `action=send` |
| `/api/extension/analyze` | Same-origin analyze для site `/foto-v-promt` и «По фото»: validation/SSRF → identity (anonymous/STV-guest = гость) → RPC `analyze_quota_reserve` (free / 401 auth_required / 402 no_credits / paid hold 1 кредит) → Gemini → confirm или release+refund; fail-closed 503 если квота недоступна; успех пишет `analyze_history.credits_spent` |
| `/api/scout/analyze` | Открытый analyze для бота: без auth, бакет `scout:v1`, 100 успешных / UTC-день, без кредитов пользователя. GET — остаток. `client_source=scout`. Не в sitemap |
| `/api/extension/analyze/quota` | GET, cookie session, no-store: `remaining_free`, `next_mode`, `credit_cost`, реальный `credits` для авторизованного |
| `/api/admin/analytics` | GET, admin auth: no-store analytics rollups за `1…90` дней; топ пользователей — `admin_analytics_top_users` за тот же период |
| `/api/admin/credits` | GET, admin auth: live остаток + daily flow (`days=1\|7\|30\|90`) + keyset-список (`q`, remaining/granted/spent/share) |
| `/api/admin/finance` | GET, admin auth: KPI и разбивки импортов ЮKassa/GCP за месяц `YYYY-MM` |
| `/api/admin/seo-watchlist` | GET, admin auth: снимок топ-30 URL + запросы/дни из `seo-watchlist-snapshot.json` |
| `/api/admin/finance/import` | POST, admin auth: multipart replace-импорт `kind=revenue\|cogs`, CSV/ZIP до 10 MB |
| `/api/admin/payments` | GET, admin auth: cursor YooKassa/Robokassa ledger с status/test/source/campaign filters, payer identity и credit state (`credited` / `not_due` / `discrepancy` / `stale`); `format=csv` — полная выгрузка тех же фильтров (до 10 000 строк, `;` + UTF-8 BOM) |
| `/api/admin/payments/reconcile` | POST, admin auth: `{ paymentId \| yookassaPaymentId }` или `{ stale: true }` — ручной/batch reconcile через YooKassa GET |
| `/api/admin/analyze-history` | GET, admin auth: cursor pagination private analyze/remix history (`kind`, `change_request`, `user_email` если был `user_id`), optional `client_source`, signed image URL (analyze only) |
| `/api/admin/analyze-history/[id]/publish` | POST, admin auth: private analyze image → public result object → idempotent `prompt_cards` draft → общий SEO publish service |
| `/api/admin/user-generations` | GET, admin auth: cursor всех `client_source != admin` generation statuses, identity, live `creditsRemaining` из `landing_users.credits`, `providerImageMode` (`gemini|xai` × `generate|edit`), public result и 15-минутные signed source previews |
| `/api/admin/user-generations/[id]/publish` | POST, admin auth: completed non-admin generation → idempotent UGC draft исходного `requester_auth_user_id` → общий SEO publish service |
| `/api/admin/generation-photo` | GET/POST, admin auth: чтение signed URL или замена закреплённого reference photo для admin generation |
| `/api/admin/generate` | POST, admin auth: idempotent enqueue `1…4` jobs в durable `landing_enqueue_generation`, `client_source=admin`, без списания кредитов |
| `/api/admin/generations` | GET, admin auth: cursor-paginated durable generation queue (`unpublished` / `published` / `all`) |
| `/api/admin/generations/[id]` | GET, admin auth: no-store polling статуса/result/error только для `client_source=admin` |
| `/api/admin/generations/[id]/publish` | POST, admin auth: completed generation → idempotent `prompt_cards` draft → общий SEO publish service |
| `/api/imageprompt-proxy/extension/analyze` | Dev-only same-origin прокси к `imageprompt.tools/api/extension/analyze`. `getImagePromptAnalyzeUrl()` в `next dev` ведёт сюда (`/foto-v-promt` и стартер «По фото» на `/generaciya-foto`); prod — `/api/extension/analyze`. |
| `/api/imageprompt-proxy/extension/remix` | Dev-only same-origin прокси к `imageprompt.tools/api/extension/remix`; prod remix — прямой cross-origin через `getPromptRemixUrl()`. Сам remix реализован в проекте **imageprompt.tools**; см. `docs/requirements/02-07-prompt-remix.md` |
| `/api/vibe/extract` | Извлечение style JSON из URL изображения (auth) |
| `/api/vibe/expand` | Один rich prompt из style JSON (auth) |
| `/api/vibe/assemble-prompt` | Legacy-only: **409** для всех вибров (grooming assemble отключён; см. ответ `assemble_not_applicable_legacy` / `vibe_not_legacy`) |
| `/api/vibe/save` | Сохранение выбранной vibe-генерации (auth) |

### Модуль генерации (карточка → inline / STV)

- **Allowlist:** `isInternalGenerateAllowlistedEmail` (`landing/src/lib/internal-generate-allowlist.ts`) — default `azarov.maxim@gmail.com`, расширяется через `INTERNAL_GENERATE_ALLOWLIST`.
- **Точка входа карточки `/p`:** treatment — `CardPageClient` → `onInternalGenerate` → `GenerateDock.seedFromCard` + close card (`PromptCardModal.close` / `router.back`). Control — LexyGPT.
- **Глобальный generate-dock:** `GenerateDockContext` + `GenerateListingDockHost` в `PageLayout` (allowlist листингов, treatment). Composer = `CardInlineGeneratePanel chrome=dock`. Expand surfaces (`prompt|photos|model`) растягивают плашку. После `phase=done` `resultUrl` — фон **внутри** пластины (clip + radius) через `GenerationResultBackdrop`: follow-up gen держит предыдущий кадр в CSS-pixelate, по completed — preload + clip-path reveal нового (reduced-motion: blur + opacity). `needsCredits` / `credits===0` → soft-rose CTA на FAB, mobile tab и footer compose («Недостаточно кредитов») → pricing overlay, без error-баннера. Mobile tab open → fullscreen `inset-0 z-[122]` поверх tab/nav; desktop: старт gen → collapse + FAB progress, `done` → reopen (+ reveal). Повторное открытие blank-dock восстанавливает последний completed + prefs **только если** `intent=resume` и пользователь не сбросил result («Повторить» / delete / result X → `lastDockResultDismissed`). Tab → `focusBlank`. Guest tab/FAB → auth (без `plateOpen`). Guest `seedFromCard` / любой `plateOpen` без сессии → `GenerateDockGuestAuthReactor` (auth; dismiss без логина закрывает plate). Sidebar indigo CTA на `/generate` убран.
- **Inline photo library:** `CardInlineGeneratePanel` при открытии параллельно читает `GET /api/user-generation-photos` и `GET /api/generation-preferences`, показывает persistent-карусель квадратных preview по `created_at DESC` и восстанавливает **все** доступные выбранные photo IDs (не одно первое). Если prefs-строки ещё нет — самое свежее фото; явный `[]` остаётся text-only; если все сохранённые id удалены — снова самое свежее. Карусель доступна поверх result backdrop. Плитка «Добавить» всегда первая; новые файлы → `POST /api/upload-generation-photo` `saveToLibrary=true` на флаге `libraryUploading` (не `phase=uploading`); **0–10** фото. Удаление — `DELETE /api/user-generation-photos/[id]`. Overlay шторки/desktop scrim закрывается по `pointerdown`.
- **Inline generation preferences:** SSOT = `landing_generation_preferences` (image model / aspect / size, video model / aspect / duration, photo IDs) + write-through `localStorage` (`promptshot:generation-prefs:v1:<authUserId>`, LWW по `updatedAt`). Hydrate: `resolveComposerPreferences`. Persist только после реального изменения (dirty); гидрация не пишет дефолты. Debounce 300ms + flush на выход из шторки фото·модель и unmount. Нельзя auto-switch модель из-за кредитов. Last-completed restore подставляет только result/prompt. Default без строки: Nano Banana + `9:16` + самое свежее фото; video default Veo 3.1 Lite.
- **Inline compose UI:** исходный `promptText` карточки инициализирует локальный draft. Одна iOS-style prompt-шторка показывает два блока: flex-height editable `Текущий промпт` и compact `Что изменить?`. CTA шторки всегда `Применить и сгенерировать`: remix, затем сразу `POST /api/generate`. Без completed result — обычный enqueue с выбранными фото; после result — continuation с `parentGenerationId`. После completion действия `Посмотреть` / `Скачать` / `Повторить` / `Оживить` / `Камера` / `Что изменить` — правый нижний rail на кадре (`GenerationResultActionRail`), все одного размера. «Камера» (флаг `camera_orbit_enabled` / allowlist) между «Оживить» и «Что изменить»: оверлей с тем же rail, шаг 30°, CTA «Снять кадр · N», «Выйти» на исходник. «Оживить» сразу над «Камера» / «Что изменить». Кадр без scrim-градиента. `Повторить` сбрасывает в idle compose (очищает result, сохраняет prompt/model/photos) и ставит `lastDockResultDismissed` в контексте — следующее открытие dock не поднимает старый result. Новая генерация — снова через `Сгенерировать`; её completed снимает dismiss. `Что изменить` — remix editor + `Применить и сгенерировать` (parent-result edit). Controls `Ваши фото` / `Модель` используют текущий draft без мутации `prompt_cards`. Видео-модели живут в той же шторке модели (бейдж «Видео»); выбор видео-модели пишет сценарий в draft и stash-ит фото-промпт, выбор фото-модели возвращает stash. Отдельной compose-плитки видео нет.
- **Inline engine:** `POST /api/prompt-remix { prompt: draft, changeRequest, parentGenerationId? }` → новый prompt → сразу `POST /api/generate`. Без parent — draft + выбранные `storagePath[]`. С completed parent — `parentGenerationId` + `editInstruction`; worker использует parent result object. Enqueue сохраняет фактически отправленный текст в `landing_generations.prompt_text`, клиент синхронизирует `draftPrompt/submittedPrompt`. Result menu переиспользует `GenerationCardMenu` без bulk-select: share/download/copy, `save-to-library`, `publish`, `DELETE`.
- **`LexyGptGenerateButton`:** internal path (inline override или STV drawer по `cardId`) только для allowlisted; иначе всегда LexyGPT. CTA `/foto-v-promt` / remix / `/analyses` → `FotoVPromtGenerateButton` → `seedBlankPrompt`, не LexyGPT.
- **OAuth resume dock:** guest `seedBlankPrompt` / `seedFromCard` пишет `sessionStorage` `promptshot:pending-generate-dock`; после возврата `GenerateDockProvider` consume-once открывает plate с тем же seed. Dismiss auth чистит pending. Виджет `/foto-v-promt` дополнительно держит `promptshot:foto-v-promt-result` (промт + data-URL preview с лимитом размера).
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
  `/admin/payments`, `/admin/finance`, `/admin/seo`, `/admin/mail` и каждый
  `/api/admin/*` проверяют Supabase Auth session, затем нормализованный email против
  `ANALYTICS_ADMIN_EMAILS`. Пустой allowlist означает fail-closed; service-role key
  остаётся только на сервере.
- **Analyze site flow:** `/foto-v-promt` и стартер «По фото» на `/generaciya-foto`
  вызывают `getImagePromptAnalyzeUrl()`: в prod — same-origin
  `POST /api/extension/analyze`, в `next dev` — `/api/imageprompt-proxy/extension/analyze`
  → `imageprompt.tools` (локальный Gemini proxy с dev-машины часто timeout).
  Стартер шлёт только `image_base64` (`image-prompt-analyze-client.ts`) с локального
  файла и **не** сохраняет его в `landing_user_photos`; виджет `/foto-v-promt` по-прежнему умеет `image_url`.
  Готовый промт уходит в dock через `seedBlankPrompt(..., intent=photo_prompt)` —
  text-only генерация, library photos не аттачатся (`shouldAttachLibraryPhotos`).
  До Gemini local route валидирует единственный image input,
  MIME/size и URL redirects против private/link-local/metadata адресов. Для
  authenticated request `auth.users.id` резолвится в shared
  `imageprompt_users.id`; anonymous request использует daily salted IP hash.
  **`client_source` analyze/remix:** `resolveClientSource` режет promptshot.ru
  по странице вызова (`foto_v_promt` / `generaciya_foto` / `admin` / fallback
  `promptshot`). Виджет и `analyzeImageToPrompt` шлют `x-client` из
  `window.location.pathname` (не Next pathname: mobile soft-modal делает
  `pushState` на `/foto-v-promt`). С веба принимаются только page-бакеты;
  иначе сервер мапит `Referer`. Исторические строки остаются `promptshot`.
  Paid generate по-прежнему пишет `site`, admin enqueue — `admin`.
- **Квота:** 10 успешных анализов в UTC-сутки на идентичность (гость = IP-hash,
  юзер = `user:{landing/shared id}` после merge IP→user). Сверх 10 —
  1 кредит с `landing_users.credits`, только у real session (не anonymous /
  не STV-guest). Гость после 10 получает `401 auth_required` и AuthModal
  PromptShot (не imageprompt.tools). Юзер с нулём токенов — `402 no_credits`
  и pricing overlay. RPC `analyze_quota_reserve` атомарно держит free-слот
  или списывает кредит до Gemini; success → `confirm`, fail → `release` +
  идемпотентный refund. Ошибка RPC/identity → `503 quota_unavailable`, Gemini
  не вызывается (fail-closed). Конфиг: `aiid_app_config.analyze_free_per_day`
  / `analyze_credit_cost`. Старый `extension_rate_limit_per_day` (=30) для
  этого эндпоинта больше не max. GET `/api/extension/analyze/quota` отдаёт
  остаток до загрузки. Extension Lite / imageprompt.tools — follow-up.
- **История:** успешный analyze best-effort сохраняет уменьшенный JPEG и prompt
  в private bucket/table `analyze-history` / `analyze_history` (`kind=analyze`,
  `credits_spent` 0|1, `quota_mode` free|paid). Admin-список показывает бейдж
  токена для paid.
  Успешный site `POST /api/prompt-remix` пишет туда же `kind=remix` + `change_request`
  (без image). Admin UI показывает бейдж Remix и текст «Что изменить?».
  Signed previews выдаются только admin API; retention — 30 дней с opportunistic cleanup.
- **Admin generation:** `/api/admin/generate` резолвит отдельно requester
  `auth.users.id` и shared `imageprompt_users.id`, ставит `client_source='admin'` job
  через существующий `landing_enqueue_generation`. Job обрабатывает тот же durable
  `web-generation-worker`; admin UI только enqueue-ит и poll-ит status.
- **Оплаты:** `/admin/payments` читает объединённый ledger через
  service-role RPC `admin_landing_payments` (YooKassa + Robokassa). Keyset cursor использует
  `(created_at,id)`; identity собирается одним SQL-read model из `auth.users`,
  `landing_users` и shared `imageprompt_users`. Credit state: `credited`,
  `discrepancy` (`succeeded` без `credited_at`), `stale` (`created|pending` старше
  15 мин без начисления), иначе `not_due`. Ручная сверка —
  `POST /api/admin/payments/reconcile`. CSV: `GET /api/admin/payments?format=csv`
  с теми же фильтрами, серверная keyset-пагинация до 10 000 строк.
- **Почта:** Yandex Cloud Postbox (SESv2, `ru-central1`, без proxy). События
  пишут `landing_mail_due` (`sql/206`); `POST /api/cron/mail-due` оценивает
  одного user через `mail-catalog.ts` и ставит `landing_enqueue_mail`.
  Send — `POST /api/cron/mail-outbox`. Welcome — `welcome:{shared_user_id}`
  и due onboard +1/+3/+7d. Токены —
  `{yookassa\|robokassa}_credited:{payment_id}`. ЮKassa insert → abandon
  40m/24h на `payment_id`. 402 generate/analyze → `landing_mail_credit_blocks`
  + `no_credits` +2ч. Грант: один живой `landing_pricing_offers`; create
  ЮKassa/Robokassa делает `landing_apply_checkout_offer` (цена серверная);
  `credited_at` ставит `consumed_at`. Кампании: dry-run на `/admin/mail`,
  fan-out `campaign:{id}:{email}`; enqueue стоп, если остаток квоты меньше
  сегмента или после send tx-резерв < 500. Email =
  `COALESCE(auth.users.email, imageprompt_users.email)`, internal
  `@promptshot.internal` skip. Маркетинг требует `List-Unsubscribe`.
  Квота Postbox **5000 / 24 ч**, 1 rps. Дневная статистика админки —
  `GET /api/admin/mail/stats` / RPC `landing_mail_admin_daily_stats` (`sql/210`):
  только outbox, due не сканируется; today.sent = `landing_mail_daily_budget().sent`.
  Спека `docs/22-08-lifecycle-mail.md`, UI-статы `docs/22-08-mail-admin-daily-stats.md`.
  Транспорт: `docs/21-08-yandex-postbox-mail.md`.
- **Финансы (касса выгрузок):** страница `/admin/finance` хранит
  месячные импорты в `admin_finance_imports` + line tables. Source of truth для
  «получено» — реестр ЮKassa (gross/net/комиссия), для «потрачено» — GCP
  `Subtotal ($)` × статический курс **$1 = 90 ₽**. Чистый доход =
  gross − комиссия/НДС ЮKassa − **УСН 6% с выручки (gross)** − Gemini RUB.
  Дневной график: выручка, косты (комиссия + налог + Gemini), прибыль;
  пунктир — live оценка обязательств: `credits_total × 0,5 ₽`
  (1 генерация = 5 кредитов = 2,5 ₽). RPC `admin_credit_liability_summary`
  даёт только остаток кредитов; blended ЮKassa в оценку не входит.
  Отдельный график — затраты Gemini по семействам моделей по дням.
  Повторный upload заменяет месяц через `admin_finance_replace_import`. Live
  остаток кредитов на Обзоре — график по `admin_credit_daily_flow` (реконструкция
  от текущего `landing_users.credits`) и разбивка `admin_credit_liabilities`
  за тот же период, что фильтр Сегодня/7/30/90: в списке те, кто начислял
  или тратил, колонка «Осталось» — live. Telegram Stars в кассе v1 нет; в
  динамике кредитов Stars `state=done` учитываются.
- **Генерации пользователей:** `admin_user_generations_queue` возвращает все
  `client_source IS DISTINCT FROM 'admin'` и terminal/non-terminal statuses.
  Private input paths не отдаются клиенту: API проверяет path, batch-подписывает до
  четырёх preview на 15 минут и возвращает только URL. Для строк страницы API
  batch-читает live `landing_users.credits` и отдаёт `creditsRemaining` (остаток
  пользователя сейчас, не баланс на момент job). Публикация доступна лишь для
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
  → identity + analyze_quota_reserve (free | auth_required | no_credits | paid)
  → Gemini
  ├─ success → confirm → analytics → private analyze_history (credits_spent)
  └─ failure → release (+ refund if paid) → outcome analytics

admin pages
  → Supabase Auth + ANALYTICS_ADMIN_EMAILS
  ├─ analytics/history → server-only reads + signed previews
  ├─ finance → CSV/ZIP import → admin_finance_replace_import
  │                         live credits → admin_credit_liabilities
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

- **Flow после `POST /api/generate`:** API через один SECURITY DEFINER RPC проверяет `Idempotency-Key`, списывает кредиты и создаёт `pending`; отдельный `web-generation-worker` poll-ит очередь, атомарно claim-ит batch (image и video отдельно), вызывает image-провайдер (Gemini `generateContent` или Grok Imagine `images/generations|edits`) или video-адаптер (Grok xAI / Omni Flash Interactions / Veo 3.1 Lite LRO) и сохраняет результат. HTTP self-fetch отсутствует.
- **Image provider route:** `job.model` → Grok (`grok-imagine-image*`) или Gemini. Grok: `web-generation-worker/src/xai-image.ts`, те же `XAI_API_KEY` / `XAI_BASE_URL` что у video, sync `POST /v1/images/generations` (text-only) или `/v1/images/edits` (до 3 data-URI), `quality=medium`, `response_format=b64_json`, resolution `1k|2k` (4K → 2K). Промпт — `assembleGrokImage*` без Gemini-тегов. Пустой `XAI_BASE_URL` → `config_error`, без fallback на `api.x.ai`.
- **Image fallback:** любая ошибка Gemini на image-job (включая `IMAGE_OTHER` и safety) на не-Grok модели → тот же attempt один раз зовёт Grok. Skip только `shutdown`. `fallback_used` + `requested_model` persist, следующие retry сразу в Grok. Кредиты не пересчитываются. In-process circuit: 50% ошибок из ≥8 за последние 20 / cooldown 60 с — фолбек skip, прямой выбор Grok жив. Kill-switch: `landing_generation_config.image_fallback_model` пустой или `enabled:false` у Grok.
- **Claim / backpressure:** миграция `sql/170_landing_generation_queue.sql` + `189` (`p_modality`); image и video claim-ятся отдельно. Image: concurrency 10, global 50, per-user 3, lease 180s. Video: concurrency 2, global 8, per-user 1, lease 600s. Video submit пишет `provider_operation_id` до poll (resume без повторной оплаты).
- **Lease / recovery:** lease 180 секунд, heartbeat 30 секунд, reaper 30 секунд. Потерянная job возвращается в `pending`, после `max_attempts=3` становится `failed`.
- **Fencing:** каждый claim получает новый `lease_token`; heartbeat/retry/complete/fail требуют точного `worker_id + lease_token`. Result path immutable (`user/job/lease.{jpg|png}`), поэтому stale attempt не перезаписывает результат новой попытки.
- **Retry:** 429, 5xx, network/timeout и временный Storage upload/reference download → 30/90 секунд с jitter; safety/config/input errors завершаются без retry. Refund выполняется только при terminal failure и защищён `credits_refunded`.
- **Requester vs billing:** `requester_auth_user_id` определяет API/RLS access, idempotency, per-user cap и `prompt_cards.author_user_id`; `user_id` остаётся владельцем кредитов/shared DB. Для guest `create_ugc=false`, поэтому общий billing-owner не получает чужие UGC-карточки. Legacy fallback действует только для доступа к старым платным generation-строкам без requester, но не для создания новой UGC-карточки.
- **Идемпотентность:** уникальный `(requester_auth_user_id, idempotency_key)` + `request_fingerprint` возвращает исходный generation id без повторного списания и даёт 409 при повторном ключе с другим payload.
- **Эксплуатация:** `/health/live`, `/health/ready`, `/metrics` отдают `workerId` и local in-flight (`inFlight`, `inFlightImage`, `inFlightVideo`); JSON-логи всегда содержат `workerId` плюс generation/trace/attempt/duration/error. N одинаковых реплик безопасны. Kill switches: `GENERATION_QUEUE_ENABLED` на Landing и `WORKER_PROCESSING_ENABLED` на worker.
- **Атрибуция клиента (`client_source`):** при create всегда пишется **`site`** (PromptShot paid generate — site-only; без резолвера / `X-Client`). Миграция: `sql/168_landing_generations_client_source.sql`.
- **Текст в Gemini (без `vibe_id`):** если есть входные фото — worker склеивает **`prompt_text`** + **`GENERATE_LANDING_CARD_CRITICAL_RULES`** (`assembleLandingCardFinalPrompt`) — идентичность с фото, **гардероб по тексту промпта**. Если фото нет (`sourceType=text_only`) — **`assembleTextToImageFinalPrompt`** без identity-preservation. Pure source of truth: `landing/src/lib/image-generation-prompt.ts`, он же компилируется в worker.
- **Gemini routing:** worker читает `photo_app_config.gemini_use_proxy`; при `true` использует `GEMINI_PROXY_BASE_URL`, при `false` ходит напрямую в `generativelanguage.googleapis.com`.
- **Video provider route:** `job.model` → Grok (`grok-imagine-*`), Veo Lite (`veo-3.1-lite*`) или Gemini Omni. Перед submit worker cover-crop'аит исходное фото под `job.aspect_ratio` (9:16/16:9, `video-source-frame.ts`) — Grok получает signed URL обрезанного JPEG, Veo/Omni — inline base64. Grok: `web-generation-worker/src/xai-video.ts`, `XAI_BASE_URL={GEMINI_PROXY_ORIGIN}/u/api.x.ai` (тот же DO-vhost, не `GEMINI_PROXY_BASE_URL`, без fallback на `api.x.ai`), signed URL кадра 15 мин, `assembleGrokVideoMotionPrompt` без Gemini-тегов. Veo Lite: `web-generation-worker/src/veo-video.ts`, `POST /v1beta/models/{id}:predictLongRunning` через `GEMINI_PROXY_BASE_URL`, poll operation, `personGeneration=allow_adult`, длительность 4/6/8, 720p, `assembleVeoVideoMotionPrompt`. Omni: SSOT `video-interaction.ts` → `buildVideoInteractionRequest`. Официальный unary: `background=false`, `store=false`, `stream=false`. `video_config` только `{ task: "image_to_video" }`; `aspect_ratio` и `duration` (`4s`–`10s`) в `response_format`. Gemini на этом task принимает **ровно одно** изображение — второе даёт `invalid_request`. Текст Omni — `assembleVideoMotionPrompt`: `[# Sources @Image1]` + identity lock. Submit логирует `provider`, `proxyHost` (xAI) или `httpStatus`/`imageBytes` (Gemini/Veo). Источник кадра: `video_input_resolved`. `user_photos` = аплоад; копия из «Использовать» поднимается в generation result как единственный кадр. `generation_result` = готовое фото.
- **Таблицы:** `landing_users.credits`, `landing_generations` (+ `client_source`), `landing_generation_config`, `landing_user_photos` (server-only индекс private uploads по `auth_user_id`, newest-first).
- **Storage:** `web-generation-uploads` (входные фото; inline-библиотека хранит ссылки, удаление синхронно удаляет объект), `web-generation-results` (результаты: новые — JPEG q=85 после Gemini, без смены пиксельного размера; legacy PNG остаются по `result_storage_path`).
- **Страница:** `/generations` — «Мои генерации» в меню пользователя; source of truth — auth API `/api/generations` и строки `landing_generations` по shared DB user. UI — тот же photo-listing chrome, что каталог (`ListingGrid` + `GenerationHistoryCard` 3:4 `object-cover`); статусы `pending` / `processing` / `failed` как плейсхолдер в том же фрейме. Completed **фото и видео** кликабельны одинаково: `seedCompletedResult` (`intent=result`) открывает generate-dock с тем же result chrome, что после генерации (кадр + rail действий). «Оживить» только на фото. Карточка `/p/[slug]` с клика не открывается. На готовом фото, если `video_animate_enabled`, поверх кадра glass-кнопка «Оживить» → `seedAnimate` в generate-dock. Overflow-меню: выбрать (bulk delete), поделиться, скачать, скопировать промпт, использовать (в библиотеку для генерации), опубликовать, удалить — без «Оживить». Ответ списка не кешируется.
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

### Покупка токенов через Robokassa / YooKassa (`/pricing`)

- **Feature flag:** серверный `PAYMENT_PROVIDER=yookassa|robokassa`, default `yookassa`. При default YooKassa опциональный `ROBOKASSA_CANARY_EMAILS` переводит только перечисленные authenticated email на Robokassa для боевого canary. `POST /api/payments/create` сам выбирает адаптер и возвращает дискриминированный provider-response; клиент не может выбрать или обойти активного провайдера. Прямые provider create routes повторно проверяют provider + canary после auth.
- **Robokassa UX:** официальный `robokassa_iframe.js` загружается один раз по требованию; `Robokassa.Render` получает подписанный сервером payload и `Settings={Mode:'modal'}`. `PaymentMethods` намеренно не ограничен: iframe показывает все способы, доступные магазину Robokassa. Backend передаёт `Email` из подтверждённой auth-сессии, поэтому адрес для чека уже заполнен; невалидный/отсутствующий email не отправляется. Платёжная форма открывается поверх PromptShot, `window.location.assign` не вызывается. `SuccessURL`/`FailURL` ведут на компактные `/payment/robokassa/*` внутри iframe.
- **YooKassa fallback:** «Умный платёж» с `confirmation.type=redirect` и `capture=true`. При `PAYMENT_PROVIDER=yookassa` клиент получает `confirmation_url` и уходит на hosted-страницу YooKassa; старые webhook/reconcile/cron остаются включены для pending и истории.
- **Страница / модалка:** hard `/pricing` — `PageLayout` + `PricingScreen`. In-app CTA открывают `ClientPricingModal` (root layout): `lockListingScrollForModal` + `history.pushState('/pricing')` + virtual `ym('hit')` + `sessionStorage` origin; close / Back — unmount затем `history.back()`. Checkout: `closeWithoutHistory()` + `replaceState(origin)` + YooKassa `return_url` на origin + `?payment=`. Return poll — `YooKassaReturnStatus` (не hard `/pricing`). Прямой заход / refresh `/pricing` без origin по-прежнему возвращается на `/pricing?payment=`. Cmd/Ctrl-click по `PricingEntryLink` — hard navigation.
- **Mobile UI (hard page):** живёт в общем listing shell (`Header` + `listing-scroll-root` + `MobileTabBar`). Main на max-lg имеет `min-h` = высота над tab bar; legal footer (`mt-auto`, без border/blur) при достаточном месте сидит внизу, иначе скроллится вместе с карточками. Карточки — 2×2 до `xl`, клик по всей карточке.
- **Mobile UI (overlay):** fullscreen white (`z-[260]`, выше generate dock `122` и карточки `50`, ниже auth/profile sheet `270`); desktop — backdrop + белая карточка. Контент — тот же `PricingScreen`.
- **Каталог:** `landing/src/lib/pricing-plans.ts` — единый server-safe источник `plan_id`, RUB-цены и числа токенов. API никогда не принимает цену/credits от клиента.
- **Auth/identity:** checkout требует Google/Yandex OAuth. Операция хранит исходный `auth_user_id`, а баланс начисляется на shared `landing_user_id`, полученный через `ensureLandingUserForGeneration`.
- **Ledgers:** `landing_robokassa_payments` (миграция `194`) хранит числовой уникальный `InvId`, а `landing_yookassa_payments` (миграции `176`, `191`) — YooKassa provider ID. Оба фиксируют server-owned план, сумму, credits, UUID idempotency key, status/test/attribution/`credited_at`; RLS включён без client policies. Admin читает объединённый `admin_landing_payments`.
- **Атрибуция Директа (оптимизация кабинета):** `YandexMetrikaRouteTracker` пишет first-touch `yclid` в cookie `promptshot_yclid` (21 день). Checkout (`PricingCards`) читает ClientID (`ym getClientID` / `_ym_uid`) и `yclid`, create-payment сохраняет в ledger YooKassa и Robokassa. Без идентификаторов оплату не блокируем. Спека MP: `docs/17-08-yandex-direct-purchases.md`.
- **Paid + SEO acquisition:** visitor/session, first-touch cookie `promptshot_utm` (21 день), immutable visitor→shared-user link, pre-auth funnel и payment snapshot — `sql/196_landing_acquisition_attribution.sql` + апгрейд unpaid→paid в `sql/211_seo_traffic_attribution_upgrade.sql`. Реклама: UTM/`yclid` как в URL. Органика: `document.referrer` → `yandex_seo`/`google_seo`/`bing_seo` + `organic` + первый pathname; пустой referrer → `direct`/`none`; чужой host → `referral`. Same-origin и OAuth host не классифицируем. Платный канал перетирает SEO на visitor, `landing_users` и ledger; второй paid и любой unpaid поверх paid — нет. Finance Директа по-прежнему `yandex|ya` + `cpc`; `yandex_seo` туда не попадает. Shared guest owner не person identity; ads не меняет текущий `netIncomeRub`. Спеки: `docs/19-08-traffic-source-attribution.md`, `docs/19-08-yandex-direct-acquisition.md`, `docs/24-08-seo-traffic-attribution.md`.
- **Robokassa confirmation:** `GET|POST /api/payments/robokassa/result` разбирает form-urlencoded ResultURL, проверяет signature через Пароль №2, `InvId`, `Shp_payment_id` и сумму, затем вызывает `landing_fulfill_robokassa_payment`; ответ строго `OK{InvId}`. SuccessURL не подтверждает оплату. `RobokassaPaymentStatus` в root layout опрашивает только owned local status с backoff и обновляет баланс после callback.
- **Конверсия в Метрику:** обе fulfillment-ветки шлют Measurement Protocol (`ea=purchase` + ecommerce, `ti=payment.id`, `tr=amount_rub`) на `mc.yandex.ru/collect`. Lease `yandex_conversion_claimed_at` проверяется в приложении; PATCH не фильтрует колонки, которые сам пишет (PostgREST смотрит новую строку). Параллельный дубль гасится `ti=payment.id` и `sent_at`. Robokassa шлёт через Next `after()`. Ошибки Метрики оплату не роняют. Cron досылает unsent live-покупки (attempts < 5, stale claim). Return/status poll дополнительно стреляет JS `purchase` + `dataLayer`.
- **YooKassa confirmation (четыре consumer’а):** (1) webhook, (2) return-poll `?payment=`, (3) open-reconcile при возврате на сайт без query / повторном checkout, (4) cron/admin stale sweep. Все пути делают `GET /v3/payments/{id}`, сверяют provider ID, metadata, RUB-сумму и статус. Обе provider-specific fulfill RPC блокируют ledger row и в одной транзакции начисляют сохранённые credits ровно один раз.
- **Create-guard:** финальный update локальной операции только при `status in (created, pending)` — не затирает уже `succeeded`/`canceled` после гонки с webhook. Перед insert create сверкает открытые платежи пользователя; credited того же плана → `alreadyCredited`, без второго hosted-redirect.
- **Return UX:** клиент polling с backoff ~2→5→10 с до ~20 попыток (~2–3 мин) если есть `?payment=`. Иначе `YooKassaReturnStatus` один раз (и на `visibilitychange`) бьёт `POST /api/payments/yookassa/open-reconcile`. Сервер reconcile’ит и локальный `canceled`, если ещё нет `credited_at`. Не вешать сверку на `GET /api/me`.
- **Stale sweep:** `reconcileStaleYooKassaPayments` — `created|pending` с `yookassa_payment_id`, старше 1 мин, batch ≤20. Затем тот же cron вызывает `flushUnsentYandexPurchaseConversions` (YooKassa + Robokassa, limit 20). Admin: кнопки «Сверить» / «Сверить зависшие». Cron: `POST /api/cron/yookassa-reconcile` с `Authorization: Bearer $CRON_SECRET` каждую минуту (pg_cron / Dockhost; после выката сменить `*/5` → `* * * * *`).
- **Webhook:** в кабинете YooKassa (Basic Auth shop) подписать `https://promptshot.ru/api/payments/yookassa/webhook` на `payment.succeeded` и `payment.canceled`.
- **Robokassa cabinet:** ResultURL `https://promptshot.ru/api/payments/robokassa/result` (POST), SuccessURL `https://promptshot.ru/payment/robokassa/success` (GET), FailURL `https://promptshot.ru/payment/robokassa/fail` (GET). Алгоритм подписи обязан совпадать с `ROBOKASSA_HASH_ALGORITHM`; production rollout только после test payment с `ROBOKASSA_TEST_MODE=1`.
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
AuthModal / SidebarAccountPanel → OAuthSignInButtons → signInWithOAuth(redirectTo: /auth/callback?next=<listing-or-hard-page>)
  → remember screen: listing path (sessionStorage + cookie ps_auth_next) + overlay (ps_auth_ov)
  → Supabase /auth/v1/authorize → IdP → /auth/v1/callback
  → promptshot.ru/auth/callback?code=…&next=/promty-dlya-foto-zhenshchiny
  → client page: finishOAuthCodeExchange (browser cookies) → redirect на next?ps_auth=1
  → AuthProvider снимает маркер (replaceState) и гидратит сессию
  → AuthReturnScreenRestorer открывает card/pricing/foto-v-promt overlay на том же листинге
```

Почему не server route: дублирующий `GET /auth/callback` делал второй `POST /token` (`user_agent=node`) → `404 flow_state_not_found`, а ответ дубля отдавал `?auth_error=` без session cookies. В браузере первый обмен пишет cookies в document; replay с `invalid flow state` проверяет `getUser()` и при активной сессии считается успехом.

Почему не «просто getUser на mount»: `location.replace(next)` часто достаёт **bfcache** исходной гостевой страницы (`pageshow.persisted`). Cookie уже есть, React-state — нет, F5 лечит. Return URL поэтому одноразово отличается (`ps_auth=1` + `ps_auth_done`); `AuthProvider` перечитывает сессию на restore и на `visibilitychange`, если chrome ещё гость. `getUser()` упал, `getSession()` жив → оставить cookie-user, не гостевую модалку.

Fallback: если `code` пришёл на произвольную страницу (не `/auth/callback`), `AuthProvider` делает client `exchangeCodeForSession` и при наличии сохранённого return path уводит туда с тем же маркером. На `/auth/callback` `AuthProvider` **не** обменивает code (избегаем второго `/token`).

- Хелпер: `landing/src/lib/auth-oauth.ts` + `auth-return-path.ts` + `auth-return-screen.ts` + `auth-finish-oauth.ts` + `auth-session-hydrate.ts` (`getOAuthCallbackUrl`, `signInWithOAuthProvider`, `captureAuthReturnScreen`, `finishOAuthCodeExchange`, `appendAuthReturnMarker`, `resolveHydratedAuthUser`, sanitize `next`). `ps_auth_next` читается, если sessionStorage пуст (Safari / SITE_URL fallback на `/`). Soft overlay регистрирует listing origin в `setLiveAuthReturnOverlay`. При старте OAuth: Yandex → `force_confirm=yes`, Google → `prompt=select_account` (выбор аккаунта при повторном логине).
- **UI кнопок (`OAuthSignInButtons`):** две кастомные кнопки одной сетки (`h-12`, `px-4`, иконка 20×20, `rounded-xl`, белый фон) — Google (цветной G) и Яндекс (красный круг + «Я»); обе вызывают `signInWithOAuthProvider`. Используются в `AuthModal` и в guest-состоянии `SidebarAccountPanel` (mobile profile sheet + desktop sidebar). Виджет YaAuthSuggest больше не используется.
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
- CTA `/foto-v-promt` открывают внутренний Generate Dock с подставленным промтом (`intent=photo_prompt`); гость сначала проходит AuthModal, после OAuth dock поднимается сам.

### Статические файлы

- `sitemap.ts` — динамический sitemap (L1 теги, фильтрованные по `getFilterCounts` с порогом ≥ 1 карточки, + L2 комбинации + карточки). Search-backed URL (`birthdayClusterSitemapPages`, `/sobytiya/1-sentyabrya`) добавляются по FTS-хитам с тем же порогом index/noindex; дедуп с теговыми/combo URL; без эмбеддингов.
- `image-sitemap.xml/route.ts` — image sitemap для Google Images / Яндекс.Картинок; XML с `xmlns:image`; `<image:loc>` через `getIndexableImageUrl` (основной домен, без query); `<image:title>` + `<image:caption>`; чанкинг по 5000 карточек, при `totalPages > 1` — `<sitemapindex>` с `?page=N`; `revalidate = 3600`
- `robots.txt/route.ts` — текстовый route handler; расширенный `Disallow` (`/api/`, `/admin/`, `/embed/`, `/auth/`, `/search`, `/favorites`, `/generations`, `/analyses`, `/generate`, `/pricing`); `Clean-param` для Яндекса (`audience&style&occasion&object&sort`); две ссылки на sitemap

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
  → счётчики hero, OG, JSON-LD hasPart
fetchRouteCards({ sort: "new", limit: 16 })
  → enrichCardsWithDetails
  → HomepageExamplesExplorer
```

Чипы: `homepage-explorer-chips.ts` («Все» + топ Wordstat без «На паспорт»; хвост включая `doc_task_tag` — `sr-only`). `/catalog` desktop — плитки `CategorySection`; mobile — тот же explorer (`variant="catalog"`, без fade/CTA). CTA главной без чипа: «Каталог и поиск».

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

**Кластер «день рождения»:** хаб остаётся `/sobytiya/den-rozhdeniya` (не переезжает на `/den-rozhdeniya`). Дети — `/sobytiya/den-rozhdeniya/{alias}` (`devushki`, `deti`, `muzhchiny` и object-сегменты). Каноникал audience+ДР occasion-first; 301 со старых audience-first L2 и L3 (`/:object` в `next.config.ts`), не с хаба. Sitemap берёт хаб/детей/L3 из `birthdayClusterSitemapPages` по числу FTS-хитов, не только из тегового combo-кэша. Если pathname ≠ `canonicalPath`, листинг отвечает 301. Ручной SEO L2 — combo-ключи `devushka+den_rozhdeniya` и т.п. в `seo-content.ts`. Видимый роутер под H1 — `ListingClusterChipGroup` из SSOT. Выдача карточек — hybrid-поиск только для SSOT-запросов кластера (`isBirthdayListingSearchQuery` → `searchListingCardsHybrid`). Успешная hybrid-выдача материализуется до 200 id на 1 час в процессе; Gemini идёт с budget actor `system` (`SEARCH_VISUAL_SYSTEM_DAILY_LIMIT`, default 10000), не в user IP-60. `text_fallback` не кэшируется. Чужой `/api/listing?q=` — FTS без эмбеддингов. SSR первая страница 48 + `has_more`, дальше `InfiniteGrid` → `GET /api/listing?q=` (HTTP cache default). Без `SEARCH_VISUAL_ENABLED` — FTS-only. Поле поиска в explorer остаётся: от 2 символов временно подменяет сетку через `/api/search`. Кластерные URL включают общий `Footer` вместе с generate dock (`showFooterWithGenerateDock`), как `/sobytiya/1-sentyabrya`. **Антиканнибализация copy:** хаб держит только «промты для фото на день рождения»; L2 не повторяют чужие модификаторы в title/description; do-интент («сделать/создать фото») — только `/generaciya-foto/na-den-rozhdeniya`; H1 хаба не меняется.

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
- **Mobile SEO (Яндекс «мелкий текст»):** на `< md` при наличии фото — immersive fullscreen (`CardPageLayout` скрывает header/sidebar/footer). Оверлей: **`text-[13px]`** (`MOBILE_FS_*`), `CARD_OVERLAY_ACTION_PILL` **`min-h-11`**. Нижний glass-бар — **«Промпт» + LexyGPT** (`grid-cols-2`); клик «Промпт» открывает полноэкранный glass-`dialog` (`bg-black/48` + `backdrop-blur`, та же подложка что у чипов) с текстом, крестиком закрытия справа сверху и CTA «Скопировать промпт» внизу (swipe листинга на это время выключен). Стрелки листинга **не** в доке. Дублирующий fixed sticky `z-[240]` с **`max-md:hidden`** при `hasPhotos`; колонка контента **`max-md:pb-6`** вместо `pb-28`. Desktop (`md+`): framed hero + sticky-bar как раньше. См. `.cursor/rules/ui-typography-icons-consistency.mdc` (tier A).
- **Mobile listing nav (карточки с фото):** правый стек по центру — реакции → избранное → шаринг → ↑ prev / ↓ next (`StickyListingNavButton` `orientation="vertical"`). Свайп **вверх** → следующая карточка, **вниз** → предыдущая. `useMobileCardSnapFeed` управляет нативным `overflow-y-auto snap-y snap-mandatory` viewport максимум из пяти слайдов высотой в текущий `visualViewport`: `prev-prev / prev / current / next / next-next`. Центральный содержит полный UI, остальные — предзагруженные hero; отсутствующие крайние слайды не рендерятся. Второй жест до завершения первого commit двигается по настоящему snap-слайду; смещение более чем на один slide сохраняется как queued direction и продолжается после recenter. Lifecycle на refs: `idle → interacting → settling → committing`; React получает только переход chrome hidden/visible, не каждый scroll event. Chrome/Firefox/current Safari завершают жест через `scrollend`; fallback старого Safari ждёт pointer release, 110 мс тишины и два стабильных animation frame. Token-guard допускает ровно один commit/rollback. При изменении высоты browser chrome активный жест сохраняет `scrollTop / oldHeight`, idle-feed центрируется; recenter WebKit на один frame замораживает overflow и snap. Стрелки делают smooth-scroll только без `prefers-reduced-motion`. `scroll-behavior: auto`, `overflow-anchor: none` и `overscroll-behavior-y: contain` изолируют snap viewport от глобального smooth-scroll и вложенных scroller. При приближении к последнему загруженному slug feed заранее отправляет `promptshot:listing-navigation-load-more`; mounted `InfiniteGrid` / `SearchResults` использует свой единый `loadMore`, а событие `promptshot:listing-navigation-updated` добавляет новых соседей без закрытия модалки. Соседи — `promptshot_listing_nav_v1` / `resolveListingNavNeighbors`, загрузка — общий LRU на 9 записей с in-flight dedup в `PromptCardModalContext`. One-time тултип у стрелок (`CardSwipeOnboarding`, ключ `promptshot_card_swipe_onboarding_v1`) — скрытие по свайпу / клику стрелки / «Понятно» / таймауту 8с / клику вне.
- **Закрытие модалки:** `CardModal` обрабатывает клик по backdrop для intercepting route и `ClientCardModal`. В desktop split кликабельным фоном считаются также прозрачные промежутки между фото, вертикальной навигацией и dark panel; сами поверхности помечены `data-card-modal-surface`. `Escape` и крестик используют тот же `handleClose`.

### Поиск `/search`

```
SearchResults (client, infinite scroll)
  → /api/search?q=&audience=&style=&occasion=&object=&limit=48&offset=N
  → параллельно: filtered search_cards_text + (если SEARCH_VISUAL_ENABLED)
    Gemini embed → filtered search_cards_visual
  → lexical guard + weighted RRF (окно ≤ 500)
  → enrichCardsWithDetails(cards)
  → защитная client-side проверка seo_tags
```

- Desktop (`lg+`): тот же explorer-блок, что у `/[...slug]` и `/trends` (`ListingExplorerFrame` + `ListingExplorerSearch`). Компактное поле в шапке не показывается — одно поле ввода. `ListingDesktopFilters` и mobile `FilterFAB` только после выдачи (`searched && cards.length > 0`); до запроса и при пустом результате фильтры скрыты.
- **Возврат с карточки:** soft `pushState /p/slug` не должен сбрасывать infinite-scroll. URL-sync (`resolveSearchUrlSync`) игнорирует overlay; in-memory snapshot переживает remount `SearchResults`; позиция — как у каталога (`SCROLL_KEY` + `scheduleListingScrollRestore`). Новый ввод в поле по-прежнему debounce 500 мс + `resetListingScroll()`.
- Пагинация детерминированная: `48` карточек на порцию (как каталог; без расширения групп в поиске). Hybrid собирает окно с offset 0 и режет страницу в приложении.
- Фильтры `audience/style/occasion/object` входят в request identity и применяются в text/visual RPC до ранжирования и пагинации. Изменение только фильтра запускает новый server search; ввод нового query сохраняет фильтры URL.
- Текстовое ранжирование: морфология (`prompt_cards.fts`, где уже денормализованы `title_ru` и RU-тексты промтов) + typo/substring fallback (`trigram` только по `title_ru`). Полные `prompt_variants.prompt_text_ru` на read path повторно не сканируются.
- Visual branch: `gemini-embedding-2` 768-d, timeout 800 мс, IP/global daily budget, LRU/single-flight, circuit breaker. Любой сбой → текущий FTS без HTTP 429.
- Hybrid rank: exact title и strong FTS выше visual-only; остальные — weighted RRF. `matchType`: `fts` / `trgm` / `visual` / `fts+visual` / `trgm+visual`.
- Защита нагрузки: максимум 160 символов, `limit ≤ 100`, debounce 500 мс; публичные клиенты отменяют устаревшие запросы. `/api/search` возвращает `Server-Timing: search-text, search-embed, search-vector, search-rank, search-enrich`; медленные и fallback-запросы логируются без текста запроса.

### Catalog admin (вместо `/debug`)

- **Кто:** email в `INTERNAL_GENERATE_ALLOWLIST` / default `azarov.maxim@gmail.com` (`isCatalogAdminEmail` → `isInternalGenerateAllowlistedEmail`).
- **Листинги:** на любом `FilterableGrid` для admin — панель «Фильтры» (всегда); default `published=yes` → тот же SSR-фид/`resolve_route_cards`, что у пользователей. `search-cards` только при debug-фильтрах (`published=all` и т.п.) с `sort` листинга; датасеты `includeUnpublished=1`. Session: `promptshot_admin_filters_v2`.
- **Свитч «Тех. информация»** (default off, `sessionStorage` `promptshot_admin_tech_info`): оверлеи `ListingCardDebugOverlay` на masonry-плитках + жёлтая DEBUG-панель (мета + «Сделать было» / удаление) на `CardPageClient`.
- **Unpublished карточки:** `/p/[slug]` и `/api/card/[slug]` — `allowDebugUnpublished` по auth email, не cookie.
- **API:** `published≠yes` в `/api/search-cards`, `includeUnpublished` в `/api/datasets`, ID-поиск unpublished в `/api/search-card`, `POST /api/set-before`, `POST /api/debug-delete-card` — только catalog admin.
- **Удалено:** маршрут `/debug`, cookie/session `promptshot_debug_tools`.

---

## Ключевые компоненты

### Server Components

| Компонент | Файл | Роль |
|-----------|------|------|
| PageLayout | `components/PageLayout.tsx` | Клиентский shell: `listing-mobile-shell` + `#listing-scroll-root`; моб. высота через `--ps-listing-shell-height` (`listing-shell-viewport.ts`: только `innerHeight`, freeze на фокусе поля; `.listing-shell-root` `fixed` top-0); hide-on-scroll шапки/таббара (`.listing-chrome-hidden` через DOM/rAF, без React state); in-flow `listing-header-flow-spacer` + `ListingBottomBar`; **`useListingScrollOnRouteChange(pathname)`** — сброс скролла при смене маршрута |
| Header | `components/Header.tsx` | Legacy серверный (заменён PageLayout) |
| Footer | `components/Footer.tsx` | Статический |
| CardPage | `app/p/[slug]/page.tsx` | Серверный, SSR карточки |

### Client Components

| Компонент | Файл | Роль |
|-----------|------|------|
| HeaderClient | `components/HeaderClient.tsx` | Mobile sticky header: бургер категорий слева на всех экранах \| логотип (на `/catalog` после ухода in-page поиска — выезжающее поле) \| у авторизованного `HeaderBalancePayChip` (баланс + «+»). На desktop не рендерит визуальный chrome |
| HeaderBalancePayChip | `components/AccountControls.tsx` | Split-pill шапки: кредиты + CTA «+» → `PricingEntryLink` (оверлей `/pricing`). `aria-label` — «пополнить». Тот же кэш `GET /api/me`, что sidebar |
| PricingModalContext | `context/PricingModalContext.tsx` | SSOT оверлея тарифов: `open` → save origin + pushState `/pricing`, `close` → back (валидный `onClick`), `closeWithoutHistory` перед YooKassa, `popstate` снимает модалку; на hard `/pricing` `open` no-op |
| ClientPricingModal | `components/ClientPricingModal.tsx` | Overlay тарифов в root layout (portal `document.body`, `z-[260]`) |
| PricingScreen | `components/pricing/PricingScreen.tsx` | Общий UI пакетов для hard page и модалки |
| PricingEntryLink | `components/PricingEntryLink.tsx` | Клик → оверлей; modified click / уже на `/pricing` → hard URL |
| SidebarNav | `components/SidebarNav.tsx` | Сквозной левый sidebar: desktop `h-screen` с `SiteBrandLink` сверху на листингах (`showBrand`, default true), затем `SidebarAccountPanel` и отдельно прокручиваемое меню. На `/p/[slug]` `showBrand={false}`. Mobile drawer снят (каталог — таб). Сверху меню pill **«Добавить в Chrome»** → CWS; Главная / **Тренды** / (treatment) **Генерация фото** → `/generaciya-foto` / **Поиск** / **Фото в промт**; далее accordion-секции. Indigo CTA на `/generate` убран. |
| SidebarAccountPanel | `components/AccountControls.tsx` | Account-блок: для гостя — Google / Яндекс (`OAuthSignInButtons`); для пользователя — профиль, кредиты, «Пополнить», избранное, генерации, анализы и выход. Desktop sidebar всегда; mobile — в `MobileProfileSheet` с `showBalance` |
| SiteBrandLink | `components/SiteBrandLink.tsx` | Общий home-link бренда; mobile — в header; desktop listings — в начале `SidebarNav` (`markSize=24`); на `/p/[slug]` не рендерится |
| ListingExplorerFrame | `components/ListingExplorerFrame.tsx` | Общая рамка блока как на главной (градиент, скругление) |
| ListingExplorerSearch | `components/ListingExplorerSearch.tsx` | Поле поиска + SEO-заголовок/intro внутри рамки |
| ListingMasonry | `components/ListingMasonry.tsx` | SSOT CSS-columns сетки промтов (`columns-2/3/4`) + skeleton |
| StableListingMasonry | `components/StableListingMasonry.tsx` | Infinite masonry: детерминированные 2/3/4 lanes без reflow prefix и дыр между порциями. Query container и `height: *cqw` — разные узлы (`.stable-listing-masonry` / `.stable-listing-masonry-canvas`) |
| ListingPhotoTile | `components/ListingPhotoTile.tsx` | Плитка листинга: первое фото, живой aspect, клик → модалка |
| listing-masonry | `lib/listing-masonry.ts` | Классы колонок и `listingPhotoAspectRatio` (DB width/height, иначе rotating fallback) |
| PromptCard | `components/PromptCard.tsx` | Legacy chrome-карточка 3:4; публичные ленты больше не используют |
| GroupedCard | `components/GroupedCard.tsx` | Legacy склейка split-siblings; публичные ленты показывают каждую карточку отдельно |
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
| MobileTabBar | `components/MobileTabBar.tsx` | Tab bar (max-lg): **Тренды** / Каталог / **Сгенерировать** → `focusBlank` / **Фото в промт** / **Войти·Профиль** → `MobileProfileSheet`. Поиск — иконка в шапке (`useOpenMobileSearchEntry`). |
| GenerateDockContext | `context/GenerateDockContext.tsx` | SSOT seed/focus/dockSurface/historyRefresh/`lastDockResultDismissed` для listing dock. Path allowlist — `generate-dock-path.ts` (включая `/foto-v-promt`, `/analyses`). Guest seed persist + restore после OAuth. `GenerateDockGuestAuthReactor`: guest `plateOpen` → auth; dismiss без логина закрывает plate и чистит pending. |
| FotoVPromtGenerateButton | `components/foto-v-promt/FotoVPromtGenerateButton.tsx` | Фирменный CTA анализа: clipboard + `seedBlankPrompt(intent=photo_prompt)` |
| GenerateListingDockHost | `components/generate/GenerateListingDockHost.tsx` | Плавающий composer на allowlist листингов (treatment); collapse FAB для гостя / при скролле. `plateOpen` блокирует autohide через `setListingChromeAutoHideBlocked` (без ререндера `PageLayout`). |
| GenerationResultBackdrop | `components/generate/GenerationResultBackdrop.tsx` | Фон result: pixelate previous → reveal next (CSS); shared dock/card. |
| useListingScrollActivity | `hooks/useListingScrollActivity.ts` | Скролл листинга с опциональным `minDeltaPx` (dock collapse только после заметного сдвига). |
| useListingChromeAutoHide | `hooks/useListingChromeAutoHide.ts` | Hide-on-scroll: classList на `.listing-shell-root`, rAF; накопленный сдвиг (Ozon): hide ≥24px вниз, show ≥4px вверх / верх ленты; hold при search/profile sheet; fail-open |
| useListingIsMobile | `hooks/useListingIsMobile.ts` | Общий `matchMedia(max-width: 1023px)` / desktop `min-width: 1024px` для listing chrome |
| GenerateBlankShell | `components/generate/GenerateBlankShell.tsx` | Только история `/generate` (без nested dock). |
| GenerateMobileModalContext | `context/GenerateMobileModalContext.tsx` | Legacy soft card portal; blank compose → global dock / hard `/generate`. |
| SidebarNav generate link | `components/SidebarNav.tsx` | Treatment: обычный пункт **«Генерация фото»** → SEO `/generaciya-foto` (не `/generate`). |
| FotoVPromtMobileModal | `components/foto-v-promt/FotoVPromtMobileModal.tsx` | Mobile fullscreen dialog (`lg:hidden`, root layout); host для `PromptSceneLiteWidget variant="immersive"`. |
| FotoVPromtMobileModalContext | `context/FotoVPromtMobileModalContext.tsx` | Soft: scroll lock + `pushState` + virtual hit, close → `history.back()`. Route (hard mobile `/foto-v-promt`): auto-open, close → `replace('/')`. Desktop — без модалки. |
| MobileProfileSheet | `components/MobileProfileSheet.tsx` | Bottom sheet профиля с `SidebarAccountPanel`; открывается из таба Войти/Профиль и `openAuthModal` (max-lg). `z-[270]` — выше pricing overlay |
| AuthModal | `components/AuthModal.tsx` | Вход: desktop — центрированная модалка `z-[270]`; max-lg — `MobileProfileSheet`. `OAuthSignInButtons` |
| CatalogExplorer | `components/CatalogExplorer.tsx` | RSC-обёртка листинга: `Suspense` + `CatalogWithFilters` |
| CatalogWithFilters | `components/CatalogWithFilters.tsx` | Листинг + `ListingDesktopFilters` (desktop) + FilterFAB (mobile), useListingFilters |
| ListingDesktopFilters | `components/ListingDesktopFilters.tsx` | Desktop: кнопки по измерениям → модалка, single-select (`setFilter`) |
| FilterFAB | `components/FilterFAB.tsx` | Mobile: регистрация кнопки в bottom bar + `FilterPanel` |
| FilterPanel | `components/FilterPanel.tsx` | Mobile sheet с чипсами (draft + «Применить») |
| FilterChips | `components/FilterChips.tsx` | Строка чипсов для одного измерения |
| useListingFilterCounts | `hooks/useListingFilterCounts.ts` | Счётчики тегов: API или агрегация из cards |
| HomepageExamplesExplorer | `components/home/HomepageExamplesExplorer.tsx` | Главная (`variant=home`) и `/catalog` mobile (`variant=catalog`): popular-карточки, Wordstat-чипы, in-place search; catalog без fade/CTA |
| MobileCatalogMenuDrawer | `components/MobileCatalogMenuDrawer.tsx` | Левая шторка категорий на max-lg; контент — `SidebarContent`; открытие из шапки через `registerMenu` / `openMenu` |
| ReactionButtons | `components/ReactionButtons.tsx` | Like/dislike |
| FavoriteButton | `components/FavoriteButton.tsx` | Избранное |
| CopyPromptButton | `components/CopyPromptButton.tsx` | Копирование промта |
| OAuthSignInButtons | `components/OAuthSignInButtons.tsx` | SSOT кнопок Google + Яндекс → `signInWithOAuthProvider` |
| UserAvatarImage | `components/UserAvatarImage.tsx` | OAuth-аватар: no-referrer + unoptimized для Google/Yandex CDN |
| auth-oauth | `lib/auth-oauth.ts` | `signInWithOAuthProvider`, `custom:yandex` |
| auth-return-screen | `lib/auth-return-screen.ts` | listing path + overlay (`card` / `pricing` / `foto-v-promt`) |
| AuthReturnScreenRestorer | `components/AuthReturnScreenRestorer.tsx` | после `?ps_auth=1` открывает overlay на листинге |
| auth-finish-oauth | `lib/auth-finish-oauth.ts` | `finishOAuthCodeExchange` (browser PKCE) + `?ps_auth=1` |
| auth-session-hydrate | `lib/auth-session-hydrate.ts` | `resolveHydratedAuthUser`, pageshow / visibility gates |
OAuth completion: `/auth/callback` page вызывает `finishOAuthCodeExchange`; `AuthProvider` гидратит сессию на return / bfcache. `AuthReturnScreenRestorer` восстанавливает soft overlay. Legacy `code` fallback — только вне `/auth/callback`. Cookie `ps_auth_next` — fallback, если sessionStorage пуст.

---

## SEO

### Метаданные

- **Root layout:** fallback title + description из `homepage-seo-copy.ts` (`HOMEPAGE_SEO`)
- **Главная (`/`):** `generateMetadata` → `HOMEPAGE_SEO.title` / `description`; canonical; H1 + hero из copy-модуля; после destinations — **`HomepageExamplesExplorer`** (`#primery`); блоки **intro**, **HowTo**, **FAQ** (`HomeSeoBlocks.tsx`) в конце страницы; JSON-LD **`CollectionPage`** (`isPartOf: WebSite`, `hasPart[].name` = «Промты для фото {label}») + **`FAQPage`** + **`ItemList`** popular-карточек; FAQ-ссылки на L1 / `#primery`
- **Листинг L1:** `generateMetadata` → title/description из `getSeoContent(tag.slug)`
- **Листинг L2/L3:** `generateMetadata` → title/description из `getSeoForRoute(route)` (combo-ключ в `seo-content.ts`, иначе шаблоны)
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
- Приоритет: combo-ключ тегов в `seo-content.ts` (`devushka+den_rozhdeniya`) → L1 по `primaryTag.slug` → шаблон по паре измерений → generic fallback
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
| `prompt_card_visual_embeddings` | 768-d Gemini image embeddings, versioned by `generation` (SQL `192`) |
| `prompt_card_visual_embedding_jobs` | Outbox/lease для индексации канонического фото |
| `prompt_card_visual_search_config` | Active generation / model singleton |
| `visual_search_rate_limit` | IP + global дневной бюджет query embeddings |
| `prompt_card_before_media` | Before/after фото |
| `card_reactions` | Лайки/дизлайки (через supabase-browser) |
| `card_favorites` | Избранное (через supabase-browser) |
| `vibes` | Сохранённые extracted style JSON для Steal This Vibe |
| `landing_generations` | История web-генераций (`vibe_id`, `client_source` — сейчас всегда `site`) |
| `landing_vibe_saves` | Сохранённые выборы пользователя по vibe-генерациям (`vibe_id`, `card_id`, `auto_seo_tags`) |
| `landing_user_telegram_links` | Привязка web-пользователя к Telegram (`landing_user_id` ↔ `telegram_id`) |
| `landing_link_tokens` | Одноразовые OTP для deep-link привязки (TTL 10 мин) |
| `landing_web_transactions` | Платежи web-кредитов через Telegram Stars |
| `landing_yookassa_payments` | Server-only ledger разовых RUB-покупок токенов через YooKassa; `191` — `ym_client_id`, `yclid`, `yandex_conversion_*` |
| `admin_finance_imports` | Месячные admin-импорты ЮKassa (`revenue`) и GCP Billing (`cogs`); unique `(kind, period_month)` |
| `admin_finance_revenue_lines` | Строки реестра ЮKassa без PII плательщика |
| `admin_finance_cogs_lines` | Строки Google Cloud Billing (SKU / `subtotal_usd`) |
| `landing_mail_outbox` | Очередь исходящей почты (Postbox). Админ-статы читают sent/skip/fail; cron claim не зависит от вкладки статистики |

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
| `search_cards_text` | Полнотекстовый поиск; overload с dimension-фильтрами до rank/pagination — миграция `194` |
| `search_cards_visual` | ANN по active generation image embeddings (миграция `192`; исправление ambiguous config `id` — `193`; overload с dimension-фильтрами — `194`) |
| `claim_visual_embedding_jobs` / `complete_visual_embedding_job` / `fail_visual_embedding_job` | Lease-outbox для backfill фото |
| `visual_embedding_coverage` | Coverage published+photo vs ready embeddings |
| `visual_search_rate_limit_increment` | Атомарный IP + global бюджет Gemini query embeds |
| `landing_add_credits` | Начисление кредитов в `landing_users.credits` после web-оплаты |
| `landing_fulfill_yookassa_payment` | Атомарное идемпотентное завершение YooKassa-платежа и начисление сохранённых в ledger токенов |
| `admin_finance_replace_import` | Service-only replace месячного finance-импорта (`revenue` \| `cogs`) |
| `admin_credit_liability_summary` | Service-only totals `landing_users.credits > 0`; RUB-оценка в админке = 5 кр. / 2,5 ₽ |
| `admin_credit_liabilities` | Service-only keyset-список тех, кто начислял/тратил кредиты за `p_days`, plus live remaining |
| `admin_analytics_top_users` | Service-only топ-50 по allowed-запросам за `p_days` |
| `admin_credit_daily_flow` | Service-only дневные начисления (ЮKassa/Stars), списания и возвраты генераций |
| `landing_mail_admin_daily_stats` | Service-only GROUP BY Moscow day × template × kind × status из `landing_mail_outbox`; окно ≤ 30 суток; `sql/210` |
| `landing_mail_daily_budget` | Service-only квота суток (cap 5000, queued pending+processing, remaining) |

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

**Блоки категорий (`get_homepage_sections`, миграция `164`):** на `/` больше не рендерятся. RPC остаётся для счётчиков / OG / JSON-LD и для desktop-плиток на `/catalog`. Mobile `/catalog` грузит ещё `fetchRouteCards({ sort: "popular", limit: 16 })` для explorer. Топ-**10** карточек на тег сортируются по **той же query-time popularity-формуле**, что листинг (мигр. `163`). **Кросс-категорийный дедуп обложек** (`buildCategorySectionBlocks` + `pickDeduplicatedPhotos`, общий `usedCardIds` в порядке `SECTION_ORDER`).

**`search_cards_text`:** по-прежнему **`view_count`** / relevance (154). **`search_cards_filtered`:** с миграцией **`182`** — `p_sort` как у `resolve_route_cards` (`new` / `popular`); до применения 182 — legacy `view_count`.

**Scroll policy листинга (`scroll-preservation.ts`, fix/category-scroll-jump):** SSOT для позиции скролла каталога. На mobile скролл в **`#listing-scroll-root`** (shell переживает soft navigation между категориями в `[...slug]`).

| Event | Action |
|-------|--------|
| pathname change (Next router) | `cancelListingScrollRestore()` + `scrollCatalogToTop()` (`PageLayout` → `useListingScrollOnRouteChange`) |
| card route `/p/...` (modal pushState или direct) | route hook **игнорирует** (`isCardPath`) — позицию листинга не трогаем |
| pricing `/pricing` (overlay pushState или hard page) | route hook **игнорирует** (`isPricingPath`) — как карточка |
| modal open | `saveListingScroll()` + lock inner root |
| modal close (back на тот же pathname) | `scheduleListingScrollRestore()` — единственный restore path (`CardModal` unmount) |
| sort change | `resetListingScroll()` (`useListingSort`) |
| filter/query on same path | `resetListingScroll()` (`useListingFilters`) |

`lastListingNavPath` (module-level, переживает remount `PageLayout`) + `scheduleRouteScrollToTop` (rAF/50/150 ms) — сброс и `#listing-scroll-root`, и `window`; category / `/generaciya-foto` scenario chips `scroll={LISTING_SHELL_LINK_SCROLL}` (`false`). `writeScrollTop` на `window` временно ставит inline `scroll-behavior: auto` — иначе `html { scroll-behavior: smooth }` анимирует `scrollTop = 0`. `<next-route-announcer>` в `globals.css` прибит `position: fixed` у `(0,0)`: Next 15 `handlePotentialScroll` не уводит viewport в подвал. **Next 15** обновляет `usePathname()` / `useSearchParams()` на `history.pushState`, поэтому открытие модалки (`pushState /p/slug`) даёт смену пути — `useListingScrollOnRouteChange` ранним выходом по `isCardPath` / `isPricingPath` не сбрасывает позицию (иначе `scrollCatalogToTop` стёр бы `SCROLL_KEY` сразу после `lockListingScrollForModal`). Тот же overlay не должен выглядеть как новый `/search` без `q`: `resolveSearchUrlSync` + snapshot в `search-listing-session.ts`; `useListingFilters` замораживает query-фильтры, пока открыт overlay.

**Пагинация листинга (`InfiniteGrid` + `GET /api/listing`):** для теговых URL — **`LISTING_SSR_INITIAL_LIMIT` (10)** и **`LISTING_INFINITE_PAGE_SIZE` (24)**. Для search-backed (кластер «день рождения») — **`LISTING_SEARCH_PAGE_SIZE` (48)** на SSR и в клиенте; SSOT-запрос материализуется hybrid-ом до 200 id на 1 час, страницы режутся из кэша, peek `limit+1`, флаг **`has_more`**. Текстовое окно по-прежнему `least(100, p_limit)`, visual — отдельный RPC только на cache miss. В теговом ответе API есть **`ranked_batch_size`** (число строк из RPC до `expandCardGroups`) и **`sort`**. Следующий **`offset`** увеличивается на это значение, а не на `cards.length`: иначе split-группы раздувают массив, OFFSET в SQL перескакивает через «недопоказанные» ранги и сетка листинга визуально «перемешивается». Условие «есть ещё страницы»: `hasMoreRankedPages` = `offset + ranked_batch_size < total_count`. Автодогрузка — **`useListingSentinelLoadMore`**: IO + drain после settle, если сенсор всё ещё в `LISTING_SENTINEL_ROOT_MARGIN_PX`. Смена **`sort`** или query-фильтра → remount `InfiniteGrid` (key включает `mergedRpcParams` + sort), **`offset=0`**, **`resetListingScroll()`**. Empty state при `sort=new` и `total_count=0`: «Пока нет новых». Риск дубликатов/пропусков при живом **`popularity_score`** + OFFSET — как с `view_count`; follow-up: keyset pagination. Повтор `card.id` между страницами (sibling с прошлой порции + ranked row) снимается в **`appendUniqueCardPage`** (`landing/src/lib/listing-cards.ts`) — offset по ranked не откатываем, чтобы не зациклить infinite scroll; drain продолжает, если порция целиком схлопнулась в дубли. `StableListingMasonry` последовательно продолжает детерминированные 2/3/4 lanes: добавление порции не меняет placement prefix и не создаёт page-boundary gaps. Публичный рендер — **одна masonry-плитка на `card.id`**, без `GroupedCard`.

**Плитки листинга (`ListingPhotoTile`):** то же визуальное правило, что главная и блок генерации — aspect первого фото, клик → модалка. Главная/короткие блоки используют CSS columns; infinite-листинги — `StableListingMasonry` с абсолютными lanes в container-query units. Hover-chrome / `listing-grid-clamp` на этих лентах не используются (`ListingGrid` 3:4 остаётся у `/generations` и `/analyses`). **`priority`** (`LISTING_LCP_PRIORITY_GRID_ITEMS` = 12) — `next/image priority` / `fetchPriority` у первых плиток. Pagination skeleton — **`ListingMasonrySkeleton`**. Legacy **`PromptCard` / `GroupedCard`** + `ListingCardLoadingShell` сохранены в коде, но публичные ленты их не монтируют.

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
│   ├── supabase-server-client.ts ← Singleton service-role `createSupabaseServer` (без GoTrue timer)
│   ├── supabase-cookie-client.ts ← Cookie/Bearer `createServerClient` с тем же `SUPABASE_SERVER_AUTH`
│   ├── next-cache-memory.ts    ← `cacheMaxMemorySize` 32 МБ для Next in-process cache
│   ├── supabase.ts             ← Реэкспорт клиента + data fetching
│   ├── auth-oauth.ts           ← signInWithOAuthProvider (google, custom:yandex)
│   ├── auth-return-path.ts     ← sanitize next, ps_auth_next read/write
│   ├── auth-return-screen.ts   ← listing + overlay snapshot after OAuth
│   ├── auth-finish-oauth.ts    ← finishOAuthCodeExchange (browser PKCE)
│   ├── auth-session-hydrate.ts ← getSession overlay vs getUser; pageshow/visibility
│   ├── supabase-browser.ts     ← Браузерный клиент (auth, reactions)
│   ├── supabase-server-auth.ts ← Серверная авторизация (cookie client)
│   ├── tag-registry.ts         ← Реестр SEO-тегов (5 измерений, 100+ тегов)
│   ├── route-resolver.ts       ← Резолвинг URL → теги (L1/L2/L3)
│   ├── den-rozhdeniya-cluster.ts ← SSOT хаба ДР, child-alias, 301, combo-ключи
│   ├── seo-templates.ts        ← SEO для L2/L3: combo-ключ, иначе шаблон
│   ├── seo-content-from-tag.ts ← Шаблон L1 из TagEntry (npm run seo:sync)
│   ├── seo-content.ts          ← SEO для L1 и combo-ключей L2 (кураторский + автодобавленный)
│   ├── homepage-sections.ts    ← buildCategorySectionBlocks(), SECTION_ORDER, SectionBlock
│   ├── homepage-explorer-chips.ts ← Wordstat-чипы главной (pinned + «Ещё»)
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
| Generation worker | Отдельный Dockhost service, N реплик одного образа. Контекст = корень репозитория: `docker build -f Dockerfile.worker .`. Образ содержит `web-generation-worker` и pure helpers `image-generation-prompt.ts`, `grok-image-prompt.ts`, `generation-edit-contract.ts`, `camera-orbit.ts`, `video-motion-prompt.ts`, `user-generation-photo-paths.ts` (список = `web-generation-worker/tsconfig.json` include); health/metrics: `:3003/health/ready`, `:3003/metrics` (`workerId`). `WORKER_ID` пустой. |

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
6. **Alpine + sharp:** не полагаться только на `npm ci` — вложенный optional `@img/sharp-libvips-linuxmusl-x64` может не поставиться, и collect page data упадёт на `libvips-cpp.so.42`. После `npm ci` в deps-стадии нужен `npm install --os=linux --libc=musl --cpu=x64 --include=optional sharp@0.33.5`; `sharp` остаётся в `serverExternalPackages`.

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
| `XAI_API_KEY` | Worker only: Grok Imagine Video. Не на лендинге |
| `XAI_BASE_URL` | Worker: `{GEMINI_PROXY_ORIGIN}/u/api.x.ai`. Пустой — Grok-job `config_error`, без прямого `api.x.ai` |
| `GENERATION_QUEUE_ENABLED` | Landing admission kill switch; `false` → `/api/generate` отвечает 503 до списания |
| `WORKER_PROCESSING_ENABLED` | Worker shadow/maintenance switch; `false` → health работает, claim/reaper выключены |
| `WORKER_ID` | Идентичность реплики в логах/health/metrics. Пустой → `hostname:pid:hex`. Не задавать одно значение на все реплики |
| `WORKER_CONCURRENCY` | Локальный in-flight cap одной реплики; default 10 |
| `WORKER_GLOBAL_CAP` | Глобальный DB processing cap для всех реплик; default 50; не умножать при scale |
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
| `YANDEX_METRIKA_MP_TOKEN` | Server-only токен Measurement Protocol счётчика `107703100`; без него покупки в Директ не уходят |
| `CRON_SECRET` | Bearer-секрет для `POST /api/cron/yookassa-reconcile`, `POST /api/cron/visual-embeddings`, `POST /api/cron/mail-outbox` и `POST /api/cron/mail-due` |
| `POSTBOX_ENDPOINT` | Host Postbox, default `https://postbox.cloud.yandex.net`. РФ, без `GEMINI_PROXY` |
| `POSTBOX_REGION` | SigV4 region, default `ru-central1` |
| `POSTBOX_ACCESS_KEY_ID` / `POSTBOX_SECRET_ACCESS_KEY` | Статические ключи YC. Пустые — cron не claim-ит |
| `POSTBOX_FROM` / `POSTBOX_REPLY_TO` | Default `noreply@promptshot.ru` / `support_ru@promptshot.ru` |
| `MAIL_UNSUBSCRIBE_SECRET` | HMAC для `/unsubscribe` и one-click |
| `POSTBOX_WEBHOOK_SECRET` | Bearer / `X-Postbox-Secret` для bounce webhook |
| `POSTBOX_TEST_ALLOWLIST` | Пока задан, cron шлёт только эти адреса; остальные claimed → `skipped/allowlist` |
| `SEARCH_VISUAL_ENABLED` | `1` включает Gemini visual branch в `/api/search` и birthday SSOT `/api/listing?q=` / SSR; default off |
| `SEARCH_VISUAL_SYSTEM_DAILY_LIMIT` | Дневной IP-лимит actor `system` (listing SSR/cache refresh); default 10000. Не делит user-60 |
| `GEMINI_EMBEDDING_MODEL` | Default `gemini-embedding-2` |
| `GEMINI_EMBEDDING_USE_PROXY` | Default on: `embedContent` через `GEMINI_PROXY_BASE_URL`. `0` — напрямую в Google |
| `SEARCH_VISUAL_GENERATION` | Active embedding generation (default 1) |
| `SEARCH_VISUAL_TIMEOUT_MS` | Query embed timeout, default 800 |
| `SEARCH_VISUAL_IP_DAILY_LIMIT` / `SEARCH_VISUAL_GLOBAL_DAILY_LIMIT` | Бюджет Gemini-вызовов поиска |
