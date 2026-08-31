# 28-08 Кластер «промты для ИИ фотосессии»

> **Дата:** 2026-08-28
> **Статус:** URL переехал 2026-08-31 → `/ii-fotosessiya` (глагол). Промт-кластер 31.08 вернулся на `/` — `docs/31-08-homepage-promty-fotosessii.md`.
> **Ветка:** `feature/28-08-promty-dlya-ii-fotosessii`
> **Роль:** `@senior-seo-strategist-ru`

Новый тип посадочных: хаб серии образов, не каталог одного кадра и не «сделать фото ИИ». Каркас визуала — `/generaciya-foto` без tools / отзывов / моделей / тарифов.

---

## 1. Один URL — один ключ

| URL | Тип | Ключ | Не берёт |
|---|---|---|---|
| `/` | каталог одного кадра | промты для фото | «фотосесс» в Title / H1 / H2 |
| `/promty-dlya-ii-fotosessii` | хаб серии | промты для ии фотосессии в нейросетях | сделать фото ИИ; промты для ИИ фото в нейросетях; промты для фото девушки |
| `/promty-dlya-ii-fotosessii/zhenskie` | L2 серии | промты для ии фотосессии женские | промты для фото девушки |
| `/promty-dlya-ii-fotosessii/pary` | L2 серии | промты для ии фотосессии парные | промты для фото пар |
| `/promty-dlya-ii-fotosessii/muzhskie` | L2 серии | промты для ии фотосессии мужские | промты для фото мужчины |
| `/promty-dlya-ii-fotosessii/semeynye` | L2 серии | промты для ии фотосессии семейные | промты для семейного фото |
| `/promty-dlya-ii-fotosessii/detskie` | L2 серии | промты для ии фотосессии детские | промты для детских фото |
| `/promty-dlya-ii-fotosessii/beremennye` | L2 серии | промты для ии фотосессии беременные | промты для фото беременной |
| `/promty-dlya-ii-fotosessii/den-rozhdeniya` | L2 серии | промты для ии фотосессии на день рождения | промты на день рождения (`/sobytiya/den-rozhdeniya`) |
| `/promty-dlya-ii-fotosessii/studiynye` | L2 серии | промты для ии фотосессии студийные | промты для студийного фото |
| `/promty-dlya-ii-fotosessii/zimnyaya` | L2 серии | промты для ии фотосессии зимняя | промты про зиму |
| `/promty-dlya-ii-fotosessii/s-voennymi` | L2 серии | промты для ии фотосессии с военными | промты для фото в форме |
| `/promty-dlya-ii-fotosessii/dlya-dvoih` | L2 серии | промты для ии фотосессии для двоих | парные (`/pary`); каталог влюблённых |
| `/promty-dlya-ii-fotosessii/novogodnyaya` | L2 серии | промты для ии фотосессии новогодняя | зима; каталог Нового года |
| `/promty-dlya-ii-fotosessii/vesennie` | L2 серии | промты для ии фотосессии весенние | промты про весну |
| `/promty-dlya-ii-fotosessii/delovoy-stil` | L2 серии | промты для ии фотосессии деловой стиль | промты для делового фото |
| `/promty-dlya-ii-fotosessii/nyuborn` | L2 серии | промты для ии фотосессии ньюборн | детские; промты для фото малыша |
| `/promty-dlya-ii-fotosessii/s-mashinoy` | L2 серии | промты для ии фотосессии с машиной | промты для фото с машиной |
| `/promty-dlya-ii-fotosessii/cherno-belye` | L2 серии | промты для ии фотосессии чёрно-белые | промты для чёрно-белого фото |
| `/generaciya-foto` | глагол | сделать фото ИИ | промты для ии фотосессии |
| `/promty-dlya-foto-devushki` | L1 кадра | промты для фото девушки | ИИ-фотосессия в H1 / Title |
| `/promty-dlya-foto-muzhchiny` | L1 кадра | промты для фото мужчины | …мужские (серия) |

Старый план марта `/promty-dlya-fotosessii` не собран. **301** → хаб.

---

## 2. Источники

- Wordcraft xlsx `промты для фотосессии`, 28.08.2026: head 9 193 demand
- Яндекс.Вебмастер, 01–25.08.2026: «промты для ии фотосессии» 3 750 / 308 / CTR 8,2% / поз. 7,0 — №1 по показам сайта

---

## 3. Хаб `/promty-dlya-ii-fotosessii`

Порядок: hero + карусель только из карточек-фотосессий → коллажи L2 `#temy` → HowTo → галерея `#primery` (луки каталога, без фильтра фотосессии) → тарифы `#tarify` → FAQ. Блока «Собрать кадры на PromptShot» нет. Рамки «Чем ИИ-фотосессия отличается от одного промта» на хабе нет.

| Блок | Запросы | Текст |
|---|---|---|
| Title | head | `Промты для ИИ фотосессии в нейросетях \| PromptShot` |
| H1 | head | `Промты для ИИ фотосессии в нейросетях` |
| Description | head + хвосты готовые / создание / на русском | `Промты для ИИ фотосессии в нейросетях. Готовые промты для создания ИИ фотосессии на русском — скопируй или создай серию со своим фото.` |
| Hero CTA | UI, не ключ | «Скопировать промт» → `#primery`; «Собрать кадр» → `/generaciya-foto` |
| Коллажи | темы L2 | H2 `Готовые промты для ИИ фотосессии на русском` |
| HowTo | как сделать ии фотосессию | H2 `Как сделать ии фотосессию`. Лид: скопируй готовый промт или создай серию со своим фото. |
| Галерея | примеры луков | H2 `Промты для создания ии фотосессии`. Лид: готовые промты для создания — скопируй с карточки или создай серию со своим фото; один стиль и один герой. |
| Тарифы | кредиты | тот же embed, что на `/generaciya-foto` |
| FAQ | готовые / на русском / лучшие / нейрофотосессия | без L1-ключей в вопросах |

