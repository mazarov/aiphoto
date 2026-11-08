# Генерация фото в Extension Lite через promptshot.ru

> **Дата:** 2026-10-11
> **Ветка (оба репо):** `feature/11-10-extension-lite-generation`
> **Бэкенд:** aiphoto (`promptshot.ru`)
> **Клиент:** `~/imageprompt/extension-lite` (AI Image Describer, CWS)

## Контракт

1. Analyze в Lite не меняется: `POST https://imageprompt.tools/api/extension/analyze`, JWT `ip_app_jwt`.
2. Генерация идёт на **promptshot.ru** с отдельной сессией Supabase (Google PKCE). Bearer access token, как у STV sidepanel (`getSupabaseUserForApiRoute`).
3. Генерация только у авторизованного пользователя с кредитами. Бесплатной квоты нет.
4. Пополнение: `POST /api/buy-credits-link` (Telegram) и ссылка `https://promptshot.ru/pricing`.
5. Фичефлаг только в БД: `landing_generation_config.extension_lite_generate_enabled`, default `false`. Allowlist (`azarov.maxim@gmail.com` + `INTERNAL_GENERATE_ALLOWLIST`) открывает фичу до `UPDATE`. `NODE_ENV` фичу не открывает.
6. При флаге `false` и без allowlist кнопка «Сгенерировать» остаётся LexyGPT (только `ru`). При открытой фиче LexyGPT в result / history / overlay не показывается.
7. Промт из analyze префиллится. Проанализированное фото **не** становится субъектом само: чип «Добавить исходное фото» — явный opt-in через `POST /api/upload-generation-photo`. 0 фото = text-only.
8. `client_source` строки `landing_generations` = `extension_lite`, когда `Origin` совпал с `CHROME_EXTENSION_ID_LITE` (несколько id через запятую). Чужой `X-Client` origin не подменяет. Запросы с сайта по-прежнему пишут `site` — page-бакеты analyze (`foto_v_promt` и т.д.) в enqueue не попадают.

## Бэкенд (aiphoto)

| Слой | Поведение |
|---|---|
| `sql/276_extension_lite_generate_flag.sql` | INSERT ключа `false`, `ON CONFLICT DO NOTHING` |
| `landing/src/lib/extension-lite-access.ts` | `isExtensionLiteGenerateUnlocked(value, email)` — флаг `1/true/yes/on` или allowlist |
| `landing/src/middleware.ts` | CORS: origins STV и Lite (CSV id). Методы `GET, POST, DELETE, OPTIONS`. Заголовки + `X-Client`, `X-Correlation-Id` |
| `POST /api/generate` | `p_client_source` = `resolveClientSource(req)`. `extension_lite` без unlock → `503 { error: "extension_lite_generate_disabled" }` до списания |
| `GET /api/generation-config` | Поле `extensionLiteGenerateEnabled` в image и video. Тот же хелпер, email из Bearer |

Остальной контракт `/api/generate` (фото, parent + editInstruction, video, sticker, photoshoot) не меняется. Промпт-сборка остаётся на сервере и в `web-generation-worker`.

Env (инфра, не флаг): `CHROME_EXTENSION_ID_LITE` на Dockhost. Несколько id — через запятую (CWS и unpacked). Supabase Auth → Redirect URLs: `chrome-extension://<id>/auth-callback.html` для каждого id.

## Клиент (extension-lite)

Side panel держит supabase-клиент и все вызовы promptshot. Service worker только хранит `extension_lite_generation_job_v1` и будит `chrome.alarms`, пока job не terminal: панель может быть закрыта, job на сервере живёт. Период 0.5 мин в unpacked; собранный CWS Chrome поднимает `periodInMinutes` до 1.

