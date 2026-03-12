# ТЗ: Извлечение хештегов из текста промтов

**Дата:** 10.03.2026  
**Проект:** aiphoto  
**Статус:** draft / implementation-ready  
**Связанные документы:**  
- `10-03-telegram-prompt-collector-tz-v2.md`  
- `10-03-parser-db-requirements.md`
- `07-03-prompt-landing-plan.md`
- `11-03-seo-card-retrieval-requirements.md`

---

## Контракт синхронизации документов

Этот документ задает таксономию content-тегов (`seo_tags`) и правила маппинга текста промта в 5 SEO-измерений (72 значения).  
`intent_action` — не является измерением карточки и покрывается canonical scenario hubs.  
`intent_modifier` и `tool_tag` — не записываются в `seo_tags`; tool-запросы живут в отдельном secondary SEO-слое (`/instrumenty/[tool]/`).  
Рабочий mapping URL → Wordstat: `docs/11-03-seo-url-query-mapping-clean.csv`.  
Canonical mapping URL → Wordstat: `docs/11-03-seo-url-query-mapping-canonical.csv`.  
Карта меню и уникальных URL: `docs/11-03-seo-menu-map.csv`.  
При изменении словаря/измерений нужно обязательно проверять:

1. `07-03-prompt-landing-plan.md`
   - что SEO-роуты используют те же измерения и slug-имена;
   - что дерево страниц не использует удаленные/переименованные теги.
2. `11-03-seo-card-retrieval-requirements.md`
   - что `route_key` и формула релевантности используют актуальные измерения;
   - что min-card логика не конфликтует с минимальным набором тегов.
3. `10-03-parser-db-requirements.md`
   - что в БД есть поля для новых измерений;
   - что parser/ingest контракт не ломается из-за новых обязательных значений.

Чеклист при ревью:

- [ ] набор SEO-измерений одинаков в тегировании, retrieval и SEO-структуре;
- [ ] slug-и каноничны и совпадают между документами;
- [ ] для нового измерения определены правила index/noindex и route-использование.

---

## 1. Цель

Сформировать унифицированные `hashtags[]` для карточки только на основе текста промтов.

Правило проекта: Telegram-хештеги (`ShowHashtag`) не используются как источник разметки и не попадают в финальный `hashtags[]`.

Дополнительная цель (SEO): извлекать content-теги карточки (`audience_tag`, `style_tag`, `occasion_tag`, `object_tag`, `doc_task_tag`) на базе реального Wordstat-корпуса (`docs/wordstat/*.csv`), чтобы из 1000 карточек строить programmatic SEO-страницы для двух сайтов (RU/EN) с общей БД.

---

## 2. Scope

### Входит
- Rule-based извлечение `hashtags[]` из `prompt_text_ru` / `prompt_text_en` / `title_ru`.
- Маппинг найденных тегов в SEO-измерения: `audience_tag`, `style_tag`, `occasion_tag`, `object_tag`, `doc_task_tag`.
- Запись в `prompt_cards.seo_tags jsonb`.
- Формирование `ru_label` / `en_label` и slug-значений из единой таксономии (два сайта, одна БД).

### Не входит
- LLM-классификация стиля.
- Дедуп хештегов между карточками.
- Автоматический перевод словаря на другие языки.

---

## 3. Input / Output

## Input
- `prompt_variants.prompt_text_ru`
- `prompt_variants.prompt_text_en`
- `prompt_cards.title_ru` (дополнительный сигнал)

## Output
- `prompt_cards.hashtags text[]` в нормализованном формате:
  - lowercase, без `#`, `snake_case`.
  - содержит ТОЛЬКО теги, найденные в тексте промта.
- `prompt_cards.seo_tags jsonb` со структурой:
  - `audience_tag[]`
  - `occasion_tag[]`
  - `style_tag[]`
  - `object_tag[]`
  - `doc_task_tag[]`
  - `labels.ru[]`
  - `labels.en[]`

### Что убрано из seo_tags

| Убранное измерение | Причина | Где покрывается |
|--------------------|---------|-----------------|
| `intent_action` | Нет в промтах, все промты = "создание" | Canonical scenario hubs (`/promty-dlya-sozdaniya-foto/`, `/promty-dlya-obrabotki-foto/` и т.д.) |
| `intent_modifier` | Нет в промтах (besplatno, onlayn) | Не участвует в card-tagging и не записывается в `seo_tags` |
| `tool_tag` | Нет в промтах (nano_banana, chatgpt) | Не участвует в card-tagging; generic tool queries живут в `/instrumenty/[tool]/` |

