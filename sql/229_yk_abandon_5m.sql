-- Flash abandon mail: +5 min, 25% grant for 60 minutes.
-- Does not edit sql/206. Flag off until explicitly enabled.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('yk_abandon_5m_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.landing_mail_outbox
  DROP CONSTRAINT IF EXISTS landing_mail_outbox_template_id_check;
ALTER TABLE public.landing_mail_outbox
  ADD CONSTRAINT landing_mail_outbox_template_id_check
  CHECK (template_id IN (
    'tokens_credited', 'welcome', 'campaign',
    'onboard_d1', 'onboard_d3', 'onboard_d7',
    'analyze_intent', 'no_credits',
    'yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h',
    'paid_unused', 'credits_empty',
    'winback_14', 'winback_30'
  ));

ALTER TABLE public.landing_pricing_offers
  DROP CONSTRAINT IF EXISTS landing_pricing_offers_percent_check;
ALTER TABLE public.landing_pricing_offers
  ADD CONSTRAINT landing_pricing_offers_percent_check
  CHECK (percent IN (10, 20, 25));

DROP INDEX IF EXISTS public.landing_pricing_offers_unconsumed;
CREATE UNIQUE INDEX IF NOT EXISTS landing_pricing_offers_unconsumed_standard
  ON public.landing_pricing_offers(shared_user_id)
  WHERE consumed_at IS NULL AND percent IN (10, 20);
CREATE UNIQUE INDEX IF NOT EXISTS landing_pricing_offers_unconsumed_flash
  ON public.landing_pricing_offers(shared_user_id)
  WHERE consumed_at IS NULL AND percent = 25;

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

CREATE OR REPLACE FUNCTION public.landing_mail_config_on(p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RETURN false;
  END IF;
  SELECT c.value
    INTO v_value
    FROM public.landing_generation_config c
   WHERE c.key = p_key;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN lower(btrim(coalesce(v_value, ''))) IN ('true', '1', 'yes');
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
    'paid_unused', 'credits_empty',
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
    kind, template_id, idempotency_key, to_email, shared_user_id, campaign_id, payload
  ) VALUES (
    p_kind, p_template_id, v_key, v_email, p_shared_user_id, p_campaign_id, coalesce(p_payload, '{}'::jsonb)
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

DROP FUNCTION IF EXISTS public.landing_upsert_pricing_offer(uuid, integer, text, integer);

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
    v_expires := now() + make_interval(days => greatest(coalesce(p_ttl_days, 7), 1));
  END IF;

  IF v_percent = 25 THEN
    SELECT * INTO v_row
      FROM public.landing_pricing_offers
     WHERE shared_user_id = p_shared_user_id
       AND consumed_at IS NULL
       AND percent = 25
     FOR UPDATE;
  ELSE
    SELECT * INTO v_row
      FROM public.landing_pricing_offers
     WHERE shared_user_id = p_shared_user_id
       AND consumed_at IS NULL
       AND percent IN (10, 20)
     FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.landing_pricing_offers (
      shared_user_id, percent, source_template_id, expires_at
    ) VALUES (
      p_shared_user_id, v_percent, p_source_template_id, v_expires
    )
    RETURNING * INTO v_row;
    RETURN QUERY SELECT v_row.id, v_row.percent, true;
    RETURN;
  END IF;

  IF v_row.expires_at <= now() OR v_percent > v_row.percent THEN
    UPDATE public.landing_pricing_offers
       SET percent = CASE WHEN v_row.expires_at <= now() THEN v_percent ELSE greatest(v_row.percent, v_percent) END,
           source_template_id = p_source_template_id,
           expires_at = v_expires,
           reserved_payment_id = CASE WHEN v_row.expires_at <= now() THEN NULL ELSE reserved_payment_id END,
           reserved_provider = CASE WHEN v_row.expires_at <= now() THEN NULL ELSE reserved_provider END,
           updated_at = now()
     WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN QUERY SELECT v_row.id, v_row.percent, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_live_pricing_offer(p_shared_user_id uuid)
RETURNS TABLE(offer_id uuid, percent integer, expires_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.percent, o.expires_at
    FROM public.landing_pricing_offers o
   WHERE o.shared_user_id = p_shared_user_id
     AND o.consumed_at IS NULL
     AND o.expires_at > now()
   ORDER BY o.percent DESC, o.expires_at DESC
   LIMIT 1;
END;
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
BEGIN
  IF p_provider NOT IN ('yookassa', 'robokassa') OR p_payment_id IS NULL THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  SELECT * INTO v_offer
    FROM public.landing_pricing_offers
   WHERE shared_user_id = p_shared_user_id
     AND consumed_at IS NULL
     AND expires_at > now()
   ORDER BY percent DESC, expires_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  IF v_offer.reserved_payment_id IS NOT NULL
     AND v_offer.reserved_payment_id IS DISTINCT FROM p_payment_id
     AND public.landing_mail_payment_open(v_offer.reserved_provider, v_offer.reserved_payment_id)
  THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  v_amount := floor(p_catalog_amount * (100 - v_offer.percent) / 100);
  IF v_amount < 1 THEN
    v_amount := 1;
  END IF;

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
     WHERE id = p_payment_id
       AND credited_at IS NULL;
  ELSE
    UPDATE public.landing_robokassa_payments
       SET amount_rub = v_amount,
           offer_id = v_offer.id,
           updated_at = now()
     WHERE id = p_payment_id
       AND credited_at IS NULL;
  END IF;

  RETURN QUERY SELECT v_amount, v_offer.id, v_offer.percent;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_yookassa_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.landing_mail_cancel_exploring(NEW.landing_user_id);
  PERFORM public.landing_mail_cancel_other_subjects(
    NEW.landing_user_id,
    ARRAY['yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h'],
    NEW.id::text
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.landing_user_id,
    'yk_abandon_5m',
    NEW.id::text,
    NEW.created_at + interval '5 minutes',
    jsonb_build_object(
      'plan_id', NEW.plan_id,
      'payment_id', NEW.id,
      'idempotency_key', 'yk_abandon_5m:' || NEW.id::text
    )
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.landing_user_id,
    'yk_abandon_40m',
    NEW.id::text,
    NEW.created_at + interval '40 minutes',
    jsonb_build_object(
      'plan_id', NEW.plan_id,
      'payment_id', NEW.id,
      'idempotency_key', 'yk_abandon_40m:' || NEW.id::text
    )
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.landing_user_id,
    'yk_abandon_24h',
    NEW.id::text,
    NEW.created_at + interval '24 hours',
    jsonb_build_object(
      'plan_id', NEW.plan_id,
      'payment_id', NEW.id,
      'idempotency_key', 'yk_abandon_24h:' || NEW.id::text
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_payment_credited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credited_at IS NULL OR OLD.credited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.landing_pricing_offers
     SET consumed_at = now(),
         reserved_payment_id = NEW.id,
         updated_at = now()
   WHERE shared_user_id = NEW.landing_user_id
     AND consumed_at IS NULL;

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
      jsonb_build_object('idempotency_key', 'paid_unused:' || NEW.landing_user_id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_mail_config_on(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_upsert_pricing_offer(uuid, integer, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_mail_config_on(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_upsert_pricing_offer(uuid, integer, text, integer, integer) TO service_role;
