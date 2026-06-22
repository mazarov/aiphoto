-- ============================================================
-- Migration 164: get_homepage_sections — order cards by popularity
--
-- Homepage category blocks previously ordered cards by source_date DESC,
-- which never matched the listing (resolve_route_cards, sort=popular). Now the
-- per-tag top cards use the SAME query-time popularity score as the listing
-- (migration 163), so the top card of a tag = card #1 of that category listing.
--
-- Cross-category cover deduplication is done in the app layer
-- (buildCategorySectionBlocks / pickDeduplicatedPhotos): the same popular card
-- is #1 in many tags at once, so each block takes the first not-yet-used card.
-- We return the top-10 per tag (was 5) to give that dedup enough headroom.
-- ============================================================

CREATE OR REPLACE FUNCTION get_homepage_sections(
  p_site_lang text DEFAULT 'ru'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_react_weight double precision := get_listing_popularity_react_weight();
  v_half_life_days double precision := get_listing_popularity_half_life_days();
  v_decay_exponent double precision := get_listing_popularity_decay_exponent();
BEGIN
  RETURN (
    WITH eligible AS (
      SELECT c.id, c.seo_tags,
        c.created_at,
        (
          (c.view_count + v_react_weight * (c.likes_count - c.dislikes_count))::double precision
          / POWER(
              1 + GREATEST(EXTRACT(EPOCH FROM (now() - c.created_at)), 0) / 86400.0 / v_half_life_days,
              v_decay_exponent
            )
        ) AS popularity_score
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
      SELECT 'audience_tag' AS dimension, t.value AS slug, e.id AS card_id, e.created_at, e.popularity_score
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'audience_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'style_tag', t.value, e.id, e.created_at, e.popularity_score
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'style_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'occasion_tag', t.value, e.id, e.created_at, e.popularity_score
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'occasion_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'object_tag', t.value, e.id, e.created_at, e.popularity_score
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'object_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'doc_task_tag', t.value, e.id, e.created_at, e.popularity_score
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'doc_task_tag', '[]'::jsonb)) AS t(value)
    ),

    tag_counts AS (
      SELECT dimension, slug, COUNT(DISTINCT card_id)::int AS total_count
      FROM tags_unnested
      GROUP BY dimension, slug
    ),

    top5_cards AS (
      SELECT dimension, slug, card_id, rn
      FROM (
        SELECT dimension, slug, card_id,
               ROW_NUMBER() OVER (
                 PARTITION BY dimension, slug
                 ORDER BY popularity_score DESC NULLS LAST, created_at DESC, card_id DESC
               ) AS rn
        FROM (SELECT DISTINCT dimension, slug, card_id, created_at, popularity_score FROM tags_unnested) AS deduped
      ) ranked
      WHERE rn <= 10
    ),

    card_photos AS (
      SELECT tc.dimension, tc.slug, tc.card_id, tc.rn,
             ph.storage_bucket, ph.storage_path
      FROM top5_cards tc
      CROSS JOIN LATERAL (
        SELECT m.storage_bucket, m.storage_path
        FROM prompt_card_media m
        WHERE m.card_id = tc.card_id AND m.media_type = 'photo'
        ORDER BY m.is_primary DESC, m.media_index ASC
        LIMIT 1
      ) ph
    ),

    cards_agg AS (
      SELECT dimension, slug,
             jsonb_agg(
               jsonb_build_object(
                 'card_id', card_id,
                 'storage_bucket', storage_bucket,
                 'storage_path', storage_path
               ) ORDER BY rn
             ) AS cards
      FROM card_photos
      GROUP BY dimension, slug
    ),

    result AS (
      SELECT
        tc.dimension,
        tc.slug,
        tc.total_count,
        COALESCE(ca.cards, '[]'::jsonb) AS cards
      FROM tag_counts tc
      LEFT JOIN cards_agg ca ON ca.dimension = tc.dimension AND ca.slug = tc.slug
      ORDER BY tc.total_count DESC
    )

    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM result r
  );
END;
$$;

COMMENT ON FUNCTION get_homepage_sections(text) IS
  'Homepage category blocks: top-10 cards per tag ordered by query-time popularity score (matches resolve_route_cards sort=popular). Cross-block cover dedup is done in the app layer.';
