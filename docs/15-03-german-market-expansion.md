# Выход на немецкий рынок — promptshot.de

> Дата: 2026-03-15

## Контекст

promptshot.ru — каталог AI-промптов для фото на Next.js 15 + Supabase. Сейчас только русский язык в UI. В БД уже есть `title_ru`, `title_en`, `prompt_text_ru`, `prompt_text_en`. Тег-система поддерживает `labelRu` / `labelEn`. i18n-инфраструктуры в лендинге нет.

Немецкий рынок — 84M населения, высокая платёжеспособность, развитый спрос на AI-фото-промпты. Ключевые запросы: «KI Bilder Prompts», «Prompts für KI Bilder», «Foto-Prompts», «Gemini Bild-Prompts Deutsch», «Bewerbungsfoto KI», «Familienfotos mit KI».

## Архитектура

### Принцип: один код — два деплоя

```
promptshot.ru  (NEXT_PUBLIC_LOCALE=ru)  ──┐
                                          ├── Общая Supabase БД
promptshot.de  (NEXT_PUBLIC_LOCALE=de)  ──┘
```

- Один Next.js репозиторий, два Vercel-проекта (или два домена на одном проекте)
- Локаль определяется env-переменной `NEXT_PUBLIC_LOCALE`
- Общая БД: `prompt_cards`, `prompt_variants`, `tags`, `tag_registry`
- `hreflang` теги между .ru и .de для одинаковых карточек

### Почему отдельный домен .de

- Немцы не кликают на `.ru` — нулевое доверие
- Google.de ранжирует `.de` домены выше для локальных запросов
- `.ru` может быть заблокирован корпоративными фаерволами в DE
- Чистый branding для немецкого рынка

## Требования

### Фаза 1 — Инфраструктура локализации

#### 1.1 Env-переменная локали

- [ ] Добавить `NEXT_PUBLIC_LOCALE` (значения: `ru`, `de`)
- [ ] По умолчанию `ru` (обратная совместимость)
- [ ] Все компоненты читают локаль из env или утилиты `getLocale()`

#### 1.2 UI-тексты — словарь

- [ ] Создать `landing/src/lib/i18n.ts` со словарём:
  ```typescript
  const dictionaries = {
    ru: { ... },
    de: { ... },
  }
  export function t(key: string): string
  ```
- [ ] Перевести на DE все UI-строки (~50-70 ключей):
  - Меню и навигация (`menu.ts`)
  - Hero-секция на главной
  - Footer (навигация, копирайт)
  - Кнопки (копировать, избранное, поиск)
  - Поисковая страница
  - Заголовки секций на главной
  - Auth-страницы
  - 404 / ошибки

#### 1.3 Layout и meta

- [ ] `layout.tsx`: `<html lang={locale}>` вместо `lang="ru"`
- [ ] Дефолтные meta-теги на немецком для DE-версии
- [ ] OG-теги на немецком
- [ ] `robots.txt` и `sitemap.xml` генерировать с немецкими URL

### Фаза 2 — Тег-система на немецком

#### 2.1 Расширение TagEntry

Текущий тип `TagEntry` в `tag-registry.ts`:
```typescript
export type TagEntry = {
  slug: string;
  dimension: Dimension;
  labelRu: string;
  labelEn: string;
  urlPath: string;       // используется для RU-маршрутов
  patterns: RegExp[];
};
```

Добавить:
```typescript
export type TagEntry = {
  slug: string;
  dimension: Dimension;
  labelRu: string;
  labelEn: string;
  labelDe: string;       // NEW
  urlPath: string;        // RU route
  urlPathDe: string;      // NEW — DE route
  patterns: RegExp[];
};
```

- [ ] Добавить `labelDe` и `urlPathDe` в тип `TagEntry`
- [ ] Утилита `getLabel(tag, locale)` → возвращает `labelRu` / `labelDe` / `labelEn`
- [ ] Утилита `getUrlPath(tag, locale)` → возвращает `urlPath` / `urlPathDe`
- [ ] Индексы `byUrlPath`, `byLastSegment` строятся для текущей локали