Синонимы в H2/FAQ, не в Title: промты для ии фотосессии, промт для фотосессии нейросети, нейрофотосессия, готовые, на русском.

---

## 4. L2

`/promty-dlya-ii-fotosessii/zhenskie` — Title/H1 `Промты для ИИ фотосессии женские`; лента `audience_tag=devushka`; ссылки на `/promty-dlya-foto-devushki` и `/generaciya-foto/devushki`.

`/promty-dlya-ii-fotosessii/pary` — Title/H1 `Промты для ИИ фотосессии парные`; лента `audience_tag=para`; ссылки на `/promty-dlya-foto-par` и `/generaciya-foto/pary`.

`/promty-dlya-ii-fotosessii/muzhskie` — Title/H1 `Промты для ИИ фотосессии мужские`; лента `audience_tag=muzhchina`; ссылки на `/promty-dlya-foto-muzhchiny` и `/generaciya-foto/muzhchiny`.

`/promty-dlya-ii-fotosessii/semeynye` — Title/H1 `Промты для ИИ фотосессии семейные`; лента `audience_tag=semya`; ссылки на `/promty-dlya-semejnogo-foto` и `/generaciya-foto/semya`.

`/promty-dlya-ii-fotosessii/detskie` — Title/H1 `Промты для ИИ фотосессии детские`; лента `audience_tag=detskie`; ссылки на `/promty-dlya-detskih-foto` и `/generaciya-foto/deti`.

`/promty-dlya-ii-fotosessii/beremennye` — Title/H1 `Промты для ИИ фотосессии беременные`; лента `audience_tag=beremennaya`; ссылки на `/promty-dlya-foto-beremennaya` и `/generaciya-foto/beremennaya`. FAQ ловит «промт для беременной фотосессии ии».

Дальше в том же шаблоне (порядок чипов/коллажей = меню):

| slug | Title/H1 модификатор | лента | каталог одного кадра |
|---|---|---|---|
| `den-rozhdeniya` | на день рождения | `occasion_tag=den_rozhdeniya` | `/sobytiya/den-rozhdeniya` |
| `studiynye` | студийные | `style_tag=studiynoe` | `/stil/studiynoe` |
| `zimnyaya` | зимняя | `object_tag=zima` | `/zima` |
| `s-voennymi` | с военными | `object_tag=v_forme` | `/v-forme` |
| `dlya-dvoih` | для двоих | `audience_tag=vlyublennykh` | `/promty-dlya-foto-vlyublennykh` |
| `novogodnyaya` | новогодняя | `occasion_tag=novyy_god` | `/sobytiya/novyj-god` |
| `vesennie` | весенние | `object_tag=vesna` | `/vesna` |
| `delovoy-stil` | деловой стиль | `style_tag=delovoe` | `/stil/delovoe` |
| `nyuborn` | ньюборн | `audience_tag=malysh` | `/promty-dlya-foto-malysh` |
| `s-mashinoy` | с машиной | `object_tag=s_mashinoy` | `/s-mashinoy` |
| `cherno-belye` | чёрно-белые | `style_tag=cherno_beloe` | `/stil/cherno-beloe` |

Порядок L2 как у хаба: hero + карусель (фотосессии ребёнка, иначе луки с фото) → коллажи `#temy` → HowTo из 2 шагов → галерея `#primery` → тарифы `#tarify` → FAQ. Рамки «серия или один кадр» и CTA-блока на L1 / GF нет: один кадр остаётся в FAQ и в ссылке «Все промты для фото» у галереи. Copy — тот же шаблон хаба, слоты под ключ ребёнка (`buildFotosessiiChildCopy`). Title/H1 не берут «в нейросетях», «готовые» и ключ главной. Пример `zhenskie`: Title/H1 `Промты для ИИ фотосессии женские`; Description `{H1}. Готовые промты для создания женской ИИ фотосессии на русском — скопируй или создай серию со своим фото.`; HowTo `Как сделать женскую ии фотосессию`.

Не делать `/na-russkom`, `/gotovye`. Occasion-хаб дня рождения не переезжает: один кадр остаётся на `/sobytiya/den-rozhdeniya`. «Для двоих» не делит ленту с `/pary`. Свадебные — не в этом выкате.

---

## 5. Антиканнибал

- `/`: убрать «промты для ии фотосессии» из синонимов; FAQ фотосессии ссылается на хаб; карточка hero → хаб.
- `devushka`: снять «ИИ-фотосессии» из H1 / title / description / FAQ #1; HowTo и seo-текст — один кадр + ссылка на L2 `zhenskie`.
- `muzhchina`: обратная ссылка на `muzhskie`.
- GF `devushki` / `pary` / `muzhchiny` / `semya` / `deti` / `beremennaya`: `promptCatalogHref` → L2 хаба.
- L1 `para` / `semya` / `detskie` / `beremennaya`: popularLinks → соответствующий L2.

Орфография: «промт»; в прозе «ИИ-фотосессия»; в Title — «ИИ фотосессии» как в запросе.

Код: `landing/src/lib/promty-dlya-ii-fotosessii-cluster.ts`, `promty-dlya-ii-fotosessii-seo-copy.ts`, `app/promty-dlya-ii-fotosessii/`.
