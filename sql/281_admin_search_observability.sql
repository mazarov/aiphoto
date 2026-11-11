-- ============================================================
-- Migration 281: Search engine observability for /admin/search
--
-- 1. Optional outcome/source columns on landing_search_events.
-- 2. Daily server-side counters for first-page GET /api/search requests:
--    - share of embedding (hybrid) vs text-only searches
--    - queries sent live to Gemini (no ready vector) vs served from L1/L2 ready vectors
--    Seeded idempotently from historical landing_search_events.
-- 3. Read-only service_role RPC admin_search_observability(p_days) combining:
--    - engine mode split & vector source funnel
--    - prompt_cards without visual embedding (via visual_embedding_coverage)
--    - stored query vector inventory & today's Gemini global quota usage
-- ============================================================

-- ── 1. Enrich landing_search_events (nullable, rolling-deploy safe) ──────────
ALTER TABLE public.landing_search_events
  ADD COLUMN IF NOT EXISTS search_outcome text,
  ADD COLUMN IF NOT EXISTS embed_source text,
  ADD COLUMN IF NOT EXISTS fallback_reason text;

ALTER TABLE public.landing_search_events
  DROP CONSTRAINT IF EXISTS landing_search_events_search_outcome_check;

ALTER TABLE public.landing_search_events
  ADD CONSTRAINT landing_search_events_search_outcome_check
  CHECK (search_outcome IS NULL OR search_outcome IN ('hybrid', 'text', 'text_fallback'));

ALTER TABLE public.landing_search_events
  DROP CONSTRAINT IF EXISTS landing_search_events_embed_source_check;

ALTER TABLE public.landing_search_events
  ADD CONSTRAINT landing_search_events_embed_source_check
  CHECK (embed_source IS NULL OR embed_source IN ('l1', 'l2_db', 'gemini', 'none'));

