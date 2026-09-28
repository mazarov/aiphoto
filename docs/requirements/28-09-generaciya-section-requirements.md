# ТЗ: секция `/generaciya/*` — три генератора по режиму и объекту

> **Дата:** 2026-09-28
> **Исполнитель:** автономный coding-агент (Grok 4.7) в репозитории `mazarov/aiphoto`, каталог `landing/`
> **Разбор и данные:** `docs/28-09-generaciya-section.md` (карты слотов, срезы Вебмастера и Wordstat)
> **Эталон:** ветка `feature/generaciya-section` содержит рабочую реализацию этого ТЗ. Если ветка доступна — сверяться с ней; если задача ставится заново — ТЗ самодостаточно.

Документ написан так, чтобы его можно было выполнить без переспроса. Всё, что не указано, — не делать. Всё, что указано как «точный текст», — копировать символ в символ.

---

## 0. Правила выполнения

1. Ветка: `feature/generaciya-section` от `origin/main`. Не писать в `main`. Не смешивать с чужими незакоммиченными файлами (`.cursor/*`, `.tmp-*`, `src/standalone/lknpd-*` — не трогать и не добавлять в коммит).
2. Не запускать `npm run build`, `docker build`, dev-сервер. Проверка — `npx tsc --noEmit -p tsconfig.json` и `npx tsx --test <files>` из `landing/`.
3. Один тяжёлый процесс за раз.
4. Секреты не хардкодить. Env не добавлять. Фичефлаги не нужны — это SEO-страницы.
5. Тексты на русском, «ты» не используется в UI-копирайте этих страниц (нейтральная форма «опишите / выберите»).
6. После реализации обновить `docs/architecture/01-landing.md` (раздел «Структура маршрутов» + строка «Последнее обновление» с датой).
7. Не переименовывать существующие экспорты, которыми пользуются другие модули (`GENERACIYA_FOTO_SEO`, `GENERACIYA_FOTO_THEMES`, `GENERACIYA_FOTO_TOOLS`, `GENERACIYA_FOTO_SCENARIOS`, `GENERACIYA_FOTO_FAQ`, `getGeneraciyaFotoScenarioPath`, `isGeneraciyaFotoScenarioPath`, `GENERACIYA_FOTO_HUB_PATH`). Менять значения — можно, имена — нет.

---

## 1. Цель и границы

### Цель

Разделить хаб `/generaciya-foto` (один URL, два режима: «по тексту» и «с вашим фото», 22 дочерних сценария) на три страницы секции `/generaciya/`, каждая — владелец своего кластера запросов:

| URL | Режим стартера | Кластер-владелец | Откуда |
|---|---|---|---|
| `/generaciya/foto-po-opisaniyu` | только текст | фото по описанию / по тексту / по промту | 301 с `/generaciya-foto` |
| `/generaciya/kartinka-po-opisaniyu` | только текст | картинка / изображение по описанию / по тексту | новая |
| `/generaciya/po-foto` | только фото | сделать фото ИИ по своему фото; редактирование фото | новая; родитель 22 сценариев |
| `/generaciya/po-foto/<slug>` | текст + фото (как было) | 22 сценария | 301 с `/generaciya-foto/<slug>` |
| `/generaciya` | — | — | 301 на `/generaciya/foto-po-opisaniyu` |

### Не входит

- Содержание 22 сценариев (`generaciya-foto-scenario-copy.ts`) — не менять, кроме ссылок на родителя.
- `/ii-fotosessiya`, `/nano-banana`, `/p/[slug]`, оплата, API генерации.
- Новые теги, миграции БД, новые RPC.
- Индексная страница `/generaciya` как отдельный хаб — только 301.
- Правки Директа и Вебмастера — вне кода (см. §12).

---

## 2. Источник истины путей — `landing/src/lib/generaciya-foto-routes.ts`

Добавить (имена точные):

```ts
export const GENERACIYA_SECTION_PATH = "/generaciya";
export const GENERACIYA_FOTO_PO_OPISANIYU_PATH = "/generaciya/foto-po-opisaniyu";
export const GENERACIYA_KARTINKA_PO_OPISANIYU_PATH = "/generaciya/kartinka-po-opisaniyu";
export const GENERACIYA_PO_FOTO_PATH = "/generaciya/po-foto";
export const LEGACY_GENERACIYA_FOTO_PATH = "/generaciya-foto";

export function getGeneraciyaFotoScenarioPath(slug): string // → `${GENERACIYA_PO_FOTO_PATH}/${slug}`
export function generaciyaLegacyRedirectPath(pathname: string): string | null
export function isGeneraciyaHubPath(pathname: string): boolean
```

Контракт `generaciyaLegacyRedirectPath` (trailing slash игнорируется, query не участвует):