| Файл | Роль |
|---|---|
| `lib/vendor/supabase.js` | Копия STV vendor |
| `lib/promptshot-auth.js` | PKCE, `chrome.storage.local`, `ps_api_origin` (default `https://promptshot.ru`) |
| `auth-callback.html` / `.js` | `exchangeCodeForSession`, broadcast `LITE_PS_AUTH_UPDATED`, закрыть вкладку |
| `lib/promptshot-api.js` | Bearer, `X-Client: extension_lite`, Idempotency-Key, маппинг 401 / `insufficient_credits` / `*_disabled` |
| `lib/generation-options.js` | `TOOLS` / `availableTools` (флаги конфига), модель только из `models`, AR/size/duration из конфига, prefs `extension_lite_generation_prefs_v1` (`tool`, фото-, видео-, стикер-настройки), без автосмены модели из-за баланса |
| `generate-panel.js` | Dock внутри `.result-stage` под карточкой анализа, виден сразу после анализа → инструмент → submit → poll 2500 мс → результат как подложка + рельс |

UI повторяет generate dock лендинга. Подложка shell — проанализированное фото; стеклянная карточка `#prompt-box` остаётся единственным источником промпта (dock читает и пишет её через хуки `getPrompt` / `setPrompt`; кнопка «Изменить» в шапке карточки открывает sheet с textarea). Dock — матовая плита снизу, показывается **сразу**, как только на экране карточка анализа, но только для UI-локали `ru` (`nativeOn()` в панели, SW отвечает `GET_LITE_GENERATE_ENABLED` по `resolveUiLocaleFolder() === "ru"`): RU — генерация и вход через PromptShot, остальные локали — прежний flow только с imageprompt-аккаунтом, без dock, чипа и блока «Аккаунт PromptShot» в Настройках. Флаг БД в расширении не читается, гейт остаётся только на сервере — `POST /api/generate` отдаёт 503 `extension_lite_generate_disabled`, пока `extension_lite_generate_enabled=false` и origin совпадает с `CHROME_EXTENSION_ID_LITE`. На время отладки `DEFAULT_PS_ORIGIN = http://localhost:3002` (`lib/promptshot-auth.js`, `background.js`); перед релизом вернуть `https://promptshot.ru`. Плитки как в ряду инструментов модалки лендинга (`ComposeToolChoiceTile`: квадрат 84px, имя на верхней кромке, белая круглая иконка, выбранная — indigo). Полоса дока как на лендинге: «Ваши фото» → «Инструмент» (плитка с иконкой и именем текущего инструмента; открывает sheet `#ps-sheet-tool`, где те же квадратные плитки Анализ / Фото / Видео / Стикер / Фотосессия — видео, стикер, фотосессия только при `videoConfig.enabled` / `stickerEnabled` / `photoshootEnabled`) → параметры выбранного: для Фото — «Пример» (sheet `#ps-sheet-example`: `GET /api/listing?limit=12&sort=new` / `?q=` с offset-пагинацией, фильтр как landing `filterComposeExampleCards("photo")` — только карточки с промтом и не фотосессии; подбор под фото как на лендинге: при `composeExampleMatchEnabled` аудитория первого выбранного фото (`audienceTag` из `/api/user-generation-photos` или `POST /api/compose/classify-audience {photoId}`) идёт в `audience_tag` листинга, сверху chip «Девушки/Мужчины/…» с × = «Показать все примеры», при поиске фильтр снимается; сетка в отдельной scroll-области с догрузкой у конца; выбор ставит промт по правилу `selectedPromptText`, при коротком — дотягивает `/api/card/<slug>`, и передаёт `cardId` в `POST /api/generate`; сбрасывается на новом разборе), «Ваши фото» (лимит `maxPhotos` для фото, 1 для остальных) и «Модель» (фото: модель + формат + качество; видео: модель + формат + длительность) или «Стиль» (стикер, каталог `/api/sticker-catalog`), pill «Сохранить одежду» для фото. Инструмент «Анализ» — обычный экран расширения (Copy / Another / remix), CTA скрыт. Для остальных один CTA `Создать фото|видео|стикер|фотосессию · N✦` / `Войти в PromptShot` / `Выберите фото` / `Купить кредиты…`; во время генерации CTA заливается прогрессом, подложка размывается, карточка приглушена. Выбранный инструмент хранится в prefs. Готовый результат становится full-bleed слоем подложки (`#ps-result-backdrop` / `#ps-result-video`), карточка анализа и dock скрыты, справа вертикальный рельс (Посмотреть, Скачать, Повторить, [Оживить], [Стикер], [Фотосессия], primary «Что изменить» → sheet «Изменить картинку» с `editInstruction`) и меню «Ещё» (Поделиться, Скопировать промпт, Использовать, [Опубликовать], Мои генерации, Удалить). «К анализу» возвращает подложку, карточку и dock; любая перерисовка analyze-сцены сбрасывает dock в compose (`resetStage`, конфиг кэшируется 60 с), job остаётся в SW. Вход в PromptShot — в Настройках («Аккаунт PromptShot») и по чипу в topbar.

