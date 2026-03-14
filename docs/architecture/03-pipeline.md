# 03 — Пайплайн: парсинг → загрузка → публикация

> Последнее обновление: 2026-03-13

## Обзор

Полный пайплайн превращения Telegram-экспорта в опубликованные карточки на лендинге.

---

## Общая схема

```
┌──────────────────────────────────────────────────────────────────┐
│                     ПОДГОТОВКА ИСТОЧНИКА                         │
│                                                                  │
│  1. Экспорт из Telegram Desktop → docs/export/<slug>/            │
│  2. analyze-source.ts → анализ структуры                         │
│  3. Создать SourceProfile в source-profiles.ts (если новый)      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                        ПАРСИНГ + ЗАГРУЗКА                        │
│                                                                  │
│  4. ingest --dry-run → проверка                                  │
│  5. ingest → запись в БД + upload медиа                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      SEO-ОБОГАЩЕНИЕ                              │
│                                                                  │
│  6. translate-en-prompts.ts → перевод EN→RU                      │
│  7. fill-seo-tags.ts → тегирование (LLM + regex)                │
│  8. fix-template-titles.ts → замена шаблонных тайтлов            │
│  9. discover-new-tags.ts → поиск новых тегов (опционально)       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       ПУБЛИКАЦИЯ                                 │
│                                                                  │
│  10. UPDATE prompt_cards SET is_published = true                  │
│      WHERE source_dataset_slug = '<slug>'                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Шаг 1–3: Подготовка источника

### Экспорт из Telegram

1. Telegram Desktop → Export Chat History
2. Формат: HTML
3. Включить: фото, видео
4. Сохранить в `docs/export/<channel>_ChatExport_<YYYY-MM-DD>/`

### Анализ нового источника

```bash
npx tsx src/analyze-source.ts <dataset-slug>
```

Выводит статистику и рекомендацию по `SourceProfile`. Подробнее → `02-parser.md`.

### Создание профиля

Добавить в `src/lib/source-profiles.ts`:

```typescript
{
  slugPrefix: "NewChannel",
  displayName: "Название канала",
  promptContainerSelector: "blockquote, pre",
  minPromptLength: 80,
  groupingStrategy: "self-contained-split",
},
```

---

## Шаг 4–5: Парсинг и загрузка в БД

### CLI

```bash
# Dry-run (только парсинг, без записи в БД)
npx tsx src/ingest-telegram-export-to-supabase.ts --dataset <slug> --dry-run

# Полная загрузка
npx tsx src/ingest-telegram-export-to-supabase.ts --dataset <slug>

# С ограничением
npx tsx src/ingest-telegram-export-to-supabase.ts --dataset <slug> --limit 50

# Только существующие (re-ingest)
npx tsx src/ingest-telegram-export-to-supabase.ts --dataset <slug> --existing-only

# Конкретное сообщение
npx tsx src/ingest-telegram-export-to-supabase.ts --dataset <slug> --message-id 42
```

### Аргументы

| Аргумент | Тип | Описание |
|----------|-----|---------|
| `--dataset` | string | **Обязательный.** Slug датасета |
| `--dry-run` | flag | Без записи в БД |
| `--limit` | number | Макс. кол-во групп |
| `--offset` | number | Пропустить N групп |
| `--existing-only` | flag | Только re-ingest существующих |
| `--message-id` | number | Одно сообщение |

### Дедупликация (Supplier-Aware)

Один канал может иметь несколько экспортов (разные даты). Дедупликация работает по `supplier key`:

```
ii_photolab_ChatExport_2026-03-10  ─┐
ii_photolab_ChatExport_2026-03-13  ─┤ supplier = "ii_photolab"
                                    │
                                    └→ общий пул source_message_id
```

1. `parseSupplierKey(datasetSlug)` → извлекает ключ поставщика
2. `findSupplierDatasetSlugs()` → все датасеты этого поставщика
3. `fetchExistingSourceMessageIds()` → уже загруженные message_id
4. Карточки с существующими message_id пропускаются

### Таблицы БД (запись)

```
ingest-telegram-export-to-supabase.ts
  │
  ├── import_datasets         ← upsert: dataset_slug, channel_title, source_type
  ├── import_runs             ← insert: run metadata (status, counts)
  │
  └── Per card:
      ├── source_message_groups  ← upsert: raw HTML, message IDs
      ├── prompt_cards           ← upsert: title, slug, tags, source info
      ├── prompt_card_media      ← delete + insert: фото/видео
      ├── prompt_variants        ← delete + insert: тексты промтов
      └── prompt_variant_media   ← delete + insert: связь вариант↔медиа
