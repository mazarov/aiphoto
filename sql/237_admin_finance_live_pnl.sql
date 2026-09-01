-- Live admin finance P&L: provider cost on generations, unit-cost config,
-- month RPCs for YooKassa ledger + generation COGS. Service-role only.

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS provider_cost_usd numeric(12, 6);

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS provider_cost_source text;

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_provider_cost_source_chk;

ALTER TABLE public.landing_generations
  ADD CONSTRAINT landing_generations_provider_cost_source_chk
  CHECK (
    provider_cost_source IS NULL
    OR provider_cost_source IN ('xai_ticks', 'estimate')
  );

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_provider_cost_pair_chk;

ALTER TABLE public.landing_generations
  ADD CONSTRAINT landing_generations_provider_cost_pair_chk
  CHECK (
    (provider_cost_usd IS NULL AND provider_cost_source IS NULL)
    OR (provider_cost_usd IS NOT NULL AND provider_cost_usd >= 0 AND provider_cost_source IS NOT NULL)
  );

COMMENT ON COLUMN public.landing_generations.provider_cost_usd IS
  'Actual or recorded provider USD for this job. xAI ticks preferred; otherwise finance estimates.';
COMMENT ON COLUMN public.landing_generations.provider_cost_source IS
  'xai_ticks | estimate. NULL when cost is unknown.';

CREATE INDEX IF NOT EXISTS landing_generations_completed_at_idx
  ON public.landing_generations (generation_completed_at)
  WHERE status = 'completed';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES (
  'finance_model_unit_costs',
  $json${
    "gemini-2.5-flash-image": { "perImage": { "1K": 0.039, "2K": 0.039, "4K": 0.039 } },
    "gemini-3.1-flash-lite-image": { "perImage": { "1K": 0.0336, "2K": 0.05, "4K": 0.076 } },
    "gemini-3.1-flash-image-preview": { "perImage": { "1K": 0.067, "2K": 0.101, "4K": 0.151 } },
    "gemini-3-pro-image-preview": { "perImage": { "1K": 0.134, "2K": 0.134, "4K": 0.24 } },
    "veo-3.1-lite-generate-preview": { "perSecond": { "720p": 0.05, "1080p": 0.08 } },
    "gemini-omni-flash-preview": {},
    "grok-imagine-image-2.0": { "perImage": { "1K": 0.04, "2K": 0.04 } },
    "grok-imagine-video-1.5": { "perSecond": { "720p": 0.08 } },
    "seedream-4.5": { "perImage": { "1K": 0.03, "2K": 0.03, "4K": 0.03 } },
    "seedream-5.0-pro": { "perImage": { "1K": 0.045, "2K": 0.045, "4K": 0.045 } },
    "flux-2-flex": { "perImage": { "1K": 0.03, "2K": 0.03 } },
    "seedance-2.5": { "perSecond": { "720p": 0.1028 } }
  }$json$,
  now()
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.landing_generation_config IS
  'Generation + finance config (key/value). finance_model_unit_costs = USD list prices for live P&L.';

CREATE OR REPLACE FUNCTION public.admin_finance_month_bounds(p_month date)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (p_month::timestamp AT TIME ZONE 'Europe/Moscow'),
    ((p_month + INTERVAL '1 month')::timestamp AT TIME ZONE 'Europe/Moscow');
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_live_revenue_month(p_month date)
RETURNS TABLE (
  day date,
  payment_count integer,
  gross_rub numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF p_month IS NULL OR date_trunc('month', p_month)::date <> p_month THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = 'P0001';
  END IF;
  SELECT starts_at, ends_at INTO v_start, v_end
  FROM public.admin_finance_month_bounds(p_month);

  RETURN QUERY
  SELECT
    ((p.credited_at AT TIME ZONE 'Europe/Moscow')::date) AS day,
    COUNT(*)::integer AS payment_count,
    COALESCE(SUM(p.amount_rub), 0)::numeric AS gross_rub
  FROM public.landing_yookassa_payments p
  WHERE p.status = 'succeeded'
    AND p.credited_at IS NOT NULL
    AND p.credited_at >= v_start
    AND p.credited_at < v_end
    AND COALESCE(p.test, false) = false
  GROUP BY 1
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_live_cogs_month(p_month date)
RETURNS TABLE (
  day date,
  model_id text,
  image_size text,
  duration_seconds integer,
  jobs integer,
  billed_jobs integer,
  billed_usd numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF p_month IS NULL OR date_trunc('month', p_month)::date <> p_month THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = 'P0001';
  END IF;
  SELECT starts_at, ends_at INTO v_start, v_end
  FROM public.admin_finance_month_bounds(p_month);

  RETURN QUERY
  SELECT
    ((g.generation_completed_at AT TIME ZONE 'Europe/Moscow')::date) AS day,
    COALESCE(NULLIF(btrim(g.executed_model), ''), NULLIF(btrim(g.model), ''), 'unknown') AS model_id,
    COALESCE(NULLIF(btrim(g.image_size), ''), '1K') AS image_size,
    COALESCE(g.duration_seconds, 0) AS duration_seconds,
    COUNT(*)::integer AS jobs,
    COUNT(g.provider_cost_usd)::integer AS billed_jobs,
    COALESCE(SUM(g.provider_cost_usd), 0)::numeric AS billed_usd
  FROM public.landing_generations g
  WHERE g.status = 'completed'
    AND g.generation_completed_at IS NOT NULL
    AND g.generation_completed_at >= v_start
    AND g.generation_completed_at < v_end
  GROUP BY 1, 2, 3, 4
  ORDER BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finance_month_bounds(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_month_bounds(date) TO service_role;

REVOKE ALL ON FUNCTION public.admin_finance_live_revenue_month(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_live_revenue_month(date) TO service_role;

REVOKE ALL ON FUNCTION public.admin_finance_live_cogs_month(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_live_cogs_month(date) TO service_role;

COMMENT ON FUNCTION public.admin_finance_live_revenue_month(date) IS
  'Service-only YooKassa live revenue by Moscow day for a calendar month.';
COMMENT ON FUNCTION public.admin_finance_live_cogs_month(date) IS
  'Service-only completed generation counts/costs by Moscow day for a calendar month.';
