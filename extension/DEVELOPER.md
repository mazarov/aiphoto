# PromptShot extension — разработка UI

Краткая карта для правок без полного чтения кода.

## Файлы

| Файл | Назначение |
|------|------------|
| `sidepanel/styles.css` | Визуал панели: токены `--stv-*`, классы `.stv-*`, базовые `.card`, `.row` |
| `sidepanel/app.js` | Состояние `state`, `render()` / `renderMain()` / `renderAuthRequired()` — **вся разметка в шаблонных строках** |
| `sidepanel/i18n.js` | Строки RU/DE (`t("key")`) |
| `sidepanel/index.html` | Корень `#app`, подключение CSS/JS |
| `content-script.js` | Плавающая кнопка: Shadow DOM + inline `<style>` в JS; копирайт **`OVERLAY_I18N`** + `getOverlayLang()` (по `navigator.language`); компактный режим при узкой картинке (`COMPACT_IMG_WIDTH`) |

Спека для дизайна и LLM: **`docs/extension-ui-spec.md`**.

## Токены бренда

Менять палитру и радиусы — в **`styles.css` → `:root`**: `--stv-primary`, `--stv-accent`, `--stv-bg`, и т.д. Панель сознательно **тёмная** (Chrome side panel), но акценты совпадают с лендингом (indigo → violet).

## Как устроен `render()`

1. `state.loading` → скелетон с `.stv-loading-card`.
2. `!state.user` → `renderAuthRequired()` (shell + topbar без «Выйти»).
3. Иначе → `renderMain()`:
   - корень **`.stv-shell`**;
   - **`.stv-topbar`** — бренд, язык, выход;
   - **`.card.stv-card-main`** — шаги 1–4 (`<section class="stv-section">`), мета-полоса, прогресс, `<details class="stv-disclosure">` для вторичных действий и dev-блока;
   - соседние карточки: пайплайн (`.stv-card-side`), результаты (`.stv-card-result`), история (`.stv-card-history`).

Любой новый блок: добавить разметку в шаблон, стили в CSS, ключи в `i18n.js`, обработчики **после** присвоения `innerHTML` (как существующие `getElementById`).

## Ограничения

- Полный ре-рендер DOM при каждом `render()` — не рассчитывать на сохранение фокуса в полях между тиками.
- Новые id должны быть уникальны в одном проходе `renderMain()`.
