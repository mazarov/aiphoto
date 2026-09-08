-- Low-balance grant threshold: remaining credits <= 30 (was 15).
-- Trial pack is 30 tokens, so a first 99 RUB buyer is eligible immediately.

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
  IF v_credits IS NULL OR v_credits > 30 THEN
    RETURN NULL;
  END IF;

  WITH live_payments AS (
    SELECT plan_id, credits, amount_rub
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT plan_id, credits, amount_rub
      FROM public.landing_robokassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE plan_id = 'trial' AND credits = 30 AND amount_rub = 99
    )::integer
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
    UPDATE public.landing_pricing_offers
       SET target_plan_id = NULL,
           updated_at = now()
     WHERE id = v_offer_id
       AND target_plan_id IS NOT NULL;
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
    NULL,
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
      'target_plan_id', NULL,
      'percent', 20
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
      'percent', 20,
      'idempotency_key', 'low_balance_upgrade:' || v_offer_id::text
    )
  );

  RETURN v_offer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_low_balance_upgrade_mail_eligible(
  p_shared_user_id uuid,
  p_offer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live_payments AS (
    SELECT plan_id, credits, amount_rub
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT plan_id, credits, amount_rub
      FROM public.landing_robokassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.landing_pricing_offers o
      JOIN public.landing_users u ON u.id = o.shared_user_id
     WHERE o.id = p_offer_id
       AND o.shared_user_id = p_shared_user_id
       AND o.source_template_id = 'low_balance_upgrade'
       AND o.consumed_at IS NULL
       AND o.expires_at > now()
       AND u.credits <= 30
       AND (SELECT count(*) FROM live_payments) = 1
       AND (SELECT count(*) FROM live_payments
             WHERE plan_id = 'trial' AND credits = 30 AND amount_rub = 99) = 1
  );
$$;

DROP TRIGGER IF EXISTS landing_low_balance_upgrade_credits
  ON public.landing_users;
CREATE TRIGGER landing_low_balance_upgrade_credits
  AFTER UPDATE OF credits ON public.landing_users
  FOR EACH ROW
  WHEN (NEW.credits IS DISTINCT FROM OLD.credits AND NEW.credits <= 30)
  EXECUTE FUNCTION public.landing_maybe_create_low_balance_upgrade_on_credits();

REVOKE ALL ON FUNCTION public.landing_ensure_low_balance_upgrade(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_low_balance_upgrade_mail_eligible(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_ensure_low_balance_upgrade(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_low_balance_upgrade_mail_eligible(uuid, uuid)
  TO service_role;

COMMENT ON FUNCTION public.landing_ensure_low_balance_upgrade(uuid, uuid) IS
  'Idempotent: one-time −20% on every catalog plan, TTL 24 hours, when flag is on, balance <= 30, and the only live payment is the 99 RUB trial/30 pack.';
