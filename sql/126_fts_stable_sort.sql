-- ============================================================
-- Migration 126: Stable sort for search_cards_text
-- Add source_date DESC, id ASC tiebreaker to prevent
-- non-deterministic ordering among equal relevance scores.
-- ============================================================

CREATE OR REPLACE FUNCTION search_cards_text(
  p_query   text,
  p_limit   int DEFAULT 20,
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

  -- Phase 1: Full-text search
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

  -- Phase 2: Trigram fallback when FTS yields nothing
  IF v_count = 0 AND length(trim(p_query)) >= 2 THEN
    RETURN QUERY
    SELECT
      c.id,
      c.slug,
      c.title_ru,
      c.title_en,
      c.seo_tags,
      (similarity(c.title_ru, p_query) * 1000)::int AS relevance_score,
      'trgm'::text AS match_type
    FROM prompt_cards c
    WHERE c.is_published = true
      AND similarity(c.title_ru, p_query) > 0.15
      AND EXISTS (
        SELECT 1 FROM prompt_card_media m
        WHERE m.card_id = c.id AND m.media_type = 'photo'
      )
    ORDER BY similarity(c.title_ru, p_query) DESC,
             c.seo_readiness_score DESC NULLS LAST,
             c.source_date DESC NULLS LAST,
             c.id ASC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;
