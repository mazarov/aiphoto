# 02 — Парсер Telegram-экспортов

> Последнее обновление: 2026-03-13  
> Версия парсера: `v1.0.0`

## Обзор

Парсер извлекает промт-карточки из HTML-экспортов Telegram-каналов. Каждый канал имеет свой формат постов, поэтому парсинг управляется **профилями источников** (`SourceProfile`).

---

## Архитектура

```
docs/export/<dataset-slug>/messages*.html
         │
         ▼
┌─────────────────────────────────────┐
│  findSourceProfile(datasetSlug)     │ ← source-profiles.ts
│  → SourceProfile                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  parseDataset(datasetSlug, root)    │ ← prompt-export-parser.ts
│                                     │
│  1. Читает messages*.html           │
│  2. Извлекает .history > .message   │
│  3. groupMessageNodes(nodes, profile)│
│  4. parseGroupToCards(group, profile)│
│                                     │
│  → ParseDatasetResult               │
└─────────────────────────────────────┘
```

---

## Профили источников (`source-profiles.ts`)

### Интерфейс

```typescript
interface SourceProfile {
  slugPrefix: string;                // Префикс для матчинга (e.g. "ii_photolab")
  displayName: string;               // Название для логов
  promptContainerSelector: string;   // CSS-селектор промтов ("blockquote", "blockquote, pre")
  minPromptLength: number;           // Мин. длина текста для промта (30–80 символов)
  groupingStrategy: "self-contained-split" | "look-back-split";
}
```

### Зарегистрированные профили

| Источник | Контейнер промтов | Мин. длина | Стратегия группировки |
|----------|-------------------|------------|----------------------|
| `ii_photolab` | `blockquote` | 80 | `look-back-split` |
| `NeiRoAIPhotoBot` | `blockquote, pre` | 80 | `self-contained-split` |
| `LEXYGPT` | `blockquote` | 80 | `self-contained-split` |
| `bananogenpromt` | `blockquote, pre` | 80 | `self-contained-split` |
| `PixelNanoBot` | `blockquote, pre` | 30 | `self-contained-split` |

### Матчинг

`findSourceProfile(datasetSlug)` — ищет профиль по `slugPrefix.startsWith()`. Если не найден — возвращает `null`, и `parseDataset` выбрасывает ошибку с инструкцией.

### Добавление нового источника

1. Положить экспорт в `docs/export/<slug>/`
2. Запустить `npx tsx src/analyze-source.ts <slug>`
3. Создать `SourceProfile` в `source-profiles.ts`
4. Запустить `--dry-run` для проверки
5. Запустить полный ingest

---

## Парсер (`prompt-export-parser.ts`)

### Основной flow

```
parseDataset(datasetSlug, root)
  │
  ├── findSourceProfile(datasetSlug)
  │     └── throw если профиль не найден
  │
  ├── readHtmlParts(datasetDir)
  │     └── messages.html, messages2.html, ...
  │
  ├── extractMessageNodes($)
  │     └── .history > .message (default + joined)
  │
  ├── groupMessageNodes(nodes, profile)
  │     └── группировка joined-сообщений
  │
  ├── parseGroupToCards(group, profile)
  │     └── извлечение фото, промтов, метаданных
  │
  └── return ParseDatasetResult
```

### Группировка сообщений

Telegram-экспорт содержит два типа сообщений:
- **default** — начало нового поста
- **joined** — продолжение предыдущего (фото, текст)

#### Стратегия `self-contained-split`

Если joined-сообщение содержит **и фото, и промт** — это самостоятельный пост, начинаем новую группу.

```
[default: фото + промт]  → группа 1
[joined: фото + промт]   → группа 2 (split!)
[joined: фото + промт]   → группа 3 (split!)
```

#### Стратегия `look-back-split`

Расширение `self-contained-split`. Дополнительно обрабатывает паттерн, когда фото идут отдельно от промта:

```
[default: фото]           ─┐
[joined: фото]             │ → группа 1 (фото + промт)
[joined: промт]           ─┘
[joined: фото]            ─┐
[joined: фото]             │ → группа 2 (фото + промт)
[joined: промт]           ─┘
```

Логика "look-back": когда приходит текстовый промт, а в текущей группе уже есть промт — "крадём" хвостовые фото-сообщения из предыдущей группы и начинаем новую.