### Пример

Промт: `Студийный портрет пары ... мягкий свет ... черный фон`

- `hashtags`: `["parnyy", "studiynyy", "myagkiy_svet", "portret"]`
- `seo_tags`:
  - `audience_tag`: `["para"]`
  - `style_tag`: `["studiynoe", "portret"]`
  - `occasion_tag`: `[]`
  - `object_tag`: `["na_chernom_fone"]`
  - `doc_task_tag`: `[]`
  - `labels.ru`: `["промт для студийного фото пары"]`
  - `labels.en`: `["studio couple photo prompt"]`

Промт: `Пожилая женщина с внучкой ... зимний лес ... мягкое освещение`

- `hashtags`: `["pokoleniy", "s_babushkoy", "zimniy", "v_lesu"]`
- `seo_tags`:
  - `audience_tag`: `["s_babushkoy", "devochka"]`
  - `style_tag`: `[]`
  - `occasion_tag`: `[]`
  - `object_tag`: `["zima", "v_lesu"]`
  - `doc_task_tag`: `[]`
  - `labels.ru`: `["промт для фото с бабушкой в зимнем лесу"]`
  - `labels.en`: `["grandmother winter forest photo prompt"]`

---

## 4. Пайплайн извлечения

1. **Keyword matching**
   - Прогоняем `prompt_text_ru/en` и `title_ru` по словарю правил → `hashtags[]`.
2. **SEO dimensions mapping**
   - Маппим найденные теги в 5 измерений: `audience_tag`, `style_tag`, `occasion_tag`, `object_tag`, `doc_task_tag`.
3. **Normalization**
   - translit + lowercase + spaces→`_`.
4. **Deduplicate in-card**
   - Удаляем повторы в рамках одной карточки.
5. **Rank + trim**
   - Ограничиваем до `max 12` хештегов на карточку.
6. **RU/EN labels generation**
   - Генерируем человекочитаемые SEO-лейблы для RU и EN сайтов на базе единого словаря таксономии (без runtime-перевода).

---

## 4.2 SEO-измерения карточки (content-only)

`SEO dimensions` — каноничные поля, по которым карточка матчится в programmatic SEO-страницы.

Все измерения извлекаются **только из текста промта** (content tags).

### Формат (общий для всех измерений)
- Тип: `text[]` (массив slug-значений).
- Значения: `snake_case`, lowercase, только каноничные элементы словаря.
- Внутри измерения дубли запрещены.
- Неизвестные/сырые значения не пишем в `seo_tags` (только в debug).

### Измерения (расширенная таксономия v2, 72 значения)

| Измерение | Кол-во | Описание | Примеры |
|-----------|--------|---------|---------|
| `audience_tag` | 22 | Аудитория + отношения | `devushka`, `para`, `semya`, `s_mamoy`, `s_parnem`, `pokoleniy` |
| `style_tag` | 18 | Визуальный стиль | `cherno_beloe`, `realistichnoe`, `portret`, `3d`, `gta`, `otkrytka` |
| `occasion_tag` | 7 | Событие/повод | `den_rozhdeniya`, `23_fevralya`, `14_fevralya`, `maslenica` |
| `object_tag` | 21 | Объект + сцена + контекст | `v_forme`, `s_mashinoy`, `s_cvetami`, `v_profil`, `zima`, `na_more` |
| `doc_task_tag` | 5 | Документные задачи | `na_pasport`, `na_dokumenty`, `na_avatarku` |

Полный перечень значений с объёмами Wordstat — см. `07-03-prompt-landing-plan.md` (блок «SEO-атрибуты карточки»).

### Что НЕ является измерением карточки

| Кластер | Почему убран | Покрытие |
|---------|-------------|----------|
| `intent_action` (sozdanie, obrabotka, uluchshenie, restavratsiya) | Нет в промтах — это интент страницы, а не content-сигнал карточки | Canonical scenario hubs |
| `intent_modifier` (besplatno, onlayn) | Нет в промтах — свойство сервиса, не контента | Не пишется в `seo_tags` |
| `tool_tag` (nano_banana, chatgpt, gemini) | Нет в промтах — свойство инструмента, а не content-сигнал | Не пишется в `seo_tags`; покрывается tool hubs |

### Минимальный набор для попадания в programmatic SEO
- Минимум 1 значение из любого измерения (`audience_tag | style_tag | occasion_tag | object_tag | doc_task_tag`).
- Плюс `labels.ru` и `labels.en` для главной комбинации.
- Карточки без content-тегов попадают только на scenario hubs / broad editorial pages (показываются как «все промты»).