| Вход | Выход |
|---|---|
| `/generaciya-foto`, `/generaciya-foto/` | `/generaciya/foto-po-opisaniyu` |
| `/generaciya`, `/generaciya/` | `/generaciya/foto-po-opisaniyu` |
| `/generaciya-foto/<известный slug>` | `/generaciya/po-foto/<slug>` |
| `/generaciya-foto/<неизвестный slug>` | `/generaciya/po-foto` |
| `/generaciya-foto/a/b` | `/generaciya/po-foto` |
| `/generaciya/foto-po-opisaniyu`, `/generaciya/po-foto/pary`, `/generaciya-fotograf`, любой другой | `null` |

`isGeneraciyaHubPath` — `true` только для трёх хабов (с/без trailing slash), `false` для детей и legacy.

Существующая `isGeneraciyaFotoScenarioPath` должна начать возвращать `true` для `/generaciya/po-foto/<slug>` и `false` для `/generaciya-foto/<slug>` (она сравнивает через `getGeneraciyaFotoScenarioPath`, поэтому меняется автоматически — проверить тестом).

---

## 3. Редиректы — `landing/src/middleware.ts`

- Импортировать `generaciyaLegacyRedirectPath`.
- Вызывать **после** `redirectWwwToApex` и `listingCatalogHubChildRedirectPath`, **до** проверки `isApiRequest` и slug-редиректов карточек.
- Ответ: `NextResponse.redirect(new URL(target, request.url), 301)`. Query строки **не переносить**.
- `config.matcher` не менять.

---

## 4. Общие компоненты и данные

### 4.1 `landing/src/components/generate/GeneraciyaHubHero.tsx` (server component)

Первый экран всех трёх хабов. Props:

```ts
breadcrumbs: { label: string; href?: string }[]  // последний — текущая страница, без ссылки
h1: string
intro: string
carouselCards: GenerationExampleCard[]
carouselAriaLabel: string
socialProof: string | null
generatorTitle: string      // H2 над стартером
generatorLead: string
generatorNote: string
starterModes: ("text" | "photo")[]
starterCopy?: GeneraciyaFotoStarterCopy
starterCtaLabel?: string
```

Разметка и классы — как у текущего hero `/generaciya-foto` (`<section id="generator">`, градиент, `nav aria-label="Хлебные крошки"`, H1, intro, `GeneraciyaFotoHeroCarousel`, соцстрока, H2 `GF_H2`, лид `GF_LEAD`, `GeneraciyaFotoStarter`, note). Ровно один `<h1>` на странице.

### 4.2 `GeneraciyaFotoStarter` — новые props

```ts
modes?: readonly ("text" | "photo")[]   // default ["text","photo"]
ctaLabel?: string                        // override idle-подписи кнопки в text-режиме (default «Создать фото»)
```

- При одном режиме селектор карточек не рендерится (`hidden`), начальный `mode = modes[0]`.
- Поведение кнопки не меняется: text → `seedBlankPrompt(initialPrompt, { entrySource: "route", intent: "text", dockSurface: "prompt" })`; photo → `fileInputRef.click()` → `seedSeoSelfieCompose`.
- `id="generaciya-foto-starter-cta"` и `id="generaciya-foto-starter-photo"` сохранить (на них завязан `GenerateListingDockHost`).

### 4.3 `landing/src/components/generate/GeneraciyaHowItWorks.tsx` (server)

Props: `title`, `paragraphs: string[]`, `tipsTitle`, `tips: string[]`, `headingId?`. Разметка: `section.scroll-mt-20 > div.GF_BLOCK > h2.GF_H2 + p.GF_LEAD×N + h3 + ul.list-disc`.

### 4.4 `landing/src/lib/generaciya-hub-data.ts`

Экспорты:

- `SITE_URL`, `GENERACIYA_BASE_RPC_PARAMS`, `GENERACIYA_EMPTY_RESULT`.
- `getGeneraciyaNewestExamples()` — `fetchRouteCards({limit:24, offset:0, min_cards:1, sort:"new"})`, `react.cache`, fail-soft → `GENERACIYA_EMPTY_RESULT`.
- `KARTINKA_EXAMPLE_STYLE_TAGS = ["anime","3d","piksar","multyashnoe","disney","kollazh"]`.
- `getGeneraciyaKartinkaExamples()` — по 6 карточек на каждый style_tag (`fetchRouteCards` с `style_tag`), затем **interleave** (1-я карточка каждого тега, потом 2-я…), дедуп по `id`. `tier_used: "style_mix"`, `total_count` = сумма. Fail-soft на каждый тег.
- `getGeneraciyaCompletedImageCount()` — `landing_generations` `count exact head`, `status=completed`, `modality=image`; ошибка → 0.
- `getGeneraciyaModels()` — `landing_generation_config` `key=models` → `parseEnabledGenerationModels`; ошибка → `FALLBACK_GENERATION_MODELS`.
- `enrichGeneraciyaCards(result, label)` — `enrichCardsWithDetails`, порядок как в `result.cards`, ошибка → `[]`.
- `firstGeneraciyaOgImage(result, cards)` — `cards[0].photoUrls[0]`, иначе `getFirstCardPhotoUrl`, иначе `null`.
- `buildGeneraciyaHubJsonLd({ pageUrl, name, description, ogImage, breadcrumbs, howTo?, faq, itemList? })` → массив: `WebApplication` (applicationCategory `MultimediaApplication`, `inLanguage: ru`), `BreadcrumbList`, `HowTo` (если передан), `FAQPage` (ответы через `flattenGeneraciyaFotoFaqAnswer`), `ItemList` (если карточки есть; `url` = `/p/<slug>`). Никаких `Offer`, `AggregateRating`, `Review`.

