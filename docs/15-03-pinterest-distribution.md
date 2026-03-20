# Pinterest — дистрибуция карточек промтов

**Дата:** 15.03.2026 (обновление 19.03.2026 — bulk CSV: имя доски)
**Проект:** aiphoto (лендинг промтов)
**Статус:** ready for development

---

## Контекст

Автоматическая публикация карточек промтов из БД (`prompt_cards`) в Pinterest для привлечения трафика на лендинг. Pinterest — визуальный поисковик с долгим хвостом: пин живёт месяцами, в отличие от постов в соцсетях.

**Источник данных:** таблицы `prompt_cards`, `prompt_card_media`, `prompt_variants`.
**Текущий объём:** ~6965 опубликованных карточек.

---

## Почему Pinterest

- Пин живёт месяцами/годами (long-tail трафик)
- Поисковая платформа — люди ищут идеи, референсы, инструменты
- Визуальный контент — карточки промтов идеально подходят
- Высокий CTR — пины кликабельны, ведут на внешние ссылки
- Дешёвый трафик: органика бесплатна, ads дешевле Google/Meta для визуальных ниш

---

## Архитектура

```
prompt_cards (Supabase)
  → publish-to-pinterest.mjs --limit N
    → Pinterest API v5 POST /v5/pins
      → пин на доске Pinterest
        → клик → лендинг /p/[slug]/?utm_source=pinterest
```

Один скрипт, запускается ежедневно по cron или вручную. Rich Pins работают пассивно через OG-теги (уже реализованы на `/p/[slug]/`).

---

## Доски Pinterest

### Принцип: Board = L1 prompt_cluster

Каждый L1 кластер с лендинга = одна доска в Pinterest. Маппинг через `prompt_clusters` WHERE `page_level = 'L1'`.

Доски создаются скриптом через Pinterest API (POST /v5/boards) на основе данных из `prompt_clusters`. Колонка `pinterest_board_id` в `prompt_clusters` хранит ID созданной доски.

### Разогрев досок (новый аккаунт)

Не создавать все доски разом — Pinterest может флагнуть новый аккаунт.

| Неделя | Досок | Критерий |
|--------|-------|----------|
| 1 | 10-15 | Кластеры с наибольшим кол-вом карточек (топ по `tag_counts_cache.count`) |
| 2-3 | +15-20 | Средние кластеры |
| 4+ | остальные | Все оставшиеся с >= 10 карточек |

Скрипт создания досок принимает `--min-cards N` — создаёт доску только если в кластере >= N карточек (по `tag_counts_cache`). Запускается несколько раз, постепенно снижая порог.

### Создание досок (скрипт)

```sql
SELECT slug, dimension_type, dimension_value, title_ru
FROM prompt_clusters
WHERE page_level = 'L1' AND is_published = true
ORDER BY sort_order;
```

Название доски в Pinterest — английское, формируется по шаблону:

| dimension_type | Шаблон названия | Пример |
|---|---|---|
| audience | "AI Photo: {title}" | "AI Photo: Girls", "AI Photo: Couples" |
| style | "{title} AI Photos" | "Portrait AI Photos", "B&W AI Photos" |
| occasion | "{title} AI Photos" | "Birthday AI Photos", "Valentine's AI Photos" |
| object | "AI Photos: {title}" | "AI Photos: With Flowers", "AI Photos: Winter" |
| doc_task | "AI {title}" | "AI Passport Photo", "AI Resume Photo" |

Описание доски — ссылка на соответствующую страницу лендинга:
`"AI photo prompts for {title}. Browse and copy → {SITE_DOMAIN}/{cluster_slug}/"`

### Логика назначения доски

Приоритет — первый непустой тег, для которого существует L1 кластер с `pinterest_board_id`:

```
1. occasion_tag[0] → cluster(dimension_type='occasion', dimension_value=tag)
2. audience_tag[0] → cluster(dimension_type='audience', dimension_value=tag)
3. style_tag[0]    → cluster(dimension_type='style', dimension_value=tag)
4. object_tag[0]   → cluster(dimension_type='object', dimension_value=tag)
5. doc_task_tag[0] → cluster(dimension_type='doc_task', dimension_value=tag)
```

Если ни один тег не матчится в L1 кластер — fallback-доска "AI Photo Prompts" (общая).

Один пин — одна доска. Без дублирования, без отложенных saves.

### Хранение маппинга