### Приоритет при конфликте
1. `audience_tag`, `occasion_tag`, `doc_task_tag` — основа programmatic SEO.
2. `style_tag`, `object_tag` — уточняющий long-tail.

Если сигнал попадает сразу в несколько измерений, сохраняем в каждом релевантном.

---

## 5. Словарь MVP (пример стартового набора)

## 5.1 Аудитория
- `парный|пара|вдвоем` -> `parnyy`
- `женщина|девушка|женский` -> `zhenskiy`
- `мужчина|парень|мужской` -> `muzhskoy`
- `семья|семейный` -> `semeynyy`

## 5.2 Сцена/формат
- `портрет` -> `portret`
- `студийн` -> `studiynyy`
- `фотобудк|polaroid` -> `fotobudka`
- `коллаж` -> `kollazh`

## 5.3 Свет/цвет
- `мягкий свет|soft light` -> `myagkiy_svet`
- `драматич` -> `dramatic_light`
- `черно-бел|чёрно-бел` -> `black_white`

## 5.4 Контекст события
- `свадьб` -> `svadba`
- `день рожден` -> `den_rozhdeniya`
- `8 март` -> `vosmoe_marta`
- `14 февр|валентин` -> `valentines_day`

## 5.5 Аудитория / Отношения (audience_tag) — 22 значения
- `девушки|женские|женщин` -> `devushka`
- `мужчины|мужские|мужчин` -> `muzhchina`
- `пар|пары|парное|вдвоем` -> `para`
- `семейн|семь` -> `semya`
- `детск|ребен` -> `detskie`
- `с мамой|мам` -> `s_mamoy`
- `с папой|пап` -> `s_papoy`
- `с парнем` -> `s_parnem`
- `с мужем` -> `s_muzhem`
- `с подругой` -> `s_podrugoy`
- `с другом` -> `s_drugom`
- `с сыном` -> `s_synom`
- `с дочкой|с дочерью` -> `s_dochkoy`
- `с сестрой` -> `s_sestroy`
- `с братом` -> `s_bratom`
- `с бабушкой` -> `s_babushkoy`
- `мальчик` -> `malchik`
- `девочка` -> `devochka`
- `подросток` -> `podrostok`
- `малыш|младенец` -> `malysh`
- `поколений|поколения` -> `pokoleniy`
- `влюблён|влюблен` -> `vlyublennykh`
- `с питомц|с животн` -> `s_pitomcem`

## 5.6 Событие / Повод (occasion_tag) — 7 значений
- `день рождения|на др\b` -> `den_rozhdeniya`
- `8 марта` -> `8_marta`
- `14 февраля|день влюбленных|валентин` -> `14_fevralya`
- `23 февраля` -> `23_fevralya`
- `маслениц` -> `maslenica`
- `новый год|новогодн` -> `novyy_god`
- `свадьб` -> `svadba`

## 5.7-ext Стиль (style_tag) — 18 значений
- `черно-бел|чёрно-бел|монохром` -> `cherno_beloe`
- `реалист` -> `realistichnoe`
- `портрет` -> `portret`
- `3д|3d` -> `3d`
- `гта|gta` -> `gta`
- `студийн|studio` -> `studiynoe`
- `love is|лав ис` -> `love_is`
- `делов|бизнес` -> `delovoe`
- `мультяш|мультик` -> `multyashnoe`
- `коллаж` -> `kollazh`
- `открытк` -> `otkrytka`
- `совет` -> `sovetskoe`
- `ретро` -> `retro`
- `аниме` -> `anime`
- `полароид|polaroid` -> `polaroid`
- `дисней|disney` -> `disney`
- `селфи|selfie` -> `selfi`
- `пиксар|pixar` -> `piksar`

## 5.8-ext Объект / Сцена (object_tag) — 20 значений
- `в форм|военн|солдат` -> `v_forme`
- `с машин|авто|тачк` -> `s_mashinoy`
- `с цвет|букет|тюльпан|роз\b|пион|мимоз` -> `s_cvetami`
- `со знаменит|с кумир|со звезд` -> `so_znamenitostyu`
- `в профиль|боком` -> `v_profil`
- `с кот|кош` -> `s_kotom`
- `в костюм|в пиджак` -> `v_kostyume`
- `на черн\w* фон` -> `na_chernom_fone`
- `с торт` -> `s_tortom`
- `зимн|снег|заснеж` -> `zima`
- `в зеркал` -> `v_zerkale`
- `весенн|весна` -> `vesna`
- `с собак|пёс|пес\b` -> `s_sobakoy`
- `в лес` -> `v_lesu`
- `с корон` -> `s_koronoy`
- `на мор|пляж` -> `na_more`
- `в полный рост` -> `v_polnyy_rost`
- `в гор` -> `v_gorah`
- `на улиц` -> `na_ulice`