### Извлечение промтов

1. Ищем контейнеры по `profile.promptContainerSelector` (e.g. `blockquote`, `pre`)
2. Фильтруем по `profile.minPromptLength`
3. Извлекаем текст, очищаем от HTML-тегов

### Сплиттинг карточек

Когда в одном посте несколько фото и несколько промтов:

| Стратегия | Условие |
|-----------|---------|
| `single_card` | 1 промт или 1 фото |
| `split_one_to_one` | кол-во промтов = кол-во фото |
| `split_even_chunks` | фото делятся поровну по промтам |
| `split_distribute_remainder` | остаток распределяется |

### Маппинг вариантов на медиа

| Стратегия | Описание |
|-----------|---------|
| `direct_index` | 1:1 по индексу |
| `label_based` | По меткам ("Кадр 1", "Вариант 2") |
| `fallback_all` | Один промт → все фото |
| `fallback_tail` | Последний промт → оставшиеся фото |

### Предупреждения (warnings)

| Warning | Описание |
|---------|---------|
| `missing_date` | Нет даты публикации |
| `photo_prompt_count_mismatch` | Кол-во фото ≠ кол-во промтов |
| `missing_ru_prompt_text` | Промт только на EN |
| `ambiguous_prompt_photo_mapping` | Неоднозначный маппинг |
| `split_mapping_no_explicit_markers` | Нет явных маркеров сплита |
| `split_mapping_remainder_distribution` | Остаток при распределении |
| `split_mapping_photo_reuse` | Фото используется повторно |

---

## Анализатор источников (`analyze-source.ts`)

CLI-инструмент для анализа нового Telegram-экспорта перед написанием профиля.

### Использование

```bash
npx tsx src/analyze-source.ts <dataset-slug>
```

### Что анализирует

- Название канала
- Количество сообщений (default / joined / service)
- Количество фото
- Количество `<blockquote>` и `<pre>` с распределением длин
- 15 примеров постов с флагами (📷, BQ, PRE, joined/default)
- Рекомендация по `SourceProfile`

### Пример вывода

```
═══════════════════════════════════════════════════
Source Analysis: NewChannel_ChatExport_2026-03-15
═══════════════════════════════════════════════════
Channel:        Новый канал промтов
Total messages: 450
  default:      120
  joined:       310
  service:      20
Total photos:   280
Total <blockquote>: 95
Total <pre>:        15

─── Recommendation ───
  promptContainerSelector: "blockquote, pre"
  minPromptLength: 70 (5th percentile - 10)
  groupingStrategy: "self-contained-split"

⚠️  No SourceProfile found for "NewChannel_ChatExport_2026-03-15".
Add one to src/lib/source-profiles.ts before running ingest.
```

---

## Типы

```typescript
interface ParsedCard {
  sourceMessageId: number;
  sourceMessageIds: number[];
  sourceDate: string | null;
  channelTitle: string;
  cardSplitIndex: number;
  cardSplitTotal: number;
  splitStrategy: string;
  titleRu: string;
  titleEn: string;
  hashtags: string[];
  tags: string[];
  variants: ParsedVariant[];
  media: ParsedMedia[];
  variantMediaMapping: VariantMediaMapping[];
  warnings: ParseWarning[];
  rawTextHtml: string;
  rawTextPlain: string;
}

interface ParsedVariant {
  variantIndex: number;
  labelRaw: string;
  promptTextRu: string;
  promptTextEn: string;
}

interface ParsedMedia {
  mediaIndex: number;
  mediaType: "photo" | "video";
  sourceRelativePath: string;
  thumbRelativePath: string | null;
}

interface ParseDatasetResult {
  datasetSlug: string;
  cards: ParsedCard[];
  htmlFiles: string[];
  skippedNoPrompt: number;
  skippedNoPhoto: number;
  profileUsed: string;
}
```

---

## Файлы

```
src/
├── lib/
│   ├── source-profiles.ts         ← Профили источников
│   └── prompt-export-parser.ts    ← Парсер
├── analyze-source.ts              ← CLI: анализ нового источника
└── ingest-telegram-export-to-supabase.ts  ← CLI: загрузка в БД (см. 03-pipeline.md)
```