#### 2.2 Перевод всех тегов (~120 шт.)

**audience_tag (24 тега):**

| slug | labelRu | labelDe | urlPathDe |
|------|---------|---------|-----------|
| devushka | Девушки | Frauen | /ki-prompts-frauen |
| muzhchina | Мужчины | Männer | /ki-prompts-maenner |
| para | Пары | Paare | /ki-prompts-paare |
| semya | Семья | Familie | /ki-prompts-familie |
| detskie | Дети | Kinder | /ki-prompts-kinder |
| s_mamoy | С мамой | Mit Mama | /ki-prompts-mit-mama |
| s_papoy | С папой | Mit Papa | /ki-prompts-mit-papa |
| s_parnem | С парнем | Mit Freund | /ki-prompts-mit-freund |
| s_muzhem | С мужем | Mit Ehemann | /ki-prompts-mit-ehemann |
| s_podrugoy | С подругой | Mit Freundin | /ki-prompts-mit-freundin |
| s_drugom | С другом | Mit Freund (m) | /ki-prompts-mit-kumpel |
| s_synom | С сыном | Mit Sohn | /ki-prompts-mit-sohn |
| s_dochkoy | С дочкой | Mit Tochter | /ki-prompts-mit-tochter |
| s_sestroy | С сестрой | Mit Schwester | /ki-prompts-mit-schwester |
| s_bratom | С братом | Mit Bruder | /ki-prompts-mit-bruder |
| s_babushkoy | С бабушкой | Mit Oma | /ki-prompts-mit-oma |
| malchik | Мальчик | Junge | /ki-prompts-junge |
| devochka | Девочка | Mädchen | /ki-prompts-maedchen |
| podrostok | Подросток | Teenager | /ki-prompts-teenager |
| malysh | Малыш | Baby | /ki-prompts-baby |
| pokoleniy | Поколения | Generationen | /ki-prompts-generationen |
| vlyublennykh | Влюблённые | Verliebte | /ki-prompts-verliebte |
| s_pitomcem | С питомцем | Mit Haustier | /ki-prompts-mit-haustier |
| beremennaya | Беременная | Schwanger | /ki-prompts-schwanger |

**style_tag (30 тегов):**

| slug | labelRu | labelDe | urlPathDe |
|------|---------|---------|-----------|
| cherno_beloe | Чёрно-белое | Schwarz-Weiß | /stil/schwarz-weiss |
| realistichnoe | Реалистичное | Realistisch | /stil/realistisch |
| portret | Портрет | Porträt | /stil/portraet |
| 3d | 3D | 3D | /stil/3d |
| gta | GTA | GTA | /stil/gta |
| studiynoe | Студийное | Studio | /stil/studio |
| love_is | Love Is | Love Is | /stil/love-is |
| delovoe | Деловое | Business | /stil/business |
| multyashnoe | Мультяшное | Cartoon | /stil/cartoon |
| kollazh | Коллаж | Collage | /stil/collage |
| otkrytka | Открытка | Postkarte | /stil/postkarte |
| sovetskoe | Советское | Sowjetisch | /stil/sowjetisch |
| retro | Ретро | Retro | /stil/retro |
| anime | Аниме | Anime | /stil/anime |
| polaroid | Полароид | Polaroid | /stil/polaroid |
| disney | Disney | Disney | /stil/disney |
| selfi | Селфи | Selfie | /stil/selfie |
| piksar | Pixar | Pixar | /stil/pixar |
| neonovoe | Неоновое | Neon | /stil/neon |
| street_style | Street Style | Street Style | /stil/street-style |
| fashion | Fashion | Fashion | /stil/fashion |
| glyanec | Глянец | Hochglanz | /stil/hochglanz |
| victorias_secret | Victoria's Secret | Victoria's Secret | /stil/victorias-secret |
| barbie | Barbie | Barbie | /stil/barbie |
| kinematograficheskoe | Кинематографическое | Cinematic | /stil/cinematic |
| y2k | Y2K | Y2K | /stil/y2k |
| lifestyle | Лайфстайл | Lifestyle | /stil/lifestyle |
| vintazhnoe | Винтажное | Vintage | /stil/vintage |
| romanticheskiy | Романтический | Romantisch | /stil/romantisch |
| bokho_stil | Бохо-стиль | Boho-Stil | /stil/boho |

