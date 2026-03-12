# Лендинг «Промты для фото ИИ» — план

**Дата:** 07.03.2026
**Проект:** aiphoto
**Статус:** планирование
**Связанные документы:**
- [11-03-seo-card-retrieval-requirements.md](./11-03-seo-card-retrieval-requirements.md) — архитектура выдачи карточек на route.
- [10-03-hashtag-extraction-tz.md](./10-03-hashtag-extraction-tz.md) — таксономия SEO-измерений для route_key.
- [10-03-parser-db-requirements.md](./10-03-parser-db-requirements.md) — DB-контракт полей для retrieval.
- `11-03-seo-url-query-mapping-clean.csv` — очищенный Wordstat mapping (рабочий слой семантики).
- `11-03-seo-url-query-mapping-canonical.csv` — канонический URL mapping после перегруппировки запросов.
- `11-03-seo-menu-map.csv` — агрегированная карта меню и SEO-хабов по уникальным URL.

---

## Контракт синхронизации документов

Этот документ описывает SEO-структуру сайта и index/noindex правила.  
При любой правке следующих блоков обязательно ревьюить связанный документ:

- Если меняется структура route/URL, обязательно проверить `11-03-seo-card-retrieval-requirements.md` (разделы `route_key`, tier-логика, min cards).
- Если меняются SEO-измерения/slug-комбинации, обязательно проверить `10-03-hashtag-extraction-tz.md` (словарь и правила маппинга).
- Если меняются требования к полям карточки, обязательно проверить `10-03-parser-db-requirements.md` (наличие и формат полей в БД).

Чеклист при ревью:

- [ ] route key и измерения совпадают с тегированием;
- [ ] индексируемые страницы достижимы по правилу `min_cards`;
- [ ] noindex/sitemap правила совпадают с retrieval-логикой.

---

## Контекст

SEO-лендинг с карточками промптов для генерации/обработки фото через ИИ. Каждая карточка — готовый промт с примером до/после, тегами и кнопкой копирования. Цель — привлечение органического трафика по запросам «промты для фото», «промты для фото девушки», «промт для фото на день рождения» и т.д.

Дополнительно: строим **programmatic SEO слой** (RU+EN), где 1 карточка участвует в нескольких низкочастотных страницах. Целевой масштаб:
- старт: 1000 карточек -> 10k+ SEO-страниц;
- расширение: 10k карточек -> 100k+ SEO-страниц.

**Источники ключей (Wordstat, 06.02–06.03.2026):**

| Файл | Ядро запроса | Суммарный трафик |
|------|-------------|------------------|
| `wordstat_top_queries (1).csv` | «фото промт» | ~131K |

Для **текущей итерации архитектуры меню и canonical URL** source of truth:
- `docs/11-03-seo-url-query-mapping-clean.csv` — только очищенные запросы из `wordstat_top_queries (1).csv`;
- `docs/11-03-seo-url-query-mapping-canonical.csv` — новый канонический mapping запрос -> URL;
- `docs/11-03-seo-menu-map.csv` — агрегированная карта уникальных URL, query count и total volume.

Из текущего слоя исключены:
- `оживление`, `видео`, `18+`, `порно`, `эротика`;
- сырые broad-кластеры из `wordstat_top_queries (2).csv` и `wordstat_top_queries (3).csv`;
- шумовые tool/modifier ветки, которые не дают стабильной menu-архитектуры.

---

## Формат карточки промпта

Каждая карточка содержит:

- **Заголовок** — описание сцены («С большим букетом мимозы»)
- **Фото-примеры** — 1–3 результата генерации
- **Инструкция** — шаги (1. Перейди в бот, 2. Отправь фото, 3. Добавь промт)
- **Текст промпта** — один или несколько копируемых блоков (кнопка «Скопировать»)
- **Теги** — #женский, #одиночный, #весенний и т.д.

### SEO-атрибуты карточки (content-only, расширенная таксономия v2)

Карточка тегируется **только из текста промта**. Атрибуты, которых нет в промте, не присваиваются.
Считаем только **RU-сайт** (EN-сайт строится на тех же тегах, но с отдельными slug/label).

Основа словаря: полный корпус `docs/wordstat/wordstat_top_queries (1).csv`.

Для текущего проектирования меню и canonical routing:
- рабочий очищенный mapping: `docs/11-03-seo-url-query-mapping-clean.csv`;
- канонический mapping: `docs/11-03-seo-url-query-mapping-canonical.csv`;
- карта меню по уникальным URL: `docs/11-03-seo-menu-map.csv`.

#### `audience_tag[]` — аудитория + отношения (22 значения, ~170K суммарно)

| slug | Wordstat RU | ~Volume/мес |
|------|-------------|------------|
| `devushka` | девушки, женские | 45 000 |
| `para` | пары, парное | 25 000 |
| `muzhchina` | мужчины, мужские | 15 000 |
| `semya` | семейные, семья | 14 000 |
| `detskie` | детские, ребенок | 11 000 |
| `s_parnem` | с парнем | 6 500 |
| `s_mamoy` | с мамой | 5 500 |
| `pokoleniy` | поколений, 3 поколения | 4 200 |
| `s_muzhem` | с мужем | 2 800 |
| `s_drugom` | с другом | 2 600 |
| `s_dochkoy` | с дочкой, с дочерью | 2 600 |
| `vlyublennykh` | влюблённых | 2 100 |
| `s_pitomcem` | с питомцем, с животными | 1 900 |
| `s_synom` | с сыном | 1 700 |
| `malchik` | мальчик | 1 500 |
| `s_papoy` | с папой | 1 500 |
| `s_podrugoy` | с подругой | 1 400 |
| `devochka` | девочка | 1 100 |
| `s_babushkoy` | с бабушкой | 1 100 |
| `malysh` | малыш, младенец | 800 |
| `podrostok` | подросток | 350 |
| `s_sestroy` | с сестрой | 300 |
| `s_bratom` | с братом | 190 |

