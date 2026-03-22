# PromptShot extension — разработка UI

Краткая карта для правок без полного чтения кода.

## Файлы

| Файл | Назначение |
|------|------------|
| `sidepanel/styles.css` | Визуал панели: токены `--stv-*`, классы `.stv-*`, базовые `.card`, `.row` |
| `sidepanel/app.js` | Состояние `state`, `render()` …; доставка референса: **`STV_PENDING_VIBE`**, **`session.onChanged`**, и **poll `chrome.storage.session` ~350ms** (основной запас, т.к. SW→panel часто молчит); превью референса с **`_stv=<at>`** cache-bust; **фото пользователя (1–4):** `state.userPhotos[]` (`storagePath`, `fileName` + эфемерные превью); persist только пути/имена; миграция со старых `photoStoragePath` / `uploadedFileName`; после перезагрузки — **`refreshUserPhotosSignedPreviews()`** (signed URL на каждый path), см. `docs/23-03-stv-multi-user-photos-ui.md`; `POST /api/generate` получает **`photoStoragePaths`** = все пути в порядке сетки |
| `sidepanel/i18n.js` | Строки RU/DE (`t("key")`) |
| `sidepanel/index.html` | Корень `#app`, подключение CSS/JS |
| `content-script.js` | Плавающая кнопка: Shadow DOM; визуал как **mini side panel** (zinc surface + градиент только на **P**); видимость: throttled **`mousemove`** + **паддинг вокруг active img** (не полагаться на `document mouseout` — ломает Pinterest) |

Спека для дизайна и LLM: **`docs/extension-ui-spec.md`**.  
Флоу vibe → generate (референс `2c23ce94`, текущий код, флаг 3×): **`docs/22-03-stv-single-generation-flow.md`**.

## Токены бренда

Менять палитру и радиусы — в **`styles.css` → `:root`**: `--stv-primary`, `--stv-accent`, `--stv-bg`, и т.д. Панель сознательно **тёмная** (Chrome side panel), но акценты совпадают с лендингом (indigo → violet).

## Как устроен `render()`

1. `state.loading` → скелетон с `.stv-loading-card`.
2. `!state.user` → `renderAuthRequired()` (shell + topbar без «Выйти»).
3. Иначе → `renderMain()`:
   - корень **`.stv-shell`**;
   - **`.stv-topbar`** — бренд, язык, выход;
   - **`.card.stv-card-main`** — шаги 1–3 (`<section class="stv-section">`), мета-полоса, сводка done/errors, `<details class="stv-disclosure">` для вторичных действий и dev-блока; **шаг 1** включает три колонки (фото / референс / результат) и при активных генерациях — прогресс под сеткой;
   - соседние карточки: пайплайн (`.stv-card-side`), история (`.stv-card-history`). Результаты — компактные **`.stv-result-compact`** в третьей колонке шага 1, не отдельным блоком под карточкой.

Любой новый блок: добавить разметку в шаблон, стили в CSS, ключи в `i18n.js`, обработчики **после** присвоения `innerHTML` (как существующие `getElementById`).

## Ограничения

- Полный ре-рендер DOM при каждом `render()` — не рассчитывать на сохранение фокуса в полях между тиками.
- Новые id должны быть уникальны в одном проходе `renderMain()`.

## Отладка: референс не меняется после клика

Что прислать разработчику:

1. **Версия Chrome** и ОС.
2. **Сайт** (например pinterest.com) и шаги: панель уже открыта или нет.
3. **Консоль service worker:** `chrome://extensions` → расширение → **Service worker** → Inspect → после клика смотреть ошибки (красное).
4. **Консоль side panel:** открыть панель → ПКМ по панели → **Inspect** (или меню ⋮ панели) → вкладка **Console** — ошибки и предупреждения.
5. **`Extension context invalidated`** при клике на кнопку — после **Обновить** расширения на `chrome://extensions` обязательно **перезагрузите вкладку** (F5). Content script со старым контекстом без этого не заработает; в новых сборках показывается `alert` с подсказкой.
6. В **Network** панели: после клика меняется ли URL картинки в превью (должен появляться query `_stv=<timestamp>`).

Локально можно временно в `applyPendingVibeFromStorage` добавить `console.log("[stv] vibe", url, vibe.at)` и смотреть side panel console.
