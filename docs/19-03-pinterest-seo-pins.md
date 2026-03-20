# Pinterest: SEO-оптимизация Title и Description пинов

**Дата:** 19.03.2026
**Статус:** ready for development
**Зависит от:** `15-03-pinterest-distribution.md` (доски, скрипт CSV)

---

## Проблема

Текущий `generate-pinterest-csv.ts` генерирует Title и Description без SEO-оптимизации:

| Поле | Сейчас | Проблема |
|------|--------|----------|
| **Title** | Обрезка `title_ru` на 100 символов | Сырой текст промпта, обрезается посреди слова. Не содержит ключевых слов. |
| **Description** | Английский шаблон + промпт + ссылка в тексте | Язык не совпадает с аудиторией. Ссылка дублирует колонку Link и обрезается на 500 символах. Нет ключевых слов. |

Pinterest — **поисковая платформа**. Title и Description индексируются и определяют, найдут ли пин. Без ключевых слов пины невидимы в поиске.

---

## Данные для SEO

### 1. `seo_tags` (в `prompt_cards`)

Каждая карточка содержит JSON с тегами по измерениям:

```json
{
  "audience_tag": ["devushka"],
  "style_tag": ["portret", "cherno_beloe"],
  "occasion_tag": ["den_rozhdeniya"],
  "object_tag": ["s_cvetami"]
}
```

### 2. `TAG_REGISTRY` (`landing/src/lib/tag-registry.ts`)

Маппинг slug → русский и английский лейбл:

| slug | labelRu | labelEn |
|------|---------|---------|
| devushka | Девушки | Women |
| portret | Портрет | Portrait |
| cherno_beloe | Чёрно-белое | Black & White |
| s_cvetami | С цветами | With flowers |
| den_rozhdeniya | День рождения | Birthday |

### 3. Wordstat (топ-запросы)

Файл: `docs/wordstat/wordstat_top_queries (1).csv`

Топ-запросы, которые должны попадать в Title/Description:

| Запрос | Частотность |
|--------|-------------|
| промты для фото | 131 030 |
| промты для фото девушки | 7 435 |
| промт для фото в стиле | 6 619 |
| промты для фото мужчины | 3 611 |
| промты для фото пар | 2 754 |
| промт для семейного фото | 2 392 |
| промт черно белое фото | 2 130 |
| реалистичные промты для фото | 1 696 |
| промты для детских фото | 1 629 |
| промт для фото портрета | 1 063 |
| промт для студийного фото | 873 |
| промт для фото с цветами | 641 |
| промт для делового фото | 672 |
| промт для фото в костюме | 623 |
| промт для фото love is | 632 |

---

## Требования к Title

### Формат

```
{тема_на_русском} — промт для AI фото
```

### Правила

1. **Язык:** только русский (аудитория — русскоязычная)
2. **Длина:** до **100 символов** (лимит Pinterest)
3. **Обрезка:** по границе слова, никогда посреди слова
4. **Обязательные ключевые слова:** «промт» + «фото» (из Wordstat — ядро всех запросов)
5. **SEO-теги из `seo_tags`:** подставлять `labelRu` из `TAG_REGISTRY`
6. **Без спецсимволов:** без emoji, без `|`, без `#`

### Формула сборки Title

```
Приоритет компонентов (до заполнения 100 символов):
1. audience_tag[0].labelRu (если есть) — «Девушки», «Мужчины», «Пары»
2. style_tag[0].labelRu (если есть) — «Портрет», «Чёрно-белое»
3. occasion_tag[0].labelRu (если есть) — «День рождения», «Свадьба»
4. object_tag[0].labelRu (если есть) — «С цветами», «В костюме»
5. Суффикс: « — промт для AI фото»
```

### Примеры

| seo_tags | Title |
|----------|-------|
| audience=devushka, style=portret, object=s_cvetami | `Девушки, портрет с цветами — промт для AI фото` |
| audience=muzhchina, style=delovoe | `Мужчины, деловое фото — промт для AI фото` |
| audience=para, occasion=svadba | `Пары, свадьба — промт для AI фото` |
| audience=devushka, style=cherno_beloe | `Девушки, чёрно-белое — промт для AI фото` |
| style=gta | `GTA стиль — промт для AI фото` |
| (пустые теги) | Обрезка `title_ru` по слову + суффикс `— промт для AI фото` |

### Fallback

Если `seo_tags` пусты или все теги не найдены в `TAG_REGISTRY`:
- Взять `title_ru`, обрезать по границе слова до `100 - len(" — промт для AI фото")`
- Добавить суффикс

---

## Требования к Description

### Формат

```
{Краткое описание из title_ru, 1-2 предложения}. Готовый промт для AI фото — скопируй и вставь в ChatGPT или Gemini. {Тема}: {audience}. {Стиль}: {style}. {Ещё теги если есть}. 6000+ промтов на PromptShot.
```

### Правила