#### `style_tag[]` — визуальный стиль (18 значений, ~50K суммарно)

| slug | Wordstat RU | ~Volume/мес |
|------|-------------|------------|
| `cherno_beloe` | чёрно-белое, ч/б | 8 000 |
| `realistichnoe` | реалистичное | 6 500 |
| `portret` | портрет | 6 000 |
| `3d` | 3д, 3d | 4 400 |
| `gta` | гта, GTA | 3 500 |
| `studiynoe` | студийное | 3 500 |
| `love_is` | love is, лав ис | 3 200 |
| `delovoe` | деловое, бизнес | 2 800 |
| `multyashnoe` | мультяшное, мультик | 2 200 |
| `kollazh` | коллаж | 2 100 |
| `otkrytka` | открытка | 2 000 |
| `sovetskoe` | советское | 2 000 |
| `retro` | ретро | 1 300 |
| `anime` | аниме | 1 300 |
| `polaroid` | полароид | 850 |
| `disney` | дисней | 370 |
| `selfi` | селфи | 300 |
| `piksar` | пиксар | 31 |

#### `occasion_tag[]` — событие/повод (7 значений, ~31K суммарно)

| slug | Wordstat RU | ~Volume/мес |
|------|-------------|------------|
| `den_rozhdeniya` | день рождения | 11 000 |
| `23_fevralya` | 23 февраля | 7 000 |
| `14_fevralya` | 14 февраля, валентин | 4 000 |
| `maslenica` | масленица | 3 400 |
| `8_marta` | 8 марта | 2 300 |
| `svadba` | свадьба | 1 900 |
| `novyy_god` | новый год | 1 500 |

#### `object_tag[]` — объект/сцена/контекст (20 значений, ~46K суммарно)

| slug | Wordstat RU | ~Volume/мес |
|------|-------------|------------|
| `v_forme` | в форме, военное | 7 500 |
| `s_mashinoy` | с машиной, авто | 6 500 |
| `s_cvetami` | с цветами, букет, тюльпаны | 5 000 |
| `so_znamenitostyu` | со знаменитостью | 3 500 |
| `v_profil` | в профиль, боком | 2 500 |
| `s_kotom` | с котом, кошки | 2 400 |
| `v_kostyume` | в костюме, пиджак | 2 200 |
| `na_chernom_fone` | на чёрном фоне | 2 200 |
| `s_tortom` | с тортом | 1 800 |
| `zima` | зимнее, снег | 1 800 |
| `v_zerkale` | в зеркале | 1 600 |
| `vesna` | весеннее | 1 400 |
| `s_sobakoy` | с собакой | 1 400 |
| `v_lesu` | в лесу | 660 |
| `s_koronoy` | с короной | 430 |
| `na_more` | на море, пляж | 430 |
| `v_polnyy_rost` | в полный рост | 320 |
| `v_gorah` | в горах | 250 |
| `na_ulice` | на улице | 160 |

#### `doc_task_tag[]` — документные задачи (5 значений, ~12K суммарно)

| slug | Wordstat RU | ~Volume/мес |
|------|-------------|------------|
| `na_pasport` | на паспорт | 7 500 |
| `na_dokumenty` | на документы | 1 800 |
| `na_avatarku` | на аватарку, на аву | 1 700 |
| `na_rezume` | на резюме | 800 |
| `na_zagranpasport` | на загранпаспорт | 200 |

#### `lang_labels` — каноничные словоформы (`ru_label`, `en_label`) для двух сайтов.

**Итого: 5 измерений, 72 уникальных значения. Суммарный Wordstat-трафик по content-тегам: ~309K/мес.**

#### Что НЕ является измерением карточки

| Кластер | Примеры | Суммарный трафик | Почему не тег | Покрытие |
|---------|---------|-----------------|---------------|----------|
| `intent_action` | sozdanie, obrabotka, uluchshenie | ~260K | Нет в промтах | Статические хабы сценариев: 7 страниц |

> `intent_modifier` (besplatno, onlayn) и `tool_tag` (nano_banana, chatgpt, gemini) — **не участвуют в card-tagging**.  
> `intent_modifier` не попадает в текущую карту, а generic tool queries живут в отдельном secondary SEO-слое `/instrumenty/[tool]/`.

Высокочастотные запросы ведут на **главную** и **статические хаб-страницы** (`intent_action`), которые наполняются редакционно.

Programmatic SEO строится на комбинациях content-тегов (audience × style × occasion × object × doc_task).

---

## Кластеры запросов

### Tier 1 — Высокочастотные (>10K запросов/мес) — главная + L1-хабы

