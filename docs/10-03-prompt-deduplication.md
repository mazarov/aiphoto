# Дедубликация промтов: отдельная спецификация

**Дата:** 10.03.2026
**Обновлено:** 14.06.2026
**Проект:** aiphoto
**Статус:** частично реализовано (Layer A image-dedup внедрён)
**Связанные документы:**
- `10-03-telegram-prompt-collector-tz.md`
- `10-03-prompt-pinterest-web-tz.md`
- `07-03-prompt-import-pipeline.md`
- `14-06-image-dedup-implementation.md`

---

## Статус реализации

| Layer | Описание | Статус |
|---|---|---|
| **Source dedup** | По `source_message_id` внутри supplier | ✅ реализован в ингесте |
| **Image exact** | SHA-256 первичного фото | ✅ реализован (`sql/162`, `image-hash.ts`) |
| **Image near** | pHash, порог Hamming ≤ 6 | ✅ реализован (`sql/162`, `image-hash.ts`) |
| **Text exact** | Нормализация + hash prompt_text_ru | ⏳ не реализован |
| **Text near** | n-gram / token set ratio | ⏳ не реализован |
| **Semantic** | Embedding cosine similarity | ⏳ не реализован |

### Реализованная схема (image dedup)

**Колонки в `prompt_card_media`** (миграция `sql/162_prompt_card_image_dedup.sql`):
- `image_sha256 text` — SHA-256 байт файла; индекс.
- `image_phash text` — 64-битный перцептивный хеш (16 hex-символов); индекс.

**Колонки в `prompt_cards`** (миграция `sql/162_prompt_card_image_dedup.sql`):
- `dedup_status text` — `'unique'` (default) | `'duplicate'`.
- `canonical_card_id uuid` — ссылка на canonical-карточку для дублей.
- `dedup_reason text` — причина (`'image_match_on_ingest'`, `'image_match(phash<=6)'`).
- `dedup_checked_at timestamptz` — время пометки.

**Алгоритм pHash:**
resize 32×32 grayscale → DCT-II → 8×8 low-freq блок → median threshold → 64 бита → 16 hex.
Порог Hamming: `6` (из 64 бит). Ловит ресайз, пережатие, мелкие вотермарки.

**Библиотека:** `src/lib/image-hash.ts` — `computeSha256`, `computePhash`, `hammingDistanceHex`.

### Backfill существующих карточек

```bash
cd aiphoto
# 1. dry-run: вычислить хеши и найти дубли (ничего не меняет в prompt_cards)
npx tsx src/dedupe-prompt-cards.ts --dry-run --published-only

# 2. подобрать порог при необходимости
npx tsx src/dedupe-prompt-cards.ts --dry-run --threshold 4

# 3. применить
npx tsx src/dedupe-prompt-cards.ts --apply --published-only
```

Флаги: `--dry-run`, `--apply`, `--threshold N` (default 6), `--canonical-by oldest|views`, `--published-only`, `--no-hash-write`.

### Интеграция в ингест

В `ingest-telegram-export-to-supabase.ts`:
- Хеши вычисляются из буфера при `uploadMedia` и сохраняются в `prompt_card_media`.
- Перед ингестом загружаются существующие хеши (`fetchExistingImageHashes`).
- При совпадении primary-фото карточка получает `dedup_status='duplicate'`, `is_published=false`.
- Счётчик `imageDuplicates` в итоговом JSON.

### Лендинг

Дубли исключены через `is_published=false` — все листинговые запросы фильтруют `is_published=true`.

---

## 1. Проблема

При импорте промтов из Telegram-каналов возникает высокий процент повторов:

- один и тот же пост репостится в нескольких каналах;
- один и тот же промт публикуется с мелкими правками;
- визуально похожие примеры имеют разный текстовый шум (`8k`, `best quality`, `ultra detailed`);
- разные посты ведут к одной и той же пользовательской ценности (одинаковый стиль/сцена).

По итогам обсуждения ожидаемая доля уникального контента может быть только `30-40%` от сырого потока.

---

## 2. Цели дедубликации

1. Не допускать захламления базы дублями.
2. Сохранять только уникальные или полезно-отличающиеся промты.
3. Повышать качество SEO-страниц за счет уникальности контента.
4. Снизить расходы на хранение и последующую обработку.

---

## 3. Что считаем дубликатом

### 3.1 Exact duplicate (точный)

Промт считается точным дублем, если после нормализации:

- текст полностью совпадает, или
- совпадает стабильный хэш нормализованного текста.