## 5.9-ext Документные задачи (doc_task_tag) — 5 значений
- `на паспорт` -> `na_pasport`
- `на документ` -> `na_dokumenty`
- `на аватарк|на аву|аватар` -> `na_avatarku`
- `на резюме|для резюме` -> `na_rezume`
- `на загранпаспорт` -> `na_zagranpasport`

---

## 5.7 RU/EN словарь для SEO-лейблов

Для каждой комбинации content-тегов хранится двуязычный словарь:

- `para + studiynoe`
  - `label_ru`: `промт для студийного фото пары`
  - `label_en`: `studio couple photo prompt`
- `devushka + s_cvetami`
  - `label_ru`: `промт для фото девушки с цветами`
  - `label_en`: `photo prompt for woman with flowers`
- `na_pasport`
  - `label_ru`: `промт для фото на паспорт`
  - `label_en`: `passport photo prompt`

Это исключает ситуацию, когда RU/EN страницы строятся из машинного перевода без контроля смысла.

---

## 5.8 Расширение словаря по реальным промтам из БД (`prompt_variants`)

Источник: фактическая выгрузка `prompt_text_ru` из БД (текущий срез: `N=28` промтов).

Наблюдения по частотности в текущем срезе:
- часто встречаются: `cinematic`, `black_white`, `fashion/editorial`, `studio`;
- средне: `neon`, `yacht/sea/beach`, `winter/christmas`;
- редкие, но валидные: `animal portrait`, `bratz`, `macro underwater`.

### Добавить в `style_tag`
- `cinematic_portrait`  
  Паттерны: `cinematic|кинематограф`
- `editorial_fashion`  
  Паттерны: `fashion|editorial|vogue|harper`
- `studiynoe_fashion`  
  Паттерны: `studio|студийн|студийный`
- `cherno_beloe_editorial`  
  Паттерны: `черно-бел|чёрно-бел|black and white|monochrome`
- `neon_fashion`  
  Паттерны: `неон|neon|ультрамарин|indigo`
- `backstage_glamour`  
  Паттерны: `backstage|victoria's secret|гримерн`
- `macro_underwater`  
  Паттерны: `macro|макро|под водой|underwater|каустические`
- `winter_editorial`  
  Паттерны: `зимн|снег|новогод|рождествен`
- `russian_folk_editorial`  
  Паттерны: `кокошник|самовар|русск`
- `lifestyle_yacht`  
  Паттерны: `яхт|палуб|море|горизонт`
- `beach_contrast`  
  Паттерны: `пляж|черный песок|black sand`
- `bratz_doll_style`  
  Паттерны: `bratz`
- `animal_lowkey_portrait`  
  Паттерны: `animal|животн|low key`

### Добавить в `object_tag`
- `krylya` (`крылья|wings`)
- `kokoshnik` (`кокошник`)
- `samovar` (`самовар`)
- `bokal_shampanskogo` (`бокал|шампанск`)
- `chernyy_pesok` (`черный песок|black sand`)
- `brelok_figurka` (`брелок|фигурк`)

### Добавить в `occasion_tag`
- `rozhdestvo` (`рождеств`)
- `novyy_god` (`новогод`)

### Добавить в `audience_tag`
- `zhivotnye` (`animal|животн`) — для отдельного ветвления карточек с питомцами/животными.

### Правило применения новых тегов
1. Тег добавляется в production-словарь после `min_hits >= 2` в базе **или** при наличии явного бизнес-кейса (ручной whitelist).
2. Теги с `hits = 1` помечаются как `candidate` и используются только в debug/аналитике до накопления выборки.
3. Для тегов fashion/beauty оставить denylist (не индексировать adult/explicit вариации как SEO-страницы).

---

## 6. Приоритет источников

Единый источник тегирования:
1. признаки из промта,
2. признаки из заголовка (fallback, если в промте сигнала недостаточно).

`ShowHashtag(...)` игнорируется на этапе формирования `hashtags` и `seo_tags`.

Для `seo_tags` приоритет:
1. основные признаки (`audience_tag`, `occasion_tag`, `doc_task_tag`);
2. уточняющие признаки (`style_tag`, `object_tag`).