| Кластер | Трафик | Ключевые запросы | Тип страницы |
|---------|--------|------------------|--------------|
| Создание фото | ~34K | промт для создания фото, промт для генерации фото | **Сценарии / L1** |
| Девушки | ~17K | промты для фото девушки, промты для фото женщины | **Люди и отношения / L1** |
| Обработка фото | ~14.7K | промт для обработки фото, промт для редактирования фото | **Сценарии / L1** |
| Пары | ~9K | промты для фото пар, парных фото | **Люди и отношения / L1** |
| Мужчины | ~8.2K | промты для фото мужчины, мужские промты | **Люди и отношения / L1** |
| Дети | ~5.3K | промты для детских фото | **Люди и отношения / L1** |
| Семья | ~5.1K | промт для семейного фото | **Люди и отношения / L1** |
| Улучшение фото | ~5K | промт для улучшения фото, улучшения качества фото | **Сценарии / L1** |
| Из фото в промт | ~4.5K | создать промт по фото, сделать промт по фото | **Главная** |
| День рождения | ~3.2K | промт для фото на день рождения | **События / L1** |
| Чёрно-белое | ~3.1K | промт черно белое фото | **Стили / L1** |
| ChatGPT | ~3.1K | промты для чата gpt для фото | **Инструменты / L1** |
| Реставрация | ~2.6K | промт для старых фото, реставрации фото | **Сценарии / L1** |
| Реалистичное | ~2.5K | реалистичные промты для фото | **Стили / L1** |
| С мамой | ~2.5K | промт для фото с мамой | **Люди и отношения / L1** |

### Tier 2 — Среднечастотные (3K–10K) — programmatic + secondary L1

| Кластер | Трафик | Тип страницы |
|---------|--------|--------------|
| Чёрно-белое | ~8K | **Programmatic L1** (style) |
| В форме/военное | ~7.5K | **Programmatic L1** (object) |
| Фото на паспорт | ~7.5K | **Programmatic L1** (doc_task) |
| 23 февраля | ~7K | **Programmatic L1** (occasion) |
| Реалистичное | ~6.5K | **Programmatic L1** (style) |
| С машиной | ~6.5K | **Programmatic L1** (object) |
| С парнем | ~6.5K | **Programmatic L1** (audience) |
| Готовые промты | ~6K | **Статический хаб** (Раздел 7) |
| Портрет | ~6K | **Programmatic L1** (style) |
| С мамой | ~5.5K | **Programmatic L1** (audience) |
| С цветами | ~5K | **Programmatic L1** (object) |
| 3D | ~4.4K | **Programmatic L1** (style) |
| Поколений | ~4.2K | **Programmatic L1** (audience) |
| 14 февраля | ~4K | **Programmatic L1** (occasion) |
| Замена фона | ~4K | **Статический хаб** (Раздел 2) |
| ChatGPT | ~4K | **Статический хаб** (Раздел 5) |
| GTA | ~3.5K | **Programmatic L1** (style) |
| Студийное | ~3.5K | **Programmatic L1** (style) |
| Со знаменитостью | ~3.5K | **Programmatic L1** (object) |
| Love Is | ~3.2K | **Programmatic L1** (style) |
| Масленица | ~3.4K | **Programmatic L1** (occasion) |

### Tier 3 — Длинный хвост (200–3K) — programmatic L1 + L2 комбинации

| Кластер | Примеры (Wordstat) | Трафик |
|---------|-------------------|--------|
| **Аудитория** | с мужем (~2.8K), с другом (~2.6K), с дочкой (~2.6K), влюблённых (~2.1K), с сыном (~1.7K), с папой (~1.5K), мальчик (~1.5K), с подругой (~1.4K), с бабушкой (~1.1K), девочка (~1.1K), малыш (~800), подросток (~350) | ~18K суммарно |
| **Стили** | деловое (~2.8K), мультяшное (~2.2K), коллаж (~2.1K), открытка (~2K), советское (~2K), ретро (~1.3K), аниме (~1.3K), полароид (~850), дисней (~370), селфи (~300) | ~15K суммарно |
| **Объекты/сцены** | в профиль (~2.5K), с котом (~2.4K), в костюме (~2.2K), чёрный фон (~2.2K), с тортом (~1.8K), зимнее (~1.8K), в зеркале (~1.6K), весеннее (~1.4K), с собакой (~1.4K), с Путиным (~1.2K), в лесу (~660), корона (~430), море (~430) | ~22K суммарно |
| **Документы** | на документы (~1.8K), на аватарку (~1.7K), на резюме (~800), загранпаспорт (~200) | ~4.5K суммарно |
| **L2 комбинации** | фото девушки с цветами (~800), мужчины в форме (~500), семья в профиль (~550), семья чёрный фон (~450), мужчины на 23 февраля (~400), пар на 14 февраля (~350) | ~10K+ суммарно |

---

## Дерево сайта (RU)

