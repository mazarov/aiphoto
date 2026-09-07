-- One-time low-balance upgrade: first 30-token buyer -> 100 tokens for 239 RUB.
-- Product flag is off by default. Does not edit prior mail/payment migrations.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('low_balance_upgrade_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.landing_pricing_offers
  ADD COLUMN IF NOT EXISTS target_plan_id text;

ALTER TABLE public.landing_pricing_offers
  DROP CONSTRAINT IF EXISTS landing_pricing_offers_target_plan_id_check;
ALTER TABLE public.landing_pricing_offers
  ADD CONSTRAINT landing_pricing_offers_target_plan_id_check
  CHECK (
    target_plan_id IS NULL
    OR target_plan_id IN ('trial', 'start', 'pro', 'max')
  );

DROP INDEX IF EXISTS public.landing_pricing_offers_unconsumed_standard;
DROP INDEX IF EXISTS public.landing_pricing_offers_unconsumed_flash;
CREATE UNIQUE INDEX landing_pricing_offers_unconsumed_standard
  ON public.landing_pricing_offers(shared_user_id)
  WHERE consumed_at IS NULL
    AND percent IN (10, 20)
    AND target_plan_id IS NULL;
CREATE UNIQUE INDEX landing_pricing_offers_unconsumed_flash
  ON public.landing_pricing_offers(shared_user_id)
  WHERE consumed_at IS NULL
    AND percent = 25
    AND target_plan_id IS NULL;
CREATE UNIQUE INDEX landing_pricing_offers_unconsumed_targeted
  ON public.landing_pricing_offers(shared_user_id, target_plan_id, source_template_id)
  WHERE consumed_at IS NULL
    AND target_plan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.landing_pricing_offer_events (
  offer_id uuid NOT NULL REFERENCES public.landing_pricing_offers(id) ON DELETE CASCADE,
  shared_user_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN (
    'eligible', 'seen', 'clicked', 'dismissed', 'email',
    'checkout', 'credited', 'closed_other_purchase'
  )),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, event)
);

CREATE INDEX IF NOT EXISTS idx_landing_pricing_offer_events_user
  ON public.landing_pricing_offer_events(shared_user_id, created_at DESC);

ALTER TABLE public.landing_pricing_offer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.landing_pricing_offer_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.landing_pricing_offer_events TO service_role;

ALTER TABLE public.landing_mail_outbox
  DROP CONSTRAINT IF EXISTS landing_mail_outbox_template_id_check;
ALTER TABLE public.landing_mail_outbox
  ADD CONSTRAINT landing_mail_outbox_template_id_check
  CHECK (template_id IN (
    'tokens_credited', 'welcome', 'campaign',
    'onboard_d1', 'onboard_d3', 'onboard_d7',
    'analyze_intent', 'no_credits',
    'yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h',
    'paid_unused', 'credits_empty', 'low_balance_upgrade',
    'winback_14', 'winback_30'
  ));

