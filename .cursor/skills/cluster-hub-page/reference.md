# Эталон: хаб пар

URL: `/promty-dlya-foto-par`. Ключ в `seo-content.ts`: `para`.

## Вход: кластер + полка URL

Слоты считаются по двум таблицам сразу:

1. Wordcraft/Wordstat — demand кластера (что ищут).
2. Яндекс Вебмастер **по этому path** — текущая полка (запрос, показы, клики, CTR, позиция).

Сайтвайд «популярные запросы» Вебмастера не подставлять. Слоты 2026-09-13: head забрал «промты для ИИ фотосессии пары», explorer — «промт для нейросети для фотосессии пары».

## Карта слотов (факт из кластеров Wordcraft)

Три выгрузки: «промты пары», «промты фото пары», «промты парные». Позиции Вебмастера по `/promty-dlya-foto-par` — обязательный второй вход на следующем хабе.

| Слот | Запрос | Ориентир | Почему так |
|---|---|---|---|
| Title | промты для ИИ фотосессии пары + `800+ готовых промтов на русском` | сниппет | объём и «готовые / на русском» в Title, не в H1 |
| H1 | Промты для ИИ фотосессии пары | целевой ВЧ | не обещает `800+` при `?audience=s_parnem` |
| Hero intro | парная фотосессия + нейросеть | complement | без exact H1 «ИИ фотосессии пары»; CTA: промт / фото, не текст / снимок |
| Explorer H2 | промт для нейросети для фотосессии пары | блок над поиском | exact-match, без marketing-хвоста «найдите свой сюжет» |
| Explorer lead | промты для парной фотосессии с ИИ | тот же кластер | действие: поиск или карточка, «скопировать промт» |
| HowTo | промт для фото пары | служебный | не «с парнем» |
| FAQ exact | как написать промт для фото с парнем | sitelink | один раз, ответ «скопируй из карточки» |
| Чипы | в машине, студия, ч/б, море, осень, Love Is, с парнем, влюблённые | НЧ | `?object=` / `?style=` / `?audience=`, не L2 |

Выкинули из заголовков: Nano Banana, Gemini, ChatGPT, `habr.com`, `vc.ru`, path-хвосты, «элегантный стиль habr», «найдите свой сюжет».

Hero intro держит «парную фотосессию» + нейросеть; exact H1 «ИИ фотосессии пары» в intro не повторяем. «С парнем» — только FAQ и чип.

## Каркас

```
GeneraciyaFotoHeroPage
  крошки
  H1 (AdLandingHeading → seo.h1)
  intro (seo.intro)
  ListingPromptCountBadge          ← точный count, не SEO-лейбл
  GeneraciyaFotoHeroCarousel       ← только тег кластера
CatalogExplorer hideHeading
  ListingExplorerHeading h2        ← explorerTitle / explorerIntro
  поиск + чипы + сетка
SeoPageSections                    ← HowTo + FAQ, без generate-CTA, без seoTextBlocks
FAB «Создать фото пары»
```

Карусель **не** внутри `CatalogExplorer`. Листинг не рисует второй H1.

## Copy пар

```
h1: Промты для ИИ фотосессии пары
metaTitle: Промты для ИИ фотосессии пары — 800+ готовых промтов на русском
intro: 800+ готовых промтов для парной фотосессии на русском. Скопируйте промт для нейросети или загрузите два фото, чтобы повторить кадр.
explorerTitle: Промт для нейросети для фотосессии пары
explorerIntro: Ищите готовые промты для парной фотосессии с ИИ по стилю, месту или настроению. …
howToTitle: Как использовать промт для фото пары
popularLinks: []
seoTextBlocks: нет
```

`800+` = `PAIRS_PROMPT_COUNT_LABEL`. В H1 при фильтре его нет.

## Файлы

| Роль | Путь |
|---|---|
| Copy | `landing/src/lib/seo-content.ts` (`para`, поля `explorerTitle` / `explorerIntro`) |
| SSOT хаба | `landing/src/lib/promty-dlya-foto-par-cluster.ts` |
| Тесты слотов | `landing/src/lib/prompt-listing-seo.test.ts` |
| Тесты хаба | `landing/src/lib/promty-dlya-foto-par-cluster.test.ts` |
| Роут | `landing/src/app/[...slug]/page.tsx` (`isPairsHubL1`) |
| Hero chrome | `landing/src/components/generate/GeneraciyaFotoHeroPage.tsx` |
| H2 над поиском | `landing/src/components/CatalogWithFilters.tsx` |
| 301 детей | `pairsChildRedirectPath` + `landing/src/middleware.ts` |
| Док | `docs/architecture/01-landing.md` |

Hero fetch: `pairsHubHeroFetchParams` — тот же `audience_tag`, что у хаба, `sort=new`, свой `limit`. Query-фильтр страницы в карусель не протекает.

Новый хаб: свой `*-cluster.ts`, не раздувать файл пар.

## Чипы и URL

- Живой хаб один. Дети `/promty-dlya-foto-par/*` → 301 на хаб.
- `/promty-dlya-foto-s-parnem` → 301 на хаб; чип `?audience=s_parnem`.
- Независимые L1 (`s-muzhem`, `vlyublennykh`) не ломать, если у них свой спрос и 200.
- Чип без карточек в выдаче не добавлять.

## FAQ / HowTo

Можно: скопировать промт, два фото → один кадр, цена копирования vs генерации.

Нельзя: «открой `/ii-fotosessiya/…`», «не описывай лицо», пересказ H2.

## Как читать Wordcraft

Колонки: `query`, `cluster`, `clicks`, `demand`, `competitiveness`.

Сортировать по `clicks`, затем `demand`. Одна строка кластера Wordcraft ≠ один URL. Несколько формулировок с одним интентом сажаем в **один** слот, не в три H2.

Бренд/площадка в Title/H1/H2 не класть, даже если clicks высокие — это чужой интент или чужая статья.
