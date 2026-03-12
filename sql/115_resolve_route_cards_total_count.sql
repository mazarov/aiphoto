-- ============================================================
-- Migration 115: add total_count to resolve_route_cards RPC
-- Previously cards_count was the count on the current page.
-- Now total_count = full count of matching cards (before LIMIT).
-- cards_count remains = count on current page.
-- ============================================================

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

  -- Tier A: all dimensions match
  IF v_dim_count > 0 THEN
    WITH base AS (
      SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score, c.source_date,
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
      ORDER BY relevance_score DESC, source_date DESC, id ASC
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

  -- Tier B: at least one dimension matches
  IF v_dim_count > 0 THEN
    WITH base AS (
      SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score, c.source_date,
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
      ORDER BY relevance_score DESC, source_date DESC, id ASC
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

  -- Tier C: broad
  WITH base AS (
    SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score, c.source_date,
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
    ORDER BY relevance_score DESC, source_date DESC, id ASC
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