```
/                                                  ← Главная: broad-хаб + "из фото в промт"
│
├── /promty-dlya-sozdaniya-foto/                  ← Сценарии / Создание фото
│   ├── /promty-dlya-sozdaniya-foto/podrobnye/    ← editorial modifier
│   ├── /promty-dlya-sozdaniya-foto/primery/
│   └── /promty-dlya-sozdaniya-foto/gotovye/
├── /promty-dlya-obrabotki-foto/                  ← Сценарии / Обработка фото
├── /promty-dlya-uluchsheniya-foto/               ← Сценарии / Улучшение фото
├── /promty-dlya-restavracii-foto/                ← Сценарии / Реставрация фото
├── /promty-dlya-fotosessii/                      ← Сценарии / Фотосессия
├── /promty-dlya-kollazha/                        ← Сценарии / Коллаж
├── /promty-dlya-zameny-lica/                     ← Сценарии / Замена лица
│
├── /promty-dlya-foto-devushki/                   ← Люди и отношения / Девушки
│   ├── /…/cherno-beloe/                          ← audience + style
│   ├── /…/den-rozhdeniya/                        ← audience + occasion
│   └── /…/s-cvetami/                             ← audience + object
├── /promty-dlya-foto-muzhchiny/                  ← Люди и отношения / Мужчины
├── /promty-dlya-foto-par/                        ← Люди и отношения / Пары
├── /promty-dlya-semejnogo-foto/                  ← Люди и отношения / Семья
├── /promty-dlya-detskih-foto/                    ← Люди и отношения / Дети
├── /promty-dlya-foto-s-mamoy/                    ← Люди и отношения / С мамой
├── /promty-dlya-foto-s-parnem/                   ← Люди и отношения / С парнем
├── /promty-dlya-foto-pokoleniy/                  ← Люди и отношения / Поколения
├── /promty-dlya-foto-s-papoy/                    ← Люди и отношения / С папой
├── /promty-dlya-foto-s-muzhem/                   ← Люди и отношения / С мужем
├── /promty-dlya-foto-s-dochkoy/                  ← Люди и отношения / С дочкой
├── /promty-dlya-foto-s-synom/                    ← Люди и отношения / С сыном
├── /promty-dlya-foto-s-podrugoy/                 ← Люди и отношения / С подругой
├── /promty-dlya-foto-s-drugom/                   ← Люди и отношения / С другом
│
├── /stil/cherno-beloe/                           ← Стили / Черно-белое
├── /stil/realistichnoe/                          ← Стили / Реалистичное
├── /stil/portret/                                ← Стили / Портрет
├── /stil/studiynoe/                              ← Стили / Студийное
├── /stil/love-is/                                ← Стили / Love Is
├── /stil/gta/                                    ← Стили / GTA
├── /stil/delovoe/                                ← Стили / Деловое
├── /stil/retro/                                  ← Стили / Ретро
├── /stil/sovetskoe/                              ← Стили / Советское
├── /stil/otkrytka/                               ← Стили / Открытка
├── /stil/anime/                                  ← Стили / Аниме
├── /stil/disney/                                 ← Стили / Disney
├── /stil/polaroid/                               ← Стили / Полароид
│
├── /sobytiya/den-rozhdeniya/                     ← События / День рождения
├── /sobytiya/23-fevralya/                        ← События / 23 февраля
├── /sobytiya/14-fevralya/                        ← События / 14 февраля
├── /sobytiya/8-marta/                            ← События / 8 марта
├── /sobytiya/maslenica/                          ← События / Масленица
├── /sobytiya/svadba/                             ← События / Свадьба
├── /sobytiya/novyj-god/                          ← События / Новый год
│
├── /foto-na-pasport/                             ← Задачи / На паспорт
├── /foto-na-dokumenty/                           ← Задачи / На документы
├── /foto-na-avatarku/                            ← Задачи / На аватарку
├── /foto-na-rezume/                              ← Задачи / Для резюме
├── /foto-na-zagranpasport/                       ← Задачи / На загранпаспорт
│
├── /v-forme/                                     ← Сцены и объекты / В форме
├── /s-mashinoy/                                  ← Сцены и объекты / С машиной
├── /s-cvetami/                                   ← Сцены и объекты / С цветами
├── /so-znamenitostyu/                            ← Сцены и объекты / Со знаменитостью
├── /s-kotom/                                     ← Сцены и объекты / С котом
├── /s-sobakoj/                                   ← Сцены и объекты / С собакой
├── /s-tortom/                                    ← Сцены и объекты / С тортом
├── /v-kostyume/                                  ← Сцены и объекты / В костюме
├── /v-profil/                                    ← Сцены и объекты / В профиль
├── /v-zerkale/                                   ← Сцены и объекты / В зеркале
├── /na-more/                                     ← Сцены и объекты / На море
├── /v-lesu/                                      ← Сцены и объекты / В лесу
├── /v-gorah/                                     ← Сцены и объекты / В горах
├── /na-chernom-fone/                             ← Сцены и объекты / На черном фоне
│
├── /instrumenty/chatgpt/                         ← Secondary SEO / ChatGPT
├── /instrumenty/gemini/                          ← Secondary SEO / Gemini
├── /instrumenty/nano-banana/                     ← Secondary SEO / Nano Banana
├── /instrumenty/grok/                            ← Secondary SEO / Grok
├── /instrumenty/perplexity/                      ← Secondary SEO / Perplexity
├── /instrumenty/sora/                            ← Secondary SEO / Sora
│
├── /gotovye-promty/                              ← База промтов / editorial hub
│   ├── /gotovye-promty/primery/
│   ├── /gotovye-promty/podrobnye/
│   ├── /gotovye-promty/na-russkom/
│   └── /gotovye-promty/luchshie/
│
├── /p/[slug]/                                    ← Индивидуальные карточки
│
└── sitemap.xml, robots.txt
```

### Подсчёт страниц (только RU)

