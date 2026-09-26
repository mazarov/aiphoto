# Subject audience карточек по фото (vision), а не по тексту

> Ветка реализации: `feature/26-09-card-subject-audience-vision` (от `origin/main`).
> Исполнитель плана: агент на модели Grok 4.7. Разделы 1–3 — контекст и решение, раздел 4 — пошаговый план с критериями приёмки.

## 0. Симптом

`/promty-dlya-foto/delovoe?audience=muzhchina` (hero-gap hub `delovoe`, чип `Мужчина` → `resolve_route_cards(p_style_tag='delovoe', p_audience_tag='muzhchina')`) показывает женщин и пары.

Замер 26.09 (prod БД, 52 карточки tier A этой выдачи):

| В тексте промта | Карточек |
|---|---|
| есть и женские, и мужские маркеры (пары / «человек в костюме» + «её») | 37 |
| только женские маркеры | 9 |
| только мужские | 6 |

Случайная выборка 60 карточек с тегом `muzhchina` по всему каталогу (1961 шт.), проверка Gemini 2.5 Flash по фото:

| Vision говорит | Карточек |
|---|---|
| muzhchina (соло мужчина) | 25 |
| para | 23 |
| semya | 5 |
| devushka | 4 |
| none (группа / нет человека) | 2 |
| malchik | 1 |

**Precision тега `muzhchina` как «на фото один мужчина» ≈ 0.42.**

## 1. Текущая реализация разметки (как есть)

```
prompt_variants.prompt_text_ru + prompt_cards.title_ru
        │
        ▼  текст → LLM (gpt-4.1-mini, OPENAI_BASE_URL) или regex TAG_REGISTRY.patterns
src/fill-seo-tags.ts (batch)  /  landing/src/lib/seo-tags-classify.ts (publish)
        │
        ▼
prompt_cards.seo_tags.audience_tag: string[]   ← массив, без приоритета, без источника
        │
        ▼
resolve_route_cards(): (seo_tags->'audience_tag') @> '["muzhchina"]'   ← containment
```

SSOT слагов и URL — `landing/src/lib/tag-registry.ts` (`audience_tag`: 24 слага, вперемешку: пол/состав кадра `devushka|muzhchina|para|semya|malchik|devochka|malysh` и отношения/контекст `s_mamoy|s_dochkoy|vlyublennykh|beremennaya|…`).

### Три дефекта, каждый — свой класс

**D1. Семантика тега не задана.** `muzhchina` сегодня означает «в промте упомянут мужчина», а страница «промты для фото мужчины» ожидает «на фото один мужчина». Пара получает `[devushka, muzhchina, para]` и попадает во все три листинга. Это 29 из 35 ошибок в выборке (83%). Классификатор тут не виноват — нет правила эксклюзивности.

**D2. Текст структурно слеп к полу для 42% каталога.** 6384 опубликованных карточек с `title_ru LIKE 'Visual Hook%'` (`web_generation_ugc`, `admin_analyze_ugc`) созданы analyze-пайплайном, где промт **намеренно** гендерно-нейтральный: `extension-prompt-sections.ts` — «Use "the subject" or "a person"; do not describe identity…». Текстовый LLM додумывает пол по одежде: «человек в костюме / деловой / пиджак» → `muzhchina`. На фото — женщина (проверено глазами на 4 карточках из выдачи `delovoe`). 2379 таких карточек вообще без `audience_tag`.

**D3. Один писатель — три точки входа, ноль контроля.** `fill-seo-tags.ts`, `seo-tags-classify.ts` (publish, `prompt-card-publication.ts`) и ручные скрипты пишут `seo_tags` целиком, без `source`/`confidence`/`classified_at`. Повторный publish перетирает всё, что было исправлено. Нет метрики качества тега — регрессию не видно.

### Почему это не «поправить промт классификатора»

