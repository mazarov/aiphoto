-- ============================================================
-- RPC: get_indexable_tag_combos
-- Returns pairs of tags from different dimensions where
-- the number of published cards matching BOTH tags >= threshold.
-- Used by sitemap.ts to include only indexable L2 URLs.
-- ============================================================

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
  GROUP BY t1.dim, t1.tag_val, t2.dim, t2.tag_val
  HAVING COUNT(DISTINCT t1.id) >= p_min_cards
  ORDER BY cards_count DESC;
$$;

-- Test:
-- SELECT * FROM get_indexable_tag_combos(6, 'ru') LIMIT 20;
