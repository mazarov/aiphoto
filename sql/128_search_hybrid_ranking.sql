-- ============================================================
-- Migration 128: Architectural search fix
-- - Hybrid ranking: FTS + trigram in one result set
-- - Deterministic pagination with stable ordering
-- - Prompt text fuzzy matching with trigram index
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Prompt text fuzzy lookup (ILIKE/% operators) uses this index.
CREATE INDEX IF NOT EXISTS idx_prompt_variants_prompt_text_ru_trgm
  ON prompt_variants USING GIN (prompt_text_ru gin_trgm_ops)
  WHERE prompt_text_ru IS NOT NULL;

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
LANGUAGE sql
STABLE
AS $$
WITH norm AS (
  SELECT trim(coalesce(p_query, '')) AS q
),
base_cards AS (
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    c.seo_readiness_score,
    c.source_date,
    c.fts
  FROM prompt_cards c
  WHERE c.is_published = true
    AND EXISTS (
      SELECT 1
      FROM prompt_card_media m
      WHERE m.card_id = c.id
        AND m.media_type = 'photo'
    )
),
fts_hits AS (
  SELECT
    b.id,
    ts_rank(b.fts, plainto_tsquery('russian', n.q)) AS fts_rank
  FROM base_cards b
  CROSS JOIN norm n
  WHERE n.q <> ''
    AND b.fts @@ plainto_tsquery('russian', n.q)
),
title_hits AS (
  SELECT
    b.id,
    GREATEST(
      similarity(b.title_ru, n.q),
      word_similarity(b.title_ru, n.q),
      CASE WHEN b.title_ru ILIKE '%' || n.q || '%' THEN 0.9 ELSE 0 END
    ) AS title_sim
  FROM base_cards b
  CROSS JOIN norm n
  WHERE n.q <> ''
    AND length(n.q) >= 2
    AND b.title_ru IS NOT NULL
    AND (
      b.title_ru % n.q
      OR b.title_ru ILIKE '%' || n.q || '%'
    )
),
prompt_hits AS (
  SELECT
    v.card_id AS id,
    MAX(
      GREATEST(
        similarity(v.prompt_text_ru, n.q),
        word_similarity(v.prompt_text_ru, n.q),
        CASE WHEN v.prompt_text_ru ILIKE '%' || n.q || '%' THEN 0.9 ELSE 0 END
      )
    ) AS prompt_sim
  FROM prompt_variants v
  JOIN base_cards b ON b.id = v.card_id
  CROSS JOIN norm n
  WHERE n.q <> ''
    AND length(n.q) >= 2
    AND v.prompt_text_ru IS NOT NULL
    AND (
      v.prompt_text_ru % n.q
      OR v.prompt_text_ru ILIKE '%' || n.q || '%'
    )
  GROUP BY v.card_id
),
merged AS (
  SELECT
    b.id,
    b.slug,
    b.title_ru,
    b.title_en,
    b.seo_tags,
    b.seo_readiness_score,
    b.source_date,
    COALESCE(f.fts_rank, 0) AS fts_rank,
    COALESCE(t.title_sim, 0) AS title_sim,
    COALESCE(p.prompt_sim, 0) AS prompt_sim,
    (f.id IS NOT NULL) AS has_fts
  FROM base_cards b
  LEFT JOIN fts_hits f ON f.id = b.id
  LEFT JOIN title_hits t ON t.id = b.id
  LEFT JOIN prompt_hits p ON p.id = b.id
  WHERE f.id IS NOT NULL OR t.id IS NOT NULL OR p.id IS NOT NULL
),
scored AS (
  SELECT
    m.id,
    m.slug,
    m.title_ru,
    m.title_en,
    m.seo_tags,
    (
      m.fts_rank * 1000
      + GREATEST(m.title_sim, m.prompt_sim) * 350
      + COALESCE(m.seo_readiness_score, 0)
    )::int AS relevance_score,
    CASE
      WHEN m.has_fts AND GREATEST(m.title_sim, m.prompt_sim) > 0 THEN 'fts+trgm'
      WHEN m.has_fts THEN 'fts'
      ELSE 'trgm'
    END AS match_type,
    m.has_fts,
    m.source_date
  FROM merged m
)
SELECT
  s.id,
  s.slug,
  s.title_ru,
  s.title_en,
  s.seo_tags,
  s.relevance_score,
  s.match_type
FROM scored s
ORDER BY
  s.has_fts DESC,
  s.relevance_score DESC,
  s.source_date DESC NULLS LAST,
  s.id ASC
LIMIT GREATEST(1, p_limit)
OFFSET GREATEST(0, p_offset);
$$;
