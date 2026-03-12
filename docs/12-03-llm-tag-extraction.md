# LLM-классификация тегов для prompt_cards

## Проблема

Текущий подход — regex-паттерны в `TAG_REGISTRY` — имеет фундаментальные ограничения:

| Проблема | Пример |
|---|---|
| `\b` не работает с кириллицей в JS | `роз\b` не матчит "розы" (починили, но это симптом) |
| Синонимы и словоформы | "мать/матери/матерью" ≠ "мама" — regex не знает |
| Косвенные описания | "женщина сидит, рядом стоит девочка-дочка" → это "с мамой" + "с дочкой", но regex ищет буквально |
| Не масштабируется | Каждый новый тег требует ручного составления regex с учётом всех форм |
| Не понимает контекст | "роза ветров" попадёт в "с цветами" |

**Вывод:** regex подходит для простых тегов (GTA, 3D, Barbie), но не справляется с семантическими (отношения, сцены, настроение).

## Решение

Заменить regex-экстракцию на LLM-классификацию. TAG_REGISTRY остаётся source of truth для slug/dimension/URL/labels, но поле `patterns` больше не используется для новых карточек.

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│ fill-seo-tags.ts (скрипт)                           │
│                                                     │
│  1. Загрузить карточки из prompt_cards               │
│  2. Загрузить prompt_text_ru из prompt_variants      │
│  3. Для каждой карточки:                             │
│     ┌───────────────────────────────────────┐        │
│     │ Gemini Flash (structured output)      │        │
│     │                                       │        │
│     │ Input:  title + prompt_text_ru        │        │
│     │         + TAG_REGISTRY (slug+label)   │        │
│     │                                       │        │
│     │ Output: { audience_tag: [...],        │        │
│     │           style_tag: [...],           │        │
│     │           occasion_tag: [...],        │        │
│     │           object_tag: [...],          │        │
│     │           doc_task_tag: [...] }       │        │
│     └───────────────────────────────────────┘        │
│  4. Валидация: все slug'и есть в TAG_REGISTRY        │
│  5. Сохранить seo_tags + seo_readiness_score в БД    │
└─────────────────────────────────────────────────────┘
```

## Выбор модели

| Критерий | Gemini 2.0 Flash |
|---|---|
| Стоимость | ~$0.10 / 1M input tokens, ~$0.40 / 1M output |
| Скорость | ~0.5–1 сек на запрос |
| Structured output | Да (responseSchema) |
| Русский язык | Отлично |
| Уже используется в проекте | Да (worker.ts) |

**Оценка стоимости для 700 карточек:**
- Input: ~500 токенов/карточка (промт ~300 + TAG_REGISTRY summary ~200) × 700 = ~350K tokens → ~$0.035
- Output: ~50 токенов/карточка × 700 = ~35K tokens → ~$0.014
- **Итого: ~$0.05 за полный прогон всех карточек**

## Промпт

```
Ты классификатор промтов для фотогенерации.

Дан промт (title + текст). Определи, какие теги подходят.

Правила:
- Выбирай ТОЛЬКО slug'и из списка ниже
- Тег подходит, если промт ЯВНО описывает соответствующую сцену/объект/стиль
- Для audience_tag: определяй по описанию персонажей и их отношений
- Для style_tag: определяй по технике, стилю, референсам
- Для object_tag: определяй по объектам, локациям, одежде
- Для occasion_tag: определяй по упоминанию праздников/событий
- Для doc_task_tag: определяй по назначению фото
- Если сомневаешься — НЕ добавляй тег (precision > recall)

Доступные теги:

audience_tag:
  devushka — Девушки (женщина, девушка, леди)
  muzhchina — Мужчины (мужчина, парень)
  para — Пары (двое, пара, вместе)
  semya — Семья (семейное фото)
  ...
  s_mamoy — С мамой (мать и ребёнок, материнство)
  s_dochkoy — С дочкой (мать/отец и дочь)
  ...

style_tag:
  ...

object_tag:
  ...
