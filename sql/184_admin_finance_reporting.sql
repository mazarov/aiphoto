-- Admin finance reporting: monthly YooKassa/GCP CSV imports and live credit liabilities.
-- Service-role only. No client policies. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.admin_finance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('revenue', 'cogs')),
  period_month date NOT NULL,
  source_filename text NOT NULL,
  file_sha256 text NOT NULL,
  uploaded_by_email text NOT NULL,
  row_count integer NOT NULL CHECK (row_count >= 0),
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  usd_rub_rate numeric(12, 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_finance_imports_kind_period_key UNIQUE (kind, period_month),
  CONSTRAINT admin_finance_imports_period_month_chk
    CHECK (date_trunc('month', period_month)::date = period_month)
);

CREATE TABLE IF NOT EXISTS public.admin_finance_revenue_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.admin_finance_imports(id) ON DELETE CASCADE,
  provider_payment_id text NOT NULL,
  paid_at timestamptz,
  amount_gross numeric(12, 2) NOT NULL,
  amount_net numeric(12, 2) NOT NULL,
  commission numeric(12, 2) NOT NULL DEFAULT 0,
  vat_on_commission numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RUB',
  payment_type text,
  description text,
  CONSTRAINT admin_finance_revenue_lines_import_payment_key
    UNIQUE (import_id, provider_payment_id)
);

CREATE TABLE IF NOT EXISTS public.admin_finance_cogs_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.admin_finance_imports(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  sku_id text NOT NULL,
  sku_description text NOT NULL,
  usage_amount numeric(20, 6) NOT NULL DEFAULT 0,
  subtotal_usd numeric(12, 6) NOT NULL,
  CONSTRAINT admin_finance_cogs_lines_import_day_sku_key
    UNIQUE (import_id, usage_date, sku_id)
);

CREATE INDEX IF NOT EXISTS admin_finance_revenue_lines_import_idx
  ON public.admin_finance_revenue_lines (import_id);

CREATE INDEX IF NOT EXISTS admin_finance_cogs_lines_import_idx
  ON public.admin_finance_cogs_lines (import_id, usage_date);

CREATE INDEX IF NOT EXISTS landing_users_positive_credits_idx
  ON public.landing_users (credits DESC, id)
  WHERE credits > 0;

ALTER TABLE public.admin_finance_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_finance_revenue_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_finance_cogs_lines ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_finance_imports IS
  'Monthly admin CSV/zip imports for YooKassa cash-in and GCP Gemini spend. Service-role only.';
COMMENT ON TABLE public.admin_finance_revenue_lines IS
  'Parsed YooKassa registry lines without payer PII. Service-role only.';
COMMENT ON TABLE public.admin_finance_cogs_lines IS
  'Parsed Google Cloud Billing Gemini SKU lines. Service-role only.';