Все JSON-LD вставляются как inline `<script type="application/ld+json">` с экранированием `<` → `\u003c` (как сейчас).

---

## 5. Копирайт и слоты

Общие правила (проверяются тестом, §9):

- H1 = основной ключ. Title ≠ H1 слово в слово; Title без «PromptShot» и без «бесплатно»; ≤ 75 символов.
- «по описанию» — не более чем в **двух** заголовках страницы (H1 + один H2).
- На `foto-po-opisaniyu` слова «картинк-», «изображени-» запрещены в Title/H1/H2/intro; в intro/generatorLead/Description запрещены «снимок/снимка/снимку», «селфи», «референс» (фото-режим не обещается).
- На `kartinka-po-opisaniyu` слово «фото» запрещено в Title/H1/H2.
- «Текст в картинку» — только в FAQ.
- Ответы FAQ не содержат: «тестовые запуски», «тестовые генерации», «Telegram», «facee», «Т-Банк», «ИИ-редактор», «Объединить два фото».
- Ссылки в FAQ — только из allowlist: `/`, `/trends`, `/foto-v-promt`, `/ii-fotosessiya`, `/nano-banana`, `/terms`, `#generator`, `#primery`, `#temy`, `#tarify`, три хаба секции, `/generaciya/po-foto#tools`, `getGeneraciyaFotoScenarioPath("pary"|"semya")`, `mailto:support_ru@promptshot.ru`. `/pricing` в FAQ не ссылать (закрыт в robots) — вместо него `#tarify`.

### 5.1 `/generaciya/foto-po-opisaniyu` — `GENERACIYA_FOTO_SEO` в `generaciya-foto-seo-copy.ts`

Точные тексты:

| Поле | Значение |
|---|---|
| `metaTitle` (fallback) | `Сделать фото по описанию 📸 — ИИ онлайн, без студии и фотографа` |
| Title с счётчиком | `Сделать фото по описанию 📸 — ИИ онлайн, {N}+ кадров уже создано`, где `N = floor(count/1000)*1000` в формате `ru-RU` (`12 000`). Функция `buildGeneraciyaFotoMetaTitle(count)`: при `count < 1000` или не-числе → fallback |
| `metaDescription` | `Опишите кадр словами — нейросеть сгенерирует реалистичное фото по описанию онлайн. Промт на русском, выбор модели и формата, файл сразу на скачивание.` |
| `h1` | `Сделать фото по описанию` |
| `intro` | `Генерация фото по описанию: напишите, кто в кадре, где и в каком свете, — нейросеть соберёт реалистичный кадр без студии и фотографа.` |
| `breadcrumb` | `Фото по описанию` |
| `sectionBreadcrumb` (новое поле) | `Генерация` |
| `chipHubLabel` | `Сделать фото по описанию` |
| `generatorTitle` | `Создать фото по промту или по тексту` |
| `generatorLead` | `Напишите промт своими словами или возьмите готовый из идей ниже. Модель, формат и качество выбираются перед запуском.` |
| `examplesTitle` | `ИИ фото по описанию: примеры и готовые промты` |
| `examplesIntro` | `Каждый кадр создан по тексту. Откройте карточку — промт можно скопировать или сразу запустить.` |
| `examplesMoreHref` | `${GENERACIYA_FOTO_PO_OPISANIYU_PATH}#primery` |
| `howToTitle` | `Как сделать фото ИИ за три шага` |
| `howToLead` | `Описание → модель → файл` |

`GENERACIYA_FOTO_HOW_TO_STEPS` (3 шага): «Опишите кадр» / «Выберите промт» / «Настройте и создайте» — тексты без упоминания загрузки снимка.

Новый экспорт `GENERACIYA_FOTO_HOW_IT_WORKS`: `title` = `Как нейросеть генерирует фото из текста`; 2 абзаца (модель читает описание целиком; несколько моделей, списание видно до запуска); `tipsTitle` = `Как написать описание для фото`; 5 подсказок (главный объект; место и время; свет и стиль; формат кнопкой; «шедевр/8k не помогают»).

Новый экспорт `GENERACIYA_FOTO_SCENARIOS_NAV`: `title` = `Сценарии: пары, семья, день рождения`, `lead` = `Нужен кадр со своим лицом? Откройте сценарий — там генерация по вашему фото.`

`GENERACIYA_FOTO_MORE_TITLE` = `Другие режимы генерации`; `GENERACIYA_FOTO_MORE_LEAD` = `Картинка по тексту, кадр со своим лицом или серия фото — выберите, что нужно.`; `GENERACIYA_FOTO_CAPABILITIES` = `generaciyaModeLinksExcept("foto")` в форме `{title,text,href}`.

