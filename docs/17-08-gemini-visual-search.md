# 17-08 — Гибридный поиск Gemini Embedding 2

V1: текстовый запрос → визуально релевантные карточки вместе с текущим FTS/trigram.
Загрузка изображения и кнопка «Похожие» не входят.

## Поток

```
GET /api/search
  ├── search_cards_text          (параллельно)
  └── guard → Gemini embed → search_cards_visual
                ↓
        lexical guard + weighted RRF
                ↓
        enrichCardsWithDetails
```

Gemini не критичен: timeout / 429 / 5xx / deny / пустой visual → текущий текстовый поиск.

## Схема

- SQL `192_prompt_card_visual_embeddings.sql`
- `prompt_card_visual_embeddings` — 768-d cosine, одна active generation
- `prompt_card_visual_embedding_jobs` — pending/processing/retry/ready/dead + lease
- `visual_search_rate_limit` — IP и глобальный дневной бюджет
- RPC: `search_cards_visual`, claim/complete/fail, coverage, enqueue

## Env

| Переменная | Default | Назначение |
|---|---|---|
| `SEARCH_VISUAL_ENABLED` | `0` | Включить visual branch |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | Модель |
| `SEARCH_VISUAL_GENERATION` | `1` | Active generation |
| `SEARCH_VISUAL_TIMEOUT_MS` | `800` | Timeout query embed |
| `SEARCH_VISUAL_TASK_PREFIX` | `1` | `task: search result \| query:` |
| `GEMINI_EMBEDDING_USE_PROXY` | `0` | Proxy только после contract test |
| `SEARCH_VISUAL_IP_DAILY_LIMIT` | `60` | Gemini-вызовы на IP/сутки |
| `SEARCH_VISUAL_GLOBAL_DAILY_LIMIT` | `4000` | Глобальный бюджет/сутки |
| `CRON_SECRET` | — | `POST /api/cron/visual-embeddings` |

Размерность 768 зафиксирована в схеме и коде.

## SLO

- search p95 ≤ 1 с, p99 ≤ 1.5 с
- Gemini branch timeout ≤ 800 мс
- coverage ≥ 95% published+photo до включения ranking
- fallback > 20% за 15 мин — стоп-сигнал

## Eval

Набор стартовых запросов: `landing/src/lib/visual-search-eval.ts`.

Перед rollout сравнить baseline FTS и hybrid:

- Recall@20 на visual-запросах
- zero-result rate
- exact-title/опечатки не должны деградировать
- два query format: raw text vs `task: search result | query:` — закрепить победителя до полного backfill

Rollout запрещён, если точные lexical запросы ухудшаются.

## Rollout (только после отдельного подтверждения)

1. Включить `vector` в Supabase (Database → Extensions), применить `sql/192_prompt_card_visual_embeddings.sql` на test.
2. Проверить RLS/GRANT, `EXPLAIN ANALYZE` для `search_cards_visual`, coverage RPC.
3. DO dry-run:

```bash
curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/backfill-card-image-embeddings.mjs
nohup node backfill-card-image-embeddings.mjs --dry-run --limit 20 > backfill-card-image-embeddings.log 2>&1 &
ps aux | grep backfill-card-image-embeddings
tail -f backfill-card-image-embeddings.log
```

4. Ограниченный backfill 100–500, затем полный. Cron лендинга:

`POST /api/cron/visual-embeddings` с `Authorization: Bearer $CRON_SECRET` каждые 5 мин.

5. Включить `SEARCH_VISUAL_ENABLED=1` только на test, затем canary production.
6. Rollback: `SEARCH_VISUAL_ENABLED=0`. Embeddings и jobs не удалять.

Новая generation строится отдельно и становится active только после полного backfill/eval. Для generation ≠ 1 нужен новый partial HNSW index.
