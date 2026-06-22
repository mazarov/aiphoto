-- ============================================================
-- Migration 163: query-time popularity ranking (no cron dependency)
--
-- Replaces the materialized popularity_score (computed by the hourly
-- recalculate_popularity_scores job, which was never running on DO) with a
-- query-time expression in resolve_route_cards based on realtime columns:
--   popularity_score = (view_count + react_weight * (likes_count - dislikes_count))
--                      / (1 + age_days / half_life_days) ^ decay_exponent
--
-- Lifetime view_count is the base signal (always present, never collapses to 0),
-- reactions are a light bonus, age applies a gentle decay (≈30d half-life) so
-- fresh-but-decent cards can surface without burying long-term hits.
--
-- prompt_cards.popularity_score / views_7d columns and
-- recalculate_popularity_scores() / prompt_card_view_events become obsolete for
-- ranking (left in place; cleanup is a separate follow-up).
-- ============================================================

INSERT INTO photo_app_config (key, value, description)
VALUES
  (
    'listing_popularity_react_weight',
    '3.0',
    'Query-time popularity: each net like (likes-dislikes) is worth this many views.'
  ),
  (
    'listing_popularity_half_life_days',
    '30',
    'Query-time popularity: age (days) at which the decay denominator doubles.'
  ),
  (
    'listing_popularity_decay_exponent',
    '1.0',
    'Query-time popularity: decay exponent. Higher = stronger age penalty.'
  )
ON CONFLICT (key) DO NOTHING;

-- ── Config helpers (defaults if row missing) ──

CREATE OR REPLACE FUNCTION get_listing_popularity_react_weight()
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value::double precision FROM photo_app_config WHERE key = 'listing_popularity_react_weight'),
    3.0::double precision
  );
$$;

CREATE OR REPLACE FUNCTION get_listing_popularity_half_life_days()
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(
    COALESCE(
      (SELECT value::double precision FROM photo_app_config WHERE key = 'listing_popularity_half_life_days'),
      30.0::double precision
    ),
    0.001::double precision
  );
$$;

CREATE OR REPLACE FUNCTION get_listing_popularity_decay_exponent()
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value::double precision FROM photo_app_config WHERE key = 'listing_popularity_decay_exponent'),
    1.0::double precision
  );
$$;

-- ── resolve_route_cards: query-time popularity_score ──

CREATE OR REPLACE FUNCTION resolve_route_cards(
  p_audience_tag text DEFAULT NULL,
  p_style_tag text DEFAULT NULL,
  p_occasion_tag text DEFAULT NULL,
  p_object_tag text DEFAULT NULL,
  p_doc_task_tag text DEFAULT NULL,
  p_site_lang text DEFAULT 'ru',
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_min_cards int DEFAULT 2,
  p_sort text DEFAULT 'popular'
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
  v_sort text;
  v_react_weight double precision;
  v_half_life_days double precision;
  v_decay_exponent double precision;
BEGIN
  v_sort := lower(trim(COALESCE(p_sort, 'popular')));
  IF v_sort NOT IN ('popular', 'new') THEN
    RAISE EXCEPTION 'invalid_sort: %', p_sort;
  END IF;

  v_react_weight := get_listing_popularity_react_weight();
  v_half_life_days := get_listing_popularity_half_life_days();
  v_decay_exponent := get_listing_popularity_decay_exponent();

  v_dim_count := 0;
  IF p_audience_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_style_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_occasion_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_object_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;
  IF p_doc_task_tag IS NOT NULL THEN v_dim_count := v_dim_count + 1; END IF;

  IF v_dim_count > 0 THEN
    WITH base AS (
      SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score,
        c.created_at,
        (
          (c.view_count + v_react_weight * (c.likes_count - c.dislikes_count))::double precision
          / POWER(
              1 + GREATEST(EXTRACT(EPOCH FROM (now() - c.created_at)), 0) / 86400.0 / v_half_life_days,
              v_decay_exponent
            )
        ) AS popularity_score,
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
      ORDER BY
        CASE WHEN v_sort = 'new' THEN NULL::double precision ELSE popularity_score END DESC NULLS LAST,
        created_at DESC,
        id DESC
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
        'dimension_count', v_dim_count,
        'sort', v_sort
      );
    END IF;
  END IF;

  IF v_dim_count > 0 THEN
    WITH base AS (
      SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score,
        c.created_at,
        (
          (c.view_count + v_react_weight * (c.likes_count - c.dislikes_count))::double precision
          / POWER(
              1 + GREATEST(EXTRACT(EPOCH FROM (now() - c.created_at)), 0) / 86400.0 / v_half_life_days,
              v_decay_exponent
            )
        ) AS popularity_score,
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
      ORDER BY
        CASE WHEN v_sort = 'new' THEN NULL::double precision ELSE popularity_score END DESC NULLS LAST,
        created_at DESC,
        id DESC
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
        'dimension_count', v_dim_count,
        'sort', v_sort
      );
    END IF;
  END IF;

  WITH base AS (
    SELECT c.id, c.slug, c.title_ru, c.title_en, c.seo_tags, c.seo_readiness_score,
      c.created_at,
      (
        (c.view_count + v_react_weight * (c.likes_count - c.dislikes_count))::double precision
        / POWER(
            1 + GREATEST(EXTRACT(EPOCH FROM (now() - c.created_at)), 0) / 86400.0 / v_half_life_days,
            v_decay_exponent
          )
      ) AS popularity_score,
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
    ORDER BY
      CASE WHEN v_sort = 'new' THEN NULL::double precision ELSE popularity_score END DESC NULLS LAST,
      created_at DESC,
      id DESC
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
    'dimension_count', v_dim_count,
    'sort', v_sort
  );
END;
$$;

COMMENT ON FUNCTION resolve_route_cards(text, text, text, text, text, text, int, int, int, text) IS
  'Listing/menu cards by tags. popular sort uses a query-time popularity score (view_count + reactions, gentle age decay); no dependency on the recalculate_popularity_scores cron.';