**occasion_tag (9 тегов):**

| slug | labelRu | labelDe | urlPathDe |
|------|---------|---------|-----------|
| den_rozhdeniya | День рождения | Geburtstag | /anlass/geburtstag |
| 8_marta | 8 марта | Frauentag | /anlass/frauentag |
| 14_fevralya | 14 февраля | Valentinstag | /anlass/valentinstag |
| 23_fevralya | 23 февраля | — | — *(не релевантен для DE, скрыть)* |
| maslenica | Масленица | — | — *(не релевантен для DE, скрыть)* |
| novyy_god | Новый год | Neujahr | /anlass/neujahr |
| svadba | Свадьба | Hochzeit | /anlass/hochzeit |
| rozhdestvo | Рождество | Weihnachten | /anlass/weihnachten |
| halloween | Хэллоуин | Halloween | /anlass/halloween |

> **Важно:** Теги 23_fevralya и maslenica — чисто российские праздники. На DE-версии их нужно скрыть из меню и не генерировать для них SEO-страницы.

**object_tag (40+ тегов) — примеры ключевых:**

| slug | labelRu | labelDe | urlPathDe |
|------|---------|---------|-----------|
| s_mashinoy | С машиной | Mit Auto | /mit-auto |
| s_cvetami | С цветами | Mit Blumen | /mit-blumen |
| s_kotom | С котом | Mit Katze | /mit-katze |
| s_sobakoy | С собакой | Mit Hund | /mit-hund |
| na_more | На море | Am Meer | /am-meer |
| v_lesu | В лесу | Im Wald | /im-wald |
| zima | Зима | Winter | /winter |
| vesna | Весна | Frühling | /fruehling |
| na_chernom_fone | На чёрном фоне | Schwarzer Hintergrund | /schwarzer-hintergrund |
| v_polnyy_rost | В полный рост | Ganzkörper | /ganzkoerper |
| na_avatarku | На аватарку | Profilbild | /profilbild |
| v_kostyume | В костюме | Im Anzug | /im-anzug |
| na_ulice | На улице | Draußen | /draussen |
| v_gorah | В горах | In den Bergen | /in-den-bergen |
| v_gorode | В городе | In der Stadt | /in-der-stadt |

> Полный список всех ~40 object_tag переводов — заполнить при реализации. Паттерн: немецкие предлоги (mit, im, am, auf) + существительное.

**doc_task_tag (4 тега):**

| slug | labelRu | labelDe | urlPathDe |
|------|---------|---------|-----------|
| na_pasport | На паспорт | Passfoto | /passfoto |
| na_dokumenty | На документы | Dokumentenfoto | /dokumentenfoto |
| na_rezume | Для резюме | Bewerbungsfoto | /bewerbungsfoto |
| na_zagranpasport | На загранпаспорт | Reisepassfoto | /reisepassfoto |

#### 2.3 Меню и DIMENSION_LABELS на немецком

Текущее состояние `menu.ts`:
- `tagItem()` возвращает `entry.labelRu` — захардкожено
- `DIMENSION_LABELS` — только RU
- Заголовки групп ("Базовые", "Дети", "Отношения", "Ещё") — захардкожены

Нужно:
- [ ] `tagItem()` → использовать `getLabel(tag, locale)` и `getUrlPath(tag, locale)`
- [ ] `DIMENSION_LABELS` → перевести:

| RU | DE |
|----|----|
| Люди и отношения | Menschen & Beziehungen |
| Стили | Stile |
| События | Anlässe |
| Сцены и объекты | Szenen & Objekte |
| Задачи | Aufgaben |

- [ ] Заголовки групп:

