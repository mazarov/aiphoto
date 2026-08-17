# Visual search rollout checklist

Не выполнять без отдельного подтверждения. Код и SQL готовы в `feature/17-08-gemini-visual-search`. `SEARCH_VISUAL_ENABLED` по умолчанию выключен.

## Test

1. Включить extension `vector` в Supabase test.
2. Применить `sql/192_prompt_card_visual_embeddings.sql`.
3. Проверить `visual_embedding_coverage()`, RLS и `EXPLAIN ANALYZE` для `search_cards_visual`.
4. DO dry-run:

```bash
curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/backfill-card-image-embeddings.mjs
nohup node backfill-card-image-embeddings.mjs --dry-run --limit 20 > backfill-card-image-embeddings.log 2>&1 &
ps aux | grep backfill-card-image-embeddings
tail -f backfill-card-image-embeddings.log
```

5. Backfill 100–500, затем полный. Сравнить eval-набор из `landing/src/lib/visual-search-eval.ts`.
6. Включить `SEARCH_VISUAL_ENABLED=1` только на test landing.
7. Смотреть `[search:fallback]`, latency и coverage. Rollback: `SEARCH_VISUAL_ENABLED=0`.

## Production

Только после test eval без деградации exact-title/опечаток и coverage ≥ 95%.