### 3.2 Near duplicate (почти дубль)

Промт считается почти дублем, если:

- смысл тот же, но изменены формулировки/порядок слов;
- различия только в шумовых токенах;
- изменение не влияет на целевой use case/style.

### 3.3 Not duplicate (уникальный)

Промт уникален, если отличается хотя бы по одному существенному признаку:

- use case;
- стиль/сцена;
- ключевая роль объекта;
- композиция/ракурс/свет;
- ожидаемый визуальный результат.

---

## 4. Нормализация перед сравнениями

Перед дедупликацией обязательно применяем pipeline нормализации:

1. lowercasing;
2. удаление лишней пунктуации и повторяющихся пробелов;
3. унификация синонимов и формулировок служебных фраз;
4. удаление шумовых токенов (`best quality`, `8k`, `masterpiece`, и т.д.);
5. приведение языковых вариантов (RU/EN) к сопоставимому виду (по правилам проекта).

Результаты нормализации храним в отдельном поле: `prompt_clean`.

---

## 5. Стратегия дедубликации (слои)

## Layer A: быстрый exact-check (MVP обязательный)

- вычисляем `prompt_clean_hash` (например, SHA-256 от `prompt_clean`);
- если такой hash уже есть, новый промт помечается `exact_duplicate`;
- в БД сохраняется ссылка на canonical prompt.

## Layer B: near-duplicate по тексту (MVP+)

- сравнение по n-gram similarity / token set ratio;
- при схожести выше порога `T_text` помечаем `near_duplicate`.

Рекомендация стартовых порогов:
- `T_text_warn = 0.85` (в ручную очередь);
- `T_text_auto = 0.93` (автосклейка в near-duplicate).

## Layer C: семантический near-duplicate (Phase 2)

- считаем embedding `prompt_clean_embedding`;
- сравниваем cosine similarity в векторном индексе;
- если `cos_sim >= T_semantic`, считаем смысловым дублем.

Рекомендация стартового порога:
- `T_semantic = 0.92` (с последующей калибровкой на реальных данных).

---

## 6. Связь с дедупликацией изображений

Дедуп промтов должен работать совместно с дедупом изображений:

- `sha256` изображения: точный дубль файла;
- `phash` изображения: почти дубль по визуалу.

Решение о публикации записи принимается по комбинированным сигналам:

- `image_duplicate && prompt_duplicate` -> не публиковать новую карточку;
- `image_duplicate && prompt_unique` -> публиковать как вариацию промта;
- `image_unique && prompt_duplicate` -> публиковать только если новый use case/style;
- `image_unique && prompt_unique` -> публиковать.

---

## 7. Canonical-модель в БД

Для дублей вводится canonical-схема:

- `prompt_id` — текущий промт;
- `canonical_prompt_id` — ссылка на основной промт;
- `dedup_status` — `unique | exact_duplicate | near_duplicate`;
- `dedup_reason` — причина (hash match, similarity threshold, semantic match);
- `dedup_score` — числовой скор.

Это позволяет:
- не терять источник данных;
- не раздувать публичную витрину;
- анализировать качество дедупа.

---

## 8. Очередь ручной валидации

В ручную проверку отправляются случаи:

- `T_text_warn <= similarity < T_text_auto`;
- конфликт сигналов (например, текст дубликат, но use case разный);
- новые редкие категории, где риск ложной склейки высокий.

Решения модератора:
- `merge_with_canonical`;
- `mark_unique`;
- `ban_as_noise`.

---

## 9. KPI качества дедупликации

1. `dedup_rate` — доля отфильтрованных дублей.
2. `false_merge_rate` — доля ошибочно склеенных уникальных промтов.
3. `false_unique_rate` — доля дублей, прошедших как уникальные.
4. Доля карточек с `dedup_status = unique` в публичной витрине.

Целевые значения для MVP (ориентир):
- `false_merge_rate < 2%`;
- `false_unique_rate < 10%`.

---

## 10. Порядок внедрения

### Шаг 1 (MVP)

- Нормализация + hash exact dedup.
- Canonical-поля в БД.
- Базовые метрики.

### Шаг 2

- Text similarity near dedup.
- Ручная очередь для спорных случаев.

### Шаг 3

- Embedding-based semantic dedup.
- Калибровка порогов по историческим данным.

---

## 11. Главный принцип

Лучше временно пропустить часть near-дублей, чем агрессивно склеить и потерять уникальные промты.

Приоритет в MVP: **высокая точность склейки**, а не максимальный recall.
