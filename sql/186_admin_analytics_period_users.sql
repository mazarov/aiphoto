-- Period-scoped admin user tables: top requesters and credit movers.
-- Service-role only. Does not edit 184/185.

CREATE OR REPLACE FUNCTION public.admin_analytics_top_users(p_days integer DEFAULT 30)
RETURNS TABLE (
  email text,
  total_requests integer,
  generations integer,
  analyzes integer,
  last_seen timestamptz
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
  )
  SELECT
    u.email,
    count(*)::integer AS total_requests,
    count(*) FILTER (WHERE r.kind = 'generation')::integer AS generations,
    count(*) FILTER (WHERE r.kind IS DISTINCT FROM 'generation')::integer AS analyzes,
    max(r.event_time) AS last_seen
  FROM public.analytics_requests r
  JOIN public.imageprompt_users u ON u.id::text = r.user_id
  CROSS JOIN bounds b
  WHERE r.allowed
    AND r.user_id IS NOT NULL
    AND r.event_time >= b.since
  GROUP BY u.id, u.email
  ORDER BY count(*) DESC, max(r.event_time) DESC
  LIMIT 50;
$$;

DROP FUNCTION IF EXISTS public.admin_credit_liabilities(integer, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.admin_credit_liabilities(
  p_cursor_credits integer DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_search text DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  landing_user_id uuid,
  email text,
  display_name text,
  provider text,
  credits integer,
  granted_total integer,
  spent_total integer,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (timezone('utc', now())::date - (greatest(1, least(COALESCE(p_days, 30), 90)) - 1)) AS start_day,
      timezone('utc', now())::date AS end_day
  ),
  search AS (
    SELECT NULLIF(btrim(p_search), '') AS q
  ),
  granted AS (
    SELECT landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_yookassa_payments
    CROSS JOIN bounds b
    WHERE status = 'succeeded'
      AND credited_at IS NOT NULL
      AND test IS NOT TRUE
      AND timezone('utc', credited_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY landing_user_id
    UNION ALL
    SELECT landing_user_id, sum(amount)::bigint AS granted
    FROM public.landing_web_transactions
    CROSS JOIN bounds b
    WHERE state = 'done'
      AND timezone('utc', updated_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY landing_user_id
  ),
  granted_user AS (
    SELECT landing_user_id, sum(granted)::bigint AS granted_total
    FROM granted
    GROUP BY landing_user_id
  ),
  spent_user AS (
    SELECT
      g.user_id,
      sum(g.credits_spent) FILTER (WHERE NOT g.credits_refunded)::bigint AS spent_total
    FROM public.landing_generations g
    CROSS JOIN bounds b
    WHERE g.credits_spent > 0
      AND g.client_source IS DISTINCT FROM 'admin'
      AND timezone('utc', g.created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY g.user_id
  )
  SELECT
    lu.id AS landing_user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS provider,
    lu.credits,
    COALESCE(gu.granted_total, 0)::integer AS granted_total,
    COALESCE(su.spent_total, 0)::integer AS spent_total,
    lu.updated_at
  FROM public.landing_users lu
  LEFT JOIN auth.users au ON au.id = lu.id
  LEFT JOIN public.imageprompt_users iu ON iu.id = lu.id
  LEFT JOIN granted_user gu ON gu.landing_user_id = lu.id
  LEFT JOIN spent_user su ON su.user_id = lu.id
  CROSS JOIN search s
  WHERE (COALESCE(gu.granted_total, 0) > 0 OR COALESCE(su.spent_total, 0) > 0)
    AND (
      s.q IS NULL
      OR COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, ''), '') ILIKE '%' || s.q || '%'
      OR COALESCE(
        NULLIF(lu.display_name, ''),
        NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(au.raw_user_meta_data ->> 'name', ''),
        NULLIF(iu.display_name, ''),
        ''
      ) ILIKE '%' || s.q || '%'
    )
    AND (
      p_cursor_credits IS NULL
      OR p_cursor_id IS NULL
      OR lu.credits < p_cursor_credits
      OR (lu.credits = p_cursor_credits AND lu.id < p_cursor_id)
    )
  ORDER BY lu.credits DESC, lu.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_top_users(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_users(integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text, integer)
  TO service_role;

COMMENT ON FUNCTION public.admin_analytics_top_users(integer) IS
  'Service-only top users by allowed requests in the selected UTC day window.';

COMMENT ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text, integer) IS
  'Service-only users with credit grant/spend in the selected UTC day window, plus live remaining.';
