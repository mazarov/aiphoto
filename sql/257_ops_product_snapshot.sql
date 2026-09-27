-- Product counters for the ops snapshot log. Service role only.
-- One scan of landing_generations per call; the landing cron runs it once a minute.

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
  v_gen_15 int;
  v_gen_1h int;
  v_completed_15 int;
  v_completed_1h int;
  v_failed_15 int;
  v_failed_1h int;
  v_pending int;
  v_processing int;
  v_oldest int;
  v_revenue float8;
  v_payments int;
  v_stars int;
  v_terminal int;
  v_hour int;
BEGIN
  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE created_at > now() - interval '3 hours'),
    count(*) FILTER (WHERE created_at > now() - interval '24 hours')
  INTO v_reg_1h, v_reg_3h, v_reg_24h
  FROM auth.users;

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '15 minutes'),
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
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
    v_gen_15, v_gen_1h, v_completed_15, v_completed_1h, v_failed_15, v_failed_1h,
    v_pending, v_processing, v_oldest
  FROM public.landing_generations;

  SELECT coalesce(sum(amount_rub), 0)::float8, count(*)
  INTO v_revenue, v_payments
  FROM (
    SELECT amount_rub
    FROM public.landing_yookassa_payments
    WHERE status = 'succeeded'
      AND coalesce(test, false) = false
      AND created_at > now() - interval '24 hours'
    UNION ALL
    SELECT amount_rub
    FROM public.landing_robokassa_payments
    WHERE status = 'succeeded'
      AND test = false
      AND created_at > now() - interval '24 hours'
  ) payments;

  SELECT count(*)
  INTO v_stars
  FROM public.landing_web_transactions
  WHERE state = 'done'
    AND created_at > now() - interval '24 hours';

  v_terminal := v_completed_15 + v_failed_15;
  v_hour := extract(hour FROM timezone('Europe/Moscow', now()))::int;

  RETURN jsonb_build_object(
    'registrations_1h', v_reg_1h,
    'registrations_3h', v_reg_3h,
    'registrations_24h', v_reg_24h,
    'generations_15m', v_gen_15,
    'generations_1h', v_gen_1h,
    'generations_completed_15m', v_completed_15,
    'generations_completed_1h', v_completed_1h,
    'generations_failed_15m', v_failed_15,
    'generations_failed_1h', v_failed_1h,
    'queue_pending', v_pending,
    'queue_processing', v_processing,
    'oldest_pending_age_seconds', v_oldest,
    'revenue_rub_24h', v_revenue,
    'payments_succeeded_24h', v_payments,
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
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ops_product_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_product_snapshot() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_product_snapshot() TO service_role;
