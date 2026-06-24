-- ============================================================
-- Migration 165: cache for get_indexable_tag_combos
-- Moves heavy self-join off the L1 category SSR hot path into a
-- pre-computed table refreshed by pg_cron (see comments below).
-- Public RPC signature and response shape are unchanged.
-- ============================================================

CREATE TABLE IF NOT EXISTS indexable_tag_combos_cache (
  site_lang   text        NOT NULL,
  dim1        text        NOT NULL,
  slug1       text        NOT NULL,
  dim2        text        NOT NULL,
  slug2       text        NOT NULL,
  cards_count bigint      NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_lang, dim1, slug1, dim2, slug2)
);

CREATE INDEX IF NOT EXISTS idx_indexable_combos_read
  ON indexable_tag_combos_cache (site_lang, cards_count DESC);

-- Internal compute (no min_cards threshold — applied on read)
CREATE OR REPLACE FUNCTION compute_indexable_tag_combos_for_lang(p_site_lang text)
RETURNS TABLE (
  dim1 text,
  slug1 text,
  dim2 text,
  slug2 text,
  cards_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH card_tags AS (
    SELECT
      c.id,
      d.dim,
      d.tag_val
    FROM prompt_cards c
    CROSS JOIN LATERAL (
      SELECT 'audience_tag' AS dim, t.value AS tag_val
      FROM jsonb_array_elements_text(c.seo_tags->'audience_tag') t
      UNION ALL
      SELECT 'style_tag', t.value
      FROM jsonb_array_elements_text(c.seo_tags->'style_tag') t
      UNION ALL
      SELECT 'occasion_tag', t.value
      FROM jsonb_array_elements_text(c.seo_tags->'occasion_tag') t
      UNION ALL
      SELECT 'object_tag', t.value
      FROM jsonb_array_elements_text(c.seo_tags->'object_tag') t
      UNION ALL
      SELECT 'doc_task_tag', t.value
      FROM jsonb_array_elements_text(c.seo_tags->'doc_task_tag') t
    ) d
    WHERE c.is_published = true
      AND EXISTS (
        SELECT 1 FROM prompt_card_media m
        WHERE m.card_id = c.id AND m.media_type = 'photo'
      )
      AND (
        (p_site_lang = 'ru' AND EXISTS (
          SELECT 1 FROM prompt_variants v
          WHERE v.card_id = c.id
            AND v.prompt_text_ru IS NOT NULL
            AND v.prompt_text_ru != ''
        ))
        OR
        (p_site_lang = 'en' AND EXISTS (
          SELECT 1 FROM prompt_variants v
          WHERE v.card_id = c.id
            AND v.prompt_text_en IS NOT NULL
            AND v.prompt_text_en != ''
        ))
      )
  )
  SELECT
    t1.dim AS dim1,
    t1.tag_val AS slug1,
    t2.dim AS dim2,
    t2.tag_val AS slug2,
    COUNT(DISTINCT t1.id) AS cards_count
  FROM card_tags t1
  JOIN card_tags t2
    ON t1.id = t2.id
    AND t1.dim < t2.dim
  GROUP BY t1.dim, t1.tag_val, t2.dim, t2.tag_val;
$$;

CREATE OR REPLACE FUNCTION refresh_indexable_tag_combos()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM indexable_tag_combos_cache;

  INSERT INTO indexable_tag_combos_cache (
    site_lang, dim1, slug1, dim2, slug2, cards_count, updated_at
  )
  SELECT
    lang.l,
    c.dim1,
    c.slug1,
    c.dim2,
    c.slug2,
    c.cards_count,
    now()
  FROM (VALUES ('ru'), ('en')) AS lang(l)
  CROSS JOIN LATERAL compute_indexable_tag_combos_for_lang(lang.l) c;
END;
$$;

COMMENT ON FUNCTION refresh_indexable_tag_combos() IS
  'Rebuild indexable_tag_combos_cache for ru/en. Schedule via pg_cron every 30 min.';

-- Public RPC: fast read from cache (signature unchanged from migration 125)
CREATE OR REPLACE FUNCTION get_indexable_tag_combos(
  p_min_cards int DEFAULT 6,
  p_site_lang text DEFAULT 'ru'
)
RETURNS TABLE (
  dim1 text,
  slug1 text,
  dim2 text,
  slug2 text,
  cards_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT dim1, slug1, dim2, slug2, cards_count
  FROM indexable_tag_combos_cache
  WHERE site_lang = p_site_lang
    AND cards_count >= p_min_cards
  ORDER BY cards_count DESC;
$$;

-- Initial population
SELECT refresh_indexable_tag_combos();

-- To schedule automatic refresh, enable pg_cron in Supabase Dashboard
-- (Database → Extensions → pg_cron) then run:
-- SELECT cron.schedule('refresh-indexable-tag-combos', '*/30 * * * *',
--   'SELECT refresh_indexable_tag_combos()');