| Тип | Кол-во | Описание |
|-----|--------|----------|
| Главная | 1 | `/` |
| Сценарии L1 | ~7 | intent-driven hubs |
| Люди и отношения L1 | ~22 | audience hubs |
| Стили L1 | ~18 | style hubs |
| События L1 | ~7 | occasion hubs |
| Задачи L1 | ~5 | doc_task hubs |
| Сцены и объекты L1 | ~21 | object hubs |
| Инструменты L1 | ~6 | secondary tool hubs |
| База промтов / editorial | ~7 | готовые, примеры, подробные и т.д. |
| **Programmatic L2** (2 тега) | **~2 000** (теор.) | core semantic combinations |
| **Programmatic L3** (3 тега) | **~25 000** (теор.) | только selective expansion |
| Карточки | **1 000+** | `/p/[slug]/` |
| **Итого теоретически** | **~28 000+** | меню + programmatic + карточки |

#### Реальные индексируемые страницы (зависят от наполнения карточками)

| Карточек в базе | L1 (index) | L2 (index) | L3 (index) | Карточки | Хабы | **Итого index** |
|----------------|-----------|-----------|-----------|---------|------|----------------|
| **1 000** | ~65 | ~500 | ~200 | 1 000 | ~65 | **~1 830** |
| **3 000** | ~72 | ~1 400 | ~1 200 | 3 000 | ~65 | **~5 739** |
| **5 000** | ~72 | ~1 850 | ~3 500 | 5 000 | ~65 | **~10 487** ← цель |
| **10 000** | ~72 | ~2 000 | ~7 000 | 10 000 | ~65 | **~19 137** |

**Вывод:** цель 10K страниц достигается при ~5 000 карточек в базе. Текущая структура (72 значения × 5 измерений) создает достаточную «решётку» для роста.

**Путь к 10K:**
1. Старт (1000 карт.) → ~1 800 страниц — покрываем все L1 + популярные L2
2. Фаза роста (3000 карт.) → ~5 700 страниц — появляются L3 комбинации
3. Цель (5000 карт.) → ~10 500 страниц — target reached
4. Масштаб (10000 карт.) → ~19 100 страниц

---

## Programmatic SEO (10k+ страниц)

### Почему это нужно

Конкуренция по broad-запросам высокая, поэтому рост делаем через long-tail:
- не только «промты для фото» (~131K),
- а **комбинации content-тегов**: «промты для фото девушки с цветами» (~800), «фото мужчины на 23 февраля в форме» (~350).

### Формула генерации страниц

Programmatic SEO строится **только на 5 content-измерениях** (72 значения):

```
L1: /[dimension_1_slug]/
L2: /[dimension_1_slug]/[dimension_2_slug]/
L3: /[dimension_1_slug]/[dimension_2_slug]/[dimension_3_slug]/
```

Приоритет первого уровня URL:
1. `audience_tag` → `/promty-dlya-foto-devushki/`
2. `style_tag` → `/stil/cherno-beloe/`
3. `occasion_tag` → `/sobytiya/den-rozhdeniya/`
4. `object_tag` → `/s-mashinoy/`
5. `doc_task_tag` → `/foto-na-pasport/`

Для L2 второй тег добавляется как подпапка:
- `/promty-dlya-foto-devushki/cherno-beloe/` (audience + style)
- `/promty-dlya-foto-devushki/s-cvetami/` (audience + object)
- `/promty-dlya-foto-devushki/den-rozhdeniya/` (audience + occasion)
- `/sobytiya/23-fevralya/v-forme/` (occasion + object)
- `/foto-na-pasport/realistichnoe/` (doc_task + style)

Для L3:
- `/promty-dlya-foto-devushki/cherno-beloe/v-zerkale/` (audience + style + object)

**Высокочастотные запросы** (`intent_action`) → статические хаб-страницы (Раздел 2).

### Индивидуальные карточки

Каждая карточка промта имеет собственную SEO-страницу:
- URL: `/p/[slug]/` (slug = транслит заголовка)
- title: `{title} — промт для фото ИИ`
- Schema.org: `HowTo`
- index: всегда `index,follow`

### Математика: как набрать 10K страниц

**72 значения × 5 измерений:**

| Уровень | Формула | Теоретический максимум |
|---------|---------|----------------------|
| L1 | 22+18+7+20+5 | **72** |
| L2 | C(5,2) пар × перемножения | **~2 000** |
| L3 | C(5,3) троек × перемножения | **~25 000** |
| Карточки | N | **N** |
| Хабы | фикс. | **~35** |

**Bottleneck = количество карточек.** Комбо-страница индексируется только при `cards_count >= min_cards_per_page`.

С 1000 карточек (при среднем 2.5 тега/карточку):
- L1: ~65 страниц, L2: ~500, L3: ~200, карточки: 1000 → **~1 800 total**

С 5000 карточек:
- L1: ~72, L2: ~1 850, L3: ~3 500, карточки: 5000 → **~10 450 total** ← цель

Рабочий Wordstat mapping: `docs/11-03-seo-url-query-mapping-clean.csv`.
Канонический URL mapping: `docs/11-03-seo-url-query-mapping-canonical.csv`.

### Правила index/noindex для защиты от thin content

`index,follow` только если одновременно:
1. `cards_count >= 6` (для L2/L3; для L1 — `>= 3`);
2. Есть уникальный SEO-блок (intro + how-to + faq) под конкретную комбинацию;
3. Есть отдельные (не дублирующиеся) `title/h1/meta`.

Иначе: `noindex,follow` + canonical на ближайший родительский L1-хаб.

Для карточек (`/p/[slug]/`): всегда `index,follow`.

### Контентный шаблон SEO-страницы