`GENERACIYA_FOTO_PRICING.returnPath` = `GENERACIYA_FOTO_PO_OPISANIYU_PATH`.

Новый экспорт `GENERACIYA_MODE_LINKS` (порядок фиксирован):

| key | label | href |
|---|---|---|
| `foto` | Фото по описанию | `/generaciya/foto-po-opisaniyu` |
| `kartinka` | Картинка по описанию | `/generaciya/kartinka-po-opisaniyu` |
| `po-foto` | По своему фото | `/generaciya/po-foto` |
| `fotosessiya` | ИИ фотосессия | `/ii-fotosessiya` |

и `generaciyaModeLinksExcept(key)`.

**FAQ** — источник `GENERACIYA_FOTO_FAQ_SOURCE` расширить, экспортировать через `pickFaq(questions[])` два списка. Тип `GeneraciyaFaqEntry = { q: string; a: readonly GeneraciyaFotoFaqPart[] }` (экспорт).

`GENERACIYA_FOTO_FAQ` — ровно в этом порядке:

1. Как сделать фото по описанию? (ссылки `#generator`, `#primery`)
2. Можно ли сделать фото по описанию бесплатно? — ответ обязан содержать «списывает кредиты», ссылка `#tarify`
3. Нужна ли регистрация, чтобы сделать фото по описанию?
4. Можно ли написать промт на русском?
5. Какой ИИ лучше сделает фото?
6. Как писать промт, чтобы сгенерировать фото?
7. Нужен подробный промт, чтобы создать фото?
8. Чем фото по описанию отличается от картинки по описанию? (ссылка на `kartinka-po-opisaniyu`)
9. Можно ли сделать фото по описанию со своим лицом? (ссылка на `po-foto`)
10. Можно ли изменить своё фото по описанию? (ссылка `/generaciya/po-foto#tools`)
11. Какой формат и размер фото получится?
12. Можно ли сгенерировать фото без водяного знака? (ссылка `#tarify`, без «тестовых генераций»)
13. Можно ли оплатить российской картой?

### 5.2 `/generaciya/po-foto` — `GENERACIYA_PO_FOTO_SEO` (новый объект там же)

| Поле | Значение |
|---|---|
| `metaTitle` | `Сделать фото ИИ по своему фото 🤳 — 22 сценария, без фотографа` |
| `metaDescription` | `Загрузите свой снимок и выберите образ — нейросеть сделает фото ИИ с вашим лицом: пары, семья, день рождения, портрет. Промт готов, результат без студии.` |
| `h1` | `Сделать фото ИИ по своему фото` |
| `intro` | `Загрузите одно селфи и выберите сценарий — ИИ повторит кадр с вами: поза, свет и стиль из примера, лицо с вашего снимка.` |
| `breadcrumb` / `chipHubLabel` | `По своему фото` |
| `generatorTitle` | `Создать фото по промту и своему снимку` |
| `examplesTitle` | `Фото ИИ по референсу: примеры` |
| `howToTitle` | `Как сделать ИИ фото со своим лицом` |
| `howToCta` | `Загрузить фото` |

`GENERACIYA_PO_FOTO_HOW_TO_STEPS`: «Загрузите снимок» (текст содержит «анфас») / «Выберите образ» / «Запустите генерацию».

`GENERACIYA_FOTO_THEMES.title` остаётся `Сделать ИИ фото по теме` (используется только на po-foto). `GENERACIYA_FOTO_TOOLS.lead` = `Изменить фото по описанию: фон, причёска, лишние объекты, качество — по вашему снимку`; items не менять.

`GENERACIYA_PO_FOTO_FAQ` — порядок:

1. Как сделать фото ИИ по своему фото?
2. Как создать фото с собой в PromptShot?
3. Что делать, если изображение не похоже на меня?
4. Можно ли использовать фото как пример?
5. Можно ли сделать совместное фото, если нет общего снимка?
6. Как создать «Портрет поколения» для семьи?
7. Как собрать серию кадров в одном стиле?
8. Где взять готовый промт для генерации фото?
9. Какой ИИ лучше сделает фото?
10. Можно ли сгенерировать фото без водяного знака?
11. Можно ли оплатить российской картой?

`GENERACIYA_FOTO_HUB_PATH` в `generaciya-foto-chip-nav.ts` = `GENERACIYA_PO_FOTO_PATH`; label чипа «назад» = `GENERACIYA_PO_FOTO_SEO.chipHubLabel`.

### 5.3 `/generaciya/kartinka-po-opisaniyu` — новый файл `landing/src/lib/kartinka-po-opisaniyu-seo-copy.ts`

`KARTINKA_PO_OPISANIYU_SEO`:

