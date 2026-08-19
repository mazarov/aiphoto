-- Admin finance: Yandex Direct spend import (kind=ads) and acquisition cohort.
-- Depends on sql/184 (finance import) and sql/196 (visitor/payment attribution).
-- Service-role only. No client policies. Additive and idempotent.
-- Ads is isolated from revenue/cogs and does not change netIncomeRub / Gemini P&L.

-- ---------------------------------------------------------------------------
-- 1. Allow kind=ads on monthly imports
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.admin_finance_imports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* 'kind'
      AND pg_get_constraintdef(oid) ~* 'revenue'
      AND pg_get_constraintdef(oid) !~* '''ads'''
  LOOP
    EXECUTE format(
      'ALTER TABLE public.admin_finance_imports DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.admin_finance_imports
  DROP CONSTRAINT IF EXISTS admin_finance_imports_kind_check;

ALTER TABLE public.admin_finance_imports
  ADD CONSTRAINT admin_finance_imports_kind_check
  CHECK (kind IN ('revenue', 'cogs', 'ads'));

COMMENT ON TABLE public.admin_finance_imports IS
  'Monthly admin imports: YooKassa cash-in (revenue), GCP Gemini spend (cogs), Yandex Direct spend (ads). Service-role only. Ads is not Gemini COGS and is excluded from netIncomeRub.';

-- ---------------------------------------------------------------------------
-- 2. Direct spend lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_finance_ads_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.admin_finance_imports(id) ON DELETE CASCADE,
  spend_date date NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text NOT NULL DEFAULT '',
  ad_group_id text,
  ad_id text,
  criterion_id text,
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  cost_rub numeric(14, 2) NOT NULL CHECK (cost_rub >= 0),
  currency text NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  CONSTRAINT admin_finance_ads_lines_campaign_id_chk CHECK (btrim(campaign_id) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_finance_ads_lines_grain_key
  ON public.admin_finance_ads_lines (
    import_id,
    spend_date,
    campaign_id,
    COALESCE(ad_id, ''),
    COALESCE(criterion_id, '')
  );

CREATE INDEX IF NOT EXISTS admin_finance_ads_lines_import_idx
  ON public.admin_finance_ads_lines (import_id);

CREATE INDEX IF NOT EXISTS admin_finance_ads_lines_day_campaign_idx
  ON public.admin_finance_ads_lines (spend_date, campaign_id);

ALTER TABLE public.admin_finance_ads_lines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_finance_ads_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_finance_ads_lines TO service_role;

COMMENT ON TABLE public.admin_finance_ads_lines IS
  'Parsed Yandex Direct spend lines (Moscow calendar dates). Grain: import × day × campaign × ad × criterion. Service-role only.';

-- ---------------------------------------------------------------------------
-- 3. Replace-import: keep revenue/cogs behavior, add p_ads_lines
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb
);
DROP FUNCTION IF EXISTS public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb, jsonb
);

CREATE FUNCTION public.admin_finance_replace_import(
  p_kind text,
  p_period_month date,
  p_source_filename text,
  p_file_sha256 text,
  p_uploaded_by_email text,
  p_row_count integer,
  p_totals jsonb,
  p_usd_rub_rate numeric DEFAULT NULL,
  p_revenue_lines jsonb DEFAULT NULL,
  p_cogs_lines jsonb DEFAULT NULL,
  p_ads_lines jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import_id uuid;
BEGIN
  IF p_kind NOT IN ('revenue', 'cogs', 'ads') THEN
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
  IF p_kind = 'ads' AND (p_ads_lines IS NULL OR jsonb_typeof(p_ads_lines) <> 'array') THEN
    RAISE EXCEPTION 'invalid_ads_lines' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'ads' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_ads_lines) AS line
    WHERE NULLIF(btrim(COALESCE(line->>'campaign_id', '')), '') IS NULL
       OR NULLIF(line->>'spend_date', '') IS NULL
       OR COALESCE(NULLIF(line->>'currency', ''), 'RUB') <> 'RUB'
  ) THEN
    RAISE EXCEPTION 'invalid_ads_lines' USING ERRCODE = 'P0001';
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
  DELETE FROM public.admin_finance_ads_lines WHERE import_id = v_import_id;

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
  ELSIF p_kind = 'cogs' THEN
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
  ELSE
    INSERT INTO public.admin_finance_ads_lines (
      import_id,
      spend_date,
      campaign_id,
      campaign_name,
      ad_group_id,
      ad_id,
      criterion_id,
      impressions,
      clicks,
      cost_rub,
      currency
    )
    SELECT
      v_import_id,
      (line->>'spend_date')::date,
      btrim(line->>'campaign_id'),
      COALESCE(line->>'campaign_name', ''),
      NULLIF(btrim(COALESCE(line->>'ad_group_id', '')), ''),
      NULLIF(btrim(COALESCE(line->>'ad_id', '')), ''),
      NULLIF(btrim(COALESCE(line->>'criterion_id', '')), ''),
      COALESCE((line->>'impressions')::bigint, 0),
      COALESCE((line->>'clicks')::bigint, 0),
      (line->>'cost_rub')::numeric,
      COALESCE(NULLIF(line->>'currency', ''), 'RUB')
    FROM jsonb_array_elements(p_ads_lines) AS line;
  END IF;

  RETURN v_import_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb, jsonb
) TO service_role;