Пол и состав кадра — **визуальное** свойство карточки. Текст для UGC-карточек его не содержит по дизайну, и менять analyze-промт (вернуть пол в текст) нельзя: нейтральный «subject» нужен, чтобы пользователь подставлял себя. Значит источник истины для `devushka|muzhchina|para|semya|malchik|devochka|malysh` — фото, а не текст.

## 2. Целевая архитектура

### 2.0 Зафиксированное решение (26.09, владелец продукта)

`devushka | muzhchina | para | semya | malchik | devochka | malysh` — **строго взаимоисключающие**. Мужчина в паре или в семье в листинг «промты для фото мужчины» **не попадает** ни с каким приоритетом; карточка живёт только в `para` / `semya`. Следствие: `resolve_route_cards` не меняется, ранжирование по «частичному совпадению» не вводится.

### 2.1 Разделить `audience_tag` на два слоя

| Слой | Значения | Источник | Кардинальность |
|---|---|---|---|
| **subject** (кто в кадре) | `devushka \| muzhchina \| para \| semya \| malchik \| devochka \| malysh \| none` | Gemini 2.5 Flash vision по каноническому фото (уже есть: `compose-example-audience-gemini.ts`, тот же enum и промт) | ровно один |
| **relation / context** | `s_mamoy, s_papoy, s_parnem, s_muzhem, s_podrugoy, s_drugom, s_synom, s_dochkoy, s_sestroy, s_bratom, s_babushkoy, podrostok, pokoleniy, vlyublennykh, s_pitomcem, beremennaya, detskie` | текст (как сейчас) | много |

`seo_tags.audience_tag` остаётся **проекцией** для листинга: `(text_tags − EXCLUSIVE_SET) ∪ [subject]`, где `EXCLUSIVE_SET` = 7 subject-слагов. `resolve_route_cards`, `get_filter_counts`, `get_homepage_sections`, sitemap, `/api/search` фильтры — **не меняются**. Blast radius = одна таблица и один триггер.

### 2.2 Хранение (SSOT в БД)

Новые колонки `prompt_cards`:

```
subject_audience        text   CHECK IN (7 slugs, 'none')   NULL = не классифицировано
subject_confidence      real
subject_people_count    smallint
subject_source          text   CHECK IN ('vision','manual')
subject_media_id        uuid   -- какое фото классифицировали (каноническое: is_primary DESC, media_index ASC)
subject_classified_at   timestamptz
subject_attempts        smallint DEFAULT 0
subject_last_error      text
subject_prev_audience   jsonb  -- снимок seo_tags.audience_tag до первого merge (откат)
```

Триггер `BEFORE INSERT OR UPDATE OF seo_tags, subject_audience ON prompt_cards` → `apply_subject_audience()`:
- `subject_audience IS NULL` или `subject_confidence < 0.6` → `seo_tags` не трогаем (legacy-поведение сохраняется).
- иначе `audience_tag := (audience_tag − EXCLUSIVE_SET) ∪ (subject ≠ 'none' ? [subject] : [])`, порядок: subject первым (влияет на `getFirstTagFromSeoTags` / canonical).
- идемпотентен; любой писатель (`fill-seo-tags.ts`, publish, ручной UPDATE) получает согласованный результат — закрывает D3.

Пересчёт при смене канонического фото: если `subject_media_id` ≠ текущего канонического media → карточка снова в очередь (проверка в claim-RPC, не отдельный триггер).

### 2.3 Поток данных

```
                     ┌──────────────────────────── publish (после text classify, after()) ──┐
prompt_card_media ───┤                                                                     ├─▶ classifyCardSubjectAudience()
                     └──── DO standalone backfill / cron claim_subject_audience_batch() ───┘        │ Gemini 2.5 Flash, responseSchema,
                                                                                                    │ через GEMINI_PROXY_BASE_URL
                                                                                                    ▼
                                                              UPDATE prompt_cards SET subject_* ─▶ триггер ─▶ seo_tags.audience_tag
```

