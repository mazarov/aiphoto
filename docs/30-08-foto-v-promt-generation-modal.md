# Фото → промт внутри модалки генерации

> **Дата:** 2026-08-30  
> **Ветка:** `feature/30-08-foto-v-promt-generation-modal`  
> **Маршруты:** `/foto-v-promt`, generate dock на всех listing-path

## Контракт

1. Загрузка фото на `/foto-v-promt` открывает generate dock, не анализирует на странице.
2. В dock есть инструмент **«Промт по фото»** (после «Фотосессия»: Фото → Видео → Фотосессия → Промт по фото).
3. Вход в модалку (FAB, таб, карточка, стартер) **не требует авторизации**. Модалка открывается и показывает все инструменты. На `/foto-v-promt` idle FAB / таб — **«Создать промт по фото»**, открытие ставит инструмент «Промт по фото».
4. Если фото уже выбрано — оно прокидывается в dock и стартует `POST /api/extension/analyze` с инструментом «Промт по фото». Старт ключуется на `intent` + data URL (`shouldStartPhotoPromptAnalyze`). In-flight один на data URL (`sharePhotoPromptAnalyze`): remount / Strict Mode не abortят Gemini. После успеха `markPhotoPromptAnalyzeCompleted` не даёт remount снова сжечь квоту. Клиент жмёт pick до 512px / q0.72 (превью). Сервер один раз жмёт JPEG ≤256px / ≤20KB и один раз зовёт Gemini (`thinkingBudget=0`, таймаут 30с). Нет retry меньшим кадром: ~85KB через DO-прокси не проходит. Не уложились в бюджет — 503, оригинал в Gemini не уходит.
5. Пока крутится analyze — исходное фото в том же `GenerationResultBackdrop`, что результат генерации (без пикселизации, `fit=cover`: кадр — подложка пластины, без letterbox слева/справа). Прогресс **«Создание промта · N%»** только в CTA, не оверлеем на фото.
6. Успех — тот же шит промта, что по клику на поле: текст в textarea, ряд **Скопировать промт** · **Готово**. Режим compose = «Фото», analyze-chrome снимается. Свёрнутое поле до шторки — подпись **Промт** + две строки excerpt, как отдельный блок.

## Границы

| Слой | Ответственность |
|---|---|
| `/foto-v-promt` виджет | SEO-вход + file picker. Не держит loading/result analyze. |
| `GenerateDockContext.seedPhotoPrompt` | Открыть plate, `intent=photo_prompt`, in-memory payload (не sessionStorage). |
| `CardInlineGeneratePanel` | Инструмент, прогресс, result chrome, вызов `analyzeImageToPrompt`. |
| `POST /api/extension/analyze` | Квота 10/сутки на идентичность. Логин **не** сбрасывает счётчик: `extension_rate_limit_merge_ip_to_user` переносит сегодняшний IP-count в `user:{id}`. Дальше 1 кредит. Клиент всегда same-origin (не imageprompt.tools). Тела секций — локаль запроса (`ru` → русский), заголовки `Visual Hook:` остаются EN. Язык — `systemInstruction` + повтор в каждой секции: английский HEADER иначе перебивает preface при `thinkingBudget=0`. |
| Enqueue `/api/generate` | По-прежнему только авторизованный. Auth на «Создать фото», не на открытие dock. |

## Квота analyze

- Гость: 10 успешных разборов / UTC-сутки на IP-бакет.
- После логина тот же остаток: использовал 4 → осталось 6; использовал 10 → `next_mode=paid` / 1 кредит.
- SSOT: `resolveAnalyzeQuotaSnapshot` + RPC merge. Не отдельный гостевой и пользовательский лимит.

## Источник фото для «Промт по фото»

- Клик по инструменту **не** открывает file picker.
- Фото берётся из **«Ваши фото»**. В этом режиме можно выбрать только одно (radio).
- Нет выбранного — CTA «Выберите фото», открывается шит библиотеки.
- Есть выбранное — CTA «Создать промт по фото» анализирует это фото (`data:` или preview URL).
- Гость на этой кнопке видит остаток бесплатных разборов (пилюля `N бесплатно`, как `N✦` у «Создать фото»). Число — `GET /api/extension/analyze/quota` `remaining_free`, до ответа — 10. У авторизованного пилюли нет.
- Загрузка с `/foto-v-promt` кладёт ephemeral-фото в полоску и стартует analyze. Гость без library читает тот же in-memory source (`resolvePhotoPromptAnalyzeSource`).
- Гость может «Добавить» в шите: файл остаётся ephemeral, в `landing_user_photos` не пишется.

## Гость

- `GenerateDockGuestAuthReactor` снят: `plateOpen` больше не открывает auth.
- FAB / mobile tab / card «Повторить» открывают dock.
- Фото / Видео / Фотосессия открываются и дают выбрать модель и фото. CTA — «Войдите». Баланс гостя из `/api/me` (`credits: 0`) не блокирует модели.
- Auth остаётся: enqueue генерации, исчерпанная бесплатная analyze-квота, покупка кредитов.
- Пока plate открыт, live overlay = `generate-dock:<intent>` (`ps_ov` + cookie). После OAuth `AuthReturnScreenRestorer` открывает ту же модалку с тем же инструментом (`photo_prompt` → «Промт по фото»). data:/blob: превью в pending не пишем.

## Данные фото

- `dataUrl` + `previewUrl` живут в модульном holder (`generate-photo-prompt.ts`), не в sessionStorage (квота / PII).
- В `landing_user_photos` не пишем (`shouldAttachLibraryPhotos` false для `photo_prompt`).

## Результат

- После успешного analyze: `enterImageCompose` + `dockSurface=prompt` (как клик по полю промта).
- Поле открыто с готовым текстом. Слева **Скопировать промт**, справа **Готово** (закрывает шит, промт остаётся).
- Дальше обычный compose: «Создать фото» (гость → auth на enqueue).
- Фото остаётся выбранным в «Ваши фото» (ephemeral с лендинга). После успеха — шит промта, не rail Скопировать·Создать·Повторить.
