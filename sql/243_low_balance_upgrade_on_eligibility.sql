-- Create the low-balance upgrade as soon as eligibility holds.
-- A new completed generation is no longer required. SQL 242 stays unchanged.

CREATE OR REPLACE FUNCTION public.landing_ensure_low_balance_upgrade(
  p_shared_user_id uuid,
  p_generation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
  v_payment_count integer;
  v_trial_count integer;
  v_offer_id uuid;
BEGIN
  IF p_shared_user_id IS NULL
     OR NOT public.landing_mail_config_on('low_balance_upgrade_enabled')
  THEN
    RETURN NULL;
  END IF;

  SELECT u.credits INTO v_credits
    FROM public.landing_users u
   WHERE u.id = p_shared_user_id;
  IF v_credits IS NULL OR v_credits > 15 THEN
    RETURN NULL;
  END IF;

  WITH live_payments AS (
    SELECT plan_id, credits
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT plan_id, credits
      FROM public.landing_robokassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE plan_id = 'trial' AND credits = 30)::integer
    INTO v_payment_count, v_trial_count
    FROM live_payments;

  IF v_payment_count <> 1 OR v_trial_count <> 1 THEN
    RETURN NULL;
  END IF;

  SELECT o.id INTO v_offer_id
    FROM public.landing_pricing_offers o
   WHERE o.shared_user_id = p_shared_user_id
     AND o.source_template_id = 'low_balance_upgrade'
   ORDER BY o.created_at DESC
   LIMIT 1;
  IF v_offer_id IS NOT NULL THEN
    RETURN v_offer_id;
  END IF;

  INSERT INTO public.landing_pricing_offers(
    shared_user_id,
    percent,
    source_template_id,
    target_plan_id,
    expires_at
  ) VALUES (
    p_shared_user_id,
    20,
    'low_balance_upgrade',
    'start',
    now() + interval '24 hours'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_offer_id;

  IF v_offer_id IS NULL THEN
    SELECT o.id INTO v_offer_id
      FROM public.landing_pricing_offers o
     WHERE o.shared_user_id = p_shared_user_id
       AND o.source_template_id = 'low_balance_upgrade'
     ORDER BY o.created_at DESC
     LIMIT 1;
    RETURN v_offer_id;
  END IF;

  INSERT INTO public.landing_pricing_offer_events(
    offer_id, shared_user_id, event, detail
  ) VALUES (
    v_offer_id,
    p_shared_user_id,
    'eligible',
    jsonb_build_object(
      'generation_id', p_generation_id,
      'credits', v_credits,
      'target_plan_id', 'start',
      'catalog_amount_rub', 299,
      'sale_amount_rub', 239
    )
  )
  ON CONFLICT (offer_id, event) DO NOTHING;

  PERFORM public.landing_mail_schedule_due(
    p_shared_user_id,
    'low_balance_upgrade',
    v_offer_id::text,
    now() + interval '2 hours',
    jsonb_build_object(
      'offer_id', v_offer_id,
      'plan_id', 'start',
      'credits', 100,
      'catalog_amount_rub', 299,
      'sale_amount_rub', 239,
      'idempotency_key', 'low_balance_upgrade:' || v_offer_id::text
    )
  );

  RETURN v_offer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_maybe_create_low_balance_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_maybe_create_low_balance_upgrade_on_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.landing_ensure_low_balance_upgrade(NEW.id, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_low_balance_upgrade_generation_completed
  ON public.landing_generations;

DROP TRIGGER IF EXISTS landing_low_balance_upgrade_credits
  ON public.landing_users;
CREATE TRIGGER landing_low_balance_upgrade_credits
  AFTER UPDATE OF credits ON public.landing_users
  FOR EACH ROW
  WHEN (NEW.credits IS DISTINCT FROM OLD.credits AND NEW.credits <= 15)
  EXECUTE FUNCTION public.landing_maybe_create_low_balance_upgrade_on_credits();

REVOKE ALL ON FUNCTION public.landing_ensure_low_balance_upgrade(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_maybe_create_low_balance_upgrade_on_credits()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_ensure_low_balance_upgrade(uuid, uuid)
  TO service_role;

COMMENT ON FUNCTION public.landing_ensure_low_balance_upgrade(uuid, uuid) IS
  'Idempotent: one-time 239 RUB start offer (−20%), TTL 24 hours, when flag is on, balance <= 15, and the only live payment is trial/30.';