Общее ядро: вынести из `compose-example-audience-gemini.ts` функцию `classifyAudienceFromImageBytes({bytes, mime, baseUrl, apiKey, timeoutMs})` → `landing/src/lib/audience-vision-core.ts`; compose-пикер и карточки используют один промт, одну schema, один маппинг (`mapComposeAudienceClassification`). Standalone `.mjs` для DO держит inline-копию промта/schema (правило DO: без импортов).

### 2.4 Внешние решения (Google) — что брать, что нет

| Вариант | Что даёт | Вердикт |
|---|---|---|
| **Gemini 2.5 Flash vision + responseSchema** | Проверено на 60 карточках: 0 ошибок парсинга, ~0.5 с/карточка при concurrency 3 через DO-прокси, enum гарантирован схемой. Стоимость: ~300 input-токенов (512px) + ~40 output → 15 000 карточек ≈ **$3–5**, ~1 час при concurrency 6 | **Основной путь.** Уже используется в проекте для того же вопроса («кто на фото») |
| Gemini 2.5 Flash-Lite | ~в 3 раза дешевле | Опционально: прогнать те же 300 gold-карточек, взять если согласие с Flash ≥ 0.97 |
| **Gemini Embedding 2 (уже есть 13 397 image-векторов в `prompt_card_visual_embeddings`)** | Мультимодальное пространство → (a) kNN-аудит: subject карточки vs мажоритарный subject 10 соседей — список расхождений для ревью; (b) линейный классификатор на векторах, обученный на vision-лейблах, — **нулевая** стоимость дообработки новых карточек и fallback при недоступности Gemini | **Этап 2, не блокирует.** Точность на пол/состав кадра не измерена; embedding сильнее ловит стиль, чем пол. Строить только после gold-set и только если vision-ветка окажется дорогой/медленной. Musk-check: сначала удалить проблему за $5, а не строить второй ML-контур |
| Cloud Vision Face Detection | лица, эмоции; пол убран из API | Нет |
| Vertex AI Multimodal Embeddings | то же, что Gemini Embedding 2, другой биллинг | Нет — дублирует уже внедрённое |

### 2.5 Текстовый классификатор — минимальные правки (D1 на legacy-пути)

В `SYSTEM_PROMPT` обоих файлов (`src/fill-seo-tags.ts`, `landing/src/lib/seo-tags-classify.ts`):
- «`devushka` / `muzhchina` только если в тексте **явно** назван пол одного человека. Нейтральные "человек", "субъект", "the subject", "a person", "модель" без пола → `audience_tag` без этих слагов. Не выводить пол из одежды (костюм, платье, пиджак).»
- «Два взрослых → только `para` (плюс `vlyublennykh` если уместно), **не** добавлять `devushka` и `muzhchina`. Взрослый + ребёнок → `semya` (+ отношение), без `devushka`/`muzhchina`.»

Это снижает шум на входе; окончательный ответ по subject — vision через триггер.

## 3. Нефункциональные требования, риски, SLO

**Нагрузка.** Backfill: 15 000 карточек, concurrency 4–6 через DO-прокси (тот же nginx, что для embeddings; лимит Gemini Flash Tier1 — 1000 RPM, мы ~6 RPS). Runtime: publish ~десятки–сотни/день, `after()` не блокирует ответ.

**Деградация.** Gemini недоступен → `subject_audience` остаётся NULL, листинг работает на текстовых тегах (как сегодня). Cron/DO добирает. Никакого синхронного ожидания в запросе пользователя.

**Идемпотентность.** Триггер чистый; backfill — по `subject_audience IS NULL AND subject_attempts < 3`; повторный publish не откатывает vision (subject-колонки не трогаются text-классификатором).

