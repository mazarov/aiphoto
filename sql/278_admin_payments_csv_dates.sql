-- Admin payments CSV: optional created_at window.
-- p_created_from is inclusive, p_created_to is exclusive. NULL bound stays open.
-- Bounds are timestamptz so the app can pass Moscow midnights without relying
-- on the database TimeZone. Dated exports must not walk the newest 10k rows
-- and then drop everything outside the window.

CREATE INDEX IF NOT EXISTS idx_landing_yookassa_admin_created
  ON public.landing_yookassa_payments (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_landing_robokassa_admin_created
  ON public.landing_robokassa_payments (created_at DESC, id DESC);

DROP FUNCTION IF EXISTS public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text
);
DROP FUNCTION IF EXISTS public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
);

CREATE FUNCTION public.admin_landing_payments(
  p_status text DEFAULT 'all',
  p_test boolean DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  provider text,
  provider_payment_id text,
  created_at timestamptz,
  updated_at timestamptz,
  auth_user_id uuid,
  landing_user_id uuid,
  payer_email text,
  payer_display_name text,
  payer_provider text,
  plan_id text,
  credits integer,
  amount_rub numeric,
  status text,
  provider_status text,
  test boolean,
  paywall_variant text,
  credited_at timestamptz,
  visitor_id uuid,
  session_id uuid,
  yclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_landing_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filters AS (
    SELECT
      public.landing_sanitize_utm(p_source) AS source,
      public.landing_sanitize_utm(p_campaign) AS campaign
  ),
  payments AS (
    SELECT
      yp.id,
      'yookassa'::text AS provider,
      yp.yookassa_payment_id AS provider_payment_id,
      yp.created_at,
      yp.updated_at,
      yp.auth_user_id,
      yp.landing_user_id,
      yp.plan_id,
      yp.credits,
      yp.amount_rub,
      yp.status,
      yp.provider_status,
      yp.test,
      yp.paywall_variant,
      yp.credited_at,
      yp.visitor_id,
      yp.session_id,
      yp.yclid,
      yp.utm_source,
      yp.utm_medium,
      yp.utm_campaign,
      yp.utm_content,
      yp.utm_term,
      yp.utm_landing_path
    FROM public.landing_yookassa_payments yp
    WHERE yp.created_at >= COALESCE(p_created_from, '-infinity'::timestamptz)
      AND yp.created_at < COALESCE(p_created_to, 'infinity'::timestamptz)
    UNION ALL
    SELECT
      rp.id,
      'robokassa'::text AS provider,
      rp.invoice_id::text AS provider_payment_id,
      rp.created_at,
      rp.updated_at,
      rp.auth_user_id,
      rp.landing_user_id,
      rp.plan_id,
      rp.credits,
      rp.amount_rub,
      rp.status,
      rp.provider_status,
      rp.test,
      rp.paywall_variant,
      rp.credited_at,
      rp.visitor_id,
      rp.session_id,
      rp.yclid,
      rp.utm_source,
      rp.utm_medium,
      rp.utm_campaign,
      rp.utm_content,
      rp.utm_term,
      rp.utm_landing_path
    FROM public.landing_robokassa_payments rp
    WHERE rp.created_at >= COALESCE(p_created_from, '-infinity'::timestamptz)
      AND rp.created_at < COALESCE(p_created_to, 'infinity'::timestamptz)
  )
  SELECT
    p.id,
    p.provider,
    p.provider_payment_id,
    p.created_at,
    p.updated_at,
    p.auth_user_id,
    p.landing_user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS payer_email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS payer_display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS payer_provider,
    p.plan_id,
    p.credits,
    p.amount_rub,
    p.status,
    p.provider_status,
    p.test,
    p.paywall_variant,
    p.credited_at,
    p.visitor_id,
    p.session_id,
    p.yclid,
    p.utm_source,
    p.utm_medium,
    p.utm_campaign,
    p.utm_content,
    p.utm_term,
    p.utm_landing_path
  FROM payments p
  CROSS JOIN filters f
  LEFT JOIN auth.users au ON au.id = p.auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = p.landing_user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = p.landing_user_id
  WHERE (
      lower(COALESCE(p_status, 'all')) = 'all'
      OR p.status = lower(p_status)
    )
    AND (p_test IS NULL OR p.test IS NOT DISTINCT FROM p_test)
    AND (
      f.source IS NULL
      OR lower(p.utm_source) = lower(f.source)
      OR (
        lower(f.source) IN ('yandex', 'ya')
        AND lower(p.utm_source) IN ('yandex', 'ya')
      )
    )
    AND (f.campaign IS NULL OR p.utm_campaign = f.campaign)
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR p.created_at < p_cursor_created_at
      OR (p.created_at = p_cursor_created_at AND p.id < p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) TO service_role;

COMMENT ON FUNCTION public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text,
  timestamptz,
  timestamptz
) IS
  'Admin YooKassa+Robokassa ledger. p_created_from inclusive, p_created_to exclusive; NULL bound is open.';