-- ── 2. Server-side daily search engine telemetry ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_engine_daily_stats (
  day date PRIMARY KEY,
  total_requests integer NOT NULL DEFAULT 0 CHECK (total_requests >= 0),
  hybrid_requests integer NOT NULL DEFAULT 0 CHECK (hybrid_requests >= 0),
  text_only_requests integer NOT NULL DEFAULT 0 CHECK (text_only_requests >= 0),
  fallback_requests integer NOT NULL DEFAULT 0 CHECK (fallback_requests >= 0),
  embed_l1_hits integer NOT NULL DEFAULT 0 CHECK (embed_l1_hits >= 0),
  embed_l2_db_hits integer NOT NULL DEFAULT 0 CHECK (embed_l2_db_hits >= 0),
  embed_gemini_ok integer NOT NULL DEFAULT 0 CHECK (embed_gemini_ok >= 0),
  embed_gemini_error integer NOT NULL DEFAULT 0 CHECK (embed_gemini_error >= 0),
  embed_guard_blocked integer NOT NULL DEFAULT 0 CHECK (embed_guard_blocked >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.search_engine_daily_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.search_engine_daily_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.search_engine_daily_stats TO service_role;

COMMENT ON TABLE public.search_engine_daily_stats IS
  'Daily server-side counters for first-page /api/search requests: hybrid vs text split and Gemini vs L1/L2 vector cache hits.';

-- Seed historical days from landing_search_events so 7/30/90d mode split is populated immediately.
INSERT INTO public.search_engine_daily_stats (
  day,
  total_requests,
  hybrid_requests,
  text_only_requests,
  fallback_requests,
  updated_at
)
SELECT
  (timezone('utc', e.created_at))::date AS day,
  count(*)::integer AS total_requests,
  count(*) FILTER (
    WHERE e.search_outcome = 'hybrid'
       OR (e.search_outcome IS NULL AND e.match_type LIKE '%visual%')
  )::integer AS hybrid_requests,
  count(*) FILTER (
    WHERE e.search_outcome IN ('text', 'text_fallback')
       OR (e.search_outcome IS NULL AND (e.match_type IS NULL OR e.match_type NOT LIKE '%visual%'))
  )::integer AS text_only_requests,
  count(*) FILTER (WHERE e.search_outcome = 'text_fallback')::integer AS fallback_requests,
  now()
FROM public.landing_search_events e
GROUP BY 1
ON CONFLICT (day) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_search_engine_telemetry(
  p_outcome text,
  p_embed_source text DEFAULT 'none',
  p_fallback_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := (timezone('utc', now()))::date;
  v_outcome text := coalesce(nullif(btrim(p_outcome), ''), 'text');
  v_source text := coalesce(nullif(btrim(p_embed_source), ''), 'none');
  v_reason text := nullif(btrim(coalesce(p_fallback_reason, '')), '');
  v_is_hybrid int := CASE WHEN v_outcome = 'hybrid' THEN 1 ELSE 0 END;
  v_is_text int := CASE WHEN v_outcome <> 'hybrid' THEN 1 ELSE 0 END;
  v_is_fallback int := CASE WHEN v_outcome = 'text_fallback' THEN 1 ELSE 0 END;
  v_l1 int := CASE WHEN v_source = 'l1' THEN 1 ELSE 0 END;
  v_l2 int := CASE WHEN v_source = 'l2_db' THEN 1 ELSE 0 END;
  v_gemini_ok int := CASE WHEN v_source = 'gemini' THEN 1 ELSE 0 END;
  v_gemini_err int := CASE
    WHEN v_outcome = 'text_fallback'
     AND v_source = 'none'
     AND v_reason IN ('timeout', 'provider_error', 'malformed_vector')
      THEN 1
    ELSE 0
  END;
  v_guard_blocked int := CASE
    WHEN v_outcome = 'text_fallback'
     AND v_source = 'none'
     AND v_reason IN ('rate_limited', 'circuit_open', 'missing_key', 'guard_unavailable')
      THEN 1
    ELSE 0
  END;
BEGIN
  INSERT INTO public.search_engine_daily_stats (
    day,
    total_requests,
    hybrid_requests,
    text_only_requests,
    fallback_requests,
    embed_l1_hits,
    embed_l2_db_hits,
    embed_gemini_ok,
    embed_gemini_error,
    embed_guard_blocked,
    updated_at
  ) VALUES (
    v_day,
    1,
    v_is_hybrid,
    v_is_text,
    v_is_fallback,
    v_l1,
    v_l2,
    v_gemini_ok,
    v_gemini_err,
    v_guard_blocked,
    now()
  )
  ON CONFLICT (day) DO UPDATE SET
    total_requests = public.search_engine_daily_stats.total_requests + 1,
    hybrid_requests = public.search_engine_daily_stats.hybrid_requests + EXCLUDED.hybrid_requests,
    text_only_requests = public.search_engine_daily_stats.text_only_requests + EXCLUDED.text_only_requests,
    fallback_requests = public.search_engine_daily_stats.fallback_requests + EXCLUDED.fallback_requests,
    embed_l1_hits = public.search_engine_daily_stats.embed_l1_hits + EXCLUDED.embed_l1_hits,
    embed_l2_db_hits = public.search_engine_daily_stats.embed_l2_db_hits + EXCLUDED.embed_l2_db_hits,
    embed_gemini_ok = public.search_engine_daily_stats.embed_gemini_ok + EXCLUDED.embed_gemini_ok,
    embed_gemini_error = public.search_engine_daily_stats.embed_gemini_error + EXCLUDED.embed_gemini_error,
    embed_guard_blocked = public.search_engine_daily_stats.embed_guard_blocked + EXCLUDED.embed_guard_blocked,
    updated_at = now();
END;
$$;

-- ── 3. Admin observability RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_search_observability(
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int := greatest(1, least(coalesce(p_days, 30), 90));
  v_since_date date := (timezone('utc', now()))::date - (v_days - 1);
  v_since_ts timestamptz := v_since_date::timestamp AT TIME ZONE 'utc';
  v_today_start timestamptz := ((timezone('utc', now()))::date)::timestamp AT TIME ZONE 'utc';
  v_coverage jsonb;
  v_totals jsonb;
  v_daily jsonb;
  v_stored_total int := 0;
  v_stored_period int := 0;
  v_global_today int := 0;
  v_visual_enabled boolean := false;
BEGIN
  v_coverage := public.visual_embedding_coverage(NULL);

  SELECT
    jsonb_build_object(
      'total_requests', coalesce(sum(s.total_requests), 0)::int,
      'hybrid_requests', coalesce(sum(s.hybrid_requests), 0)::int,
      'text_only_requests', coalesce(sum(s.text_only_requests), 0)::int,
      'fallback_requests', coalesce(sum(s.fallback_requests), 0)::int,
      'embed_l1_hits', coalesce(sum(s.embed_l1_hits), 0)::int,
      'embed_l2_db_hits', coalesce(sum(s.embed_l2_db_hits), 0)::int,
      'embed_gemini_ok', coalesce(sum(s.embed_gemini_ok), 0)::int,
      'embed_gemini_error', coalesce(sum(s.embed_gemini_error), 0)::int,
      'embed_guard_blocked', coalesce(sum(s.embed_guard_blocked), 0)::int
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', s.day::text,
          'total_requests', s.total_requests,
          'hybrid_requests', s.hybrid_requests,
          'text_only_requests', s.text_only_requests,
          'fallback_requests', s.fallback_requests,
          'embed_l1_hits', s.embed_l1_hits,
          'embed_l2_db_hits', s.embed_l2_db_hits,
          'embed_gemini_ok', s.embed_gemini_ok,
          'embed_gemini_error', s.embed_gemini_error
        )
        ORDER BY s.day ASC
      ),
      '[]'::jsonb
    )
  INTO v_totals, v_daily
  FROM public.search_engine_daily_stats s
  WHERE s.day >= v_since_date;

  IF to_regclass('public.search_query_embeddings') IS NOT NULL THEN
    SELECT
      count(*)::int,
      count(*) FILTER (WHERE created_at >= v_since_ts)::int
    INTO v_stored_total, v_stored_period
    FROM public.search_query_embeddings;
  END IF;

  IF to_regclass('public.visual_search_rate_limit') IS NOT NULL THEN
    SELECT coalesce(r.count, 0)::int
    INTO v_global_today
    FROM public.visual_search_rate_limit r
    WHERE r.bucket_key = 'global'
      AND r.window_start >= v_today_start
    LIMIT 1;
  END IF;

  IF to_regclass('public.landing_generation_config') IS NOT NULL THEN
    SELECT lower(btrim(coalesce(c.value, ''))) IN ('1', 'true', 'yes', 'on')
    INTO v_visual_enabled
    FROM public.landing_generation_config c
    WHERE c.key = 'search_visual_enabled'
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'visual_enabled', coalesce(v_visual_enabled, false),
    'coverage', coalesce(v_coverage, '{}'::jsonb),
    'engine', coalesce(v_totals, '{}'::jsonb),
    'daily_engine', coalesce(v_daily, '[]'::jsonb),
    'stored_query_vectors_total', coalesce(v_stored_total, 0),
    'stored_query_vectors_period', coalesce(v_stored_period, 0),
    'today_gemini_global_used', coalesce(v_global_today, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_search_engine_telemetry(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_search_observability(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_search_engine_telemetry(text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_observability(integer)
  TO service_role;