| RU | DE |
|----|----|
| Базовые | Grundlagen |
| Дети | Kinder |
| Отношения | Beziehungen |
| Расширение | Weitere |
| Core | Kern |
| Visual | Visuell |
| Illustrative | Illustrativ |
| Праздники | Feiertage |
| Объекты | Objekte |
| Образ / поза | Look / Pose |
| Место / среда | Ort / Umgebung |
| Ещё | Mehr |

- [ ] Скрыть нерелевантные теги для DE (23_fevralya, maslenica, sovetskoe)

#### 2.4 Маршрутизация [...slug]

- [ ] `byUrlPath` индекс строится из `urlPath` (RU) или `urlPathDe` (DE) в зависимости от `NEXT_PUBLIC_LOCALE`
- [ ] `byLastSegment` — аналогично
- [ ] `findTagByUrlPath()` — работает с немецкими путями на DE
- [ ] `getAllTagPaths()` — возвращает немецкие пути для sitemap на DE

#### 2.3 SEO-обёртки на немецком

- [ ] Создать `seo-content-de.ts` (аналог `seo-content.ts`) с немецкими:
  - h1
  - metaTitle
  - metaDescription
  - FAQ (3-5 вопросов на немецком для каждой L1-категории)
  - howTo (если есть)
- [ ] `seo-templates-de.ts` — шаблоны для L2/L3 комбинаций
- [ ] Приоритет перевода L1-категорий (P0 первые):

| Приоритет | Категория | DE-запрос | Объём поиска |
|-----------|-----------|-----------|-------------|
| P0 | Бизнес-портрет | Bewerbungsfoto KI, LinkedIn-Foto AI | Высокий |
| P0 | Семейные фото | Familienfotos mit KI | Высокий |
| P0 | Пары | Paarfotos mit KI | Высокий |
| P1 | Рождество | Weihnachtsfotos KI-Prompts | Сезонный пик |
| P1 | Дети/бэби | Babyfotos mit KI | Средний |
| P1 | Свадьба | KI-Hochzeitsfotos | Средний |
| P2 | Питомцы | Hunde-Fotos KI | Нишевый |
| P2 | Хеллоуин | Halloween KI-Prompts | Сезонный |

### Фаза 3 — Контент карточек и перевод названий

#### 3.1 Миграция БД — колонка `title_de`

- [ ] Новая миграция: `ALTER TABLE prompt_cards ADD COLUMN title_de text;`
- [ ] Индекс для trigram: `CREATE INDEX idx_cards_title_de_trgm ON prompt_cards USING GIN(title_de gin_trgm_ops);`

#### 3.2 Батчевый перевод title_en → title_de

- [ ] Скрипт `scripts/fill-title-de.mjs`:
  - Читает все карточки с `title_en IS NOT NULL AND title_de IS NULL`
  - Батч по 20 через Gemini API: `"Translate these photo prompt titles to German. Keep them short, SEO-friendly. Context: AI photo generation prompts catalog."`
  - Записывает `title_de` обратно
- [ ] Проверка: не должно быть дословного перевода — нужны естественные немецкие формулировки
- [ ] Пример: "Romantic couple at sunset" → "Romantisches Paarfoto im Sonnenuntergang" (не "Romantisches Paar bei Sonnenuntergang")

#### 3.3 RPC: возврат title по локали

- [ ] Все RPC, возвращающие карточки, должны учитывать `p_site_lang`:
  - `p_site_lang = 'de'` → возвращать `title_de` (fallback `title_en`)
  - `p_site_lang = 'ru'` → возвращать `title_ru` (как сейчас)
- [ ] На фронте: компоненты карточек используют `title` из ответа (уже на нужном языке)

#### 3.4 Тексты промптов — НЕ переводить

- [ ] Промпт-тексты остаются на EN (`prompt_text_en`)
- [ ] Немцы вводят промпты в Gemini на английском — это стандартная практика
- [ ] DE-версия показывает `prompt_text_en` (не `prompt_text_ru`)
- [ ] Fallback: если нет `prompt_text_en`, не показывать карточку в DE-версии

#### 3.5 Немецкие описания карточек (опционально, P2)

- [ ] Добавить `description_de` — краткое описание промпта на немецком (1-2 предложения)
- [ ] Используется для SEO (meta description карточки) и превью
- [ ] Генерируется батчем через Gemini API из `title_de` + `prompt_text_en`

