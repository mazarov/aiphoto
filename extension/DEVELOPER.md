# PromptShot extension — разработка UI

Краткая карта для правок без полного чтения кода.

## Файлы

| Файл | Назначение |
|------|------------|
| `sidepanel/styles.css` | Визуал панели: токены `--stv-*`, классы `.stv-*`, базовые `.card`, `.row` |
| `sidepanel/stv-core.js` | Состояние `state`, `render()`, API — **единый модуль** для Chrome и лендинга. Точки входа: **`boot-chrome.js`** (side panel) и **`boot-web.js`** (бандл в `landing/public/stv-panel/`). Платформенные хуки: `extension/sidepanel/platform/*` (`chrome.storage` / `session` vs `localStorage` / `sessionStorage`, OAuth redirect). Референс стиля: URL (доставка в extension — **`STV_PENDING_VIBE`**, **`session.onChanged`**, poll **`chrome.storage.session` ~350ms**; на сайте — query **`sourceImageUrl`** на `/embed/stv`) **или** один файл с ПК — **`state.referencePhoto`** (`POST /api/upload-generation-photo`, extract через свежий **`/api/upload-generation-photo/signed-url`**). Взаимоисключение с URL-референсом. Превью URL с **`_stv=<at>`**, загрузки — **`_stvref=`**. **Фото пользователя (1–4):** `state.userPhotos[]`; `POST /api/generate` — **`photoStoragePaths`** + опционально **`cardId`** (`state.landingCardId`). **Вкладки:** `state.panelTab` (`prompt` / `generate` / `history`), два `input` референса: **`stv-ref-file-prompt`**, **`stv-ref-file-generate`**. Режим **3× генерация:** только **`localStorage`** ключ **`stv_triple_variant_flow`** (= `1`), UI-чекбокса нет. |
| `sidepanel/stv-prompt-assembly.js` | Клиентская сборка legacy-тела промпта + grooming + превью CRITICAL (должна совпадать с `landing/src/lib/vibe-legacy-prompt-chain.ts` и `vibe-gemini-instructions.ts`). |
| `sidepanel/boot-chrome.js` | `configureStv` + `boot()` для панели; подключён из `index.html` |
| `sidepanel/boot-web.js` | То же ядро для веб; из **`landing/`**: **`npm run build:stv-web`**. Зеркало для Docker: **`landing/stv-web-sidepanel/`** — **`npm run sync:stv-sidepanel`** после правок здесь |
| `sidepanel/i18n.js` | Строки RU/DE (`t("key")`) |
| `sidepanel/index.html` | Корень `#app`, подключение CSS/JS |
| `content-script.js` | Плавающая кнопка: Shadow DOM; визуал как **mini side panel** (zinc surface + градиент только на **P**); видимость: throttled **`mousemove`** + **паддинг вокруг active img** (не полагаться на `document mouseout` — ломает Pinterest). Порог размера — по **`getBoundingClientRect()`** (не intrinsic), плюс отсев `nav`/`header`/`footer`/`[role=navigation|banner|contentinfo]`, `.svg` в URL, **`MIN_RENDERED_SIZE`** |

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