**Откат.** `UPDATE prompt_cards SET seo_tags = jsonb_set(seo_tags,'{audience_tag}',subject_prev_audience), subject_audience = NULL WHERE subject_prev_audience IS NOT NULL` — без редеплоя. Флаг `card_subject_audience_enabled=false` останавливает runtime-классификацию.

**Наблюдаемость.** RPC `subject_audience_coverage()` → `{published_with_photo, classified, none, low_confidence, failed, pending, by_subject{…}}`. Лог backfill: агрегат `text_exclusive_tags vs vision` (матрица расхождений) — это метрика качества D1/D2. Алерт: `failed / attempted > 10%` за прогон → стоп.

**SEO-риски (нужна проверка после backfill).**
- Счётчики хабов: `muzhchina` 1961 → ожидаемо ~900–1100 (только соло). Лейбл Title/H1 «1300+» в `promty-dlya-foto-muzhchiny-cluster.ts` пересмотреть по факту (`ListingPromptCountBadge` даёт точный объём). `para` вырастет (пары из `[devushka,muzhchina]`).
- L2/L3 комбинации с audience могут упасть ниже `p_min_cards=6` → noindex по существующей логике; проверить `sitemap` diff до/после (число URL с `audience_tag`).
- Карусели хабов `sort=new` фильтруют по тому же `seo_tags` — изменений в коде не требуется.

