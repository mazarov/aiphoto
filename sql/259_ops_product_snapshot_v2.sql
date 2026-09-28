-- Week-ago baselines, activation, stuck payments, daytime no-payments flag.
-- Same function as 257; one scan of auth.users, one of landing_generations,
-- one of each payments table over 8 days.

CREATE OR REPLACE FUNCTION public.ops_product_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
SET statement_timeout = '3s'
AS $$
DECLARE
  v_reg_1h int;
  v_reg_3h int;
  v_reg_24h int;
  v_reg_1h_wk int;
  v_activated int;
  v_gen_15 int;
  v_gen_1h int;
  v_gen_1h_wk int;
  v_completed_15 int;
  v_completed_1h int;
  v_failed_15 int;
  v_failed_1h int;
  v_pending int;
  v_processing int;
  v_oldest int;
  v_revenue float8;
  v_payments int;
  v_revenue_wk float8;
  v_payments_wk int;
  v_payments_stuck int;
  v_payments_6h int;
  v_stars int;
  v_terminal int;
  v_hour int;
  v_activation int;
BEGIN
  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE created_at > now() - interval '3 hours'),
    count(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    count(*) FILTER (
      WHERE created_at > now() - interval '7 days 1 hour'
        AND created_at <= now() - interval '7 days'
    )
  INTO v_reg_1h, v_reg_3h, v_reg_24h, v_reg_1h_wk
  FROM auth.users;

  SELECT count(*)::int
  INTO v_activated
  FROM auth.users u
  WHERE u.created_at > now() - interval '24 hours'
    AND EXISTS (
      SELECT 1
      FROM public.landing_generations g
      WHERE g.user_id = u.id
    );

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '15 minutes'),
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*) FILTER (
      WHERE created_at > now() - interval '7 days 1 hour'
        AND created_at <= now() - interval '7 days'
    ),
    count(*) FILTER (WHERE status = 'completed' AND created_at > now() - interval '15 minutes'),
    count(*) FILTER (WHERE status = 'completed' AND created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '15 minutes'),
    count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE status = 'processing'),
    coalesce(
      floor(extract(epoch FROM (now() - min(created_at) FILTER (WHERE status = 'pending'))))::int,
      0
    )
  INTO
    v_gen_15, v_gen_1h, v_gen_1h_wk, v_completed_15, v_completed_1h, v_failed_15, v_failed_1h,
    v_pending, v_processing, v_oldest
  FROM public.landing_generations;

  SELECT
    (coalesce(sum(amount_rub) FILTER (WHERE ok AND created_at > now() - interval '24 hours'), 0))::float8,
    (count(*) FILTER (WHERE ok AND created_at > now() - interval '24 hours'))::int,
    (coalesce(sum(amount_rub) FILTER (
      WHERE ok
        AND created_at > now() - interval '8 days'
        AND created_at <= now() - interval '7 days'
    ), 0))::float8,
    (count(*) FILTER (
      WHERE ok
        AND created_at > now() - interval '8 days'
        AND created_at <= now() - interval '7 days'
    ))::int,
    (count(*) FILTER (
      WHERE status IN ('created', 'pending')
        AND created_at > now() - interval '24 hours'
        AND created_at <= now() - interval '1 hour'
    ))::int,
    (count(*) FILTER (WHERE ok AND created_at > now() - interval '6 hours'))::int
  INTO v_revenue, v_payments, v_revenue_wk, v_payments_wk, v_payments_stuck, v_payments_6h
  FROM (
    SELECT
      amount_rub,
      status,
      created_at,
      (status = 'succeeded' AND coalesce(test, false) = false) AS ok
    FROM public.landing_yookassa_payments
    WHERE created_at > now() - interval '8 days'
    UNION ALL
    SELECT
      amount_rub,
      status,
      created_at,
      (status = 'succeeded' AND test = false) AS ok
    FROM public.landing_robokassa_payments
    WHERE created_at > now() - interval '8 days'
  ) payments;

  SELECT count(*)
  INTO v_stars
  FROM public.landing_web_transactions
  WHERE state = 'done'
    AND created_at > now() - interval '24 hours';

  v_terminal := v_completed_15 + v_failed_15;
  v_hour := extract(hour FROM timezone('Europe/Moscow', now()))::int;
  v_activation := CASE
    WHEN v_reg_24h = 0 THEN 0
    ELSE round(100.0 * v_activated / v_reg_24h)::int
  END;

  RETURN jsonb_build_object(
    'registrations_1h', v_reg_1h,
    'registrations_3h', v_reg_3h,
    'registrations_24h', v_reg_24h,
    'registrations_1h_wk_ago', v_reg_1h_wk,
    'generations_15m', v_gen_15,
    'generations_1h', v_gen_1h,
    'generations_1h_wk_ago', v_gen_1h_wk,
    'generations_completed_15m', v_completed_15,
    'generations_completed_1h', v_completed_1h,
    'generations_failed_15m', v_failed_15,
    'generations_failed_1h', v_failed_1h,
    'queue_pending', v_pending,
    'queue_processing', v_processing,
    'oldest_pending_age_seconds', v_oldest,
    'revenue_rub_24h', v_revenue,
    'revenue_rub_24h_wk_ago', v_revenue_wk,
    'payments_succeeded_24h', v_payments,
    'payments_succeeded_24h_wk_ago', v_payments_wk,
    'payments_succeeded_6h', v_payments_6h,
    'payments_pending_1h', v_payments_stuck,
    'activation_24h_pct', v_activation,
    'stars_done_24h', v_stars,
    'alert_failed_ratio', CASE
      WHEN v_terminal >= 10 AND v_failed_15::float8 / v_terminal > 0.3 THEN 1
      ELSE 0
    END,
    'alert_queue_stuck', CASE
      WHEN v_pending > 0 AND v_completed_15 = 0 AND v_oldest >= 900 THEN 1
      ELSE 0
    END,
    'alert_no_registrations', CASE
      WHEN v_hour BETWEEN 9 AND 21 AND v_reg_3h = 0 THEN 1
      ELSE 0
    END,
    'alert_no_payments', CASE
      WHEN v_hour BETWEEN 9 AND 21 AND v_payments_6h = 0 THEN 1
      ELSE 0
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ops_product_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_product_snapshot() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_product_snapshot() TO service_role;