| Поле | Значение |
|---|---|
| `path` | `GENERACIYA_KARTINKA_PO_OPISANIYU_PATH` |
| `metaTitle` | `Сгенерировать картинку по описанию 🎨 — ИИ онлайн, любой стиль за минуту` |
| `metaDescription` | `Напишите, что должно быть на картинке, — нейросеть создаст изображение по описанию онлайн. Промт на русском, выбор модели и формата, файл сразу на скачивание.` |
| `h1` | `Сгенерировать картинку по описанию` |
| `intro` | `Создать картинку по тексту просто: опишите сцену своими словами — нейросеть соберёт изображение за минуту. Без своего фото, без навыков дизайна, на русском.` |
| `breadcrumb` / `chipHubLabel` | `Картинка по описанию` |
| `generatorTitle` | `Изображение по тексту: напишите промт и получите файл` |
| `generatorLead` | `Одно поле, один запуск. Опишите, кто или что в кадре, где происходит, какой свет и стиль. Модель и формат — перед запуском, стоимость видна до генерации.` |
| `starterCta` | `Создать картинку` |
| `starterByTextTitle` / `Lead` | `Генерация по тексту` / `Опишите картинку своими словами` |
| `examplesTitle` | `Картинки по тексту: примеры и готовые промты` |
| `examplesIntro` | `Каждый пример создан по текстовому описанию без исходного фото. Откройте карточку — промт можно скопировать или сразу запустить.` |
| `examplesEyebrow` | `Библиотека картинок` |
| `examplesCta` | `Больше идей для картинок` |
| `carouselAriaLabel` | `Новые картинки по описанию` |
| `socialProofSuffix` | `человек уже сгенерировали изображения` |
| `howToTitle` / `howToLead` / `howToCta` | `Как создать картинку за три шага` / `Описание → модель → файл` / `Создать картинку` |
| `moreTitle` / `moreLead` | `Другие режимы генерации` / `Реалистичное фото по тексту, кадр со своим лицом или серия — выберите, что нужно.` |

Счётчик в Title **не** используется (он общий на все генерации; две страницы с одной цифрой выглядят копией).

`KARTINKA_PO_OPISANIYU_HOW_TO_STEPS` (3): «Опишите картинку» (пример «Кот-космонавт на крыше ночного города, неон, дождь») / «Выберите модель и формат» / «Скачайте файл».

`KARTINKA_PO_OPISANIYU_HOW_IT_WORKS.title` = `Как нейросеть создаёт изображение по описанию`; `tipsTitle` = `Как написать описание для картинки`; 5 подсказок.

`KARTINKA_PO_OPISANIYU_STYLE_CHIPS`: Аниме `/stil/anime` `anime`; 3D `/stil/3d` `3d`; Пиксар `/stil/piksar` `piksar`; Мультяшное `/stil/multyashnoe` `multyashnoe`; Дисней `/stil/disney` `disney`; Коллаж `/stil/kollazh` `kollazh`.

`KARTINKA_PO_OPISANIYU_MODE_LINKS` = `generaciyaModeLinksExcept("kartinka")` → `{title,text,href}`.

`KARTINKA_PO_OPISANIYU_FAQ` (8, порядок):

1. Можно ли сгенерировать картинку по описанию бесплатно? — содержит «списывает кредиты», ссылка `#tarify`
2. Работает ли генератор картинок онлайн без регистрации?
3. Что значит «текст в картинку»? — два смысла; наложение надписей сервис не делает
4. Можно ли написать описание на русском?
5. Какая нейросеть создаёт картинки по описанию в PromptShot?
6. Чем картинка по описанию отличается от фото по описанию? (ссылки на `foto-po-opisaniyu` и `po-foto`)
7. Как написать промт, чтобы картинка получилась? (ссылка `#primery`)
8. Какой формат и размер картинки получится?

---

## 6. Страницы — состав и порядок блоков

Общее: `export const revalidate = 3600`; `generateMetadata` с `robots index/follow/max-image-preview:large/max-snippet:-1/max-video-preview:-1`, `alternates.canonical = PAGE_URL`, OpenGraph/Twitter с OG-картинкой первой карточки; `PageLayout showFooterWithGenerateDock`; `<main className={GF_PAGE_MAIN}>`; после hero — `<div className={GF_PAGE_STACK}>`. Крошки: `Главная (/) → Генерация (без ссылки) → <breadcrumb страницы>`. Пустая галерея → плашка «Примеры временно загружаются. Панель генерации продолжает работать.».

### 6.1 `app/generaciya/foto-po-opisaniyu/page.tsx`

Данные: `getGeneraciyaNewestExamples`, `getGeneraciyaModels`, `fetchNewestThemeCollagePhotos(GENERACIYA_FOTO_THEMES.items)`, `getGeneraciyaCompletedImageCount`. Title = `buildGeneraciyaFotoMetaTitle(count)`.

Порядок:

1. `GeneraciyaHubHero` — `starterModes={["text"]}`, `carouselAriaLabel="Новые фото по описанию"`.
2. `#primery` — `GeneraciyaFotoExamplesExplorer` (`eyebrow=""`, title/intro из SEO, `defaultAllPromptsHref="#primery"`, `scenarioNavigation={getGeneraciyaFotoChipNavigation()}`).
3. `GeneraciyaHowItWorks` из `GENERACIYA_FOTO_HOW_IT_WORKS`.
4. `GeneraciyaFotoHowTo` (defaults).
5. `GeneraciyaFotoThemes` с `title`/`lead` из `GENERACIYA_FOTO_SCENARIOS_NAV`.
6. `GeneraciyaFotoMore` (defaults = режимы кроме `foto`).
7. `GenerationModelsShowcase models layout="chips" linkNanoBananaFamily`.
8. `GeneraciyaFotoPricing` (return `foto-po-opisaniyu`).
9. `GeneraciyaFotoFaq` (defaults = `GENERACIYA_FOTO_FAQ`).

**Нет:** `GeneraciyaFotoTools`, фото-режима стартера, карточки «Фото по описанию и по примеру».

### 6.2 `app/generaciya/kartinka-po-opisaniyu/page.tsx`

Данные: `getGeneraciyaKartinkaExamples`, `getGeneraciyaModels`, `getGeneraciyaCompletedImageCount`. Соцстрока: `Более {N} человек уже сгенерировали изображения`.

1. Hero — `starterModes={["text"]}`, `starterCopy={{byTextTitle, byTextLead}}`, `starterCtaLabel="Создать картинку"`.
2. `#primery` — explorer с `scenarioNavigation` из `KARTINKA_PO_OPISANIYU_STYLE_CHIPS` (kind `scenario`, `dimension:"style_tag"`, `value`), `navigationAriaLabel="Стили картинок"`, `filterChipsInPlace`, `restrictToInitialCards`.
3. `GeneraciyaHowItWorks` из `KARTINKA_PO_OPISANIYU_HOW_IT_WORKS`.
4. `GeneraciyaFotoHowTo` с kartinka-шагами.
5. `GeneraciyaFotoMore` с `KARTINKA_PO_OPISANIYU_MODE_LINKS`, `moreTitle`, `moreLead`.
6. Модели. 7. `GeneraciyaFotoPricing returnPath=kartinka`. 8. `GeneraciyaFotoFaq items=KARTINKA_PO_OPISANIYU_FAQ`.

### 6.3 `app/generaciya/po-foto/page.tsx`

Данные: как 6.1, Title статический.

1. Hero — `starterModes={["photo"]}`, `starterCopy={{byPhotoTitle, byPhotoLead}}`, `carouselAriaLabel="Новые фото ИИ по своему фото"`.
2. `GeneraciyaFotoThemes` (defaults — «Сделать ИИ фото по теме»).
3. `#primery` — explorer с title/intro из `GENERACIYA_PO_FOTO_SEO`, `scenarioNavigation={getGeneraciyaFotoChipNavigation()}`.
4. `<div id="tools" className="scroll-mt-20"><GeneraciyaFotoTools /></div>`.
5. `GeneraciyaFotoHowTo` с po-foto title/lead/cta/steps.
6. `GeneraciyaFotoMore items=generaciyaModeLinksExcept("po-foto")`.
7. Модели. 8. `GeneraciyaFotoPricing returnPath=po-foto`. 9. `GeneraciyaFotoFaq items=GENERACIYA_PO_FOTO_FAQ`.

### 6.4 `app/generaciya/po-foto/[scenario]/page.tsx`

`git mv` из `app/generaciya-foto/[scenario]/page.tsx`. Изменить только: крошка и JSON-LD `BreadcrumbList` — родитель `GENERACIYA_PO_FOTO_SEO.breadcrumb` + `GENERACIYA_PO_FOTO_PATH`; ссылка «Все сценарии генерации» → `GENERACIYA_PO_FOTO_PATH`. Стартер, копирайт, `generateStaticParams`, порог индексации 8 — без изменений.

Старый каталог `app/generaciya-foto/` удалить целиком.

---

## 7. Внутренние ссылки — обязательный список замен