**Безопасность.** Ключи только из env (`GEMINI_API_KEY`, `GEMINI_PROXY_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — уже на DO). Все RPC — `SECURITY DEFINER`, `REVOKE … FROM anon, authenticated`, `GRANT … TO service_role`. Флаг и лимиты — строки в `landing_generation_config`, не env.

## 4. План реализации (для агента на Grok 4.7)

### Правила исполнения (обязательно прочитать перед началом)

- `.cursor/rules/git-workflow.mdc`: `git fetch origin main && git checkout -b feature/26-09-card-subject-audience-vision origin/main`. Если дерево грязное чужими файлами — остановиться и спросить пользователя. Ничего не коммитить в `main`.
- `.cursor/rules/migrations.mdc`: новая миграция = следующий номер после последнего в `sql/` (на 26.09 последний — `255`, значит `256_…`). Старые не править.
- `.cursor/rules/feature-flags-db.mdc`: флаг только в `landing_generation_config`, default `false`.
- `.cursor/rules/non-rf-via-do-proxy.mdc`: Gemini только через `GEMINI_PROXY_BASE_URL`; пустой env → стоп, не fallback на Google.
- `.cursor/rules/no-secrets-in-code.mdc`, `.cursor/rules/digital-ocean-runner.mdc`: standalone `.mjs` без npm-зависимостей, запуск на DO — `curl -sO … && nohup node … --dry-run > … .log 2>&1 &`.
- `.cursor/rules/shell-safety.mdc`: не запускать `npm run build`/`tsc` без запроса; тесты — `npx vitest run <file>` точечно.
- `.cursor/rules/update-architecture-docs.mdc` + «Delivery unit» из `high-scale-architect.mdc`: код + тесты + `docs/architecture/*.md` в **одном** коммите на шаг.
- Не расширять scope: не трогать `resolve_route_cards`, `get_filter_counts`, компоненты листинга, analyze-промт (`extension-prompt-sections.ts`), compose-пикер поведенчески.

### Шаг 1 — SQL миграция `sql/256_prompt_cards_subject_audience.sql`

1. `ALTER TABLE prompt_cards ADD COLUMN IF NOT EXISTS …` — 9 колонок из §2.2, CHECK на `subject_audience` и `subject_source`.
2. Индекс: `CREATE INDEX … ON prompt_cards (subject_attempts) WHERE is_published AND subject_audience IS NULL` (очередь backfill).
3. Функция `apply_subject_audience()` + триггер `prompt_cards_apply_subject_audience BEFORE INSERT OR UPDATE OF seo_tags, subject_audience, subject_confidence`. `EXCLUSIVE_SET` захардкожен в функции как `ARRAY['devushka','muzhchina','para','semya','malchik','devochka','malysh']`. При первом применении (`subject_prev_audience IS NULL`) сохранить `seo_tags->'audience_tag'` в `subject_prev_audience`.
4. RPC `claim_subject_audience_batch(p_limit int, p_priority text DEFAULT 'all') RETURNS TABLE(card_id, media_id, storage_bucket, storage_path, mime_type, current_audience jsonb)`: `FOR UPDATE SKIP LOCKED`, `WHERE is_published AND subject_attempts < 3 AND (subject_audience IS NULL OR subject_media_id IS DISTINCT FROM <каноническое media>)`. `p_priority`: `'exclusive'` → сначала карточки, где `audience_tag` содержит ≥1 слаг из EXCLUSIVE_SET с `muzhchina|para|semya` (самые шумные, ~2.6k), `'visual_hook'` → `title_ru LIKE 'Visual Hook%'`, `'all'`. Внутри RPC инкрементировать `subject_attempts` (claim = попытка).
5. RPC `complete_subject_audience(p_card_id, p_media_id, p_audience, p_confidence, p_people_count, p_model) RETURNS boolean` и `fail_subject_audience(p_card_id, p_error text)`.
6. RPC `subject_audience_coverage() RETURNS jsonb` (§3).
7. `INSERT INTO landing_generation_config … ON CONFLICT DO NOTHING`: `card_subject_audience_enabled='false'`, `card_subject_audience_daily_limit='3000'`, `card_subject_audience_min_confidence='0.6'`.
8. REVOKE/GRANT как в `sql/192`.
9. Тест миграции: `psql`/SQL-блок в PR-описании с проверкой идемпотентности триггера (два раза UPDATE одинаковым subject → один и тот же `audience_tag`), кейсов `none`, `NULL`, `confidence 0.5`.

Приёмка: миграция применяется на test-БД без ошибок; `SELECT subject_audience_coverage()` возвращает `classified=0`, `pending=14997`.

### Шаг 2 — общее ядро vision-классификации в лендинге

1. Создать `landing/src/lib/audience-vision-core.ts`: перенести туда `COMPOSE_AUDIENCE_RESPONSE_SCHEMA`, `CLASSIFY_PROMPT`, `extractJsonObject`, `ComposeAudienceClassifyError` и новую `classifyAudienceFromImageBytes({ bytes, mimeType, baseUrl, apiKey, timeoutMs, fetchImpl })` → `{ audience, confidence, peopleCount, hasChild, hasVisibleFace }`.
2. `compose-example-audience-gemini.ts` становится тонкой обёрткой (prepare image → core → `mapComposeAudienceClassification`). Существующие тесты `compose-example-audience*.test.ts` должны пройти без изменений.
3. Создать `landing/src/lib/card-subject-audience.ts`: `classifyCardSubjectAudience({ supabase, cardId })` — claim одной карточки (`p_card_id`), качает `storage/v1/render/image/public/...?width=512&quality=60` (fallback `object/public`), вызывает core, пишет через `complete_subject_audience` / `fail_subject_audience`. Читает флаг и дневной лимит из `landing_generation_config`. Прокси обязателен, пока `photo_app_config.gemini_use_proxy` не выключен явно. Бюджет — `card_subject_audience_take_budget` (см. ниже), не shared increment пикера.
4. Дневной бюджет — отдельная функция `card_subject_audience_take_budget` в ту же таблицу `compose_audience_classify_rate_limit`, ключ `card_subject:global`. Общий `compose_audience_classify_rate_limit_increment` не используем: он ещё инкрементирует shared `global` и 15k backfill сожрёт бюджет пикера «Выбрать пример». Standalone backfill бюджет не тратит.
5. Тесты (`node:test` / `tsx --test`, mock fetch): happy path; `none`; низкая confidence → `complete_*` вызван, confidence передана как есть (порог применяет триггер); Gemini 429 → `fail_*` с кодом `rate_limited`; флаг выключен → no-op без сетевых вызовов; пустой `GEMINI_PROXY_BASE_URL` при `gemini_use_proxy=true` → ошибка, не запрос в Google.

Приёмка: `npx vitest run landing/src/lib/audience-vision-core.test.ts landing/src/lib/card-subject-audience.test.ts landing/src/lib/compose-example-audience-gemini.test.ts` зелёные.

### Шаг 3 — правки текстового классификатора (D1 на входе)

1. В `src/fill-seo-tags.ts` и `landing/src/lib/seo-tags-classify.ts` добавить в `SYSTEM_PROMPT` два правила из §2.5 (одинаковый текст в обоих файлах).
2. В `extractSeoTagsRegex` обоих файлов: если сработали и `devushka`, и `muzhchina` **и** `para` → оставить только `para`; если `semya` → убрать `devushka`/`muzhchina`. Чистая функция `normalizeExclusiveAudience(tags: string[]): string[]`, вынести в `landing/src/lib/audience-exclusive.ts` (импортируется обоими, как `tag-registry`).
3. Тесты: `audience-exclusive.test.ts` (5 кейсов); существующие `seo-tags-classify` тесты не ломаются.

Приёмка: тесты зелёные; `npx tsx src/fill-seo-tags.ts --card-id <uuid карточки пары> --dry-run` показывает `audience_tag=[para,…]` без `devushka/muzhchina`.

### Шаг 4 — standalone backfill для DO

1. `src/standalone/backfill-card-subject-audience.mjs` по образцу `backfill-card-image-embeddings.mjs`: только `fetch`, env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_PROXY_BASE_URL` (пустой → exit 1). Аргументы: `--dry-run`, `--limit N` (default 200), `--concurrency` (default 4, max 6), `--priority exclusive|visual_hook|all`, `--loop` (крутить батчи до пустого claim, пауза 2 с между батчами).
2. Цикл: `claim_subject_audience_batch` → download 512px → Gemini (inline промт/schema = копия core, комментарий «keep in sync with audience-vision-core.ts») → `complete_*`/`fail_*`. Retry 429/5xx с backoff 2^n + jitter, max 3.
3. Лог каждые 50: `{claimed, completed, failed, by_subject, disagreements: {text_exclusive→vision: count}}`; в конце `subject_audience_coverage()`.
4. Стоп-условие: `failed/attempted > 0.1` на батче ≥ 50 → выход с кодом 2 и сообщением.
5. Инструкция запуска (в шапке файла и в `docs/architecture/03-pipeline.md`):
   ```
   curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/backfill-card-subject-audience.mjs
   nohup node backfill-card-subject-audience.mjs --dry-run --limit 20 > backfill-card-subject-audience.log 2>&1 &
   ps aux | grep backfill-card-subject-audience ; tail -f backfill-card-subject-audience.log
   ```
   Затем `--priority exclusive --loop`, потом `--priority visual_hook --loop`, потом `--priority all --loop`.

Приёмка: `--dry-run` печатает coverage и план без записи; прогон `--limit 60 --priority exclusive` на test-БД даёт `failed=0`, coverage `classified=60`.

### Шаг 5 — runtime на publish + cron

1. `landing/src/lib/prompt-card-publication.ts`: после text-classify в обоих ветках (`is_published` уже / первая публикация) — `after(() => classifyCardSubjectAudience({supabase, cardId}))`, логи `[card-subject-audience] publish kick …` по образцу `scheduleVisualEmbeddingProcessing`.
2. `landing/src/app/api/cron/visual-embeddings/route.ts`: в том же POST после embeddings — `processSubjectAudienceBacklog({supabase, limit: 8})` (claim → classify) при включённом флаге; в ответ добавить `subjectAudience: {processed, failed, coverage}`. Отдельный cron-роут не заводить.
3. Тесты: publish-хук вызывается ровно один раз на карточку; при выключенном флаге — ни одного сетевого вызова.

Приёмка: на test-контейнере опубликовать карточку с identity-фото → в `prompt_cards` появились `subject_*`, `seo_tags.audience_tag` содержит один exclusive-слаг.

### Шаг 6 — верификация и SEO-проверки

1. Gold-set: 300 карточек (100 `muzhchina`-тегированных до backfill, 100 `devushka`, 50 `para`, 50 без audience). Скрипт в `/tmp` (не в репо): сравнить `subject_audience` с ручной разметкой пользователя на 50 случайных — precision `muzhchina` ≥ 0.95, `para` ≥ 0.9.
2. `http://localhost:3002/promty-dlya-foto/delovoe?audience=muzhchina` — первые 24 карточки: 0 соло-женщин, 0 пар (визуальная проверка скриншотом через browser tool).
3. До/после: `SELECT count(*) … audience_tag @> '["muzhchina"]'`, `'["para"]'`, `'["devushka"]'`; diff числа URL с `audience` в `sitemap.xml`; список L2/L3, упавших ниже 6 карточек — в PR-описание.
4. Пересмотреть лейблы объёма в `promty-dlya-foto-muzhchiny-cluster.ts` / `promty-dlya-foto-par-cluster.ts` по факту, если расходятся с новым count > 20%. Отдельный маленький коммит, согласовать с пользователем.

### Шаг 7 — документация (в тех же коммитах, что код)

- `docs/architecture/01-landing.md`: раздел «Теги / audience»: два слоя, триггер-проекция, флаг, что `resolve_route_cards` не менялся; строка про `/api/cron/visual-embeddings` → плюс subject backlog; обновить дату.
- `docs/architecture/03-pipeline.md`: шаг пайплайна «8. subject audience по фото (vision)», таблица standalone-скриптов, чеклист загрузки, секция env (без новых env).
- Этот файл → после выполнения чеклиста `git mv docs/26-09-card-subject-audience-vision.md docs/done/`.

### Порядок выката

1. Шаги 1–4 → PR → merge в `main` (флаг `false`, триггер пассивен пока `subject_audience IS NULL`).
2. Backfill на DO: `--dry-run` → `--priority exclusive --loop` (~2.6k, ~15 мин) → проверить страницу `delovoe?audience=muzhchina` → `visual_hook` → `all`.
3. Шаг 6 проверки; при провале precision — откат по §3 (один UPDATE).
4. Шаг 5 → PR → merge → `UPDATE landing_generation_config SET value='true' WHERE key='card_subject_audience_enabled'`.

## 5. Чеклист

- [x] Ветка `feature/26-09-card-subject-audience-vision` от `origin/main`
- [x] `sql/256_prompt_cards_subject_audience.sql`: колонки, триггер, RPC, флаги, grants (на БД ещё не применена)
- [x] `audience-vision-core.ts` + рефактор `compose-example-audience-gemini.ts` (тесты compose зелёные)
- [x] `card-subject-audience.ts` + тесты
- [x] `audience-exclusive.ts` + правки промтов text-классификаторов + тесты
- [x] `src/standalone/backfill-card-subject-audience.mjs` (dry-run, priority, loop, stop-loss)
- [ ] Backfill на DO: exclusive → visual_hook → all; coverage ≥ 98%
- [x] Publish-хук + cron backlog за флагом (флаг остаётся `false` до прогона)
- [ ] Gold-set precision `muzhchina` ≥ 0.95; `delovoe?audience=muzhchina` без женщин/пар
- [ ] Sitemap/счётчики хабов проверены, лейблы объёма согласованы
- [x] `01-landing.md`, `03-pipeline.md` обновлены (коммит — отдельно, по запросу)
- [ ] Флаг включён; файл перенесён в `docs/done/`