### Фаза 3.5 — Поиск для DE-версии

#### Проблема: текущий поиск работает только на русском

Текущая реализация (миграции 120, 121):

```sql
-- FTS-вектор (миграция 121): только russian
setweight(to_tsvector('russian', coalesce(v_title_ru, '')), 'A') ||
setweight(to_tsvector('russian', coalesce(v_prompts, '')), 'B')

-- RPC search_cards_text: только russian tsquery
v_tsquery := plainto_tsquery('russian', p_query);

-- Trigram fallback: только title_ru
similarity(c.title_ru, p_query) > 0.15
```

На DE-версии немец вводит "Familienfotos" → `plainto_tsquery('russian', 'Familienfotos')` → пустой результат.

#### 3.5.1 Новая колонка `fts_de`

- [ ] Миграция: `ALTER TABLE prompt_cards ADD COLUMN fts_de tsvector;`
- [ ] GIN-индекс: `CREATE INDEX idx_cards_fts_de ON prompt_cards USING GIN(fts_de);`
- [ ] Функция `rebuild_card_fts_de(p_card_id)`:
  ```sql
  UPDATE prompt_cards
     SET fts_de =
       setweight(to_tsvector('german', coalesce(v_title_de, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(v_prompts_en, '')), 'B')
   WHERE id = p_card_id;
  ```
  - **A-weight**: `title_de` через `'german'` конфигурацию (стемминг немецких слов)
  - **B-weight**: `prompt_text_en` через `'english'` конфигурацию
- [ ] Триггеры на `UPDATE OF title_de` и на изменение `prompt_text_en` в `prompt_variants`

#### 3.5.2 Новая RPC `search_cards_text_de`

- [ ] Создать RPC аналогичную `search_cards_text`, но:
  ```sql
  -- FTS: german конфигурация + fts_de колонка
  v_tsquery := plainto_tsquery('german', p_query);
  WHERE c.fts_de @@ v_tsquery

  -- Trigram fallback: по title_de
  similarity(c.title_de, p_query) > 0.15
  ```
- [ ] Фильтр: `c.title_de IS NOT NULL` (не показывать непереведённые карточки)

> **Альтернатива (DRY):** Единая RPC `search_cards_text_v2(p_query, p_lang)` которая выбирает колонку/конфигурацию по `p_lang`. Но две отдельные RPC проще и надёжнее на старте.

#### 3.5.3 Фронт: роутинг поиска по локали

- [ ] `searchCardsByText()` в `supabase.ts` → вызывать `search_cards_text` (RU) или `search_cards_text_de` (DE) в зависимости от `NEXT_PUBLIC_LOCALE`
- [ ] API route `/api/search` → передавать локаль
- [ ] Плейсхолдер поисковой строки: "Поиск промптов..." → "KI-Foto-Prompts suchen..."

#### 3.5.4 Postgres: конфигурация `german`

- [ ] Убедиться что `german` text search configuration доступна в Supabase (она есть по умолчанию в PostgreSQL)
- [ ] Проверить стемминг: `SELECT to_tsvector('german', 'Familienfotos Weihnachten Porträtfotografie');` — должен правильно стемить составные слова

### Фаза 4 — hreflang и кросс-линковка

- [ ] На каждой странице .ru добавить `<link rel="alternate" hreflang="de" href="https://promptshot.de/...">`
- [ ] На каждой странице .de добавить `<link rel="alternate" hreflang="ru" href="https://promptshot.ru/...">`
- [ ] Маппинг URL через тег ID (один тег = два слага в разных локалях)
- [ ] Для карточек: маппинг через `prompt_card.id`

### Фаза 5 — Деплой

- [ ] Купить домен `promptshot.de` (или `foto-prompts.de` / `ki-foto-prompts.de`)
- [ ] Vercel: добавить второй домен или второй проект с `NEXT_PUBLIC_LOCALE=de`
- [ ] DNS, SSL
- [ ] Google Search Console — добавить .de property
- [ ] Подать sitemap.xml для .de