```sql
ALTER TABLE prompt_clusters
  ADD COLUMN IF NOT EXISTS pinterest_board_id text;
```

### Конфиг в скрипте

Маппинг загружается из БД при старте:

```javascript
async function loadBoardMap(supabase) {
  const { data } = await supabase
    .from("prompt_clusters")
    .select("dimension_type, dimension_value, pinterest_board_id")
    .eq("page_level", "L1")
    .not("pinterest_board_id", "is", null);

  const map = {};
  for (const row of data) {
    map[`${row.dimension_type}:${row.dimension_value}`] = row.pinterest_board_id;
  }
  return map;
}

const PRIORITY = ["occasion_tag", "audience_tag", "style_tag", "object_tag", "doc_task_tag"];
const DIM_TYPE = {
  occasion_tag: "occasion",
  audience_tag: "audience",
  style_tag: "style",
  object_tag: "object",
  doc_task_tag: "doc_task",
};

function pickBoard(seoTags, boardMap, fallbackBoardId) {
  for (const dim of PRIORITY) {
    const tags = seoTags[dim];
    if (!tags?.length) continue;
    const key = `${DIM_TYPE[dim]}:${tags[0]}`;
    if (boardMap[key]) return boardMap[key];
  }
  return fallbackBoardId;
}
```

### Bulk CSV (`generate-pinterest-csv.ts`)

Ручная загрузка через интерфейс Pinterest: колонка **Pinterest board** должна **точно совпадать** с названием доски в аккаунте. Доски создаются скриптом `create-pinterest-boards.ts` по шаблонам выше с полем **`title_en || title_ru`** (не только `title_ru`). Пример: для audience-кластера «девушки» в БД доска называется **`AI Photo: Girls`**, а не `Девушки` — если в CSV указать короткое русское имя, Pinterest не найдёт доску и вернёт «Не удалось создать пин».

Тест одной карточки на доску «Девушки» (L1 `audience` / `devushka`):

`npx tsx src/generate-pinterest-csv.ts --limit 1 --board audience:devushka --output pinterest-test-devushki-1.csv`

---

## Скрипт публикации

### Входные данные (из Supabase)

```sql
SELECT
  pc.id,
  pc.slug,
  pc.title_en,
  pc.seo_tags,
  pcm.storage_path,
  pv.prompt_text_en
FROM prompt_cards pc
JOIN prompt_card_media pcm ON pcm.card_id = pc.id AND pcm.is_primary = true
LEFT JOIN prompt_variants pv ON pv.card_id = pc.id AND pv.variant_index = 0
WHERE pc.is_published = true
  AND NOT EXISTS (
    SELECT 1 FROM card_distributions cd
    WHERE cd.card_id = pc.id AND cd.platform = 'pinterest'
  )
ORDER BY pc.source_date DESC
LIMIT $1;
```

### Формирование пина

| Поле пина | Источник |
|---|---|
| **title** | `title_en` (до 100 символов) |
| **description** | Шаблон ниже |
| **link** | `https://{SITE_DOMAIN}/p/{slug}/?utm_source=pinterest&utm_medium=pin&utm_campaign={board_key}` |
| **image_url** | `https://{SUPABASE_PUBLIC_URL}/storage/v1/object/public/prompt-images/{storage_path}` |
| **board_id** | Из `pickBoard(seo_tags, boardMap, fallbackBoardId)` |

### Шаблон description

```
{title_en}. Ready-to-use AI photo prompt — copy and paste into ChatGPT or Gemini.

"{первые 150 символов prompt_text_en}..."

Get this prompt and 6000+ more → {link}
```

Без хештегов (Pinterest их не индексирует с 2021).

### Трекинг публикации

```sql
CREATE TABLE IF NOT EXISTS card_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_id text,
  board_id text,
  status text NOT NULL DEFAULT 'pending',
  published_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, platform)
);

CREATE INDEX idx_card_distributions_card_platform
  ON card_distributions(card_id, platform);
CREATE INDEX idx_card_distributions_status
  ON card_distributions(status) WHERE status = 'failed';
```

### Обработка ошибок

- **429 (rate limit):** sleep 60 сек, retry до 3 раз
- **5xx:** пропустить карточку, записать `status = 'failed'`, `error_message`
- **Повторный запуск:** UNIQUE(card_id, platform) предотвращает дубли

---

## Стратегия постинга

### Разогрев (новый аккаунт)

