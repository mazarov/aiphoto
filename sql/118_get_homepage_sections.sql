-- ============================================================
-- Migration 118: RPC get_homepage_sections
-- Returns per-tag counts + 2 most recent photo URLs for homepage.
-- Single query replaces ~80 individual resolve_route_cards calls.
-- ============================================================

CREATE OR REPLACE FUNCTION get_homepage_sections(
  p_site_lang text DEFAULT 'ru'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    WITH eligible AS (
      SELECT c.id, c.seo_tags, c.source_date
      FROM prompt_cards c
      WHERE c.is_published = true
        AND EXISTS (
          SELECT 1 FROM prompt_card_media m
          WHERE m.card_id = c.id AND m.media_type = 'photo'
        )
        AND (
          (p_site_lang = 'ru' AND EXISTS (
            SELECT 1 FROM prompt_variants v
            WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''
          ))
          OR
          (p_site_lang = 'en' AND EXISTS (
            SELECT 1 FROM prompt_variants v
            WHERE v.card_id = c.id AND v.prompt_text_en IS NOT NULL AND v.prompt_text_en != ''
          ))
        )
    ),

    tags_unnested AS (
      SELECT 'audience_tag' AS dimension, t.value AS slug, e.id AS card_id, e.source_date
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'audience_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'style_tag', t.value, e.id, e.source_date
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'style_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'occasion_tag', t.value, e.id, e.source_date
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'occasion_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'object_tag', t.value, e.id, e.source_date
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'object_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'doc_task_tag', t.value, e.id, e.source_date
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'doc_task_tag', '[]'::jsonb)) AS t(value)
    ),

    tag_counts AS (
      SELECT dimension, slug, COUNT(DISTINCT card_id)::int AS total_count
      FROM tags_unnested
      GROUP BY dimension, slug
    ),

    top2_cards AS (
      SELECT dimension, slug, card_id, rn
      FROM (
        SELECT dimension, slug, card_id,
               ROW_NUMBER() OVER (
                 PARTITION BY dimension, slug
                 ORDER BY source_date DESC NULLS LAST, card_id DESC
               ) AS rn
        FROM (SELECT DISTINCT dimension, slug, card_id, source_date FROM tags_unnested) AS deduped
      ) ranked
      WHERE rn <= 2
    ),

    card_photos AS (
      SELECT tc.dimension, tc.slug, tc.rn,
             ph.storage_bucket, ph.storage_path
      FROM top2_cards tc
      CROSS JOIN LATERAL (
        SELECT m.storage_bucket, m.storage_path
        FROM prompt_card_media m
        WHERE m.card_id = tc.card_id AND m.media_type = 'photo'
        ORDER BY m.is_primary DESC, m.media_index ASC
        LIMIT 1
      ) ph
    ),

    result AS (
      SELECT
        tc.dimension,
        tc.slug,
        tc.total_count,
        p1.storage_bucket AS photo_bucket,
        p1.storage_path   AS photo_path,
        p2.storage_bucket  AS second_photo_bucket,
        p2.storage_path    AS second_photo_path
      FROM tag_counts tc
      LEFT JOIN card_photos p1 ON p1.dimension = tc.dimension AND p1.slug = tc.slug AND p1.rn = 1
      LEFT JOIN card_photos p2 ON p2.dimension = tc.dimension AND p2.slug = tc.slug AND p2.rn = 2
      ORDER BY tc.total_count DESC
    )

    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM result r
  );
END;
$$;
