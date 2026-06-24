-- ============================================================
-- Migration 166: materialized popularity_score for resolve_route_cards
--
-- Reverts query-time popularity (migration 163) back to stored
-- prompt_cards.popularity_score so ORDER BY popular can use
-- idx_prompt_cards_published_popularity (migration 158).
--
-- Formula (same as 163, computed by recalculate_popularity_scores):
--   (view_count + react_weight * (likes_count - dislikes_count))
--   / (1 + age_days / half_life_days) ^ decay_exponent
--
-- Schedule recalculate_popularity_scores via pg_cron (hourly).
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_popularity_scores(p_batch_size int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_react_weight double precision;
  v_half_life_days double precision;
  v_decay_exponent double precision;
  v_deleted bigint;
  v_updated bigint := 0;
  v_batch int;
BEGIN
  v_react_weight := get_listing_popularity_react_weight();
  v_half_life_days := get_listing_popularity_half_life_days();
  v_decay_exponent := get_listing_popularity_decay_exponent();

  DELETE FROM prompt_card_view_events
  WHERE viewed_at < now() - interval '14 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  LOOP
    WITH batch AS (
      SELECT
        c.id,
        c.view_count,
        c.likes_count,
        c.dislikes_count,
        c.created_at
      FROM prompt_cards c
      WHERE c.is_published = true
      ORDER BY c.id
      LIMIT p_batch_size
      OFFSET v_updated
    ),
    scored AS (
      SELECT
        b.id,
        (
          (b.view_count + v_react_weight * (b.likes_count - b.dislikes_count))::double precision
          / POWER(
              1 + GREATEST(EXTRACT(EPOCH FROM (now() - b.created_at)), 0) / 86400.0 / v_half_life_days,
              v_decay_exponent
            )
        ) AS popularity_score
      FROM batch b
    ),
    upd AS (
      UPDATE prompt_cards pc
      SET
        popularity_score = s.popularity_score,
        popularity_updated_at = now()
      FROM scored s
      WHERE pc.id = s.id
      RETURNING pc.id
    )
    SELECT COUNT(*)::int INTO v_batch FROM upd;

    v_updated := v_updated + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  UPDATE prompt_cards
  SET popularity_score = 0, popularity_updated_at = now()
  WHERE is_published = false
    AND popularity_score <> 0;

  RETURN jsonb_build_object(
    'updated_published', v_updated,
    'events_deleted', v_deleted,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION recalculate_popularity_scores(int) IS
  'Recompute materialized popularity_score for published prompt_cards (formula matches migration 163). Prune view events older than 14d.';

-- ── resolve_route_cards: ORDER BY stored popularity_score ──

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
BEGIN
  v_sort := lower(trim(COALESCE(p_sort, 'popular')));
  IF v_sort NOT IN ('popular', 'new') THEN
    RAISE EXCEPTION 'invalid_sort: %', p_sort;
  END IF;

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
        c.popularity_score,
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
        c.popularity_score,
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
      c.popularity_score,
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
  'Listing/menu cards by tags. popular sort uses materialized prompt_cards.popularity_score (refreshed by recalculate_popularity_scores cron).';

-- Backfill materialized scores
SELECT recalculate_popularity_scores();

-- To schedule automatic refresh, enable pg_cron then run:
-- SELECT cron.schedule('recalc-popularity', '0 * * * *',
--   'SELECT recalculate_popularity_scores()');
