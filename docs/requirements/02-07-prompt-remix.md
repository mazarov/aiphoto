# 02-07 — Prompt Remix («Изменить промт под себя»)

> Дата: 2026-06-15

## Цель

Дать пользователю точку входа с карточки промта `/p/[slug]`, где он может быстро переписать готовый промт под свою идею — без загрузки фото и без ручного редактирования текста. Побочная цель: ненавязчивая конверсия в установку расширения AI Image Describer.

---

## Flow

```
/p/[slug]
  └─ CTA «Изменить промт под себя» (над FotoVPromtMiniBanner)
       → /foto-v-promt?card=<slug>&src=card (новая вкладка / переход)
            └─ PromptSceneLiteWidgetGate видит ?card → монтирует PromptRemixWidget
                 ├─ GET /api/card/[slug] → promptTexts[] (оригинальный промт карточки)
                 ├─ показываем оригинальный промт (read-only)
                 ├─ textarea «Что изменить?» + выбор стиля (4 варианта)
                 └─ POST /api/prompt-remix { originalPrompt, changeRequest, style }
                      → Gemini text → { prompt }
                          └─ результат + «Копировать» + «Повторить в LexyGPT» + «Изменить ещё раз»
                               └─ хинт про расширение AI Image Describer
```

---

## Архитектура (как у анализа фото)

Remix-вызов идёт **не напрямую в Gemini из этого репо**, а на проект **imageprompt.tools** — точно так же, как `/foto-v-promt` отправляет анализ фото на `imageprompt.tools/api/extension/analyze`. Причина: прямой доступ к `generativelanguage.googleapis.com` из РФ заблокирован; imageprompt-эндпоинты уже умеют ходить через прокси DigitalOcean (`getGeminiBaseUrl` читает `photo_app_config.gemini_use_proxy` + `GEMINI_PROXY_BASE_URL`).

```
PromptRemixWidget
  → getPromptRemixUrl()
       ├─ dev:  /api/imageprompt-proxy/extension/remix  (same-origin прокси, без CORS)
       └─ prod: https://imageprompt.tools/api/extension/remix  (cross-origin)
            └─ [imageprompt repo] /api/extension/remix
                 ├─ extension rate-limit (checkAndIncrementExtensionLimit)
                 ├─ Gemini text через getGeminiBaseUrl (прокси DO)
                 └─ { prompt }
```

## Компоненты и файлы

### Этот репо (landing)

| Файл | Роль |
|------|------|
| `landing/src/lib/foto-v-promt-config.ts` | `getPromptRemixUrl()` (dev-прокси / прод imageprompt.tools) |
| `landing/src/lib/foto-v-promt-copy.ts` | `PROMPT_REMIX_COPY`, `PROMPT_REMIX_CARD_CTA` |
| `landing/src/app/api/imageprompt-proxy/extension/remix/route.ts` | Dev-only same-origin прокси к imageprompt.tools |
| `landing/src/components/foto-v-promt/PromptRemixWidget.tsx` | Клиентский UI remix-режима |
| `landing/src/components/foto-v-promt-promo/PromptRemixCardCta.tsx` | CTA «Изменить промт под себя» (card / cardImmersive) |
| `landing/src/components/foto-v-promt/PromptSceneLiteWidgetGate.tsx` | Роутинг по `?card` → `PromptRemixWidget` |
| `landing/src/components/CardPageClient.tsx` | Размещение CTA (sticky-бар + mobile immersive) |

### Репо imageprompt (`~/imageprompt`)

| Файл | Роль |
|------|------|
| `landing/src/app/api/extension/remix/route.ts` | Сам remix: валидация, extension rate-limit, Gemini text через прокси DO |

---

## API: POST /api/extension/remix (в репо imageprompt)

### Запрос

```json
{
  "originalPrompt": "string (1–8000 символов)",
  "changeRequest": "string (1–1000 символов)",
  "style": "photoreal | midjourney | sd | flux"
}
```

### Ответ

| Статус | Тело | Условие |
|--------|------|---------|
| 200 | `{ "prompt": "string", "remaining?", "count?", "max?" }` | Успех |
| 400 | `{ "error": "invalid_request" }` | Пустые/сверхдлинные поля или невалидный JSON |
| 429 | `{ "error": "rate_limited", "auth_required" }` | Превышен дневной extension-лимит |
| 500 | `{ "error": "upstream_failed" }` | Нет `GEMINI_API_KEY` |
| 502/503 | `{ "error": "upstream_failed" }` | Ошибка/таймаут Gemini |