CREATE OR REPLACE FUNCTION public.admin_finance_replace_import(
  p_kind text,
  p_period_month date,
  p_source_filename text,
  p_file_sha256 text,
  p_uploaded_by_email text,
  p_row_count integer,
  p_totals jsonb,
  p_usd_rub_rate numeric DEFAULT NULL,
  p_revenue_lines jsonb DEFAULT NULL,
  p_cogs_lines jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import_id uuid;
BEGIN
  IF p_kind NOT IN ('revenue', 'cogs') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE = 'P0001';
  END IF;
  IF p_period_month IS NULL OR date_trunc('month', p_period_month)::date <> p_period_month THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'revenue' AND (p_revenue_lines IS NULL OR jsonb_typeof(p_revenue_lines) <> 'array') THEN
    RAISE EXCEPTION 'invalid_revenue_lines' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'cogs' AND (p_cogs_lines IS NULL OR jsonb_typeof(p_cogs_lines) <> 'array') THEN
    RAISE EXCEPTION 'invalid_cogs_lines' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_finance_imports (
    kind,
    period_month,
    source_filename,
    file_sha256,
    uploaded_by_email,
    row_count,
    totals,
    usd_rub_rate
  ) VALUES (
    p_kind,
    p_period_month,
    p_source_filename,
    p_file_sha256,
    p_uploaded_by_email,
    GREATEST(COALESCE(p_row_count, 0), 0),
    COALESCE(p_totals, '{}'::jsonb),
    p_usd_rub_rate
  )
  ON CONFLICT (kind, period_month) DO UPDATE SET
    source_filename = EXCLUDED.source_filename,
    file_sha256 = EXCLUDED.file_sha256,
    uploaded_by_email = EXCLUDED.uploaded_by_email,
    row_count = EXCLUDED.row_count,
    totals = EXCLUDED.totals,
    usd_rub_rate = EXCLUDED.usd_rub_rate,
    updated_at = now()
  RETURNING id INTO v_import_id;

  DELETE FROM public.admin_finance_revenue_lines WHERE import_id = v_import_id;
  DELETE FROM public.admin_finance_cogs_lines WHERE import_id = v_import_id;

  IF p_kind = 'revenue' THEN
    INSERT INTO public.admin_finance_revenue_lines (
      import_id,
      provider_payment_id,
      paid_at,
      amount_gross,
      amount_net,
      commission,
      vat_on_commission,
      currency,
      payment_type,
      description
    )
    SELECT
      v_import_id,
      line->>'provider_payment_id',
      NULLIF(line->>'paid_at', '')::timestamptz,
      (line->>'amount_gross')::numeric,
      (line->>'amount_net')::numeric,
      COALESCE((line->>'commission')::numeric, 0),
      COALESCE((line->>'vat_on_commission')::numeric, 0),
      COALESCE(NULLIF(line->>'currency', ''), 'RUB'),
      NULLIF(line->>'payment_type', ''),
      NULLIF(line->>'description', '')
    FROM jsonb_array_elements(p_revenue_lines) AS line;
  ELSE
    INSERT INTO public.admin_finance_cogs_lines (
      import_id,
      usage_date,
      sku_id,
      sku_description,
      usage_amount,
      subtotal_usd
    )
    SELECT
      v_import_id,
      (line->>'usage_date')::date,
      line->>'sku_id',
      line->>'sku_description',
      COALESCE((line->>'usage_amount')::numeric, 0),
      (line->>'subtotal_usd')::numeric
    FROM jsonb_array_elements(p_cogs_lines) AS line;
  END IF;

  RETURN v_import_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_credit_liability_summary()
RETURNS TABLE (
  users_with_credits integer,
  credits_total bigint,
  blended_rub_per_credit numeric,
  liability_rub_estimate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH balances AS (
    SELECT
      count(*)::integer AS users_with_credits,
      coalesce(sum(credits), 0)::bigint AS credits_total
    FROM public.landing_users
    WHERE credits > 0
  ),
  paid AS (
    SELECT
      CASE
        WHEN coalesce(sum(credits), 0) > 0 THEN sum(amount_rub) / sum(credits)
        ELSE NULL
      END AS blended_rub_per_credit
    FROM public.landing_yookassa_payments
    WHERE status = 'succeeded'
      AND credited_at IS NOT NULL
      AND test IS NOT TRUE
  )
  SELECT
    b.users_with_credits,
    b.credits_total,
    p.blended_rub_per_credit,
    CASE
      WHEN p.blended_rub_per_credit IS NULL THEN NULL
      ELSE round(b.credits_total * p.blended_rub_per_credit, 2)
    END AS liability_rub_estimate
  FROM balances b
  CROSS JOIN paid p;
$$;

CREATE OR REPLACE FUNCTION public.admin_credit_liabilities(
  p_cursor_credits integer DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  landing_user_id uuid,
  email text,
  display_name text,
  provider text,
  credits integer,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    lu.updated_at
  FROM public.landing_users lu
  LEFT JOIN auth.users au ON au.id = lu.id
  LEFT JOIN public.imageprompt_users iu ON iu.id = lu.id
  WHERE lu.credits > 0
    AND (
      p_cursor_credits IS NULL
      OR p_cursor_id IS NULL
      OR lu.credits < p_cursor_credits
      OR (lu.credits = p_cursor_credits AND lu.id < p_cursor_id)
    )
  ORDER BY lu.credits DESC, lu.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.admin_credit_liability_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_liability_summary() TO service_role;

REVOKE ALL ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer)
  TO service_role;

COMMENT ON FUNCTION public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb
) IS 'Service-only transactional replace of one month kind (revenue|cogs) finance import.';

COMMENT ON FUNCTION public.admin_credit_liability_summary() IS
  'Service-only live unused-credit totals and blended RUB liability estimate.';

COMMENT ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer) IS
  'Service-only keyset list of users with credits > 0.';
