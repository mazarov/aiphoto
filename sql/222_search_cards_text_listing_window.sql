-- Raise search_cards_text window so birthday listing hybrid can materialize 500.
-- Public /api/search still requests TEXT_SEARCH_MAX_WINDOW (100) in JS.

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
SET search_path = public
AS $$
WITH raw_norm AS (
  SELECT left(btrim(coalesce(p_query, '')), 160) AS q
),
norm AS (
  SELECT
    r.q,
    plainto_tsquery('russian', r.q) AS tsq,
    replace(
      replace(
        replace(r.q, E'\\', E'\\\\'),
        '%',
        E'\\%'
      ),
      '_',
      E'\\_'
    ) AS like_q
  FROM raw_norm r
),
fts_hits AS (
  SELECT
    c.id,
    ts_rank(c.fts, n.tsq) AS fts_rank
  FROM prompt_cards c
  CROSS JOIN norm n
  WHERE n.q <> ''
    AND c.is_published = true
    AND c.fts @@ n.tsq
),
title_hits AS (
  SELECT
    c.id,
    GREATEST(
      similarity(c.title_ru, n.q),
      word_similarity(n.q, c.title_ru),
      CASE
        WHEN c.title_ru ILIKE ('%' || n.like_q || '%') ESCAPE E'\\' THEN 0.9
        ELSE 0
      END
    ) AS title_sim
  FROM prompt_cards c
  CROSS JOIN norm n
  WHERE length(n.q) >= 2
    AND c.is_published = true
    AND c.title_ru IS NOT NULL
    AND (
      c.title_ru % n.q
      OR c.title_ru ILIKE ('%' || n.like_q || '%') ESCAPE E'\\'
    )
),
candidate_scores AS (
  SELECT
    f.id,
    f.fts_rank,
    0::real AS title_sim,
    true AS has_fts
  FROM fts_hits f

  UNION ALL

  SELECT
    t.id,
    0::real AS fts_rank,
    t.title_sim,
    false AS has_fts
  FROM title_hits t
),
merged AS (
  SELECT
    cs.id,
    max(cs.fts_rank) AS fts_rank,
    max(cs.title_sim) AS title_sim,
    bool_or(cs.has_fts) AS has_fts
  FROM candidate_scores cs
  GROUP BY cs.id
),
scored AS (
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    (
      m.fts_rank * 1000
      + m.title_sim * 350
      + coalesce(c.seo_readiness_score, 0)
    )::int AS relevance_score,
    CASE
      WHEN m.has_fts AND m.title_sim > 0 THEN 'fts+trgm'
      WHEN m.has_fts THEN 'fts'
      ELSE 'trgm'
    END AS match_type,
    m.has_fts,
    c.source_date
  FROM merged m
  JOIN prompt_cards c ON c.id = m.id
  WHERE EXISTS (
    SELECT 1
    FROM prompt_card_media media
    WHERE media.card_id = c.id
      AND media.media_type = 'photo'
  )
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
LIMIT least(500, greatest(1, p_limit))
OFFSET greatest(0, p_offset);
$$;

CREATE OR REPLACE FUNCTION public.search_cards_text(
  p_query text,
  p_limit int,
  p_offset int,
  p_audience_tag text,
  p_style_tag text,
  p_occasion_tag text,
  p_object_tag text
)
RETURNS TABLE (
  id uuid,
  slug text,
  title_ru text,
  title_en text,
  seo_tags jsonb,
  relevance_score int,
  match_type text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH raw_norm AS (
  SELECT left(btrim(coalesce(p_query, '')), 160) AS q
),
norm AS (
  SELECT
    r.q,
    plainto_tsquery('russian', r.q) AS tsq,
    replace(
      replace(
        replace(r.q, E'\\', E'\\\\'),
        '%',
        E'\\%'
      ),
      '_',
      E'\\_'
    ) AS like_q
  FROM raw_norm r
),
fts_hits AS (
  SELECT
    c.id,
    ts_rank(c.fts, n.tsq) AS fts_rank
  FROM public.prompt_cards c
  CROSS JOIN norm n
  WHERE n.q <> ''
    AND c.is_published = true
    AND (p_audience_tag IS NULL OR coalesce(c.seo_tags -> 'audience_tag', '[]'::jsonb) ? p_audience_tag)
    AND (p_style_tag IS NULL OR coalesce(c.seo_tags -> 'style_tag', '[]'::jsonb) ? p_style_tag)
    AND (p_occasion_tag IS NULL OR coalesce(c.seo_tags -> 'occasion_tag', '[]'::jsonb) ? p_occasion_tag)
    AND (p_object_tag IS NULL OR coalesce(c.seo_tags -> 'object_tag', '[]'::jsonb) ? p_object_tag)
    AND c.fts @@ n.tsq
),
title_hits AS (
  SELECT
    c.id,
    GREATEST(
      similarity(c.title_ru, n.q),
      word_similarity(n.q, c.title_ru),
      CASE
        WHEN c.title_ru ILIKE ('%' || n.like_q || '%') ESCAPE E'\\' THEN 0.9
        ELSE 0
      END
    ) AS title_sim
  FROM public.prompt_cards c
  CROSS JOIN norm n
  WHERE length(n.q) >= 2
    AND c.is_published = true
    AND (p_audience_tag IS NULL OR coalesce(c.seo_tags -> 'audience_tag', '[]'::jsonb) ? p_audience_tag)
    AND (p_style_tag IS NULL OR coalesce(c.seo_tags -> 'style_tag', '[]'::jsonb) ? p_style_tag)
    AND (p_occasion_tag IS NULL OR coalesce(c.seo_tags -> 'occasion_tag', '[]'::jsonb) ? p_occasion_tag)
    AND (p_object_tag IS NULL OR coalesce(c.seo_tags -> 'object_tag', '[]'::jsonb) ? p_object_tag)
    AND c.title_ru IS NOT NULL
    AND (
      c.title_ru % n.q
      OR c.title_ru ILIKE ('%' || n.like_q || '%') ESCAPE E'\\'
    )
),
candidate_scores AS (
  SELECT
    f.id,
    f.fts_rank,
    0::real AS title_sim,
    true AS has_fts
  FROM fts_hits f

  UNION ALL

  SELECT
    t.id,
    0::real AS fts_rank,
    t.title_sim,
    false AS has_fts
  FROM title_hits t
),
merged AS (
  SELECT
    cs.id,
    max(cs.fts_rank) AS fts_rank,
    max(cs.title_sim) AS title_sim,
    bool_or(cs.has_fts) AS has_fts
  FROM candidate_scores cs
  GROUP BY cs.id
),
scored AS (
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    (
      m.fts_rank * 1000
      + m.title_sim * 350
      + coalesce(c.seo_readiness_score, 0)
    )::int AS relevance_score,
    CASE
      WHEN m.has_fts AND m.title_sim > 0 THEN 'fts+trgm'
      WHEN m.has_fts THEN 'fts'
      ELSE 'trgm'
    END AS match_type,
    m.has_fts,
    c.source_date
  FROM merged m
  JOIN public.prompt_cards c ON c.id = m.id
  WHERE EXISTS (
    SELECT 1
    FROM public.prompt_card_media media
    WHERE media.card_id = c.id
      AND media.media_type = 'photo'
  )
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
LIMIT least(500, greatest(1, p_limit))
OFFSET greatest(0, p_offset);
$$;

REVOKE ALL ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text) IS
  'Text search with SEO-dimension filters. Window cap 500 for listing hybrid materialize.';