Для каждой programmatic страницы обязателен минимум:
1. `H1` под узкий intent-запрос;
2. 60-120 слов intro (не шаблон "копипаст");
3. сетка карточек (6+);
4. блок "как использовать промт";
5. FAQ 3-5 вопросов;
6. перелинковка: соседние audience / style / occasion / object теги.

---

## Приоритеты по трафику (топ-20 страниц)

| # | Страница | Тип | Трафик |
|---|----------|-----|--------|
| 1 | `/promty-dlya-sozdaniya-foto/` | static hub | ~34.3K |
| 2 | `/promty-dlya-foto-devushki/` | **programmatic L1** | ~17.4K |
| 3 | `/promty-dlya-obrabotki-foto/` | static hub | ~14.7K |
| 4 | `/promty-dlya-foto-par/` | **programmatic L1** | ~9.1K |
| 5 | `/promty-dlya-foto-muzhchiny/` | **programmatic L1** | ~8.3K |
| 6 | `/promty-dlya-detskih-foto/` | **programmatic L1** | ~5.3K |
| 7 | `/promty-dlya-semejnogo-foto/` | **programmatic L1** | ~5.1K |
| 8 | `/promty-dlya-uluchsheniya-foto/` | static hub | ~5.0K |
| 9 | `/` | homepage | ~4.5K |
| 10 | `/sobytiya/den-rozhdeniya/` | **programmatic L1** | ~3.2K |
| 11 | `/stil/cherno-beloe/` | **programmatic L1** | ~3.1K |
| 12 | `/instrumenty/chatgpt/` | secondary L1 | ~3.1K |
| 13 | `/promty-dlya-restavracii-foto/` | static hub | ~2.6K |
| 14 | `/stil/realistichnoe/` | **programmatic L1** | ~2.5K |
| 15 | `/promty-dlya-foto-s-mamoy/` | **programmatic L1** | ~2.5K |
| 16 | `/foto-na-pasport/` | **programmatic L1** | ~2.4K |
| 17 | `/sobytiya/23-fevralya/` | **programmatic L1** | ~2.35K |
| 18 | `/stil/portret/` | **programmatic L1** | ~2.17K |
| 19 | `/v-forme/` | **programmatic L1** | ~2.13K |
| 20 | `/so-znamenitostyu/` | **programmatic L1** | ~2.06K |

---

## Стек и инфраструктура

| Слой | Технология |
|------|------------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Data | Supabase (PostgreSQL + Storage) — **отдельный проект** (не photo2sticker-bot) |
| Deploy | Dockhost (Docker standalone) |
| SSG | `generateStaticParams` для кластеров и карточек |
| Аналитика | Яндекс.Метрика |
| Домен | Нужно зарегистрировать (TODO) |

### Supabase

Отдельный Supabase-проект. Не пересекается с photo2sticker-bot.

### Домен и DNS