```

## Structured Output (responseSchema)

```typescript
const responseSchema = {
  type: "object",
  properties: {
    audience_tag: {
      type: "array",
      items: { type: "string", enum: [...audience slugs] }
    },
    style_tag: {
      type: "array",
      items: { type: "string", enum: [...style slugs] }
    },
    occasion_tag: {
      type: "array",
      items: { type: "string", enum: [...occasion slugs] }
    },
    object_tag: {
      type: "array",
      items: { type: "string", enum: [...object slugs] }
    },
    doc_task_tag: {
      type: "array",
      items: { type: "string", enum: [...doc_task slugs] }
    },
  },
  required: ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"],
};
```

Gemini с `responseMimeType: "application/json"` + `responseSchema` гарантирует валидный JSON с допустимыми slug'ами.

## Изменения в fill-seo-tags.ts

### Режимы работы

```bash
# LLM-классификация (по умолчанию для новых карточек)
npx tsx src/fill-seo-tags.ts --recompute-all

# Regex fallback (если LLM недоступен / для отладки)
npx tsx src/fill-seo-tags.ts --recompute-all --regex-only

# Одна карточка
npx tsx src/fill-seo-tags.ts --card-id <uuid>

# Dry run (показать что изменится, не писать в БД)
npx tsx src/fill-seo-tags.ts --recompute-all --dry-run
```

### Батчинг и rate limits

- **Параллельность:** 5 concurrent запросов к Gemini Flash (не упираться в rate limit)
- **Retry:** 3 попытки с exponential backoff (429/500/503)
- **Таймаут:** 10 сек на запрос
- **Прогресс:** логировать каждые 50 карточек

### Валидация ответа

1. Проверить что все slug'и есть в TAG_REGISTRY
2. Отфильтровать невалидные slug'и (не крашить, а логировать warning)
3. Если ответ полностью невалидный — retry, потом skip с warning

## Изменения в TAG_REGISTRY

Поле `patterns` остаётся для обратной совместимости и regex-fallback, но **не используется** при LLM-режиме.

Добавляется опциональное поле `description`:

```typescript
export type TagEntry = {
  slug: string;
  dimension: Dimension;
  labelRu: string;
  labelEn: string;
  urlPath: string;
  patterns: RegExp[];
  /** Hint for LLM classifier — when to assign this tag */
  description?: string;
};
```

Пример:
```typescript
{
  slug: "s_mamoy",
  dimension: "audience_tag",
  labelRu: "С мамой",
  labelEn: "With mother",
  urlPath: "/promty-dlya-foto-s-mamoy",
  patterns: [/с мамой|мам[аыуе]|мать|матер[иью]/i],
  description: "Мать и ребёнок вместе. Любые формы: мама, мать, матери, материнство, женщина с дочкой/сыном",
}
```

## Что НЕ меняется

- Структура `seo_tags` в БД (JSONB) — формат идентичен
- `seo_readiness_score` — та же формула
- `TAG_REGISTRY` — source of truth для slug/dimension/URL/labels
- Лендинг — потребляет `seo_tags` как раньше, изменений не нужно
- `labels` в `seo_tags` — генерируются из slug'ов после классификации (как сейчас)

## Env переменные

Нужен `GEMINI_API_KEY` — уже есть в `.env` (используется worker.ts).

## Этапы реализации

### Этап 1: LLM-классификатор в fill-seo-tags.ts
- Добавить Gemini API вызов с structured output
- Добавить `--regex-only` флаг для fallback
- Добавить concurrency (p-limit или ручной семафор)
- Добавить retry + validation

### Этап 2: Прогон всех карточек
- `--dry-run` → сравнить LLM vs regex на 50 карточках
- Убедиться что coverage выше
- `--recompute-all` → обновить все 700 карточек

### Этап 3: Интеграция в пайплайн загрузки
- При ingest новых карточек — автоматически вызывать LLM-классификацию
- Regex остаётся как fallback при недоступности Gemini

## Метрики успеха

| Метрика | Сейчас (regex) | Цель (LLM) |
|---|---|---|
| audience coverage | 577/673 (86%) | >95% |
| Relationship tags (с мамой, с дочкой...) | ~4 матча | >50 |
| False positives | Бывают (розетка→цветы) | <1% |
| Время на добавление нового тега | ~30 мин (regex) | ~1 мин (добавить slug + description) |
| Стоимость полного прогона | $0 | ~$0.05 |

## Риски

| Риск | Митигация |
|---|---|
| LLM галлюцинирует slug'и | Structured output с enum → невозможно |
| LLM переназначает теги (over-tagging) | Промпт: "precision > recall, если сомневаешься — не добавляй" |
| Rate limit Gemini | p-limit(5), retry с backoff |
| Стоимость при масштабе (10K карточек) | ~$0.70 — приемлемо |
| LLM API недоступен | Regex fallback (--regex-only) |
