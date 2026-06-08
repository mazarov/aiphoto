-- ============================================================
-- Migration 160: popularity config, recalculate job, view event insert
-- ============================================================

INSERT INTO photo_app_config (key, value, description)
VALUES
  (
    'listing_popularity_age_offset_hours',
    '48',
    'Popularity formula: views_7d / (age_hours + offset) ^ exponent. Default offset hours.'
  ),
  (
    'listing_popularity_age_exponent',
    '1.2',
    'Popularity formula exponent. Default 1.2.'
  )
ON CONFLICT (key) DO NOTHING;

-- ── Config helpers (defaults if row missing) ──

CREATE OR REPLACE FUNCTION get_listing_popularity_age_offset_hours()
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value::double precision FROM photo_app_config WHERE key = 'listing_popularity_age_offset_hours'),
    48::double precision
  );
$$;

CREATE OR REPLACE FUNCTION get_listing_popularity_age_exponent()
RETURNS double precision
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value::double precision FROM photo_app_config WHERE key = 'listing_popularity_age_exponent'),
    1.2::double precision
  );
$$;

-- ── Hourly batch: views_7d + popularity_score for published cards ──

CREATE OR REPLACE FUNCTION recalculate_popularity_scores(p_batch_size int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset_hours double precision;
  v_exponent double precision;
  v_deleted bigint;
  v_updated bigint := 0;
  v_batch int;
  v_cutoff timestamptz := now() - interval '7 days';
BEGIN
  v_offset_hours := get_listing_popularity_age_offset_hours();
  v_exponent := get_listing_popularity_age_exponent();

  DELETE FROM prompt_card_view_events
  WHERE viewed_at < now() - interval '14 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  LOOP
    WITH batch AS (
      SELECT c.id
      FROM prompt_cards c
      WHERE c.is_published = true
      ORDER BY c.id
      LIMIT p_batch_size
      OFFSET v_updated
    ),
    agg AS (
      SELECT
        b.id,
        COUNT(e.id)::bigint AS cnt
      FROM batch b
      LEFT JOIN prompt_card_view_events e
        ON e.card_id = b.id AND e.viewed_at > v_cutoff
      GROUP BY b.id
    ),
    scored AS (
      SELECT
        a.id,
        a.cnt AS views_7d,
        CASE
          WHEN a.cnt = 0 THEN 0::double precision
          ELSE a.cnt::double precision / POWER(
            GREATEST(
              EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600.0 + v_offset_hours,
              0.001
            ),
            v_exponent
          )
        END AS popularity_score
      FROM agg a
      JOIN prompt_cards c ON c.id = a.id
    ),
    upd AS (
      UPDATE prompt_cards pc
      SET
        views_7d = s.views_7d,
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

  -- Unpublished cards: zero out materialized fields
  UPDATE prompt_cards
  SET views_7d = 0, popularity_score = 0, popularity_updated_at = now()
  WHERE is_published = false
    AND (views_7d <> 0 OR popularity_score <> 0);

  RETURN jsonb_build_object(
    'updated_published', v_updated,
    'events_deleted', v_deleted,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION recalculate_popularity_scores(int) IS
  'Recompute views_7d and popularity_score for published prompt_cards; prune view events older than 14d.';

REVOKE ALL ON FUNCTION recalculate_popularity_scores(int) FROM PUBLIC;

-- ── View beacon: increment lifetime count + append event ──

CREATE OR REPLACE FUNCTION increment_prompt_card_view(p_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_card_id uuid;
  v_count bigint;
BEGIN
  v_slug := nullif(trim(p_slug), '');
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE prompt_cards
  SET view_count = view_count + 1
  WHERE slug = v_slug AND is_published = true
  RETURNING id, view_count INTO v_card_id, v_count;

  IF v_card_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO prompt_card_view_events (card_id, viewed_at)
  VALUES (v_card_id, now());

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION increment_prompt_card_view(text) IS
  'Increments view_count and appends prompt_card_view_events row for published card by slug.';

REVOKE ALL ON FUNCTION increment_prompt_card_view(text) FROM PUBLIC;

-- Initial backfill (safe on empty events table)
SELECT recalculate_popularity_scores();
