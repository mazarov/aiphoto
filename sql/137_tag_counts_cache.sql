-- ============================================================
-- Materialized tag counts cache for sidebar menu badges
-- Replaces 80+ individual resolve_route_cards RPC calls with
-- a single fast SELECT from a pre-computed table.
-- ============================================================

-- 1. Cache table
CREATE TABLE IF NOT EXISTS tag_counts_cache (
  dimension  TEXT NOT NULL,
  tag_slug   TEXT NOT NULL,
  count      INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dimension, tag_slug)
);

-- 2. Refresh function — recalculates all counts in one pass
CREATE OR REPLACE FUNCTION refresh_tag_counts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Truncate and repopulate in one transaction
  DELETE FROM tag_counts_cache;

  INSERT INTO tag_counts_cache (dimension, tag_slug, count, updated_at)
  SELECT dim, tag_val, cnt, now()
  FROM (
    SELECT 'audience_tag' AS dim, t.value AS tag_val, COUNT(DISTINCT c.id) AS cnt
    FROM prompt_cards c
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'audience_tag', '[]'::jsonb)) t
    WHERE c.is_published = true
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != '')
    GROUP BY t.value

    UNION ALL

    SELECT 'style_tag', t.value, COUNT(DISTINCT c.id)
    FROM prompt_cards c
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'style_tag', '[]'::jsonb)) t
    WHERE c.is_published = true
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != '')
    GROUP BY t.value

    UNION ALL

    SELECT 'occasion_tag', t.value, COUNT(DISTINCT c.id)
    FROM prompt_cards c
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'occasion_tag', '[]'::jsonb)) t
    WHERE c.is_published = true
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != '')
    GROUP BY t.value

    UNION ALL

    SELECT 'object_tag', t.value, COUNT(DISTINCT c.id)
    FROM prompt_cards c
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'object_tag', '[]'::jsonb)) t
    WHERE c.is_published = true
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != '')
    GROUP BY t.value
  ) sub
  WHERE tag_val IS NOT NULL AND tag_val != '';
END;
$$;

-- 3. RPC to read cached counts (single fast SELECT)
CREATE OR REPLACE FUNCTION get_tag_counts_cache()
RETURNS TABLE (dimension text, tag_slug text, count int)
LANGUAGE sql
STABLE
AS $$
  SELECT dimension, tag_slug, count
  FROM tag_counts_cache;
$$;

-- 4. Initial population
SELECT refresh_tag_counts();

-- 5. To schedule automatic refresh, enable pg_cron in Supabase Dashboard
--    (Database → Extensions → pg_cron) then run:
--    SELECT cron.schedule('refresh-tag-counts', '*/15 * * * *', 'SELECT refresh_tag_counts()');
--
--    Alternatively, call refresh_tag_counts() from an external cron/scheduler.
