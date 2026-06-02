# SEO: тексты страницы «Фото в промт» (`/foto-v-promt/`)

> **Дата:** 2026-06-02  
> **Статус:** реализовано в `landing/src/lib/foto-v-promt-copy.ts`  
> **Связанные документы:** [02-06-foto-v-promt-page.md](./02-06-foto-v-promt-page.md), [extension-landing-seo-requirements.md](../extension-landing-seo-requirements.md)

---

## 1. Цель

Оптимизировать `/foto-v-promt/` под Wordstat-кластер image-to-prompt:

| Запрос | Частота | Роль на странице |
|--------|---------|------------------|
| **фото в промт** | 18 019 | ВЧ — H1, title, URL |
| промт из фото | 4 331 | СЧ — H2 How, FAQ |
| промт по картинке | 3 196 | СЧ — H2 виджета, FAQ |
| фото в промпт | 2 230 | вариант орфографии — 1–2× в body |
| картинка в промт | 1 833 | subtitle How, FAQ |
| создать промт из фото | 176 | FAQ, prompt snippet |
| промт из фото онлайн | 130 | title, hero, FAQ |

**Intent:** инструмент (upload → промт сейчас) + коммерция (расширение Chrome).

**Разводка с главной:** `/` — каталог готовых промтов; `/foto-v-promt/` — **инструмент** «фото → промт». Главная не конкурирует H1 «фото в промт»; даёт ссылку на инструмент.

---

## 2. Аудит до правок (baseline)

| Элемент | Было | Проблема |
|---------|------|----------|
| H1 | «Фото в **промпт**» | ВЧ — «**промт**» |
| Title | EN-бренд в начале | Слабое покрытие RU-кластера |
| Hero | AI Image Describer (EN) | Нет целевых ключей |
| How H2 | «Как это работает» | Без СЧ |
| FAQ | EN product questions | Не совпадают с выдачей RU |

---

## 3. Орфография «промт» / «промпт»

- **H1, title, nav, URL** — «промт» (ВЧ + slug `foto-v-promt`).
- «промпт» — 1–2 раза в тексте (вариант 2 230).
- Не чередовать в каждом предложении.

---

## 4. Финальные тексты (source of truth)

Источник в коде: `landing/src/lib/foto-v-promt-copy.ts`.

### 4.1 Meta

**Title:**
```
Фото в промт онлайн — промт из фото и картинки | PromptShot
```

**Description:**
```
Превратите фото или картинку в готовый промт онлайн: загрузите изображение на PromptShot и получите текст для Nano Banana, Midjourney, DALL·E и Stable Diffusion. Бесплатный разбор на странице и расширение для Chrome.
```

**JSON-LD WebApplication name:** `Фото в промт — PromptShot`

### 4.2 Hero

**H1:** `Фото в промт`

**Subtitle:** см. `FOTO_V_PROMT_HERO.subtitle` в copy.ts

### 4.3 Виджет

**H2:** `Промт по картинке онлайн — попробуйте сейчас`

**aria-label секции:** `Live-разбор: фото в промт`

### 4.4 How it works

**H2:** `Как получить промт из фото`

**Subtitle + steps + prompt snippet:** см. `FOTO_V_PROMT_HOW` в copy.ts

### 4.5 FAQ

7 вопросов, привязанных к запросам — см. `FOTO_V_PROMT_FAQ` в copy.ts.

**Subtitle FAQ:** «Ответы про фото в промт, промт из фото и промт по картинке онлайн.»

### 4.6 Widget microcopy

| Ключ | Текст |
|------|-------|
| emptyTitle | Загрузите фото или картинку — получите промт |
| analyzing | Делаем промт из фото… |
| resultTitle | Ваш промт |

---

## 5. Schema.org

- **WebApplication** — name, description, url, downloadUrl
- **FAQPage** — mainEntity из FAQ items (отдельный JSON-LD в `page.tsx`)

---

## 6. Внутренняя перелинковка

| Откуда | Куда | Анкор |
|--------|------|-------|
| Sidebar / Footer | `/foto-v-promt/` | Фото в промт |
| Главная `/` | `/foto-v-promt/` | Фото в промт |
| `/foto-v-promt/` FAQ | `/` | готовые промты для генерации (в ответе FAQ) |

---

## 7. Что не менять

- URL `/foto-v-promt/`, canonical
- Структура секций Hero → Widget → How → FAQ
- Backend / CORS / виджет

---

## 8. Метрики

- Индексация без дублей с `/`
- Позиции: «фото в промт», «промт из фото» (2–4 мес.)
- CTR сниппета с «онлайн» в title
- Поведение: upload → result в виджете

---

## 9. Acceptance

- [x] `foto-v-promt-copy.ts` обновлён по §4
- [x] H2 над виджетом, FAQPage JSON-LD
- [x] Nav/Footer: «Фото в промт»
- [x] Ссылка с главной
- [x] `docs/architecture/01-landing.md` — SEO-кластер