| Файл | Было | Стало |
|---|---|---|
| `components/SidebarNav.tsx` | `href="/generaciya-foto"`, label «Сделать фото», active по `/generaciya-foto` | `/generaciya/foto-po-opisaniyu`, label **«Фото по описанию»**, active по `/generaciya` |
| `components/HomeHeroDestinations.tsx` | карточка «Сделать фото ИИ» → `/generaciya-foto` | «Сделать фото по описанию» / «Реалистичный кадр только по тексту» → `/generaciya/foto-po-opisaniyu`. Число карточек остаётся 4 |
| `lib/promty-dlya-ii-fotosessii-cluster.ts` | `generateHref: "/generaciya-foto/<slug>"` и `"/generaciya-foto"` | `/generaciya/po-foto/<slug>` и `/generaciya/po-foto` |
| `lib/promty-dlya-foto-{par,devushki,muzhchiny}-cluster.ts` | `GENERACIYA_FOTO_*_PATH = "/generaciya-foto/<slug>"` | `/generaciya/po-foto/<slug>` |
| `lib/den-rozhdeniya-cluster.ts` | `DEN_ROZHDENIYA_GENERATE_HREF` | `/generaciya/po-foto/na-den-rozhdeniya` |
| `lib/seo-content.ts` | `href: "/generaciya-foto/na-den-rozhdeniya"` | `/generaciya/po-foto/na-den-rozhdeniya` |
| `lib/foto-v-promt-copy.ts` | `generateHref: "/generaciya-foto"` | `/generaciya/foto-po-opisaniyu` |
| `lib/trends-seo-copy.ts` | `{ label: "Сгенерировать фото", href: "/generaciya-foto" }` | `/generaciya/foto-po-opisaniyu` |
| `lib/promty-dlya-ii-fotosessii-seo-copy.ts` | ссылка «странице «Сделать фото ИИ»» | `/generaciya/po-foto`, label «странице «Сделать фото ИИ по своему фото»» |
| `components/pricing/PricingCards.tsx` | `href="/generaciya-foto"` | `/generaciya/foto-po-opisaniyu` |
| `lib/mail-catalog.ts`, `lib/mail-templates.ts` | `https://promptshot.ru/generaciya-foto` | `https://promptshot.ru/generaciya/foto-po-opisaniyu` |
| `lib/yandex-two-cluster-launch.ts` | `landingUrl …/generaciya-foto/pary` | `…/generaciya/po-foto/pary` |
| `lib/llms-txt.ts` | одна строка «Сделать фото ИИ» | три строки: «Сделать фото по описанию», «Сгенерировать картинку по описанию», «Сделать фото ИИ по своему фото» (с новыми URL); текст про генераторы: текст-only vs текст/файл |
| `data/seo-watchlist-paths.json` | `/generaciya-foto`, `/generaciya-foto/<slug>` | `/generaciya/foto-po-opisaniyu`, `/generaciya/po-foto/<slug>` |
| `app/sitemap.ts` | один hub `/generaciya-foto` 0.9 | три хаба 0.9; сценарии через `getGeneraciyaFotoScenarioPath` (уже так) |
| `lib/client-source.ts` | prefix `/generaciya-foto` → `generaciya_foto` | плюс `/generaciya` и `/generaciya/` → тот же `generaciya_foto` (legacy оставить) |
| `lib/generate-dock-path.ts` | `normalized === "/generaciya-foto"` | `isGeneraciyaHubPath(normalized)` |

Не трогать: `data/seo-watchlist-snapshot.json` (исторические данные), CSS-классы `generaciya-foto-marquee*`, id `generaciya-foto-starter-*`, комментарии.

Проверка полноты: `rg -n '"/generaciya-foto|/generaciya-foto"|/generaciya-foto/' landing/src --glob '!*.test.ts' --glob '!seo-watchlist-snapshot.json'` — допустимы только `LEGACY_GENERACIYA_FOTO_PATH`, `client-source.ts` и комментарии.

---

## 8. `docs/architecture/01-landing.md`

