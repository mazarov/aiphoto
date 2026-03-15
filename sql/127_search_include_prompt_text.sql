-- ============================================================
-- Migration 127: Search — include prompt_text_ru in trigram fallback,
-- increase default limit, re-backfill FTS vectors.
-- ============================================================

-- 1. Improved search RPC: trigram fallback now also searches prompt_text_ru
CREATE OR REPLACE FUNCTION search_cards_text(
  p_query   text,
  p_limit   int DEFAULT 24,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  slug            text,
  title_ru        text,
  title_en        text,
  seo_tags        jsonb,
  relevance_score int,
  match_type      text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tsquery tsquery;
  v_count   int;
BEGIN
  v_tsquery := plainto_tsquery('russian', p_query);

  -- Phase 1: Full-text search (title_ru weight A + prompt_text_ru weight B)
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    (ts_rank(c.fts, v_tsquery) * 1000 + COALESCE(c.seo_readiness_score, 0))::int AS relevance_score,
    'fts'::text AS match_type
  FROM prompt_cards c
  WHERE c.is_published = true
    AND c.fts @@ v_tsquery
    AND EXISTS (
      SELECT 1 FROM prompt_card_media m
      WHERE m.card_id = c.id AND m.media_type = 'photo'
    )
  ORDER BY ts_rank(c.fts, v_tsquery) DESC,
           c.seo_readiness_score DESC NULLS LAST,
           c.source_date DESC NULLS LAST,
           c.id ASC
  LIMIT p_limit
  OFFSET p_offset;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Phase 2: Trigram fallback — search title_ru AND prompt_text_ru
  IF v_count = 0 AND length(trim(p_query)) >= 2 THEN
    RETURN QUERY
    SELECT
      c.id,
      c.slug,
      c.title_ru,
      c.title_en,
      c.seo_tags,
      (GREATEST(
        similarity(c.title_ru, p_query),
        COALESCE(sub.max_prompt_sim, 0)
      ) * 1000)::int AS relevance_score,
      'trgm'::text AS match_type
    FROM prompt_cards c
    LEFT JOIN LATERAL (
      SELECT MAX(similarity(v.prompt_text_ru, p_query)) AS max_prompt_sim
      FROM prompt_variants v
      WHERE v.card_id = c.id
        AND v.prompt_text_ru IS NOT NULL
    ) sub ON true
    WHERE c.is_published = true
      AND (
        similarity(c.title_ru, p_query) > 0.15
        OR COALESCE(sub.max_prompt_sim, 0) > 0.15
      )
      AND EXISTS (
        SELECT 1 FROM prompt_card_media m
        WHERE m.card_id = c.id AND m.media_type = 'photo'
      )
    ORDER BY GREATEST(similarity(c.title_ru, p_query), COALESCE(sub.max_prompt_sim, 0)) DESC,
             c.seo_readiness_score DESC NULLS LAST,
             c.source_date DESC NULLS LAST,
             c.id ASC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- 2. Re-backfill FTS for all cards (ensures prompt_text_ru is indexed)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM prompt_cards LOOP
    PERFORM rebuild_card_fts(r.id);
  END LOOP;
  RAISE NOTICE 'FTS backfill complete';
END;
$$;