COMMENT ON FUNCTION public.admin_finance_replace_import(
  text, date, text, text, text, integer, jsonb, numeric, jsonb, jsonb, jsonb
) IS
  'Service-only transactional replace of one month kind (revenue|cogs|ads). Empty ads array clears the month. Revenue/cogs insert shape unchanged. Named callers may omit p_ads_lines.';

-- ---------------------------------------------------------------------------
-- 4. Acquisition cohort + delivery + data quality (Europe/Moscow)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_acquisition_cohort(date, date, text, text, text);

CREATE FUNCTION public.admin_acquisition_cohort(
  p_from date,
  p_to date,
  p_source text DEFAULT NULL,
  p_campaign_id text DEFAULT NULL,
  p_landing_path text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := timezone('Europe/Moscow', now())::date;
  v_source text;
  v_campaign text;
  v_path text;
  v_result jsonb;
BEGIN
  IF to_regclass('public.landing_acquisition_visitors') IS NULL
     OR to_regclass('public.landing_visitor_user_links') IS NULL
     OR to_regprocedure('public.landing_is_shared_guest_owner(uuid)') IS NULL THEN
    RAISE EXCEPTION 'migration_196_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = 'P0001';
  END IF;
  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'period_too_long' USING ERRCODE = 'P0001';
  END IF;

  v_source := CASE
    WHEN lower(btrim(COALESCE(p_source, ''))) IN ('ya', 'yandex') THEN 'yandex'
    ELSE NULLIF(lower(btrim(COALESCE(p_source, ''))), '')
  END;
  v_campaign := NULLIF(btrim(COALESCE(p_campaign_id, '')), '');
  v_path := NULLIF(btrim(COALESCE(p_landing_path, '')), '');

  WITH
  guest_owners AS (
    SELECT DISTINCT id
    FROM (
      SELECT NULLIF(btrim(c.value), '')::uuid AS id
      FROM public.photo_app_config c
      WHERE c.key = 'stv_guest_owner_user_id'
        AND NULLIF(btrim(c.value), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      UNION ALL
      SELECT lu.id
      FROM public.landing_users lu
      WHERE lu.provider = 'stv_guest_owner'
      UNION ALL
      SELECT iu.id
      FROM public.imageprompt_users iu
      WHERE lower(iu.email) = 'stv-guest-owner@promptshot.internal'
    ) s
    WHERE id IS NOT NULL
  ),
  visitors_dim AS (
    SELECT
      v.visitor_id,
      v.first_seen_at,
      timezone('Europe/Moscow', v.first_seen_at)::date AS cohort_date,
      CASE
        WHEN lower(btrim(COALESCE(v.utm_source, ''))) IN ('ya', 'yandex') THEN 'yandex'
        ELSE NULLIF(lower(btrim(COALESCE(v.utm_source, ''))), '')
      END AS source_norm,
      NULLIF(lower(btrim(COALESCE(v.utm_medium, ''))), '') AS medium_norm,
      NULLIF(btrim(COALESCE(v.utm_campaign, '')), '') AS campaign_id,
      CASE
        WHEN NULLIF(btrim(COALESCE(v.utm_content, '')), '') IS NULL THEN NULL
        WHEN btrim(v.utm_content) ~* '^sitelink[0-9]+\.' THEN
          NULLIF(split_part(btrim(v.utm_content), '.', 2), '')
        ELSE NULLIF(split_part(btrim(v.utm_content), '.', 1), '')
      END AS ad_id,
      NULLIF(btrim(COALESCE(v.utm_landing_path, '')), '') AS landing_path,
      NULLIF(btrim(COALESCE(v.yclid, '')), '') AS yclid
    FROM public.landing_acquisition_visitors v
  ),
  visitors_in AS (
    SELECT d.*
    FROM visitors_dim d
    WHERE d.cohort_date BETWEEN p_from AND p_to
      AND (v_source IS NULL OR d.source_norm = v_source)
      AND (v_campaign IS NULL OR d.campaign_id = v_campaign)
      AND (v_path IS NULL OR d.landing_path = v_path)
  ),
  aha_events AS (
    SELECT e.visitor_id, e.created_at AS at
    FROM public.extension_client_events e
    WHERE e.event = 'prompt_copy'
      AND e.visitor_id IS NOT NULL
    UNION ALL
    SELECT e.visitor_id, e.created_at
    FROM public.extension_analyze_events e
    WHERE e.outcome = 'success'
      AND e.visitor_id IS NOT NULL
    UNION ALL
    SELECT g.visitor_id, COALESCE(g.generation_completed_at, g.updated_at, g.created_at)
    FROM public.landing_generations g
    WHERE g.status = 'completed'
      AND g.visitor_id IS NOT NULL
  ),
  aha_days AS (
    SELECT
      visitor_id,
      timezone('Europe/Moscow', at)::date AS day
    FROM aha_events
    GROUP BY 1, 2
  ),
  visitor_aha AS (
    SELECT
      v.visitor_id,
      v.cohort_date,
      v.first_seen_at,
      (min(a.at) IS NOT NULL) AS has_aha,
      min(a.at) AS first_aha_at,
      EXISTS (
        SELECT 1 FROM aha_days d
        WHERE d.visitor_id = v.visitor_id
          AND d.day = v.cohort_date + 1
      ) AS retained_d1,
      EXISTS (
        SELECT 1 FROM aha_days d
        WHERE d.visitor_id = v.visitor_id
          AND d.day > v.cohort_date
          AND d.day <= v.cohort_date + 7
      ) AS retained_d7
    FROM visitors_in v
    LEFT JOIN aha_events a ON a.visitor_id = v.visitor_id
    GROUP BY v.visitor_id, v.cohort_date, v.first_seen_at
  ),
  user_acq AS (
    SELECT
      lu.id AS landing_user_id,
      COALESCE(lu.acquisition_visitor_id, first_link.visitor_id) AS visitor_id
    FROM public.landing_users lu
    LEFT JOIN LATERAL (
      SELECT l.visitor_id
      FROM public.landing_visitor_user_links l
      WHERE l.landing_user_id = lu.id
      ORDER BY l.linked_at, l.visitor_id
      LIMIT 1
    ) first_link ON true
    WHERE NOT public.landing_is_shared_guest_owner(lu.id)
  ),
  live_payments AS (
    SELECT
      yp.id,
      'yookassa'::text AS provider,
      yp.landing_user_id,
      yp.visitor_id AS payment_visitor_id,
      yp.utm_source,
      yp.utm_medium,
      yp.utm_campaign,
      yp.utm_content,
      yp.utm_landing_path,
      yp.amount_rub,
      yp.credited_at,
      timezone('Europe/Moscow', yp.credited_at)::date AS pay_date,
      yp.yandex_conversion_sent_at,
      yp.yandex_conversion_error
    FROM public.landing_yookassa_payments yp
    WHERE yp.status = 'succeeded'
      AND yp.credited_at IS NOT NULL
      AND yp.test IS NOT TRUE
    UNION ALL
    SELECT
      rp.id,
      'robokassa'::text,
      rp.landing_user_id,
      rp.visitor_id,
      rp.utm_source,
      rp.utm_medium,
      rp.utm_campaign,
      rp.utm_content,
      rp.utm_landing_path,
      rp.amount_rub,
      rp.credited_at,
      timezone('Europe/Moscow', rp.credited_at)::date,
      rp.yandex_conversion_sent_at,
      rp.yandex_conversion_error
    FROM public.landing_robokassa_payments rp
    WHERE rp.status = 'succeeded'
      AND rp.credited_at IS NOT NULL
      AND rp.test IS NOT TRUE
  ),
  payments_attr AS (
    SELECT
      p.*,
      COALESCE(p.payment_visitor_id, ua.visitor_id) AS visitor_id,
      CASE
        WHEN lower(btrim(COALESCE(p.utm_source, ''))) IN ('ya', 'yandex') THEN 'yandex'
        ELSE NULLIF(lower(btrim(COALESCE(p.utm_source, ''))), '')
      END AS pay_source_norm,
      NULLIF(btrim(COALESCE(p.utm_campaign, '')), '') AS pay_campaign_id,
      NULLIF(btrim(COALESCE(p.utm_landing_path, '')), '') AS pay_landing_path,
      row_number() OVER (
        PARTITION BY p.landing_user_id
        ORDER BY p.credited_at, p.id
      ) AS payment_seq
    FROM live_payments p
    LEFT JOIN user_acq ua ON ua.landing_user_id = p.landing_user_id
  ),
  payments_filtered AS (
    SELECT p.*
    FROM payments_attr p
    LEFT JOIN visitors_dim vd ON vd.visitor_id = p.visitor_id
    WHERE (v_source IS NULL OR COALESCE(p.pay_source_norm, vd.source_norm) = v_source)
      AND (v_campaign IS NULL OR COALESCE(p.pay_campaign_id, vd.campaign_id) = v_campaign)
      AND (v_path IS NULL OR COALESCE(p.pay_landing_path, vd.landing_path) = v_path)
  ),
  spend_include AS (
    SELECT (v_source IS NULL OR v_source = 'yandex') AS ok
  ),
  spend_day AS (
    SELECT
      l.spend_date AS day,
      sum(l.cost_rub)::numeric AS spend_rub,
      sum(l.impressions)::bigint AS impressions,
      sum(l.clicks)::bigint AS clicks
    FROM public.admin_finance_ads_lines l
    CROSS JOIN spend_include si
    WHERE si.ok
      AND l.spend_date BETWEEN p_from AND p_to
      AND (v_campaign IS NULL OR l.campaign_id = v_campaign)
    GROUP BY l.spend_date
  ),
  spend_campaign_day AS (
    SELECT
      l.spend_date AS day,
      l.campaign_id,
      sum(l.cost_rub)::numeric AS spend_rub
    FROM public.admin_finance_ads_lines l
    CROSS JOIN spend_include si
    WHERE si.ok
      AND l.spend_date BETWEEN p_from AND p_to
      AND (v_campaign IS NULL OR l.campaign_id = v_campaign)
    GROUP BY l.spend_date, l.campaign_id
  ),
  spend_ad_day AS (
    SELECT
      l.spend_date AS day,
      l.campaign_id,
      COALESCE(l.ad_id, '') AS ad_id,
      sum(l.cost_rub)::numeric AS spend_rub
    FROM public.admin_finance_ads_lines l
    CROSS JOIN spend_include si
    WHERE si.ok
      AND l.spend_date BETWEEN p_from AND p_to
      AND (v_campaign IS NULL OR l.campaign_id = v_campaign)
    GROUP BY l.spend_date, l.campaign_id, COALESCE(l.ad_id, '')
  ),
  calendar AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
  ),
  delivery AS (
    SELECT
      c.day,
      COALESCE(s.spend_rub, 0)::numeric AS spend_rub,
      COALESCE(s.impressions, 0)::bigint AS impressions,
      COALESCE(s.clicks, 0)::bigint AS clicks,
      CASE
        WHEN COALESCE(s.impressions, 0) = 0 THEN NULL
        ELSE round(s.clicks::numeric / s.impressions::numeric, 6)
      END AS ctr,
      CASE
        WHEN COALESCE(s.clicks, 0) = 0 THEN NULL
        ELSE round(s.spend_rub / s.clicks::numeric, 6)
      END AS cpc,
      count(p.id)::integer AS payments,
      COALESCE(sum(p.amount_rub), 0)::numeric AS gross_revenue_rub
    FROM calendar c
    LEFT JOIN spend_day s ON s.day = c.day
    LEFT JOIN payments_filtered p ON p.pay_date = c.day
    GROUP BY c.day, s.spend_rub, s.impressions, s.clicks
  ),
  cohort_visitors AS (
    SELECT
      v.cohort_date,
      v.source_norm,
      v.campaign_id,
      v.ad_id,
      v.landing_path,
      v.visitor_id,
      COALESCE(a.has_aha, false) AS has_aha,
      COALESCE(a.retained_d1, false) AS retained_d1,
      COALESCE(a.retained_d7, false) AS retained_d7,
      a.first_aha_at
    FROM visitors_in v
    LEFT JOIN visitor_aha a ON a.visitor_id = v.visitor_id
  ),
  visitor_groups AS (
    SELECT
      cohort_date,
      source_norm,
      campaign_id,
      ad_id,
      landing_path,
      count(*)::integer AS visitors,
      count(*) FILTER (WHERE has_aha)::integer AS aha_visitors,
      count(*) FILTER (WHERE retained_d1)::integer AS d1_retained,
      count(*) FILTER (WHERE retained_d7)::integer AS d7_retained
    FROM cohort_visitors
    GROUP BY 1, 2, 3, 4, 5
  ),
  signup_groups AS (
    SELECT
      cv.cohort_date,
      cv.source_norm,
      cv.campaign_id,
      cv.ad_id,
      cv.landing_path,
      count(DISTINCT ua.landing_user_id)::integer AS signup_users
    FROM cohort_visitors cv
    JOIN user_acq ua ON ua.visitor_id = cv.visitor_id
    GROUP BY 1, 2, 3, 4, 5
  ),
  pay_groups AS (
    SELECT
      cv.cohort_date,
      cv.source_norm,
      cv.campaign_id,
      cv.ad_id,
      cv.landing_path,
      count(DISTINCT p.landing_user_id) FILTER (WHERE p.payment_seq = 1)::integer AS first_payers,
      count(*) FILTER (WHERE p.payment_seq = 1)::integer AS first_payments,
      count(*) FILTER (WHERE p.payment_seq > 1)::integer AS repeat_payments,
      COALESCE(sum(p.amount_rub) FILTER (
        WHERE p.pay_date >= cv.cohort_date AND p.pay_date <= cv.cohort_date
      ), 0)::numeric AS revenue_d0,
      COALESCE(sum(p.amount_rub) FILTER (
        WHERE p.pay_date >= cv.cohort_date AND p.pay_date <= cv.cohort_date + 7
      ), 0)::numeric AS revenue_d7,
      COALESCE(sum(p.amount_rub) FILTER (
        WHERE p.pay_date >= cv.cohort_date AND p.pay_date <= cv.cohort_date + 30
      ), 0)::numeric AS revenue_d30
    FROM cohort_visitors cv
    JOIN user_acq ua ON ua.visitor_id = cv.visitor_id
    JOIN payments_attr p
      ON p.landing_user_id = ua.landing_user_id
     AND p.visitor_id = cv.visitor_id
    GROUP BY 1, 2, 3, 4, 5
  ),
  cohorts AS (
    SELECT
      vg.cohort_date,
      vg.source_norm AS source,
      vg.campaign_id,
      vg.ad_id,
      vg.landing_path,
      vg.visitors,
      vg.aha_visitors,
      COALESCE(sg.signup_users, 0)::integer AS signup_users,
      COALESCE(pg.first_payers, 0)::integer AS first_payers,
      COALESCE(pg.first_payments, 0)::integer AS first_payments,
      COALESCE(pg.repeat_payments, 0)::integer AS repeat_payments,
      COALESCE(pg.revenue_d0, 0)::numeric AS revenue_d0,
      COALESCE(pg.revenue_d7, 0)::numeric AS revenue_d7,
      COALESCE(pg.revenue_d30, 0)::numeric AS revenue_d30,
      vg.d1_retained,
      vg.d7_retained,
      ((v_today - vg.cohort_date) >= 7) AS mature_d7,
      ((v_today - vg.cohort_date) >= 30) AS mature_d30,
      COALESCE(sad.spend_rub, 0)::numeric AS spend_rub
    FROM visitor_groups vg
    LEFT JOIN signup_groups sg
      ON sg.cohort_date = vg.cohort_date
     AND sg.source_norm IS NOT DISTINCT FROM vg.source_norm
     AND sg.campaign_id IS NOT DISTINCT FROM vg.campaign_id
     AND sg.ad_id IS NOT DISTINCT FROM vg.ad_id
     AND sg.landing_path IS NOT DISTINCT FROM vg.landing_path
    LEFT JOIN pay_groups pg
      ON pg.cohort_date = vg.cohort_date
     AND pg.source_norm IS NOT DISTINCT FROM vg.source_norm
     AND pg.campaign_id IS NOT DISTINCT FROM vg.campaign_id
     AND pg.ad_id IS NOT DISTINCT FROM vg.ad_id
     AND pg.landing_path IS NOT DISTINCT FROM vg.landing_path
    LEFT JOIN spend_ad_day sad
      ON sad.day = vg.cohort_date
     AND sad.campaign_id IS NOT DISTINCT FROM vg.campaign_id
     AND sad.ad_id = COALESCE(vg.ad_id, '')
  ),
  campaign_economics AS (
    SELECT
      c.cohort_date,
      c.source,
      c.campaign_id,
      sum(c.visitors)::integer AS visitors,
      sum(c.aha_visitors)::integer AS aha_visitors,
      sum(c.signup_users)::integer AS signup_users,
      sum(c.first_payers)::integer AS first_payers,
      sum(c.first_payments)::integer AS first_payments,
      sum(c.repeat_payments)::integer AS repeat_payments,
      sum(c.revenue_d0)::numeric AS revenue_d0,
      sum(c.revenue_d7)::numeric AS revenue_d7,
      sum(c.revenue_d30)::numeric AS revenue_d30,
      bool_and(c.mature_d7) AS mature_d7,
      bool_and(c.mature_d30) AS mature_d30,
      COALESCE(sc.spend_rub, 0)::numeric AS spend_rub
    FROM cohorts c
    LEFT JOIN spend_campaign_day sc
      ON sc.day = c.cohort_date
     AND sc.campaign_id IS NOT DISTINCT FROM c.campaign_id
    GROUP BY c.cohort_date, c.source, c.campaign_id, sc.spend_rub
  ),
  totals AS (
    SELECT
      COALESCE(sum(c.visitors), 0)::integer AS visitors,
      COALESCE(sum(c.aha_visitors), 0)::integer AS aha_visitors,
      COALESCE(sum(c.signup_users), 0)::integer AS signup_users,
      COALESCE(sum(c.first_payers), 0)::integer AS first_payers,
      COALESCE(sum(c.first_payments), 0)::integer AS first_payments,
      COALESCE(sum(c.repeat_payments), 0)::integer AS repeat_payments,
      COALESCE(sum(c.revenue_d0), 0)::numeric AS revenue_d0,
      COALESCE(sum(c.revenue_d7), 0)::numeric AS revenue_d7,
      COALESCE(sum(c.revenue_d30), 0)::numeric AS revenue_d30,
      COALESCE((SELECT sum(spend_rub) FROM spend_day), 0)::numeric AS spend_rub
    FROM cohorts c
  ),
  funnel_facts AS (
    SELECT 'analyze'::text AS fact, e.visitor_id, e.user_id, e.created_at AS at,
           NULL::text AS session_key, NULL::text AS event_name
    FROM public.extension_analyze_events e
    WHERE timezone('Europe/Moscow', e.created_at)::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'client', e.visitor_id, e.user_id, e.created_at, e.session_id::text, e.event
    FROM public.extension_client_events e
    WHERE timezone('Europe/Moscow', e.created_at)::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'analyze_history', e.visitor_id, e.user_id, e.created_at, e.session_id::text, NULL
    FROM public.analyze_history e
    WHERE timezone('Europe/Moscow', e.created_at)::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'generation', g.visitor_id, g.user_id, g.created_at, g.session_id::text, NULL
    FROM public.landing_generations g
    WHERE timezone('Europe/Moscow', g.created_at)::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'card_view', ev.visitor_id, NULL, ev.viewed_at, ev.session_id::text, NULL
    FROM public.prompt_card_view_events ev
    WHERE timezone('Europe/Moscow', ev.viewed_at)::date BETWEEN p_from AND p_to
  ),
  oauth_users AS (
    SELECT lu.id, lu.created_at
    FROM public.landing_users lu
    WHERE lu.id NOT IN (SELECT id FROM guest_owners)
      AND COALESCE(lu.provider, '') NOT IN ('stv_guest_owner', 'anonymous')
      AND timezone('Europe/Moscow', lu.created_at)::date BETWEEN p_from AND p_to
  ),
  period_live AS (
    SELECT p.*
    FROM payments_attr p
    WHERE p.pay_date BETWEEN p_from AND p_to
  ),
  quality AS (
    SELECT
      (SELECT count(*) FROM visitors_in v WHERE v.source_norm = 'yandex' AND v.medium_norm = 'cpc')::integer
        AS direct_visits,
      (SELECT count(*) FROM visitors_in v
        WHERE v.source_norm = 'yandex' AND v.medium_norm = 'cpc' AND v.yclid IS NOT NULL)::integer
        AS direct_visits_with_yclid,
      (SELECT count(*) FROM visitors_in v
        WHERE v.source_norm = 'yandex' AND v.medium_norm = 'cpc' AND v.campaign_id ~ '^[0-9]+$')::integer
        AS direct_visits_with_numeric_campaign,
      (SELECT count(*) FROM visitors_in v WHERE v.yclid IS NOT NULL AND v.source_norm IS NULL)::integer
        AS yclid_without_utm,
      (SELECT count(*) FROM funnel_facts)::integer AS funnel_facts,
      (SELECT count(*) FROM funnel_facts f WHERE f.visitor_id IS NOT NULL)::integer AS funnel_facts_with_visitor,
      (SELECT count(*) FROM oauth_users)::integer AS oauth_users,
      (SELECT count(*) FROM oauth_users u
        WHERE EXISTS (
          SELECT 1 FROM public.landing_visitor_user_links l
          WHERE l.landing_user_id = u.id
        ))::integer AS oauth_users_with_visitor_link,
      (SELECT count(*) FROM period_live)::integer AS live_payments,
      (SELECT count(*) FROM period_live p
        WHERE p.payment_visitor_id IS NOT NULL OR p.utm_source IS NOT NULL)::integer
        AS live_payments_with_snapshot,
      (SELECT count(*) FROM period_live p WHERE p.yandex_conversion_sent_at IS NOT NULL)::integer
        AS mp_sent,
      (SELECT count(*) FROM period_live p
        WHERE p.yandex_conversion_error IS NOT NULL
          AND p.yandex_conversion_sent_at IS NULL)::integer
        AS mp_error,
      (SELECT count(*) FROM funnel_facts f
        WHERE f.user_id IN (SELECT id FROM guest_owners))::integer
        AS guest_owner_facts,
      (SELECT count(*) FROM (
          SELECT visitor_id, session_key
          FROM funnel_facts
          WHERE event_name = 'landing_view'
            AND visitor_id IS NOT NULL
            AND session_key IS NOT NULL
          GROUP BY visitor_id, session_key
          HAVING count(*) > 1
        ) d)::integer AS duplicate_landing_view_sessions,
      (SELECT count(*) FROM (
          SELECT visitor_id
          FROM public.landing_visitor_user_links
          GROUP BY visitor_id
          HAVING count(DISTINCT landing_user_id) > 1
        ) d)::integer AS visitors_linked_to_multiple_users,
      (SELECT COALESCE(jsonb_agg(x.campaign_id ORDER BY x.campaign_id), '[]'::jsonb)
        FROM (
          SELECT DISTINCT l.campaign_id
          FROM public.admin_finance_ads_lines l
          WHERE l.spend_date BETWEEN p_from AND p_to
            AND (v_campaign IS NULL OR l.campaign_id = v_campaign)
            AND NOT EXISTS (
              SELECT 1
              FROM public.landing_acquisition_visitors vis
              WHERE vis.utm_campaign = l.campaign_id
            )
        ) x) AS unmatched_spend_campaigns,
      (SELECT
          CASE
            WHEN count(*) FILTER (WHERE first_aha_at IS NOT NULL) = 0 THEN NULL
            ELSE round(
              avg(extract(epoch FROM (first_aha_at - first_seen_at)) / 3600.0)
                FILTER (WHERE first_aha_at IS NOT NULL),
              2
            )
          END
        FROM visitor_aha) AS time_to_first_aha_hours
  )
  SELECT jsonb_build_object(
    'timezone', 'Europe/Moscow',
    'from', p_from,
    'to', p_to,
    'as_of', v_today,
    'filters', jsonb_build_object(
      'source', v_source,
      'campaign_id', v_campaign,
      'landing_path', v_path
    ),
    'notes', jsonb_build_object(
      'revenue', 'gross — payment refunds are not modeled',
      'cogs', 'Gemini/GCP cost is not allocated to campaigns',
      'stars', 'Telegram Stars / landing_web_transactions excluded',
      'spend_allocation', 'campaign×ad×day; not split by landing_path. Use campaign_economics for CAC/ROAS without path double-count.',
      'join', 'utm_campaign = Direct campaign_id; yclid is never used as campaign id'
    ),
    'delivery', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'spend_rub', d.spend_rub,
          'impressions', d.impressions,
          'clicks', d.clicks,
          'ctr', d.ctr,
          'cpc', d.cpc,
          'payments', d.payments,
          'gross_revenue_rub', d.gross_revenue_rub
        ) ORDER BY d.day
      )
      FROM delivery d
    ), '[]'::jsonb),
    'cohorts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'cohort_date', c.cohort_date,
          'source', c.source,
          'campaign_id', c.campaign_id,
          'ad_id', c.ad_id,
          'landing_path', c.landing_path,
          'visitors', c.visitors,
          'aha_visitors', c.aha_visitors,
          'signup_users', c.signup_users,
          'first_payers', c.first_payers,
          'first_payments', c.first_payments,
          'repeat_payments', c.repeat_payments,
          'revenue_d0', c.revenue_d0,
          'revenue_d7', c.revenue_d7,
          'revenue_d30', c.revenue_d30,
          'd1_retained', c.d1_retained,
          'd7_retained', c.d7_retained,
          'mature_d7', c.mature_d7,
          'mature_d30', c.mature_d30,
          'spend_rub', c.spend_rub,
          'activation_rate', CASE WHEN c.visitors = 0 THEN NULL ELSE round(c.aha_visitors::numeric / c.visitors, 6) END,
          'signup_rate', CASE WHEN c.visitors = 0 THEN NULL ELSE round(c.signup_users::numeric / c.visitors, 6) END,
          'payer_conversion', CASE WHEN c.visitors = 0 THEN NULL ELSE round(c.first_payers::numeric / c.visitors, 6) END,
          'cpa_aha', CASE WHEN c.aha_visitors = 0 THEN NULL ELSE round(c.spend_rub / c.aha_visitors, 6) END,
          'cac', CASE WHEN c.first_payers = 0 THEN NULL ELSE round(c.spend_rub / c.first_payers, 6) END,
          'gross_roas_d0', CASE WHEN c.spend_rub = 0 THEN NULL ELSE round(c.revenue_d0 / c.spend_rub, 6) END,
          'gross_roas_d7', CASE WHEN c.spend_rub = 0 THEN NULL ELSE round(c.revenue_d7 / c.spend_rub, 6) END,
          'gross_roas_d30', CASE WHEN c.spend_rub = 0 THEN NULL ELSE round(c.revenue_d30 / c.spend_rub, 6) END,
          'gross_romi_d0', CASE WHEN c.spend_rub = 0 THEN NULL ELSE round((c.revenue_d0 - c.spend_rub) / c.spend_rub, 6) END,
          'gross_romi_d7', CASE WHEN c.spend_rub = 0 THEN NULL ELSE round((c.revenue_d7 - c.spend_rub) / c.spend_rub, 6) END,
          'gross_romi_d30', CASE WHEN c.spend_rub = 0 THEN NULL ELSE round((c.revenue_d30 - c.spend_rub) / c.spend_rub, 6) END,
          'ltv_d0', CASE WHEN c.first_payers = 0 THEN NULL ELSE round(c.revenue_d0 / c.first_payers, 6) END,
          'ltv_d7', CASE WHEN c.first_payers = 0 THEN NULL ELSE round(c.revenue_d7 / c.first_payers, 6) END,
          'ltv_d30', CASE WHEN c.first_payers = 0 THEN NULL ELSE round(c.revenue_d30 / c.first_payers, 6) END
        ) ORDER BY c.cohort_date, c.source, c.campaign_id, c.ad_id, c.landing_path
      )
      FROM cohorts c
    ), '[]'::jsonb),
    'campaign_economics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'cohort_date', e.cohort_date,
          'source', e.source,
          'campaign_id', e.campaign_id,
          'visitors', e.visitors,
          'aha_visitors', e.aha_visitors,
          'signup_users', e.signup_users,
          'first_payers', e.first_payers,
          'first_payments', e.first_payments,
          'repeat_payments', e.repeat_payments,
          'revenue_d0', e.revenue_d0,
          'revenue_d7', e.revenue_d7,
          'revenue_d30', e.revenue_d30,
          'mature_d7', e.mature_d7,
          'mature_d30', e.mature_d30,
          'spend_rub', e.spend_rub,
          'activation_rate', CASE WHEN e.visitors = 0 THEN NULL ELSE round(e.aha_visitors::numeric / e.visitors, 6) END,
          'signup_rate', CASE WHEN e.signup_users IS NULL OR e.visitors = 0 THEN NULL ELSE round(e.signup_users::numeric / e.visitors, 6) END,
          'payer_conversion', CASE WHEN e.visitors = 0 THEN NULL ELSE round(e.first_payers::numeric / e.visitors, 6) END,
          'cpa_aha', CASE WHEN e.aha_visitors = 0 THEN NULL ELSE round(e.spend_rub / e.aha_visitors, 6) END,
          'cac', CASE WHEN e.first_payers = 0 THEN NULL ELSE round(e.spend_rub / e.first_payers, 6) END,
          'gross_roas_d0', CASE WHEN e.spend_rub = 0 THEN NULL ELSE round(e.revenue_d0 / e.spend_rub, 6) END,
          'gross_roas_d7', CASE WHEN e.spend_rub = 0 THEN NULL ELSE round(e.revenue_d7 / e.spend_rub, 6) END,
          'gross_roas_d30', CASE WHEN e.spend_rub = 0 THEN NULL ELSE round(e.revenue_d30 / e.spend_rub, 6) END,
          'gross_romi_d0', CASE WHEN e.spend_rub = 0 THEN NULL ELSE round((e.revenue_d0 - e.spend_rub) / e.spend_rub, 6) END,
          'gross_romi_d7', CASE WHEN e.spend_rub = 0 THEN NULL ELSE round((e.revenue_d7 - e.spend_rub) / e.spend_rub, 6) END,
          'gross_romi_d30', CASE WHEN e.spend_rub = 0 THEN NULL ELSE round((e.revenue_d30 - e.spend_rub) / e.spend_rub, 6) END,
          'ltv_d0', CASE WHEN e.first_payers = 0 THEN NULL ELSE round(e.revenue_d0 / e.first_payers, 6) END,
          'ltv_d7', CASE WHEN e.first_payers = 0 THEN NULL ELSE round(e.revenue_d7 / e.first_payers, 6) END,
          'ltv_d30', CASE WHEN e.first_payers = 0 THEN NULL ELSE round(e.revenue_d30 / e.first_payers, 6) END
        ) ORDER BY e.cohort_date, e.source, e.campaign_id
      )
      FROM campaign_economics e
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'visitors', t.visitors,
        'aha_visitors', t.aha_visitors,
        'signup_users', t.signup_users,
        'first_payers', t.first_payers,
        'first_payments', t.first_payments,
        'repeat_payments', t.repeat_payments,
        'revenue_d0', t.revenue_d0,
        'revenue_d7', t.revenue_d7,
        'revenue_d30', t.revenue_d30,
        'spend_rub', t.spend_rub,
        'activation_rate', CASE WHEN t.visitors = 0 THEN NULL ELSE round(t.aha_visitors::numeric / t.visitors, 6) END,
        'signup_rate', CASE WHEN t.visitors = 0 THEN NULL ELSE round(t.signup_users::numeric / t.visitors, 6) END,
        'payer_conversion', CASE WHEN t.visitors = 0 THEN NULL ELSE round(t.first_payers::numeric / t.visitors, 6) END,
        'cpa_aha', CASE WHEN t.aha_visitors = 0 THEN NULL ELSE round(t.spend_rub / t.aha_visitors, 6) END,
        'cac', CASE WHEN t.first_payers = 0 THEN NULL ELSE round(t.spend_rub / t.first_payers, 6) END,
        'gross_roas_d0', CASE WHEN t.spend_rub = 0 THEN NULL ELSE round(t.revenue_d0 / t.spend_rub, 6) END,
        'gross_roas_d7', CASE WHEN t.spend_rub = 0 THEN NULL ELSE round(t.revenue_d7 / t.spend_rub, 6) END,
        'gross_roas_d30', CASE WHEN t.spend_rub = 0 THEN NULL ELSE round(t.revenue_d30 / t.spend_rub, 6) END,
        'gross_romi_d0', CASE WHEN t.spend_rub = 0 THEN NULL ELSE round((t.revenue_d0 - t.spend_rub) / t.spend_rub, 6) END,
        'gross_romi_d7', CASE WHEN t.spend_rub = 0 THEN NULL ELSE round((t.revenue_d7 - t.spend_rub) / t.spend_rub, 6) END,
        'gross_romi_d30', CASE WHEN t.spend_rub = 0 THEN NULL ELSE round((t.revenue_d30 - t.spend_rub) / t.spend_rub, 6) END,
        'ltv_d0', CASE WHEN t.first_payers = 0 THEN NULL ELSE round(t.revenue_d0 / t.first_payers, 6) END,
        'ltv_d7', CASE WHEN t.first_payers = 0 THEN NULL ELSE round(t.revenue_d7 / t.first_payers, 6) END,
        'ltv_d30', CASE WHEN t.first_payers = 0 THEN NULL ELSE round(t.revenue_d30 / t.first_payers, 6) END
      )
      FROM totals t
    ),
    'data_quality', (
      SELECT jsonb_build_object(
        'direct_visits', q.direct_visits,
        'direct_visits_with_yclid', q.direct_visits_with_yclid,
        'direct_visits_with_numeric_campaign', q.direct_visits_with_numeric_campaign,
        'direct_yclid_rate', CASE WHEN q.direct_visits = 0 THEN NULL ELSE round(q.direct_visits_with_yclid::numeric / q.direct_visits, 6) END,
        'direct_numeric_campaign_rate', CASE WHEN q.direct_visits = 0 THEN NULL ELSE round(q.direct_visits_with_numeric_campaign::numeric / q.direct_visits, 6) END,
        'yclid_without_utm', q.yclid_without_utm,
        'funnel_facts', q.funnel_facts,
        'funnel_facts_with_visitor', q.funnel_facts_with_visitor,
        'funnel_visitor_rate', CASE WHEN q.funnel_facts = 0 THEN NULL ELSE round(q.funnel_facts_with_visitor::numeric / q.funnel_facts, 6) END,
        'oauth_users', q.oauth_users,
        'oauth_users_with_visitor_link', q.oauth_users_with_visitor_link,
        'oauth_visitor_link_rate', CASE WHEN q.oauth_users = 0 THEN NULL ELSE round(q.oauth_users_with_visitor_link::numeric / q.oauth_users, 6) END,
        'live_payments', q.live_payments,
        'live_payments_with_snapshot', q.live_payments_with_snapshot,
        'live_payment_snapshot_rate', CASE WHEN q.live_payments = 0 THEN NULL ELSE round(q.live_payments_with_snapshot::numeric / q.live_payments, 6) END,
        'mp_sent', q.mp_sent,
        'mp_error', q.mp_error,
        'guest_owner_facts', q.guest_owner_facts,
        'duplicate_landing_view_sessions', q.duplicate_landing_view_sessions,
        'visitors_linked_to_multiple_users', q.visitors_linked_to_multiple_users,
        'unmatched_spend_campaigns', q.unmatched_spend_campaigns,
        'time_to_first_aha_hours', q.time_to_first_aha_hours
      )
      FROM quality q
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_acquisition_cohort(date, date, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_acquisition_cohort(date, date, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.admin_acquisition_cohort(date, date, text, text, text) IS
  'Service-only Europe/Moscow delivery calendar, acquisition cohorts (D0/D7/D30 + maturity), and data quality. Gross revenue from YooKassa+Robokassa live payments only. Join spend on utm_campaign, never yclid.';
