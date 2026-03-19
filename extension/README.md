# Steal This Vibe Extension (MVP scaffold)

Минимальный scaffold для flow:

1. hover на изображение -> кнопка `Steal this vibe`
2. click -> открывается side panel
3. auth check через `/api/me`
4. upload фото -> `/api/upload-generation-photo`
5. extract -> `/api/vibe/extract`
6. expand -> `/api/vibe/expand`
7. 3x generate -> `/api/generate`
8. polling -> `/api/generations/[id]`
9. save -> `/api/vibe/save`

## Структура

- `manifest.json`
- `background.js`
- `content-script.js`
- `content-script.css`
- `sidepanel/index.html`
- `sidepanel/app.js`
- `sidepanel/styles.css`

## Запуск в Chrome (dev)

1. Открой `chrome://extensions`
2. Включи `Developer mode`
3. Нажми `Load unpacked`
4. Выбери папку `aiphoto/extension`
5. Закрепи extension и открой любой сайт с изображениями

## Важно для API и CORS

Extension делает запросы c origin `chrome-extension://<EXT_ID>`.
Для успешной авторизации (`credentials: include`) backend должен разрешить этот origin.

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

- Нет продуманного UI/UX состояния для частичных ошибок
- Нет ретраев для failed генераций
- Нет автоматической публикации в `prompt_cards` (save пишет в `landing_vibe_saves`)
- Нет сборки через bundler (пока plain JS)