| Неделя | Пинов/день | Запуск |
|--------|-----------|--------|
| 1 | 15 | `--limit 15` |
| 2 | 30 | `--limit 30` |
| 3 | 50 | `--limit 50` |
| 4+ | 100 | `--limit 100` |

При 100/день: **~70 дней** на весь бэклог (6965 карточек).

### Распределение по дню

Скрипт выбирает N карточек и публикует с паузой между пинами:

```
pause_ms = Math.floor((14 * 60 * 60 * 1000) / limit)  // 14 часов / N пинов
```

При 100 пинах: пауза ~8.4 минуты между пинами.

### Cron

```
0 8 * * * node /path/to/publish-to-pinterest.mjs --limit 100
```

Запуск в 8:00, публикация растянется до ~22:00.

---

## Настройка Pinterest (ручные шаги)

1. **Бизнес-аккаунт** — создать на pinterest.com/business/create
2. **Claim website** — подтвердить домен лендинга (мета-тег или DNS TXT)
3. **Pinterest Developer App** — создать на developers.pinterest.com
4. **OAuth токен** — scope: `boards:read`, `boards:write`, `pins:read`, `pins:write`
5. **Создать доски** — одноразовый скрипт `create-pinterest-boards.mjs` (из L1 кластеров)
6. **Rich Pins** — пройти валидацию через Pinterest URL Debugger

### Env vars

```
PINTEREST_ACCESS_TOKEN=...
PINTEREST_REFRESH_TOKEN=...
SITE_DOMAIN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Pinterest access token живёт 30 дней. Скрипт при старте проверяет `expires_at` и обновляет через refresh token при необходимости.

---

## Воронка

```
Пин (стилизованное фото)
  → Клик → Лендинг /p/[slug]/?utm_source=pinterest&utm_medium=pin&utm_campaign={board}
    → Просмотр карточки, копирование промта
      → CTA "Попробовать в боте" → Telegram бот
      → Переход на другие карточки → глубина сессии
```

Pinterest не любит прямые ссылки на Telegram — всегда вести на лендинг.

---

## Метрики успеха

| Метрика | Цель (1 мес.) | Цель (3 мес.) |
|---|---|---|
| Impressions | 50K | 500K |
| Saves | 500 | 5K |
| Клики на сайт | 200 | 2K |
| CTR | >1% | >2% |
| Топ-пин saves | >50 | >200 |

---

## Фазы

| Фаза | Задача | Статус |
|---|---|---|
| **1. MVP** | Миграции, скрипт создания досок, скрипт публикации, cron | TODO |
| **2. Аналитика** | Pinterest Analytics + UTM в Яндекс.Метрике | — |
| **3. Оптимизация** | A/B заголовков, лучшее время, водяной знак | — |
| **4. Масштаб** | Автопубликация новых карточек, Pinterest Ads | — |

---

## Зависимости

- [x] Лендинг задеплоен и доступен по домену
- [x] OG-теги на страницах `/p/[slug]/` (для Rich Pins)
- [ ] Публичный доступ к картинкам в Supabase Storage — проверить
- [ ] Pinterest Business аккаунт + API токен
- [ ] Миграция: таблица `card_distributions`
- [ ] Миграция: колонка `prompt_clusters.pinterest_board_id`

---

## Что реализовать

1. **Миграция** — таблица `card_distributions` + колонка `prompt_clusters.pinterest_board_id`
2. **Скрипт** `create-pinterest-boards.mjs` (запускается несколько раз):
   - Аргументы: `--min-cards N` (порог карточек для создания доски)
   - Читает L1 кластеры из `prompt_clusters` + каунты из `tag_counts_cache`
   - Пропускает кластеры где `pinterest_board_id` уже заполнен
   - Создаёт доски через Pinterest API (POST /v5/boards)
   - Записывает `pinterest_board_id` обратно в `prompt_clusters`
   - + одна fallback-доска "AI Photo Prompts"
3. **Скрипт** `publish-to-pinterest.mjs` (~150 строк):
   - Аргументы: `--limit N`, `--dry-run`
   - Загружает boardMap из `prompt_clusters`
   - Запрос неопубликованных карточек из Supabase
   - `pickBoard()` по seo_tags + boardMap
   - Создание пина через Pinterest API v5
   - Запись результата в `card_distributions`
   - Пауза между пинами
   - Token refresh при необходимости
4. **Cron** — `0 8 * * *`