Тело `POST /api/generate`: `generationSurface: "prompt_card"`, `modality`, `prompt`, `model`, `aspectRatio`, `imageSize`, `photoStoragePaths`, `preserveOutfit`, `cardId` (id карточки из «Пример», иначе `null`). Правка: `parentGenerationId` + `editInstruction`. Инструменты из compose: видео — `modality=video`, `model` из video-конфига, `durationSeconds`, `imageSize=720p`, до 1 фото; стикер — `editKind=sticker` + `stickerStyleId` + ровно 1 фото; фотосессия — `editKind=photoshoot` + ровно 1 фото, `imageSize=2K`. Из результата (рельс): animate (`animate-scenario` → `modality=video` + `parentGenerationId`), sticker / photoshoot с `parentGenerationId` без фото, publish. Camera orbit в UI нет.

Кэш `extensionLiteGenerateEnabled` в `chrome.storage.local`, TTL 10 минут; после входа в PromptShot конфиг читается заново.

i18n: ключи `ps*` в `_locales/en` и `_locales/ru`. Остальные локали падают на английский через `lib/i18n.js` (ключ отсутствует → en).

Телеметрия imageprompt (`landing/src/lib/client-events.ts`): `lexygpt_click`, `generate_click`, `ps_auth_start`, `ps_auth_ok`, `generate_start_ok`, `generate_start_error`, `generate_result_shown`, `generate_failed`, `generate_action_click`, `buy_credits_click`.

## Выкат

1. Смержить aiphoto в `main` и задеплоить. Флаг остаётся `false`.
2. Dockhost landing: `CHROME_EXTENSION_ID_LITE=<cws id>[,<unpacked id>]`.
3. Self-hosted GoTrue (контейнер `auth` на Dockhost, перезапуск после правки env): добавить `chrome-extension://<id>/auth-callback.html` в `GOTRUE_URI_ALLOW_LIST` через запятую (точный URL показан в Настройках расширения → «Для разработки», кнопка «Копировать»). В манифесте `auth-callback.html` / `auth-callback.js` обязаны быть в `web_accessible_resources` — иначе редирект с GoTrue на страницу расширения даёт `ERR_BLOCKED_BY_CLIENT`. Без этого GoTrue после Google уводит на `SITE_URL/?code=`; панель это ловит через `chrome.tabs.onUpdated`, забирает `code` из URL вкладки и делает PKCE-exchange сама (verifier лежит только в storage расширения), затем закрывает вкладку — вход работает, но с лишней вкладкой promptshot.ru. `exchangeCodeForSession` принимает **raw `code`**, не URL.
4. Собрать Lite `1.1.0`, отправить в CWS. Dock виден только локали `ru`; пока флаг `false`, enqueue отвечает 503.
5. Smoke под `azarov.maxim@gmail.com` (allowlist, флаг ещё `false`): вход PromptShot → загрузка фото → «Создать фото» → poll → скачать / правка / удалить. В `landing_generations.client_source` = `extension_lite`.
6. Открыть всем:

```sql
UPDATE public.landing_generation_config
SET value = 'true', updated_at = now()
WHERE key = 'extension_lite_generate_enabled';
```

Откат — тот же `UPDATE` на `'false'`, без редеплоя. Кнопка пропадёт после TTL кэша конфига (10 мин) или перезапуска панели.

## Не делать в этом выкате

- Бесплатную квоту генерации и гостевой enqueue.
- Подстановку чужого фото с веб-страницы как субъекта без чипа.
- Перенос analyze с imageprompt.tools.
- Camera orbit в UI Lite.
- Запись prefs в `landing_generation_preferences` (v1 — только `chrome.storage.local`).