- Зарегистрировать домен (TODO: выбрать имя)
- DNS → Dockhost IP
- SSL через Dockhost (Let's Encrypt автоматически)

### Деплой (Dockhost)

**Dockerfile** (standalone output):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**`next.config.mjs`:**

```js
export default {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};
```

**Env vars (Dockhost):**

| Переменная | Описание |
|-----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase проекта |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (public, для клиента) |
| `NEXT_PUBLIC_YM_ID` | ID счётчика Яндекс.Метрики |

---

## Хранение данных (Supabase)

Полная схема БД описана в [07-03-prompt-import-pipeline.md](./07-03-prompt-import-pipeline.md#хранение-данных-supabase). Здесь — краткое описание для контекста лендинга.

### Таблицы

| Таблица | Назначение |
|---------|-----------|
| `prompt_cards` | Карточки промптов (заголовок, промты в jsonb, теги, источник) |
| `prompt_card_images` | Фото-примеры карточек (ссылки на Storage) |
| `prompt_clusters` | Страницы сайта (slug, SEO-тексты, иерархия) |
| `prompt_card_pages` | Many-to-many: карточка ↔ страница (одна карточка на нескольких страницах) |

### Storage

Бакет: `prompt-images` (public)

```
prompt-images/{card_slug}/1.webp, 2.webp, 3.webp
```

---

## Навигация и layout

### Header

- Логотип (ссылка на `/`)
- Навигация: Сценарии | Люди и отношения | Стили | События | Задачи | Сцены и объекты | Все промты
- Мобильное меню (бургер)

### Меню для пользователя (финальная структура)

Меню строится от canonical SEO-дерева (`11-03-seo-menu-map.csv`), но остается компактным для пользователя.

Верхний уровень (desktop):

1. `Сценарии`
2. `Люди и отношения`
3. `Стили`
4. `События`
5. `Задачи`
6. `Сцены и объекты`
7. `Все промты`

Secondary navigation:
- `Инструменты` — отдельный SEO-блок во втором ряду / в каталоге / в footer, но не ключевой пункт первого экрана.

#### Dropdown: `Сценарии`

| Колонка | Пункты | URL-паттерн |
|---------|--------|-------------|
| **Основные** | создание фото, обработка фото, улучшение фото | `/promty-dlya-sozdaniya-foto/` |
| **Дополнительные** | реставрация фото, фотосессия, коллаж, замена лица | `/promty-dlya-restavracii-foto/` |
| **Editorial modifiers** | готовые, примеры, подробные | `/promty-dlya-sozdaniya-foto/podrobnye/` |

#### Dropdown: `Люди и отношения`

| Колонка | Пункты | URL-паттерн |
|---------|--------|-------------|
| **Базовые** | девушки, мужчины, пары, семья, дети | `/promty-dlya-foto-devushki/` |
| **Отношения** | с мамой, с парнем, поколения, с папой, с мужем, с дочкой, с сыном | `/promty-dlya-foto-s-mamoy/` |
| **Расширение** | с подругой, с другом, с бабушкой, влюблённые | `/promty-dlya-foto-s-podrugoy/` |

#### Dropdown: `Стили`

| Группа | Пункты |
|--------|--------|
| **Core styles** | чёрно-белое, реалистичное, портрет, студийное |
| **Visual styles** | Love Is, GTA, деловое, ретро, советское |
| **Illustrative** | аниме, Disney, полароид, открытка |

#### Dropdown: `События`

- День рождения
- 23 февраля
- 14 февраля
- 8 марта
- Масленица
- Свадьба
- Новый год

#### Dropdown: `Задачи`

- На паспорт
- На документы
- На аватарку
- Для резюме
- На загранпаспорт

#### Dropdown: `Сцены и объекты`

| Группа | Пункты |
|--------|--------|
| **Объекты** | с машиной, с цветами, со знаменитостью, с котом, с собакой, с тортом |
| **Образ / поза** | в форме, в костюме, в профиль, в зеркале, на чёрном фоне |
| **Место / среда** | на море, в лесу, в горах |

#### Dropdown: `Все промты`

- Каталог всех L1-хабов
- Вход в `Базу промтов`
- Вход в `Инструменты`
- Популярные подборки и новые кластеры

### Мобильное меню (бургер)

- Первым экраном: 7 пунктов верхнего уровня (`Сценарии`, `Люди и отношения`, `Стили`, `События`, `Задачи`, `Сцены и объекты`, `Все промты`).
- Вторым экраном: подпункты выбранного раздела (группы из dropdown).
- Обязательна кнопка `Назад` + хлебные ссылки внутри раздела.
- На мобильном не использовать mega-menu, только вложенные списки.

### Footer

- Ссылки на разделы
- Ссылка на Telegram-канал
- Копирайт

### Хлебные крошки

На всех страницах кроме главной:

```
Главная → Стили → Студийное фото
Главная → Промты для девушек
```

Реализация: компонент `Breadcrumbs.tsx`, данные из `prompt_clusters.parent_slug`.

### Блоки внутренней перелинковки (SEO + UX)

На каждой кластерной странице добавить 4 блока ссылок:

1. `Соседние действия`  
   Пример: на `/promty-dlya-obrabotki-foto/` ссылки на создание/генерацию/улучшение.
2. `Соседние аудитории`  
   Пример: девушки -> мужчины -> пары -> семья.
3. `Соседние стили`  
   Пример: студийное -> черно-белое -> портрет -> ретро.

Правила перелинковки:

- в каждом блоке 4-8 ссылок;
- сначала ссылки той же dimension, затем расширение на смежные route;
- не линковать в noindex-страницы;
- анкоры формировать по каноничным `ru_label/en_label`, без дублирования одного и того же анкора на странице.

### Карточка -> SEO-страницы (двунаправленная связь)

На карточке показывать кликабельные теги/чипы, которые ведут на соответствующие route:

- `audience_tag` → L1 audience-страница
- `style_tag` → L1 style-страница
- `occasion_tag` → L1 occasion-страница
- `object_tag` → L1 object-страница
- `doc_task_tag` → L1 doc_task-страница

А на route-странице показывать карточки, выбранные через retrieval-резолвер (см. `11-03-seo-card-retrieval-requirements.md`), чтобы меню/перелинковка и выдача использовали одну и ту же таксономию.

### Related pages внизу страницы

Нижний блок `Похожие страницы` обязателен:

- 6-12 ссылок;
- минимум 3 ссылки из того же раздела;
- минимум 3 ссылки из соседнего раздела (например, из action в style);
- сортировка по релевантности + приоритет страниц с `index`.

### 404 страница

Кастомная `app/not-found.tsx`:
- Заголовок «Страница не найдена»
- Ссылки на популярные разделы
- Поиск по промтам

---

## SEO и метаданные

### Meta-теги (для каждой страницы)

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const cluster = await getCluster(params.slug);
  return {
    title: cluster.title_ru + " — готовые промты 2026",
    description: cluster.meta_description_ru,
    openGraph: {
      title: cluster.title_ru,
      description: cluster.meta_description_ru,
      type: "website",
      images: [{ url: "/og-default.jpg", width: 1200, height: 630 }],
    },
  };
}
```

Для programmatic страниц:
- `title` и `description` генерируются из content-измерений (`audience_tag`, `occasion_tag`, `style_tag`, `object_tag`, `doc_task_tag`) с отдельными шаблонами для RU-сайта и EN-сайта;
- запрещены полностью дублирующиеся пары `title+description` внутри одного сайта;
- fallback title только на хабах, но не на низкочастотных страницах.

### Open Graph

- Дефолтное OG-изображение: `public/og-default.jpg` (1200x630)
- Для карточек: первое фото-пример как OG-image (если есть отдельные URL карточек в будущем)

### Schema.org

- `HowTo` — на карточках промптов (шаги: перейди в бот → отправь фото → добавь промт)
- `FAQPage` — на кластерных страницах (FAQ-секция)
- `BreadcrumbList` — хлебные крошки

### sitemap.xml

Динамический `app/sitemap.ts`:
- Все кластерные страницы из `prompt_clusters`
- Все programmatic SEO страницы из materialized view/таблицы генерации
- Приоритет: главная 1.0, Tier 1 кластеры 0.8, остальные 0.6
- `changeFrequency: "weekly"`

Дополнительно:
- В sitemap включаются только URL со статусом `index`;
- `noindex` страницы исключаются из sitemap полностью;
- для двух сайтов обязательно проставляются кросс-доменные `hreflang` пары.

### robots.txt

```
User-agent: *
Allow: /
Sitemap: https://{domain}/sitemap.xml
```

---

## Аналитика (Яндекс.Метрика)

Счётчик подключается через `app/layout.tsx`:

```tsx
<Script
  id="yandex-metrika"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      (function(m,e,t,r,i,k,a){...})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
      ym(${process.env.NEXT_PUBLIC_YM_ID}, "init", {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
    `,
  }}
/>
```

**Цели:**
- `copy_prompt` — нажатие «Скопировать» на карточке
- `page_view_cluster` — просмотр кластерной страницы

---

## Пагинация

На страницах с большим количеством карточек (catch-all: sozdaniya-foto, generacii-foto, главная):

- **Серверная пагинация** — `?page=1`, `?page=2`
- **Лимит:** 24 карточки на страницу (сетка 3x8 или 4x6)
- **SEO:** `<link rel="next">` / `<link rel="prev">` + каноничный URL
- **Компонент:** `Pagination.tsx` (номера страниц + стрелки)

На страницах с малым количеством карточек (<24) — без пагинации.

---

## Структура проекта

```
aiphoto/landing/
├── app/
│   ├── layout.tsx                              ← Root layout + YM + Header/Footer
│   ├── page.tsx                                ← Главная
│   ├── not-found.tsx                           ← 404
│   ├── [cluster]/
│   │   └── page.tsx                            ← Кластерная страница (по аудитории, действию, объекту)
│   ├── stil/
│   │   └── [style]/
│   │       └── page.tsx                        ← Стиль
│   ├── sobytiya/
│   │   └── [event]/
│   │       └── page.tsx                        ← Событие
│   ├── gotovye-promty/
│   │   ├── page.tsx                            ← Хаб «Готовые промты»
│   │   └── [sub]/
│   │       └── page.tsx                        ← Подстраницы
│   ├── api/
│   │   └── prompts/route.ts                    ← API для карточек
│   ├── sitemap.ts
│   └── robots.ts
├── components/
│   ├── PromptCard.tsx                          ← Карточка промпта (фото + промт + «Скопировать»)
│   ├── PromptGrid.tsx                          ← Сетка карточек
│   ├── ClusterHero.tsx                         ← Hero кластера (h1 + описание)
│   ├── CopyPromptButton.tsx                    ← Кнопка копирования промпта
│   ├── TagFilter.tsx                           ← Фильтр по тегам
│   ├── Breadcrumbs.tsx                         ← Хлебные крошки
│   ├── Pagination.tsx                          ← Пагинация
│   ├── Header.tsx                              ← Шапка + навигация
│   ├── Footer.tsx                              ← Подвал
│   ├── YandexMetrika.tsx                       ← Счётчик ЯМ
│   └── ui/                                     ← shadcn/ui
├── lib/
│   ├── supabase.ts                             ← Supabase client
│   ├── prompts.ts                              ← Запросы к БД (getCardsByCluster, getCardsByPage, ...)
│   └── seo/
│       ├── clusters.ts                         ← Кластеры (slug → контент)
│       ├── styles.ts                           ← Стили
│       └── metadata.ts                         ← Генерация title/description/OG
├── public/
│   └── og-default.jpg                          ← OG-изображение по умолчанию (1200x630)
├── Dockerfile
├── next.config.mjs
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## Фазы реализации

### Фаза 1 — MVP (каркас)

1. Инициализация Next.js 15 проекта в `aiphoto/landing/`
2. Подключение Supabase, создание таблиц
3. Компонент `PromptCard` + `CopyPromptButton`
4. Главная страница с сеткой карточек
5. 5–10 тестовых карточек промптов (ручной INSERT или через скрипт импорта)
6. Dockerfile + деплой на Dockhost

### Фаза 2 — Кластеры

1. Кластерные страницы (по аудитории, действию)
2. Страницы стилей
3. Страницы событий
4. `generateStaticParams` для SSG
5. sitemap.xml, robots.txt

### Фаза 3 — Готовые промты

1. Готовые промты (сборники)

### Фаза 4 — Контент и SEO

1. Наполнение карточками через скрипт импорта (см. [07-03-prompt-import-pipeline.md](./07-03-prompt-import-pipeline.md))
2. SEO-тексты для кластеров
3. FAQ для каждого кластера
4. Перелинковка между разделами
5. Schema.org разметка (HowTo, FAQ)
6. Programmatic SEO генератор страниц для двух сайтов (RU/EN) на базе общей БД и общей taxonomy
7. Механизм `index/noindex` по качественным порогам (`min_cards_per_page`, уникальность контента)

### Фаза 5 — Масштабирование

1. Админка для добавления карточек (или через Supabase Dashboard)
2. Расширение taxonomies (`audience_tag`, `occasion_tag`, `style_tag`, `object_tag`, `doc_task_tag`) и словарей RU/EN
3. Автогенерация промптов через ИИ
4. Пользовательские рейтинги промптов
5. Интеграция с ботом (deep links)