- В «Структура маршрутов» заменить строку `/generaciya-foto …` на пять строк (три хаба, `[scenario]`, `/generaciya` → 301) с описанием слотов и SSOT.
- Добавить `> Последнее обновление: 2026-09-28 (**секция `/generaciya/*`:** …)` в шапку.

---

## 9. Тесты

### Обновить существующие (заменить ожидания путей)

`ad-landing-title.test.ts`, `client-source.test.ts`, `den-rozhdeniya-cluster.test.ts`, `generaciya-foto-chip-nav.test.ts`, `generaciya-foto-routes.test.ts`, `generate-dock-path.test.ts`, `homepage-explorer-chips.test.ts` (`startsWith("/generaciya")`), `llms-txt.test.ts`, `mail-templates.test.ts`, `promty-dlya-foto-{par,devushki,muzhchiny}-cluster.test.ts`, `promty-dlya-ii-fotosessii-cluster.test.ts`, `yandex-two-cluster-launch.test.ts`.

### Добавить в `generaciya-foto-routes.test.ts`

Таблицу из §2 для `generaciyaLegacyRedirectPath` и `isGeneraciyaHubPath` — каждая строка отдельным `assert`.

### Переписать `generaciya-foto-seo-copy.test.ts`

Обязательные проверки:

- `foto`: `h1 === "Сделать фото по описанию"`; `metaTitle` начинается с `Сделать фото по описанию 📸 — `; `metaTitle !== h1`; длина ≤ 75; `buildGeneraciyaFotoMetaTitle(12_345)` соответствует `/^Сделать фото по описанию 📸 — ИИ онлайн, 12\s000\+ кадров уже создано$/` (разделитель тысяч — `\s`, т.к. `toLocaleString` даёт NBSP); `buildGeneraciyaFotoMetaTitle(999)` и `(NaN)` → fallback; `(1_250_000)` ≤ 75 символов.
- `foto`: в наборе заголовков `[h1, generatorTitle, examplesTitle, HOW_IT_WORKS.title, howToTitle, SCENARIOS_NAV.title, MORE_TITLE]` ровно **2** содержат «по описанию»; ни один заголовок, intro и metaTitle не содержит `/картинк|изображени/i`; intro, generatorLead, metaDescription не содержат `/сним(ок|ка|ку)|селфи|референс/i`.
- `kartinka`: аналогично, ровно 2 «по описанию»; заголовки и metaTitle не содержат `/\bфото/i`; в FAQ есть вопрос с «текст в картинку», в заголовках его нет.
- `po-foto`: `h1`, `metaTitle` (начало и «22 сценария»), `generatorTitle`; `GENERACIYA_FOTO_THEMES.items.length === 22`, `items[0].href === "/generaciya/po-foto/pary"`; `TOOLS.lead` начинается с «Изменить фото по описанию».
- Регэксп запрета для мета: `/best|recommended|premium|\bfree\b|#1|бесплатно|PromptShot/i`.
- `GENERACIYA_MODE_LINKS.map(href)` deep-equal четырём URL в порядке §5.1; `generaciyaModeLinksExcept("kartinka").length === 3`.
- FAQ трёх страниц: ≥ 8 вопросов каждая; все `href` из allowlist §5; текст ответов не матчит `/Фотосессии|ИИ-редактор|Объединить два фото|https:\/\/promptshot\.ru\/terms|тестовые (запуски|генерации)|Telegram|@facee|facee\.ru|Т-Банк/i`; первые вопросы — как в §5; вопрос про «бесплатно» на `foto` и `kartinka` содержит «списывает кредиты»; на `po-foto` его нет.

### Прогон

```bash
cd landing
npx tsc --noEmit -p tsconfig.json          # 0 ошибок вне *.test.ts
npx tsx --test $(ls src/lib/*.test.ts src/lib/**/*.test.ts src/components/**/*.test.ts* src/app/**/*.test.ts 2>/dev/null)
```

Известный pre-existing fail: `route-resolver.test.ts` «pairs object-first mirrors 301 to audience-first hub child» — падает и на `origin/main`, не чинить в рамках этой задачи. Все остальные — зелёные.

---

## 10. Критерии приёмки

1. `GET /generaciya-foto` → 301 `/generaciya/foto-po-opisaniyu`; `GET /generaciya-foto/na-den-rozhdeniya?ps_auth=1` → 301 `/generaciya/po-foto/na-den-rozhdeniya` без query; `GET /generaciya` → 301 на `foto-po-opisaniyu`; `GET /generaciya-foto/xyz` → 301 `/generaciya/po-foto`.
2. На каждом из трёх хабов: один `<h1>` с точным текстом из §5; Title из §5 (на `foto` — с цифрой, если завершённых генераций ≥ 1 000); Description из §5; canonical = свой URL; JSON-LD `WebApplication + BreadcrumbList + HowTo + FAQPage (+ ItemList)`; без `Offer/AggregateRating`.
3. Стартер: на `foto` и `kartinka` нет карточки «С вашим фото» и селектора режимов; кнопка `#generaciya-foto-starter-cta` открывает dock в text-режиме; на `kartinka` подпись «Создать картинку». На `po-foto` — нет карточки «Генерация по тексту», кнопка «Загрузить фото» открывает file input.
4. На `foto-po-opisaniyu` нет блока «Редактирование фото с ИИ»; на `po-foto` он есть с `id="tools"`.
5. Галерея `kartinka` не совпадает с галереей `foto` (проверить первые 6 карточек); чипы стилей фильтруют на месте без смены URL.
6. Все 22 `/generaciya/po-foto/<slug>` открываются, крошка ведёт на `/generaciya/po-foto`, чип «назад» — туда же.
7. `sitemap.xml` содержит три хаба и сценарии с новыми путями, старых `/generaciya-foto` нет.
8. `rg` из §7 не находит легаси-строк вне разрешённых мест.
9. Тесты и `tsc` — по §9.
10. `01-landing.md` обновлён.

---

## 11. Граничные случаи

- Счётчик недоступен (ошибка Supabase) → 0 → Title fallback без цифры, соцстрока не рендерится.
- `getGeneraciyaKartinkaExamples`: один из тегов упал → остальные собираются; все упали → пустая галерея с плашкой, страница индексируется.
- Trailing slash на legacy и новых URL — обрабатывается одинаково (§2).
- Неизвестный путь под `/generaciya/<что-то>` не редиректится (уходит в `[...slug]` → 404 как сейчас).
- `AdLandingHeading` на сценариях читает путь через `getGeneraciyaFotoScenarioPath` — карта заголовков Директа (`ad-landing-title.ts`) должна матчить новые пути через `GENERACIYA_FOTO_PARY_PATH` из кластера пар, не по строке.

---

## 12. После merge (не код)

1. Яндекс Директ: посадочная кампании пар → `https://promptshot.ru/generaciya/po-foto/pary`.
2. Вебмастер: переобход `foto-po-opisaniyu`, `kartinka-po-opisaniyu`, `po-foto`, `/generaciya-foto`.
3. Baseline для измерения — срез 13–26.09 (`docs/28-09-generaciya-section.md` §1, §8); контроль через 4 недели, Title не менять до конца окна.