```

### Загрузка медиа

- **Bucket:** `prompt-images`
- **Путь:** `telegram/{datasetSlug}/{sourceMessageId}/{cardSplitIndex}/{mediaIndex}{ext}`
- **Источник:** `docs/export/{datasetSlug}/{sourceRelativePath}`
- **Upsert:** `true` (перезапись при re-ingest)

### Финализация run

| Поле | Описание |
|------|---------|
| `status` | `success` / `partial` / `failed` |
| `groups_parsed` | Успешно обработано |
| `groups_failed` | С ошибками |
| `groups_skipped` | Пропущено (дедупликация) |
| `error_summary` | Первые 10 ошибок |

---

## Шаг 6: Перевод промтов (EN → RU)

```bash
npx tsx src/translate-en-prompts.ts --dataset <slug>
```

| Аргумент | Описание |
|----------|---------|
| `--dataset` | Slug датасета |
| `--dry-run` | Без записи |
| `--limit` | Макс. кол-во |
| `--concurrency` | Параллельность (default: 3) |

**Логика:** находит `prompt_variants` где `prompt_text_ru` пустой, а `prompt_text_en` заполнен → Gemini переводит → обновляет `prompt_text_ru` и `prompt_normalized_ru`.

**Обработка ошибок:** 429 → retry с backoff.

---

## Шаг 7: SEO-тегирование

```bash
npx tsx src/fill-seo-tags.ts --dataset <slug>
```

| Аргумент | Описание |
|----------|---------|
| `--dataset` | Slug датасета |
| `--recompute-all` | Пересчитать все (не только score=0) |
| `--regex-only` | Только regex, без LLM |
| `--card-id` | Конкретная карточка |
| `--dry-run` | Без записи |
| `--limit` | Макс. кол-во |
| `--batch-size` | Размер батча |
| `--concurrency` | Параллельность |

**Два режима:**
1. **LLM** (Gemini 2.5 Flash) — структурированная классификация по `TAG_REGISTRY`
2. **Regex** — fallback по `patterns` из `TAG_REGISTRY`

**Результат:** обновляет `seo_tags` (jsonb) и `seo_readiness_score` (0–100) в `prompt_cards`.

**Авто-добавление тегов:** если LLM находит тег ≥ 3 раз, которого нет в `TAG_REGISTRY` — предлагает добавить в `landing/src/lib/tag-registry.ts`.

---

## Шаг 8: Исправление шаблонных тайтлов

```bash
npx tsx src/fix-template-titles.ts --dataset <slug>
```

| Аргумент | Описание |
|----------|---------|
| `--dataset` | Slug датасета |
| `--dry-run` | Без записи |
| `--limit` | Макс. кол-во |
| `--concurrency` | Параллельность |

**Логика:** находит карточки с `JUNK_PATTERNS` в title → Gemini генерирует новый → обновляет `title_ru` и `slug`.

---

## Шаг 9: Поиск новых тегов (опционально)

```bash
npx tsx src/discover-new-tags.ts --limit 10
```

Открытая классификация: LLM предлагает теги, которых нет в `TAG_REGISTRY`. Только вывод в консоль, без записи в БД.

---

## Шаг 10: Публикация

```sql
UPDATE prompt_cards
SET is_published = true, updated_at = now()
WHERE source_dataset_slug = '<slug>'
  AND is_published = false;
```

После этого карточки появляются на лендинге.

---

## Standalone-скрипты (для сервера без npm)

Для запуска на серверах без полного Node.js окружения (DigitalOcean, Dockhost) есть standalone `.mjs` скрипты:

| Скрипт | Назначение |
|--------|-----------|
| `scripts/translate-en-standalone.mjs` | Перевод EN→RU |
| `scripts/fill-seo-tags-standalone.mjs` | SEO-тегирование |

Используют встроенный `fetch` (Node 20+) и прямые REST-вызовы к Supabase. Не требуют `npm install`.

---

## Порядок выполнения (чеклист)

```
□ 1. Экспорт из Telegram → docs/export/<slug>/
□ 2. npx tsx src/analyze-source.ts <slug>
□ 3. Создать/проверить SourceProfile
□ 4. npx tsx src/ingest-...ts --dataset <slug> --dry-run
□ 5. npx tsx src/ingest-...ts --dataset <slug>
□ 6. npx tsx src/translate-en-prompts.ts --dataset <slug>
□ 7. npx tsx src/fill-seo-tags.ts --dataset <slug>
□ 8. npx tsx src/fix-template-titles.ts --dataset <slug>
□ 9. SQL: UPDATE prompt_cards SET is_published = true WHERE ...
□ 10. Проверить на лендинге
```

---

## Env Variables

| Переменная | Используется в |
|-----------|---------------|
| `SUPABASE_SUPABASE_PUBLIC_URL` | Ingest, SEO-скрипты |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingest, SEO-скрипты |
| `GEMINI_API_KEY` | translate, fill-seo-tags, fix-template-titles |
| `GEMINI_PROXY_BASE_URL` | Опционально: прокси для обхода гео-блокировки |

---

## Файлы

```
src/
├── analyze-source.ts                       ← CLI: анализ нового источника
├── ingest-telegram-export-to-supabase.ts   ← CLI: парсинг + загрузка в БД
├── translate-en-prompts.ts                 ← CLI: перевод EN→RU
├── fill-seo-tags.ts                        ← CLI: SEO-тегирование
├── fix-template-titles.ts                  ← CLI: замена шаблонных тайтлов
├── discover-new-tags.ts                    ← CLI: поиск новых тегов
└── lib/
    ├── source-profiles.ts                  ← Профили источников
    ├── prompt-export-parser.ts             ← Парсер HTML
    └── gemini-url.ts                       ← Хелпер URL для Gemini API

scripts/
├── translate-en-standalone.mjs             ← Standalone: перевод (без npm)
├── fill-seo-tags-standalone.mjs            ← Standalone: теги (без npm)
└── generate-110-clusters.js                ← Генерация SQL кластеров
```
