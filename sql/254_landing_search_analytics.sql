-- First-party search analytics: committed /search impressions + card clicks.
-- Service-role only. Does not edit GET /api/search or existing analytics views.

CREATE TABLE IF NOT EXISTS public.landing_search_events (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  visitor_id uuid,
  session_id uuid,
  query_raw text NOT NULL,
  query_norm text NOT NULL,
  result_count integer NOT NULL CHECK (result_count >= 0),
  has_more boolean NOT NULL DEFAULT false,
  match_type text,
  limit_size integer NOT NULL CHECK (limit_size > 0),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_path text
);

CREATE INDEX IF NOT EXISTS landing_search_events_created_at_idx
  ON public.landing_search_events (created_at DESC);
CREATE INDEX IF NOT EXISTS landing_search_events_query_norm_created_idx
  ON public.landing_search_events (query_norm, created_at DESC);
CREATE INDEX IF NOT EXISTS landing_search_events_session_created_idx
  ON public.landing_search_events (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.landing_search_clicks (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_id uuid NOT NULL REFERENCES public.landing_search_events (id) ON DELETE CASCADE,
  visitor_id uuid,
  session_id uuid,
  card_slug text NOT NULL,
  position integer CHECK (position IS NULL OR position >= 0),
  entry text NOT NULL CHECK (entry IN ('modal', 'page'))
);

CREATE INDEX IF NOT EXISTS landing_search_clicks_search_id_idx
  ON public.landing_search_clicks (search_id);
CREATE INDEX IF NOT EXISTS landing_search_clicks_created_at_idx
  ON public.landing_search_clicks (created_at DESC);

COMMENT ON TABLE public.landing_search_events IS
  'Committed /search first-page impressions. Client-generated id. Retention target 180d.';
COMMENT ON TABLE public.landing_search_clicks IS
  'Card opens attributed to a landing_search_events row.';

CREATE OR REPLACE VIEW public.analytics_search_daily AS
SELECT
  date_trunc('day', e.created_at) AS day,
  count(*)::integer AS searches,
  count(DISTINCT e.visitor_id)::integer AS unique_visitors,
  count(*) FILTER (WHERE e.result_count = 0)::integer AS zero_results,
  coalesce(avg(e.result_count), 0)::numeric AS avg_result_count,
  count(*) FILTER (WHERE e.has_more)::integer AS with_more,
  count(*) FILTER (WHERE c.clicks > 0)::integer AS searches_with_click,
  coalesce(sum(c.clicks), 0)::integer AS clicks
FROM public.landing_search_events e
LEFT JOIN (
  SELECT search_id, count(*)::integer AS clicks
  FROM public.landing_search_clicks
  GROUP BY search_id
) c ON c.search_id = e.id
GROUP BY 1;

CREATE OR REPLACE FUNCTION public.admin_search_summary(p_days integer DEFAULT 30)
RETURNS TABLE (
  searches integer,
  unique_visitors integer,
  zero_results integer,
  searches_with_click integer,
  clicks integer,
  avg_result_count numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (timezone('utc', now())::date - (greatest(1, least(COALESCE(p_days, 30), 90)) - 1))
        ::timestamp AT TIME ZONE 'utc' AS since
  ),
  click_agg AS (
    SELECT search_id, count(*)::integer AS clicks
    FROM public.landing_search_clicks
    CROSS JOIN bounds b
    WHERE created_at >= b.since
    GROUP BY search_id
  )
  SELECT
    count(*)::integer AS searches,
    count(DISTINCT e.visitor_id)::integer AS unique_visitors,
    count(*) FILTER (WHERE e.result_count = 0)::integer AS zero_results,
    count(*) FILTER (WHERE c.clicks > 0)::integer AS searches_with_click,
    coalesce(sum(c.clicks), 0)::integer AS clicks,
    coalesce(avg(e.result_count), 0)::numeric AS avg_result_count
  FROM public.landing_search_events e
  CROSS JOIN bounds b
  LEFT JOIN click_agg c ON c.search_id = e.id
  WHERE e.created_at >= b.since;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_queries(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 50,
  p_zero_only boolean DEFAULT false
)
RETURNS TABLE (
  query_norm text,
  query_raw text,
  searches integer,
  unique_visitors integer,
  avg_result_count numeric,
  zero_results integer,
  clicks integer,
  searches_with_click integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (timezone('utc', now())::date - (greatest(1, least(COALESCE(p_days, 30), 90)) - 1))
        ::timestamp AT TIME ZONE 'utc' AS since
  ),
  events AS (
    SELECT e.*
    FROM public.landing_search_events e
    CROSS JOIN bounds b
    WHERE e.created_at >= b.since
      AND (
        NOT COALESCE(p_zero_only, false)
        OR e.result_count = 0
      )
  ),
  click_agg AS (
    SELECT c.search_id, count(*)::integer AS clicks
    FROM public.landing_search_clicks c
    WHERE c.search_id IN (SELECT id FROM events)
    GROUP BY c.search_id
  )
  SELECT
    e.query_norm,
    (array_agg(e.query_raw ORDER BY e.created_at DESC))[1] AS query_raw,
    count(*)::integer AS searches,
    count(DISTINCT e.visitor_id)::integer AS unique_visitors,
    coalesce(avg(e.result_count), 0)::numeric AS avg_result_count,
    count(*) FILTER (WHERE e.result_count = 0)::integer AS zero_results,
    coalesce(sum(c.clicks), 0)::integer AS clicks,
    count(*) FILTER (WHERE c.clicks > 0)::integer AS searches_with_click
  FROM events e
  LEFT JOIN click_agg c ON c.search_id = e.id
  GROUP BY e.query_norm
  ORDER BY
    CASE WHEN COALESCE(p_zero_only, false) THEN count(*) FILTER (WHERE e.result_count = 0) END DESC NULLS LAST,
    count(*) DESC,
    max(e.created_at) DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 50), 100));
$$;

ALTER TABLE public.landing_search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_search_clicks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.landing_search_events FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.landing_search_clicks FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_search_daily FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_search_summary(integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_search_queries(integer, integer, boolean)
  FROM public, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.landing_search_events TO service_role;
GRANT SELECT, INSERT ON TABLE public.landing_search_clicks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.landing_search_clicks_id_seq TO service_role;
GRANT SELECT ON TABLE public.analytics_search_daily TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_queries(integer, integer, boolean)
  TO service_role;
