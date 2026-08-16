-- Daily credit in/out for the admin remaining-balance chart, plus per-user
-- granted/spent on the unused-credit list. Service-role only.

CREATE OR REPLACE FUNCTION public.admin_credit_daily_flow(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  granted integer,
  spent integer,
  refunded integer
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
  days AS (
    SELECT generate_series(b.start_day, b.end_day, interval '1 day')::date AS day
    FROM bounds b
  ),
  granted AS (
    SELECT
      timezone('utc', p.credited_at)::date AS day,
      sum(p.credits)::bigint AS granted
    FROM public.landing_yookassa_payments p
    CROSS JOIN bounds b
    WHERE p.status = 'succeeded'
      AND p.credited_at IS NOT NULL
      AND p.test IS NOT TRUE
      AND timezone('utc', p.credited_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
    UNION ALL
    SELECT
      timezone('utc', t.updated_at)::date AS day,
      sum(t.amount)::bigint AS granted
    FROM public.landing_web_transactions t
    CROSS JOIN bounds b
    WHERE t.state = 'done'
      AND timezone('utc', t.updated_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
  ),
  granted_day AS (
    SELECT g.day, sum(g.granted)::bigint AS granted
    FROM granted g
    GROUP BY g.day
  ),
  spent_day AS (
    SELECT
      timezone('utc', g.created_at)::date AS day,
      sum(g.credits_spent)::bigint AS spent
    FROM public.landing_generations g
    CROSS JOIN bounds b
    WHERE g.credits_spent > 0
      AND g.client_source IS DISTINCT FROM 'admin'
      AND timezone('utc', g.created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
  ),
  refunded_day AS (
    SELECT
      timezone('utc', g.refunded_at)::date AS day,
      sum(g.credits_spent)::bigint AS refunded
    FROM public.landing_generations g
    CROSS JOIN bounds b
    WHERE g.credits_refunded
      AND g.credits_spent > 0
      AND g.refunded_at IS NOT NULL
      AND g.client_source IS DISTINCT FROM 'admin'
      AND timezone('utc', g.refunded_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(gd.granted, 0)::integer AS granted,
    COALESCE(sd.spent, 0)::integer AS spent,
    COALESCE(rd.refunded, 0)::integer AS refunded
  FROM days d
  LEFT JOIN granted_day gd ON gd.day = d.day
  LEFT JOIN spent_day sd ON sd.day = d.day
  LEFT JOIN refunded_day rd ON rd.day = d.day
  ORDER BY d.day;
$$;

DROP FUNCTION IF EXISTS public.admin_credit_liabilities(integer, uuid, integer);

CREATE OR REPLACE FUNCTION public.admin_credit_liabilities(
  p_cursor_credits integer DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_search text DEFAULT NULL
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
  WITH search AS (
    SELECT NULLIF(btrim(p_search), '') AS q
  ),
  granted AS (
    SELECT landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_yookassa_payments
    WHERE status = 'succeeded'
      AND credited_at IS NOT NULL
      AND test IS NOT TRUE
    GROUP BY landing_user_id
    UNION ALL
    SELECT landing_user_id, sum(amount)::bigint AS granted
    FROM public.landing_web_transactions
    WHERE state = 'done'
    GROUP BY landing_user_id
  ),
  granted_user AS (
    SELECT landing_user_id, sum(granted)::bigint AS granted_total
    FROM granted
    GROUP BY landing_user_id
  ),
  spent_user AS (
    SELECT
      user_id,
      sum(credits_spent) FILTER (WHERE NOT credits_refunded)::bigint AS spent_total
    FROM public.landing_generations
    WHERE credits_spent > 0
      AND client_source IS DISTINCT FROM 'admin'
    GROUP BY user_id
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
  WHERE lu.credits > 0
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

REVOKE ALL ON FUNCTION public.admin_credit_daily_flow(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_daily_flow(integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text)
  TO service_role;

COMMENT ON FUNCTION public.admin_credit_daily_flow(integer) IS
  'Service-only daily credit grants (YooKassa/Stars), generation spend, and refunds.';

COMMENT ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text) IS
  'Service-only keyset list of users with credits > 0, plus lifetime granted/spent.';