## Что НЕ делать

- **Не переводить промпт-тексты на немецкий** — промпты работают на EN, немцы это знают
- **Не делать /de/ субдиректорию на .ru домене** — убьёт CTR в German SERP
- **Не запускать все языки сразу** — один рынок качественно, потом масштабировать
- **Не копировать русские слаги транслитом** — `/promty-dlya-foto/` не ранжируется в DE
- **Не использовать next-intl / react-i18next** — overkill для двух деплоев с env; простой словарь достаточен

## Целевые немецкие поисковые запросы

### Основные (бренд + категория)

| Запрос | Тип | Приоритет |
|--------|-----|-----------|
| KI Bilder Prompts | Общий | P0 |
| Prompts für KI Bilder | Общий | P0 |
| Foto-Prompts | Общий | P0 |
| Gemini Bild-Prompts Deutsch | Инструмент | P0 |
| AI Bilder erstellen | Общий | P0 |
| KI Fotos erstellen | Общий | P1 |

### По категориям

| Запрос | Категория | Приоритет |
|--------|-----------|-----------|
| Bewerbungsfoto KI | Бизнес-портрет | P0 |
| LinkedIn-Foto AI erstellen | Бизнес-портрет | P0 |
| Familienfotos mit KI | Семья | P0 |
| Paarfotos mit KI | Пары | P0 |
| Weihnachtsfotos KI-Prompts | Рождество | P1 |
| Babyfotos mit KI | Дети | P1 |
| KI-Hochzeitsfotos | Свадьба | P1 |
| Hunde-Fotos KI | Питомцы | P2 |
| Halloween KI-Prompts | Хеллоуин | P2 |
| Porträtfotografie KI | Портреты | P1 |
| Retro-Fotos KI | Стиль | P2 |
| Double-Exposure-Effekt KI | Стиль | P2 |

## Метрики успеха

| Метрика | Цель (3 мес.) | Цель (6 мес.) |
|---------|--------------|--------------|
| Страниц в индексе Google.de | 50+ | 200+ |
| Органический трафик DE | 500 vis/мес | 5 000 vis/мес |
| Позиции по P0-запросам | Топ-30 | Топ-10 |
| CTR из German SERP | > 3% | > 5% |

## Оценка трудозатрат

| Задача | Объём | Оценка |
|--------|-------|--------|
| Инфраструктура локали (env, getLocale, layout) | Код | 2-3 ч |
| Словарь i18n + перевод UI | ~70 ключей | 3-4 ч |
| TagEntry расширение (labelDe, urlPathDe) + перевод 120 тегов | tag-registry.ts | 5-6 ч |
| menu.ts → locale-aware (tagItem, DIMENSION_LABELS, группы) | Код | 2-3 ч |
| Маршрутизация [...slug] для DE-путей | Код | 2-3 ч |
| SEO-обёртки DE (L1, 15 категорий) | h1 + meta + FAQ | 6-8 ч |
| SEO-шаблоны DE (L2/L3) | Шаблоны | 2-3 ч |
| Миграция title_de + батч-перевод скрипт | БД + скрипт | 3-4 ч |
| FTS для DE (fts_de колонка, RPC, триггеры) | SQL миграция | 3-4 ч |
| Фронт поиска → locale-aware | Код | 1-2 ч |
| hreflang + кросс-линковка | Код | 2-3 ч |
| Деплой .de | Infra | 1-2 ч |
| **Итого** | | **~35-40 часов** |

## Следующие рынки (после DE)

| Приоритет | Язык | Домен | Нас. | Обоснование |
|-----------|------|-------|------|-------------|
| 1 | Французский | promptshot.fr | 68M | 2-й по размеру платёжеспособный EU-рынок |
| 2 | Испанский | promptshot.es | 48M + LatAm | Огромный совокупный рынок с Латинской Америкой |
| 3 | Португальский | promptshot.pt | 10M + BR | Бразилия = 200M+ к португальскому рынку |
| 4 | Итальянский | promptshot.it | 59M | Крупный EU-рынок |
