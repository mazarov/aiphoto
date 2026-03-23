-- ============================================================
-- Migration 154: prompt_cards.view_count + list sort by views only
-- Product decision: grid/homepage/filtered listing order = view_count DESC,
-- tie-break source_date DESC, id ASC (no relevance_score / SEO score in sort).
-- ============================================================

ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_prompt_cards_published_view_count
  ON prompt_cards (is_published, view_count DESC, source_date DESC NULLS LAST)
  WHERE is_published = true;

-- ── resolve_route_cards: same tiers, sort by view_count only ──
CREATE OR REPLACE FUNCTION resolve_route_cards(
  p_audience_tag text DEFAULT NULL,
  p_style_tag text DEFAULT NULL,
  p_occasion_tag text DEFAULT NULL,
  p_object_tag text DEFAULT NULL,
  p_doc_task_tag text DEFAULT NULL,
  p_site_lang text DEFAULT 'ru',
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_min_cards int DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_dim_count int;
  v_tier text;
  v_cards jsonb;
  v_count int;
  v_total int;
  v_has_minimum boolean;
BEGIN
  v_dim_count := 0;
  IF p_audience_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_style_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_occasion_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_object_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_doc_task_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;

  IF v_dim_count > 0 THEN
    WITH base AS (
      SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score, c.source_date,
        COALESCE(c.view_count, 0) AS view_count,
        (CASE WHEN p_audience_tag IS NOT NULL AND (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag) THEN 30 ELSE 0 END) +
        (CASE WHEN p_occasion_tag IS NOT NULL AND (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag) THEN 20 ELSE 0 END) +
        (CASE WHEN p_style_tag IS NOT NULL AND (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag) THEN 15 ELSE 0 END) +
        (CASE WHEN p_object_tag IS NOT NULL AND (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag) THEN 15 ELSE 0 END) +
        (CASE WHEN p_doc_task_tag IS NOT NULL AND (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag) THEN 15 ELSE 0 END) +
        COALESCE(c.seo_readiness_score, 0) AS relevance_score
      FROM prompt_cards c
      WHERE c.is_published = true
        AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
        AND (
          (p_site_lang = 'ru' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''))
          OR
          (p_site_lang = 'en' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_en IS NOT NULL AND v.prompt_text_en != ''))
        )
        AND (p_audience_tag IS NULL OR (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag))
        AND (p_style_tag IS NULL OR (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag))
        AND (p_occasion_tag IS NULL OR (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag))
        AND (p_object_tag IS NULL OR (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag))
        AND (p_doc_task_tag IS NULL OR (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag))
    ),
    total AS (
      SELECT COUNT(*)::int AS cnt FROM base
    ),
    ranked AS (
      SELECT id, slug, title_ru, title_en, seo_tags, relevance_score
      FROM base
      ORDER BY view_count DESC, source_date DESC NULLS LAST, id ASC
      LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_agg(row_to_json(r)::jsonb), COUNT(*)::int, (SELECT cnt FROM total)
    INTO v_cards, v_count, v_total
    FROM ranked r;

    IF COALESCE(v_total, 0) >= p_min_cards THEN
      v_tier := 'A';
      v_has_minimum := true;
      RETURN jsonb_build_object(
        'cards', COALESCE(v_cards, '[]'::jsonb),
        'tier_used', v_tier,
        'cards_count', COALESCE(v_count, 0),
        'total_count', COALESCE(v_total, 0),
        'has_minimum', v_has_minimum,
        'dimension_count', v_dim_count
      );
    END IF;
  END IF;

  IF v_dim_count > 0 THEN
    WITH base AS (
      SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score, c.source_date,
        COALESCE(c.view_count, 0) AS view_count,
        (CASE WHEN p_audience_tag IS NOT NULL AND (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag) THEN 30 ELSE 0 END) +
        (CASE WHEN p_occasion_tag IS NOT NULL AND (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag) THEN 20 ELSE 0 END) +
        (CASE WHEN p_style_tag IS NOT NULL AND (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag) THEN 15 ELSE 0 END) +
        (CASE WHEN p_object_tag IS NOT NULL AND (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag) THEN 15 ELSE 0 END) +
        (CASE WHEN p_doc_task_tag IS NOT NULL AND (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag) THEN 15 ELSE 0 END) +
        COALESCE(c.seo_readiness_score, 0) AS relevance_score
      FROM prompt_cards c
      WHERE c.is_published = true
        AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
        AND (
          (p_site_lang = 'ru' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''))
          OR
          (p_site_lang = 'en' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_en IS NOT NULL AND v.prompt_text_en != ''))
        )
        AND (
          (p_audience_tag IS NOT NULL AND (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag))
          OR (p_style_tag IS NOT NULL AND (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag))
          OR (p_occasion_tag IS NOT NULL AND (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag))
          OR (p_object_tag IS NOT NULL AND (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag))
          OR (p_doc_task_tag IS NOT NULL AND (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag))
        )
    ),
    total AS (
      SELECT COUNT(*)::int AS cnt FROM base
    ),
    ranked AS (
      SELECT id, slug, title_ru, title_en, seo_tags, relevance_score
      FROM base
      ORDER BY view_count DESC, source_date DESC NULLS LAST, id ASC
      LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_agg(row_to_json(r)::jsonb), COUNT(*)::int, (SELECT cnt FROM total)
    INTO v_cards, v_count, v_total
    FROM ranked r;

    IF COALESCE(v_total, 0) >= p_min_cards THEN
      v_tier := 'B';
      v_has_minimum := true;
      RETURN jsonb_build_object(
        'cards', COALESCE(v_cards, '[]'::jsonb),
        'tier_used', v_tier,
        'cards_count', COALESCE(v_count, 0),
        'total_count', COALESCE(v_total, 0),
        'has_minimum', v_has_minimum,
        'dimension_count', v_dim_count
      );
    END IF;
  END IF;

  WITH base AS (
    SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score, c.source_date,
      COALESCE(c.view_count, 0) AS view_count,
      (CASE WHEN p_audience_tag IS NOT NULL AND (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag) THEN 30 ELSE 0 END) +
      (CASE WHEN p_occasion_tag IS NOT NULL AND (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag) THEN 20 ELSE 0 END) +
      (CASE WHEN p_style_tag IS NOT NULL AND (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag) THEN 15 ELSE 0 END) +
      (CASE WHEN p_object_tag IS NOT NULL AND (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag) THEN 15 ELSE 0 END) +
      (CASE WHEN p_doc_task_tag IS NOT NULL AND (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag) THEN 15 ELSE 0 END) +
      COALESCE(c.seo_readiness_score, 0) AS relevance_score
    FROM prompt_cards c
    WHERE c.is_published = true
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND (
        (p_site_lang = 'ru' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''))
        OR
        (p_site_lang = 'en' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_en IS NOT NULL AND v.prompt_text_en != ''))
      )
      AND (
        v_dim_count = 0
        OR (p_audience_tag IS NOT NULL AND (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag))
        OR (p_style_tag IS NOT NULL AND (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag))
        OR (p_occasion_tag IS NOT NULL AND (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag))
        OR (p_object_tag IS NOT NULL AND (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag))
        OR (p_doc_task_tag IS NOT NULL AND (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag))
      )
  ),
  total AS (
    SELECT COUNT(*)::int AS cnt FROM base
  ),
  ranked AS (
    SELECT id, slug, title_ru, title_en, seo_tags, relevance_score
    FROM base
    ORDER BY view_count DESC, source_date DESC NULLS LAST, id ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(row_to_json(r)::jsonb), COUNT(*)::int, (SELECT cnt FROM total)
  INTO v_cards, v_count, v_total
  FROM ranked r;

  v_tier := 'C';
  v_has_minimum := (COALESCE(v_total, 0) >= p_min_cards);

  RETURN jsonb_build_object(
    'cards', COALESCE(v_cards, '[]'::jsonb),
    'tier_used', v_tier,
    'cards_count', COALESCE(v_count, 0),
    'total_count', COALESCE(v_total, 0),
    'has_minimum', v_has_minimum,
    'dimension_count', v_dim_count
  );
END;
$$;

-- ── search_cards_filtered: sort by views ──
CREATE OR REPLACE FUNCTION search_cards_filtered(
  p_has_warnings text DEFAULT 'all',
  p_score_min int DEFAULT 0,
  p_score_max int DEFAULT 100,
  p_has_ru_prompt text DEFAULT 'all',
  p_seo_tag text DEFAULT NULL,
  p_has_before text DEFAULT 'all',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_dataset text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  title_ru text,
  title_en text,
  seo_tags jsonb,
  relevance_score int
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    COALESCE(c.seo_readiness_score, 0)::int AS relevance_score
  FROM prompt_cards c
  WHERE c.is_published = true
    AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
    AND (p_has_warnings = 'all'
         OR (p_has_warnings = 'yes' AND jsonb_array_length(COALESCE(c.parse_warnings, '[]'::jsonb)) > 0)
         OR (p_has_warnings = 'no' AND jsonb_array_length(COALESCE(c.parse_warnings, '[]'::jsonb)) = 0))
    AND COALESCE(c.seo_readiness_score, 0) >= p_score_min
    AND COALESCE(c.seo_readiness_score, 0) <= p_score_max
    AND (p_has_ru_prompt = 'all'
         OR (p_has_ru_prompt = 'yes' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''))
         OR (p_has_ru_prompt = 'no' AND NOT EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != '')))
    AND (p_seo_tag IS NULL OR p_seo_tag = ''
         OR (c.seo_tags->'audience_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'style_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'object_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_seo_tag))
    AND (p_has_before = 'all' OR (p_has_before = 'yes' AND EXISTS (SELECT 1 FROM prompt_card_before_media b WHERE b.card_id = c.id)))
    AND (p_dataset IS NULL OR p_dataset = '' OR c.source_dataset_slug = p_dataset)
  ORDER BY c.view_count DESC NULLS LAST, c.source_date DESC NULLS LAST, c.id ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ── get_homepage_sections: top cards per tag by views ──
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
      SELECT c.id, c.seo_tags, c.source_date, COALESCE(c.view_count, 0) AS view_count
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
      SELECT 'audience_tag' AS dimension, t.value AS slug, e.id AS card_id, e.source_date, e.view_count
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'audience_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'style_tag', t.value, e.id, e.source_date, e.view_count
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'style_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'occasion_tag', t.value, e.id, e.source_date, e.view_count
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'occasion_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'object_tag', t.value, e.id, e.source_date, e.view_count
      FROM eligible e, jsonb_array_elements_text(COALESCE(e.seo_tags->'object_tag', '[]'::jsonb)) AS t(value)
      UNION ALL
      SELECT 'doc_task_tag', t.value, e.id, e.source_date, e.view_count
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
                 ORDER BY view_count DESC, source_date DESC NULLS LAST, card_id DESC
               ) AS rn
        FROM (SELECT DISTINCT dimension, slug, card_id, source_date, view_count FROM tags_unnested) AS deduped
      ) ranked
      WHERE rn <= 5
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
