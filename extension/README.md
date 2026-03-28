# Steal This Vibe Extension (MVP scaffold)

**UI / визуальная логика для дизайна и LLM:** см. [`docs/extension-ui-spec.md`](../docs/extension-ui-spec.md).

Flow:

1. hover на изображение -> кнопка `Steal this vibe`
2. click -> открывается side panel
3. вход **Google в панели** (PKCE + `sidepanel/auth-callback.html`); API с `Authorization: Bearer`
4. **Референс стиля:** с сайта (шаг 1) **или** одно фото с ПК в той же колонке панели («+» / «×») → тот же bucket, перед extract — signed URL
5. **Ваше фото (1–4):** upload -> `/api/upload-generation-photo` (пути в `chrome.storage` до смены / сброса)
6. extract -> `/api/vibe/extract`
7. expand -> `/api/vibe/expand` (сервер по-прежнему отдаёт 3 промпта; расширение использует **первый**)
8. **одна** генерация -> `/api/generate`
9. polling -> `/api/generations/[id]`
10. save -> `/api/vibe/save`

В карточке результата показывается **текст промпта**, ушедший в `POST /api/generate` (из expand).

После успешного extract/expand отображается блок **«Шаг 1»**: JSON стиля с референса, поля **`modelUsed`** (vision / expand) и кнопка загрузки полных системных инструкций через `GET /api/vibe/pipeline-spec`.

**Язык UI:** RU по умолчанию, EN если `navigator.language` начинается с `en`, DE если с `de`; выбор **Русский / English / Deutsch** в выпадающем списке в шапке панели (`localStorage.stv_ui_lang`: `ru` | `en` | `de`).

## Структура

- `manifest.json`
- `background.js`
- `content-script.js`
- `content-script.css`
- `sidepanel/index.html`
- `sidepanel/boot-chrome.js` → `stv-core.js` (общая логика с веб-embed)
- `sidepanel/platform/chrome-platform.js` / `web-platform.js`
- `sidepanel/boot-web.js` — собирается в `landing/public/stv-panel/boot.mjs` (`landing`: `npm run build:stv-web`; зеркало для CI — **`landing/stv-web-sidepanel/`**, обновление: **`npm run sync:stv-sidepanel`**)
- `sidepanel/i18n.js`, `sidepanel/supabase-extension.js` (Chrome), `supabase-web.js` (embed)
- `sidepanel/auth-callback.html` + `auth-callback.js` (OAuth redirect)
- `sidepanel/vendor/supabase.js` (бандл `@supabase/supabase-js`, см. ниже)
- `sidepanel/styles.css`

### Supabase Redirect URLs

В Supabase Dashboard → Authentication → URL configuration добавь **точный** redirect:

`chrome-extension://<ТВОЙ_EXTENSION_ID>/sidepanel/auth-callback.html`

ID смотри в `chrome://extensions` ( unpacked — стабилен для папки). Без этого Google OAuth вернёт ошибку.

### Пересборка `vendor/supabase.js`

Из каталога `landing`:

```bash
npm run vendor:extension
```

### Веб-бандл и образ лендинга

- Локально: из **`landing/`** — **`npm run build:stv-web`** / **`npm run build`** (предпочтительно **`../extension/sidepanel`**; иначе зеркало **`landing/stv-web-sidepanel/`**).
- После правок **`extension/sidepanel/`** для веба: из **`landing/`** — **`npm run sync:stv-sidepanel`** и коммит зеркала.
- Docker: контекст **`landing/`** — **`docker build -f landing/Dockerfile landing/`** (см. **`landing/README.md`**).

## Запуск в Chrome (dev)

1. Открой `chrome://extensions`
2. Включи `Developer mode`
3. Нажми `Load unpacked`
4. Выбери папку `aiphoto/extension`
5. Закрепи extension и открой любой сайт с изображениями

## Важно для API и CORS

Extension делает запросы c origin `chrome-extension://<EXT_ID>`.
Backend разрешает origin через `CHROME_EXTENSION_ID` / `CORS_ALLOWED_ORIGINS`.
После входа через Google в панели к API уходит **`Authorization: Bearer <access_token>`** (плюс `credentials: include` для совместимости).

Настройки на стороне landing (`landing/.env.local`):

```bash
# Уже существующие
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...

# Новые для CORS extension
CHROME_EXTENSION_ID=<your_extension_id_from_chrome_extensions>
# или список через запятую:
# CORS_ALLOWED_ORIGINS=chrome-extension://<id1>,chrome-extension://<id2>
```

## API origin для sidepanel

По умолчанию `stv-core` + `boot-chrome` используют:

```js
const API_ORIGIN = localStorage.getItem("stv_api_origin") || "https://promptshot.ru";
```

Для локальной разработки (landing на `http://localhost:3001`):

1. Открой DevTools sidepanel
2. Выполни:

```js
localStorage.setItem("stv_api_origin", "http://localhost:3001");
location.reload();
```

## Ограничения текущего scaffold

- UI остаётся упрощённым (plain JS без фреймворка)
- Автопубликация в `prompt_cards` best-effort (при ошибке публикации сохранение остаётся в `landing_vibe_saves`)
- Веб-встраивание: бандл `boot.mjs` через esbuild в `landing` (`npm run build:stv-web`); Chrome-панель по-прежнему native ESM без бандла

## Что уже есть в phase2

- Частичные ошибки не роняют весь запуск (можно получить 2/3 успешных результатов)
- Retry для отдельного failed-результата
- Retry all failed для пакетного повтора
- Reset session для быстрой очистки локального состояния
- Сохранение состояния sidepanel в `chrome.storage.local` (восстановление после закрытия панели)
- Run History (последние запуски: модель, размеры, успешные/ошибки)
- Агрегированные метрики history (успешность %, last error type)
- Метрики по акцентам (`lighting`, `mood`, `composition`) с success rate
- Export run history в JSON + Clear history
- Динамическая загрузка generation config через `/api/generation-config`
- Cooldown на повторный запуск генерации (anti-spam)
- Двухшаговое подтверждение стоимости перед запуском (credits confirm)
- Soft auth fallback: при 401/403 sidepanel возвращается в экран логина
- Индикатор состояния сессии (активна / требуется вход)
- Авто-обновление сессии/кредитов каждые 30 секунд
- Автовосстановление незавершённых генераций при повторном открытии sidepanel
- Кнопка «Очистить результаты» (без сброса выбранных настроек)
- Общий progress bar по 3 задачам генерации
- Адаптивный polling (увеличение интервала на long-running задачах)
- Status detail для долгих генераций (понятный текст вместо "тишины")
- Нормализация API-ошибок в понятные сообщения (auth/credits/validation/server)
- First-run hint в sidepanel (как начать работу)
- Inline toast-уведомления (info/success/error) с авто-скрытием
- При `Save` отображается количество auto-tag (`autoTagCount`), если карточка уже доступна

## Smoke checklist (phase2 ready)

- Авторизация из sidepanel проходит через `/api/me` (есть user + credits)
- Загрузка фото в `/api/upload-generation-photo` успешна
- Запуск 3 генераций проходит через `/api/generate` + polling `/api/generations/[id]`
- При частичном фейле работает `Retry` и `Retry all failed`
- После перезагрузки sidepanel состояние и незавершенные задачи восстанавливаются
- `Save` вызывает `/api/vibe/save` и не ломает текущую сессию
- Кнопка «Очистить результаты» чистит только результаты (без сброса model/ratio/size/source)