1. **Язык:** русский
2. **Длина:** до **500 символов** (лимит Pinterest)
3. **Нет URL внутри описания** — ссылка уже в колонке Link
4. **Ключевые слова из тегов** — `labelRu` значения как естественный текст
5. **CTA:** «Скопируй и вставь в ChatGPT или Gemini» (совпадает с поисковыми запросами «промты для чата gpt для фото»)
6. **Бренд:** «PromptShot» + количество промтов

### Формула сборки Description

```
Часть 1 — Описание (до ~200 символов):
  Взять title_ru, обрезать по последнему ". " до 200 символов.
  Если title_ru короткий — использовать целиком.

Часть 2 — SEO-шаблон:
  "Готовый промт для AI фото — скопируй и вставь в ChatGPT или Gemini."

Часть 3 — Теги как ключевики (каждый если есть):
  "Тема: {audience_tag.labelRu}."
  "Стиль: {style_tag.labelRu}."
  "Событие: {occasion_tag.labelRu}."
  "Детали: {object_tag.labelRu}."

Часть 4 — CTA:
  "6000+ промтов для AI фото на PromptShot."
```

### Пример

**seo_tags:** `audience=devushka, style=portret, object=s_cvetami`
**title_ru:** `Кинематографический портрет девушки. На ней белая пижама с рюшами...`

```
Кинематографический портрет девушки. На ней белая пижама с рюшами. Готовый промт для AI фото — скопируй и вставь в ChatGPT или Gemini. Тема: девушки. Стиль: портрет. Детали: с цветами. 6000+ промтов для AI фото на PromptShot.
```

---

## Реализация

### Изменения в `generate-pinterest-csv.ts`

1. **Импортировать `TAG_REGISTRY`** из `landing/src/lib/tag-registry.ts`
2. **Новая функция `buildSeoTitle(card)`:**
   - Собрать лейблы из `seo_tags` + `TAG_REGISTRY`
   - Сформировать title по формуле
   - Обрезать по границе слова до 100 символов
3. **Новая функция `buildSeoDescription(card)`:**
   - Описание из `title_ru` (до первой точки или 200 символов)
   - SEO-шаблон + теги + CTA
   - Обрезать до 500 символов
4. **Убрать ссылку из Description**
5. **Заменить английские шаблоны на русские**

### Вспомогательные структуры

```typescript
import { TAG_REGISTRY } from "../landing/src/lib/tag-registry";

const tagLabelMap = new Map<string, string>();
for (const entry of TAG_REGISTRY) {
  tagLabelMap.set(`${entry.dimension}:${entry.slug}`, entry.labelRu);
}

function resolveTagLabels(seoTags: Record<string, string[]>): {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
} {
  return {
    audience: seoTags.audience_tag?.[0] ? tagLabelMap.get(`audience_tag:${seoTags.audience_tag[0]}`) : undefined,
    style: seoTags.style_tag?.[0] ? tagLabelMap.get(`style_tag:${seoTags.style_tag[0]}`) : undefined,
    occasion: seoTags.occasion_tag?.[0] ? tagLabelMap.get(`occasion_tag:${seoTags.occasion_tag[0]}`) : undefined,
    object: seoTags.object_tag?.[0] ? tagLabelMap.get(`object_tag:${seoTags.object_tag[0]}`) : undefined,
  };
}
```

### Не меняется

- Колонка **Link** — без изменений
- Колонка **Media URL** — без изменений
- Колонка **Pinterest board** — без изменений (уже исправлено)
- Логика `pickBoard()` — без изменений
- Логика `fetchCards()` — без изменений
- Флаг `--board` — без изменений

---

## Валидация

### Тест 1 — одна карточка

```bash
npx tsx src/generate-pinterest-csv.ts --limit 1 --board audience:devushka --output pinterest-seo-test.csv
```

Проверить:
- [ ] Title содержит «промт» и «фото»
- [ ] Title на русском, <= 100 символов
- [ ] Title не обрезан посреди слова
- [ ] Description на русском, <= 500 символов
- [ ] Description НЕ содержит URL
- [ ] Description содержит теги из `seo_tags`
- [ ] Description содержит «ChatGPT или Gemini»

### Тест 2 — батч 200

```bash
npx tsx src/generate-pinterest-csv.ts --limit 200 --output pinterest-seo-batch.csv
```

Проверить:
- [ ] Все Title <= 100 символов
- [ ] Все Description <= 500 символов
- [ ] Ни один Title не обрезан посреди слова

### Тест 3 — загрузка в Pinterest

- Загрузить 1 пин через bulk CSV
- Убедиться что Pinterest принял
- Проверить как выглядит в ленте

---

## Метрики успеха

| Метрика | До (baseline) | Цель (через 30 дней) |
|---------|---------------|----------------------|
| Pinterest Impressions | 0 | > 10K |
| Клики на promptshot.ru | 0 | > 200 |
| Позиция в поиске Pinterest по «промт для фото девушки» | — | топ-50 |
