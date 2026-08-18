-- Persist the pricing paywall A/B variant in both payment ledgers and expose it
-- through the provider-neutral admin read model.

ALTER TABLE public.landing_yookassa_payments
  ADD COLUMN IF NOT EXISTS paywall_variant text
    CHECK (paywall_variant IN ('control', 'treatment'));

ALTER TABLE public.landing_robokassa_payments
  ADD COLUMN IF NOT EXISTS paywall_variant text
    CHECK (paywall_variant IN ('control', 'treatment'));

CREATE INDEX IF NOT EXISTS idx_landing_yookassa_paywall_created
  ON public.landing_yookassa_payments(paywall_variant, created_at DESC)
  WHERE paywall_variant IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_landing_robokassa_paywall_created
  ON public.landing_robokassa_payments(paywall_variant, created_at DESC)
  WHERE paywall_variant IS NOT NULL;

COMMENT ON COLUMN public.landing_yookassa_payments.paywall_variant IS
  'First-touch pricing paywall assignment: control (A) or treatment (B).';
COMMENT ON COLUMN public.landing_robokassa_payments.paywall_variant IS
  'First-touch pricing paywall assignment: control (A) or treatment (B).';

DROP FUNCTION IF EXISTS public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer
);

CREATE FUNCTION public.admin_landing_payments(
  p_status text DEFAULT 'all',
  p_test boolean DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
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
  credited_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH payments AS (
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
      yp.credited_at
    FROM public.landing_yookassa_payments yp
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
      rp.credited_at
    FROM public.landing_robokassa_payments rp
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
    p.credited_at
  FROM payments p
  LEFT JOIN auth.users au ON au.id = p.auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = p.landing_user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = p.landing_user_id
  WHERE (
      lower(COALESCE(p_status, 'all')) = 'all'
      OR p.status = lower(p_status)
    )
    AND (p_test IS NULL OR p.test IS NOT DISTINCT FROM p_test)
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
  integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer
) TO service_role;