CREATE OR REPLACE FUNCTION public.landing_mail_due_priority(p_template_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_template_id
    WHEN 'yk_abandon_5m' THEN 9
    WHEN 'yk_abandon_40m' THEN 10
    WHEN 'yk_abandon_24h' THEN 11
    WHEN 'paid_unused' THEN 20
    WHEN 'low_balance_upgrade' THEN 25
    WHEN 'credits_empty' THEN 30
    WHEN 'no_credits' THEN 40
    WHEN 'analyze_intent' THEN 41
    WHEN 'onboard_d1' THEN 50
    WHEN 'onboard_d3' THEN 51
    WHEN 'onboard_d7' THEN 52
    WHEN 'winback_14' THEN 60
    WHEN 'winback_30' THEN 61
    ELSE 90
  END;
$$;

CREATE OR REPLACE FUNCTION public.landing_enqueue_mail(
  p_kind text,
  p_template_id text,
  p_idempotency_key text,
  p_to_email text,
  p_shared_user_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(outbox_id uuid, inserted boolean, skip_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := public.landing_mail_normalize_email(p_to_email);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_skip text;
  v_id uuid;
BEGIN
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind NOT IN ('transactional', 'marketing') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE = 'P0001';
  END IF;
  IF p_template_id NOT IN (
    'tokens_credited', 'welcome', 'campaign',
    'onboard_d1', 'onboard_d3', 'onboard_d7',
    'analyze_intent', 'no_credits',
    'yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h',
    'paid_unused', 'credits_empty', 'low_balance_upgrade',
    'winback_14', 'winback_30'
  ) THEN
    RAISE EXCEPTION 'invalid_template' USING ERRCODE = 'P0001';
  END IF;

  v_skip := public.landing_mail_skip_reason(v_email, p_kind);
  IF v_skip IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, v_skip;
    RETURN;
  END IF;

  INSERT INTO public.landing_mail_outbox (
    kind, template_id, idempotency_key, to_email,
    shared_user_id, campaign_id, payload
  ) VALUES (
    p_kind, p_template_id, v_key, v_email,
    p_shared_user_id, p_campaign_id, coalesce(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT o.id INTO v_id
      FROM public.landing_mail_outbox o
     WHERE o.idempotency_key = v_key;
    RETURN QUERY SELECT v_id, false, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_id, true, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_upsert_pricing_offer(
  p_shared_user_id uuid,
  p_percent integer,
  p_source_template_id text,
  p_ttl_days integer DEFAULT 7,
  p_ttl_minutes integer DEFAULT NULL
)
RETURNS TABLE(offer_id uuid, percent integer, applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.landing_pricing_offers%ROWTYPE;
  v_percent integer := p_percent;
  v_expires timestamptz;
BEGIN
  IF p_shared_user_id IS NULL OR v_percent NOT IN (10, 20, 25) THEN
    RETURN QUERY SELECT NULL::uuid, 0, false;
    RETURN;
  END IF;

  IF p_ttl_minutes IS NOT NULL AND p_ttl_minutes > 0 THEN
    v_expires := now() + make_interval(mins => p_ttl_minutes);
  ELSE
    v_expires := now() + make_interval(
      days => greatest(coalesce(p_ttl_days, 7), 1)
    );
  END IF;

  IF v_percent = 25 THEN
    SELECT * INTO v_row
      FROM public.landing_pricing_offers
     WHERE shared_user_id = p_shared_user_id
       AND consumed_at IS NULL
       AND target_plan_id IS NULL
       AND percent = 25
     FOR UPDATE;
  ELSE
    SELECT * INTO v_row
      FROM public.landing_pricing_offers
     WHERE shared_user_id = p_shared_user_id
       AND consumed_at IS NULL
       AND target_plan_id IS NULL
       AND percent IN (10, 20)
     FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.landing_pricing_offers(
      shared_user_id,
      percent,
      source_template_id,
      target_plan_id,
      expires_at
    ) VALUES (
      p_shared_user_id,
      v_percent,
      p_source_template_id,
      NULL,
      v_expires
    )
    RETURNING * INTO v_row;
    RETURN QUERY SELECT v_row.id, v_row.percent, true;
    RETURN;
  END IF;

  IF v_row.expires_at <= now() OR v_percent > v_row.percent THEN
    UPDATE public.landing_pricing_offers
       SET percent = CASE
             WHEN v_row.expires_at <= now() THEN v_percent
             ELSE greatest(v_row.percent, v_percent)
           END,
           source_template_id = p_source_template_id,
           expires_at = v_expires,
           reserved_payment_id = CASE
             WHEN v_row.expires_at <= now() THEN NULL
             ELSE reserved_payment_id
           END,
           reserved_provider = CASE
             WHEN v_row.expires_at <= now() THEN NULL
             ELSE reserved_provider
           END,
           updated_at = now()
     WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN QUERY SELECT v_row.id, v_row.percent, true;
END;
$$;

DROP FUNCTION IF EXISTS public.landing_live_pricing_offer(uuid);
CREATE FUNCTION public.landing_live_pricing_offer(p_shared_user_id uuid)
RETURNS TABLE(
  offer_id uuid,
  percent integer,
  expires_at timestamptz,
  target_plan_id text,
  source_template_id text,
  show_nudge boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.percent,
    o.expires_at,
    o.target_plan_id,
    o.source_template_id,
    NOT EXISTS (
      SELECT 1
        FROM public.landing_pricing_offer_events e
       WHERE e.offer_id = o.id
         AND e.event IN ('seen', 'dismissed')
    )
  FROM public.landing_pricing_offers o
  WHERE o.shared_user_id = p_shared_user_id
    AND o.consumed_at IS NULL
    AND o.expires_at > now()
  ORDER BY
    o.percent DESC,
    (o.target_plan_id IS NULL) DESC,
    o.expires_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.landing_apply_checkout_offer(
  p_shared_user_id uuid,
  p_payment_id uuid,
  p_provider text,
  p_catalog_amount numeric
)
RETURNS TABLE(amount_rub numeric, offer_id uuid, percent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.landing_pricing_offers%ROWTYPE;
  v_amount numeric := p_catalog_amount;
  v_plan_id text;
BEGIN
  IF p_provider NOT IN ('yookassa', 'robokassa') OR p_payment_id IS NULL THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  IF p_provider = 'yookassa' THEN
    SELECT p.plan_id INTO v_plan_id
      FROM public.landing_yookassa_payments p
     WHERE p.id = p_payment_id AND p.landing_user_id = p_shared_user_id;
  ELSE
    SELECT p.plan_id INTO v_plan_id
      FROM public.landing_robokassa_payments p
     WHERE p.id = p_payment_id AND p.landing_user_id = p_shared_user_id;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  SELECT * INTO v_offer
    FROM public.landing_pricing_offers o
   WHERE o.shared_user_id = p_shared_user_id
     AND o.consumed_at IS NULL
     AND o.expires_at > now()
     AND (o.target_plan_id IS NULL OR o.target_plan_id = v_plan_id)
   ORDER BY o.percent DESC, (o.target_plan_id IS NOT NULL) DESC, o.expires_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  IF v_offer.reserved_payment_id IS NOT NULL
     AND v_offer.reserved_payment_id IS DISTINCT FROM p_payment_id
     AND public.landing_mail_payment_open(
       v_offer.reserved_provider,
       v_offer.reserved_payment_id
     )
  THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  v_amount := greatest(1, floor(p_catalog_amount * (100 - v_offer.percent) / 100));

  UPDATE public.landing_pricing_offers
     SET reserved_payment_id = p_payment_id,
         reserved_provider = p_provider,
         updated_at = now()
   WHERE id = v_offer.id;

  IF p_provider = 'yookassa' THEN
    UPDATE public.landing_yookassa_payments
       SET amount_rub = v_amount,
           offer_id = v_offer.id,
           updated_at = now()
     WHERE id = p_payment_id AND credited_at IS NULL;
  ELSE
    UPDATE public.landing_robokassa_payments
       SET amount_rub = v_amount,
           offer_id = v_offer.id,
           updated_at = now()
     WHERE id = p_payment_id AND credited_at IS NULL;
  END IF;

  INSERT INTO public.landing_pricing_offer_events(
    offer_id, shared_user_id, event, detail
  ) VALUES (
    v_offer.id,
    p_shared_user_id,
    'checkout',
    jsonb_build_object(
      'provider', p_provider,
      'payment_id', p_payment_id,
      'plan_id', v_plan_id,
      'amount_rub', v_amount
    )
  )
  ON CONFLICT (offer_id, event) DO NOTHING;

  RETURN QUERY SELECT v_amount, v_offer.id, v_offer.percent;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_record_pricing_offer_event(
  p_offer_id uuid,
  p_shared_user_id uuid,
  p_event text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event NOT IN ('seen', 'clicked', 'dismissed', 'email') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.landing_pricing_offers o
     WHERE o.id = p_offer_id
       AND o.shared_user_id = p_shared_user_id
       AND o.source_template_id = 'low_balance_upgrade'
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.landing_pricing_offer_events(
    offer_id, shared_user_id, event
  ) VALUES (p_offer_id, p_shared_user_id, p_event)
  ON CONFLICT (offer_id, event) DO NOTHING;
  RETURN true;
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
    SELECT landing_user_id
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = p_shared_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT landing_user_id
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
       AND o.target_plan_id = 'start'
       AND o.consumed_at IS NULL
       AND o.expires_at > now()
       AND u.credits <= 15
       AND (SELECT count(*) FROM live_payments) = 1
  );
$$;

CREATE OR REPLACE FUNCTION public.landing_maybe_create_low_balance_upgrade()
RETURNS trigger
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
  IF NEW.status <> 'completed'
     OR OLD.status IS NOT DISTINCT FROM 'completed'
     OR NEW.user_id IS NULL
     OR NOT public.landing_mail_config_on('low_balance_upgrade_enabled')
  THEN
    RETURN NEW;
  END IF;

  SELECT u.credits INTO v_credits
    FROM public.landing_users u
   WHERE u.id = NEW.user_id;
  IF v_credits IS NULL OR v_credits > 15 THEN
    RETURN NEW;
  END IF;

  WITH live_payments AS (
    SELECT plan_id, credits
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = NEW.user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT plan_id, credits
      FROM public.landing_robokassa_payments
     WHERE landing_user_id = NEW.user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE plan_id = 'trial' AND credits = 30)::integer
    INTO v_payment_count, v_trial_count
    FROM live_payments;

  IF v_payment_count <> 1 OR v_trial_count <> 1 OR EXISTS (
    SELECT 1
      FROM public.landing_pricing_offers o
     WHERE o.shared_user_id = NEW.user_id
       AND o.source_template_id = 'low_balance_upgrade'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.landing_pricing_offers(
    shared_user_id,
    percent,
    source_template_id,
    target_plan_id,
    expires_at
  ) VALUES (
    NEW.user_id,
    20,
    'low_balance_upgrade',
    'start',
    now() + interval '7 days'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_offer_id;

  IF v_offer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.landing_pricing_offer_events(
    offer_id, shared_user_id, event, detail
  ) VALUES (
    v_offer_id,
    NEW.user_id,
    'eligible',
    jsonb_build_object(
      'generation_id', NEW.id,
      'credits', v_credits,
      'target_plan_id', 'start',
      'catalog_amount_rub', 299,
      'sale_amount_rub', 239
    )
  );

  PERFORM public.landing_mail_schedule_due(
    NEW.user_id,
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_low_balance_upgrade_generation_completed
  ON public.landing_generations;
CREATE TRIGGER landing_low_balance_upgrade_generation_completed
  AFTER UPDATE OF status ON public.landing_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_maybe_create_low_balance_upgrade();

CREATE OR REPLACE FUNCTION public.landing_mail_on_payment_credited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_id uuid;
  v_payment_count integer;
BEGIN
  IF NEW.credited_at IS NULL OR OLD.credited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id IS NOT NULL THEN
    UPDATE public.landing_pricing_offers
       SET consumed_at = now(),
           reserved_payment_id = NEW.id,
           updated_at = now()
     WHERE id = NEW.offer_id
     RETURNING id INTO v_offer_id;

    IF EXISTS (
      SELECT 1
        FROM public.landing_pricing_offers o
       WHERE o.id = v_offer_id
         AND o.source_template_id = 'low_balance_upgrade'
    ) THEN
      INSERT INTO public.landing_pricing_offer_events(
        offer_id, shared_user_id, event, detail
      ) VALUES (
        v_offer_id,
        NEW.landing_user_id,
        'credited',
        jsonb_build_object(
          'payment_id', NEW.id,
          'plan_id', NEW.plan_id,
          'amount_rub', NEW.amount_rub
        )
      )
      ON CONFLICT (offer_id, event) DO NOTHING;
    END IF;
  END IF;

  -- Preserve the existing contract: any completed payment consumes active
  -- general/flash grants. Targeted grants are handled separately below.
  UPDATE public.landing_pricing_offers
     SET consumed_at = coalesce(consumed_at, now()),
         updated_at = now()
   WHERE shared_user_id = NEW.landing_user_id
     AND consumed_at IS NULL
     AND target_plan_id IS NULL;

  WITH live_payments AS (
    SELECT 1
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = NEW.landing_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT 1
      FROM public.landing_robokassa_payments
     WHERE landing_user_id = NEW.landing_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
  )
  SELECT count(*)::integer INTO v_payment_count FROM live_payments;

  IF v_payment_count >= 2 THEN
    FOR v_offer_id IN
      SELECT o.id
        FROM public.landing_pricing_offers o
       WHERE o.shared_user_id = NEW.landing_user_id
         AND o.source_template_id = 'low_balance_upgrade'
         AND o.consumed_at IS NULL
    LOOP
      UPDATE public.landing_pricing_offers
         SET consumed_at = now(), updated_at = now()
       WHERE id = v_offer_id;
      INSERT INTO public.landing_pricing_offer_events(
        offer_id, shared_user_id, event, detail
      ) VALUES (
        v_offer_id,
        NEW.landing_user_id,
        'closed_other_purchase',
        jsonb_build_object('payment_id', NEW.id, 'plan_id', NEW.plan_id)
      )
      ON CONFLICT (offer_id, event) DO NOTHING;
    END LOOP;
    PERFORM public.landing_mail_cancel_templates(
      NEW.landing_user_id,
      ARRAY['low_balance_upgrade']
    );
  END IF;

  PERFORM public.landing_mail_cancel_templates(
    NEW.landing_user_id,
    ARRAY[
      'onboard_d1', 'onboard_d3', 'onboard_d7',
      'analyze_intent', 'no_credits',
      'yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h'
    ]
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.landing_generations g
     WHERE g.user_id = NEW.landing_user_id AND g.status = 'completed'
  ) THEN
    PERFORM public.landing_mail_schedule_due(
      NEW.landing_user_id,
      'paid_unused',
      NEW.landing_user_id::text,
      NEW.credited_at + interval '24 hours',
      jsonb_build_object(
        'idempotency_key',
        'paid_unused:' || NEW.landing_user_id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_low_balance_upgrade_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH offers AS (
    SELECT id, shared_user_id, created_at
      FROM public.landing_pricing_offers
     WHERE source_template_id = 'low_balance_upgrade'
  ),
  payments AS (
    SELECT landing_user_id, plan_id, amount_rub, credits, credited_at
      FROM public.landing_yookassa_payments
     WHERE status = 'succeeded' AND credited_at IS NOT NULL AND test IS NOT TRUE
    UNION ALL
    SELECT landing_user_id, plan_id, amount_rub, credits, credited_at
      FROM public.landing_robokassa_payments
     WHERE status = 'succeeded' AND credited_at IS NOT NULL AND test IS NOT TRUE
  ),
  repeats AS (
    SELECT
      o.id AS offer_id,
      min(p.credited_at) AS repeat_at,
      (array_agg(p.plan_id ORDER BY p.credited_at))[1] AS repeat_plan_id,
      (array_agg(p.amount_rub ORDER BY p.credited_at))[1] AS repeat_amount_rub,
      (array_agg(p.credits ORDER BY p.credited_at))[1] AS repeat_credits
    FROM offers o
    LEFT JOIN payments p
      ON p.landing_user_id = o.shared_user_id
     AND p.credited_at > o.created_at
    GROUP BY o.id
  )
  SELECT jsonb_build_object(
    'eligible', (SELECT count(*) FROM offers),
    'seen', (
      SELECT count(*) FROM public.landing_pricing_offer_events
       WHERE event = 'seen'
    ),
    'clicked', (
      SELECT count(*) FROM public.landing_pricing_offer_events
       WHERE event = 'clicked'
    ),
    'email', (
      SELECT count(*) FROM public.landing_pricing_offer_events
       WHERE event = 'email'
    ),
    'mature_d7', (
      SELECT count(*) FROM offers WHERE created_at <= now() - interval '7 days'
    ),
    'repeat_payers_d7', (
      SELECT count(*)
        FROM offers o JOIN repeats r ON r.offer_id = o.id
       WHERE o.created_at <= now() - interval '7 days'
         AND r.repeat_at <= o.created_at + interval '7 days'
    ),
    'start_payers_d7', (
      SELECT count(*)
        FROM offers o JOIN repeats r ON r.offer_id = o.id
       WHERE o.created_at <= now() - interval '7 days'
         AND r.repeat_at <= o.created_at + interval '7 days'
         AND r.repeat_plan_id = 'start'
    ),
    'mature_d30', (
      SELECT count(*) FROM offers WHERE created_at <= now() - interval '30 days'
    ),
    'repeat_payers_d30', (
      SELECT count(*)
        FROM offers o JOIN repeats r ON r.offer_id = o.id
       WHERE o.created_at <= now() - interval '30 days'
         AND r.repeat_at <= o.created_at + interval '30 days'
    ),
    'repeat_revenue_d30', (
      SELECT coalesce(sum(r.repeat_amount_rub), 0)
        FROM offers o JOIN repeats r ON r.offer_id = o.id
       WHERE o.created_at <= now() - interval '30 days'
         AND r.repeat_at <= o.created_at + interval '30 days'
    ),
    'repeat_contribution_d30', (
      SELECT coalesce(round(sum(
        r.repeat_amount_rub
        - r.repeat_amount_rub * 0.035 * 1.22
        - r.repeat_amount_rub * 0.06
        - r.repeat_credits * 0.5
      ), 2), 0)
        FROM offers o JOIN repeats r ON r.offer_id = o.id
       WHERE o.created_at <= now() - interval '30 days'
         AND r.repeat_at <= o.created_at + interval '30 days'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.landing_live_pricing_offer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_record_pricing_offer_event(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_low_balance_upgrade_mail_eligible(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_low_balance_upgrade_stats()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_live_pricing_offer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_record_pricing_offer_event(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_low_balance_upgrade_mail_eligible(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_low_balance_upgrade_stats() TO service_role;

COMMENT ON FUNCTION public.admin_low_balance_upgrade_stats() IS
  'Service-only one-time low-balance upgrade funnel and D7/D30 repeat economics.';