---

## 7. Правила качества

- Минимум 1 хештег для опубликованной карточки.
- Если ничего не найдено, ставим fallback: `["ai_prompt"]`.
- Запрещены слишком общие теги:
  - `photo`, `image`, `best_quality`, `8k`.
- Для programmatic SEO-страниц карточка считается "готовой", если заполнен минимум:
  - 1 тег из (`audience_tag`, `style_tag`, `occasion_tag`, `object_tag`, `doc_task_tag`),
  - `ru_label` и `en_label` для главной комбинации.
- Карточки без content-тегов попадают только на статические хаб-страницы (все промты).
- На этапе quality-check фиксируем `seo_readiness_score` (0..100), чтобы отфильтровать слабые карточки из индексации.

---

## 8. Изменения в БД

Используется текущее поле:
- `prompt_cards.hashtags text[] not null default '{}'`

Нужно добавить (phase 1.5/2):
- `prompt_cards.seo_tags jsonb not null default '{}'::jsonb`
- `prompt_cards.seo_readiness_score int not null default 0`

Опционально (phase 2) добавить debug таблицу:
- `prompt_card_hashtag_debug`
  - `card_id`
  - `tag`
  - `source` (`prompt_rule|title_rule`)
  - `matched_pattern`
  - `dimension` (`hashtag|audience_tag|occasion_tag|style_tag|object_tag|doc_task_tag`)

Опционально (phase 2) добавить таблицы для auto-suggest словаря:
- `prompt_tag_candidates`
  - `id`
  - `normalized_term` (каноничная форма кандидата)
  - `dimension_guess` (`audience_tag|occasion_tag|style_tag|object_tag|doc_task_tag|unknown`)
  - `hits_total`
  - `unique_cards`
  - `unique_channels`
  - `first_seen_at`
  - `last_seen_at`
  - `status` (`new|suggested|approved|rejected|promoted`)
  - `review_note`
- `prompt_tag_candidate_examples`
  - `candidate_id`
  - `card_id`
  - `source_channel`
  - `context_fragment`
  - `created_at`

---

## 9. Acceptance criteria

1. Для всех карточек теги формируются из текста промта (и заголовка как fallback), независимо от `ShowHashtag`.
2. На тестовой выборке не менее 90% карточек имеют осмысленные теги.
3. Нормализация единообразна (lowercase + snake_case).
4. В рамках карточки нет дублей хештегов.
5. Не менее 80% карточек имеют валидный `seo_tags` (минимальные измерения для генерации страниц).
6. Для ключевых Wordstat-комбинаций (`action+modifier/tool/audience`) есть корректные RU+EN labels без машинного мусора.
7. Карточки с `seo_readiness_score < threshold` не попадают в индексируемые programmatic страницы.

---

## 10. Непрерывное расширение словаря (auto-suggest)

Цель: словарь должен обновляться по новым формулировкам из каналов без ручного полного аудита.

### 10.1 Контур 1 — во время парсинга (online)

На этапе парсинга для каждого токена/фразы:
1. Пытаемся замаппить в текущий словарь.
2. Если маппинг не найден — пишем в `prompt_tag_candidates`:
   - `normalized_term`,
   - `dimension_guess`,
   - счетчики `hits_total/unique_cards/unique_channels`,
   - примеры контекста в `prompt_tag_candidate_examples`.
3. Явный мусор (stopwords, техмусор, URL, emoji-only) отбрасываем до записи.

### 10.2 Контур 2 — после парсинга (batch, daily/weekly)

Отдельный job пересчитывает кандидатов и выставляет `status=suggested`, если выполнены пороги:
- `hits_total >= 5`
- `unique_cards >= 3`
- `unique_channels >= 2`
- term не в denylist (`nsfw/adult`, системный шум).

### 10.3 Правила ревью и промоушена

Ревьюер видит:
- кандидат,
- предполагаемое измерение,
- 3-5 примеров контекста,
- статистику (`hits_total`, каналы, динамика).

Решения:
- `approved` -> добавить в production-словарь и сделать `promoted`;
- `rejected` -> сохранить причину в `review_note`, повторно не предлагать без роста сигнала (например x2 по `hits_total`).

### 10.4 Безопасные ограничения

- Новые теги не должны сразу влиять на indexable SEO-страницы без `approved`.
- Кандидаты со спорной лексикой (`18+`, explicit) не попадают в SEO-словари.
- Все auto-suggest действия должны быть idempotent (повторный запуск не дублирует записи).
