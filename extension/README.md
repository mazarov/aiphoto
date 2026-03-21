# Steal This Vibe Extension (MVP scaffold)

Flow:

1. hover на изображение -> кнопка `Steal this vibe`
2. click -> открывается side panel
3. вход **Google в панели** (PKCE + `sidepanel/auth-callback.html`); API с `Authorization: Bearer`
4. upload фото -> `/api/upload-generation-photo` (путь и имя файла сохраняются в `chrome.storage` до смены фото / сброса)
5. extract -> `/api/vibe/extract`
6. expand -> `/api/vibe/expand` (сервер по-прежнему отдаёт 3 промпта; расширение использует **первый**)
7. **одна** генерация -> `/api/generate`
8. polling -> `/api/generations/[id]`
9. save -> `/api/vibe/save`

**Язык UI:** RU по умолчанию, DE если `navigator.language` начинается с `de`, либо переключатель **DE/RU** в панели (`localStorage.stv_ui_lang`).

## Структура

- `manifest.json`
- `background.js`
- `content-script.js`
- `content-script.css`
- `sidepanel/index.html`
- `sidepanel/app.js` (ES modules)
- `sidepanel/i18n.js`, `sidepanel/supabase-extension.js`
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

По умолчанию `sidepanel/app.js` использует:

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
- Нет сборки через bundler (пока plain JS)

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