### Gemini

- Инструкция: переписать ORIGINAL применяя ТОЛЬКО запрошенные изменения; сохранить замысел, структуру и язык (русский → русский); вернуть ТОЛЬКО финальный промт.
- Модель `gemini-2.5-flash`, temperature `0.7`, maxOutputTokens `2048`.
- Base URL через `getGeminiBaseUrl` (прокси DigitalOcean при `gemini_use_proxy`).

### Rate-limit

- Тот же механизм, что у `extension/analyze` — `checkAndIncrementExtensionLimit` (Supabase RPC, дневной лимит по IP/пользователю).

---

## CTA на карточке

- Файл: `CardPageClient.tsx`, блок нижнего sticky-бара (desktop + mobile без hero).
- Позиция: над `<FotoVPromtMiniBanner variant="card" />`.
- Показывается только если `data.promptTexts.length > 0`.
- URL: `/foto-v-promt?card=${slug}&src=card`.
- Копии: `PROMPT_REMIX_CARD_CTA` из `foto-v-promt-copy.ts`.

---

## Роутинг в Gate

`PromptSceneLiteWidgetGate` читает `window.location.search` в `useEffect` (без `useSearchParams`/Suspense):
- Нет `?card` → обычный режим анализа фото (без изменений).
- Есть `?card=<slug>` → сразу монтирует `PromptRemixWidget`, не ждёт IntersectionObserver.
- SEO-страница `/foto-v-promt` и её `<h1>` не затрагиваются (SSR server-component без динамики).

---

## Env-переменные

### Этот репо (landing)

| Переменная | Дефолт | Назначение |
|-----------|--------|-----------|
| `NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN` | `https://imageprompt.tools` | Origin imageprompt для прод/прокси |
| `NEXT_PUBLIC_IMAGEPROMPT_DIRECT` | — | `1` → даже в dev звать напрямую (без прокси) |

В этом репо `GEMINI_API_KEY` для remix **не используется** (вызов проксируется в imageprompt).

### Репо imageprompt

| Переменная | Дефолт | Назначение |
|-----------|--------|-----------|
| `GEMINI_API_KEY` | обязательная | Gemini text |
| `GEMINI_PROXY_BASE_URL` | прямой Gemini | Прокси DigitalOcean (при `gemini_use_proxy`) |

### Локальное тестирование

В dev лендинг проксирует на `getImagePromptApiOrigin()` (по умолчанию прод `imageprompt.tools`). Чтобы тестировать remix локально до деплоя imageprompt — поднять imageprompt dev-сервер и задать в landing `NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN=http://localhost:<port>`. Иначе remix заработает после деплоя `/api/extension/remix` на прод imageprompt.tools.

---

## Edge cases

| Сценарий | Поведение |
|---------|----------|
| Несуществующий `card` slug | `cardState = "error"`, показать `cardLoadError` |
| Карточка без промтов | То же — `promptTexts.length === 0` |
| `changeRequest` пустой | Кнопка «Переделать промт» disabled |
| originalPrompt > 8000 символов | `400 validation_error` → показать `errorGeneric` |
| Gemini вернул пустой текст | `remix_failed` → `errorGeneric` |
| 429 rate_limited | `errorRateLimited` с понятным текстом |

---

## Тестирование

1. `/p/<slug>` → виден CTA «Изменить промт под себя» (только если есть промты).
2. Клик → `/foto-v-promt?card=<slug>&src=card` → remix-виджет грузит оригинальный промт.
3. Поле «Что изменить?»: «сделай фон вечерним городом» → «Переделать промт» → изменённый промт на том же языке, что оригинал.
4. Кнопка «Копировать промпт» кладёт результат в буфер.
5. «Повторить в LexyGPT» открывает вкладку.
6. «Изменить ещё раз» возвращает в input-панель.
7. `/foto-v-promt` без `?card` — старый режим анализа фото работает без изменений (регрессия).
8. > 20 запросов с одного IP → 429 с текстом `errorRateLimited`.
