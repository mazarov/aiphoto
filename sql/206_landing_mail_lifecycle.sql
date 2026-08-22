-- Lifecycle mail: due queue, pricing grants, credit-block facts, priority outbox.
-- Does not edit sql/205. Service-role only.

ALTER TABLE public.landing_mail_outbox
  DROP CONSTRAINT IF EXISTS landing_mail_outbox_template_id_check;
ALTER TABLE public.landing_mail_outbox
  ADD CONSTRAINT landing_mail_outbox_template_id_check
  CHECK (template_id IN (
    'tokens_credited', 'welcome', 'campaign',
    'onboard_d1', 'onboard_d3', 'onboard_d7',
    'analyze_intent', 'no_credits',
    'yk_abandon_40m', 'yk_abandon_24h',
    'paid_unused', 'credits_empty',
    'winback_14', 'winback_30'
  ));

ALTER TABLE public.landing_mail_campaigns
  DROP CONSTRAINT IF EXISTS landing_mail_campaigns_segment_check;
ALTER TABLE public.landing_mail_campaigns
  ADD CONSTRAINT landing_mail_campaigns_segment_check
  CHECK (segment IN (
    'all_email', 'paid', 'exploring', 'paid_active', 'paid_quiet', 'empty', 'trial_only'
  ));

ALTER TABLE public.landing_yookassa_payments
  ADD COLUMN IF NOT EXISTS offer_id uuid;
ALTER TABLE public.landing_robokassa_payments
  ADD COLUMN IF NOT EXISTS offer_id uuid;

CREATE TABLE IF NOT EXISTS public.landing_mail_due (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_user_id uuid NOT NULL,
  template_id text NOT NULL,
  subject_key text NOT NULL,
  due_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'claimed', 'done', 'cancelled')),
  lease_token uuid,
  lease_expires_at timestamptz,
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  UNIQUE (template_id, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_landing_mail_due_ready
  ON public.landing_mail_due(due_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_landing_mail_due_user
  ON public.landing_mail_due(shared_user_id, status);

CREATE TABLE IF NOT EXISTS public.landing_pricing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_user_id uuid NOT NULL,
  percent integer NOT NULL CHECK (percent IN (10, 20)),
  source_template_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  reserved_payment_id uuid,
  reserved_provider text CHECK (reserved_provider IN ('yookassa', 'robokassa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS landing_pricing_offers_unconsumed
  ON public.landing_pricing_offers(shared_user_id)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.landing_mail_credit_blocks (
  shared_user_id uuid PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('generate', 'analyze')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_blocked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_yookassa_payments
  DROP CONSTRAINT IF EXISTS landing_yookassa_payments_offer_id_fkey;
ALTER TABLE public.landing_yookassa_payments
  ADD CONSTRAINT landing_yookassa_payments_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES public.landing_pricing_offers(id);
ALTER TABLE public.landing_robokassa_payments
  DROP CONSTRAINT IF EXISTS landing_robokassa_payments_offer_id_fkey;
ALTER TABLE public.landing_robokassa_payments
  ADD CONSTRAINT landing_robokassa_payments_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES public.landing_pricing_offers(id);

ALTER TABLE public.landing_mail_due ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pricing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_mail_credit_blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.landing_mail_moscow_day(p_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (timezone('Europe/Moscow', p_ts))::date;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_next_moscow_midnight()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT ((public.landing_mail_moscow_day(now()) + 1)::timestamp AT TIME ZONE 'Europe/Moscow');
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_jitter_seconds(p_user uuid, p_salt text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT abs(hashtext(coalesce(p_user::text, '') || ':' || coalesce(p_salt, ''))) % 86400;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_due_priority(p_template_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_template_id
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

CREATE OR REPLACE FUNCTION public.landing_mail_daily_budget()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := public.landing_mail_moscow_day(now());
  v_sent integer := 0;
  v_queued integer := 0;
  v_tx integer := 0;
  v_campaign integer := 0;
  v_winback integer := 0;
BEGIN
  SELECT
    count(*) FILTER (
      WHERE status = 'sent' AND public.landing_mail_moscow_day(sent_at) = v_day
    ),
    count(*) FILTER (WHERE status IN ('pending', 'processing')),
    count(*) FILTER (
      WHERE kind = 'transactional'
        AND (
          (status = 'sent' AND public.landing_mail_moscow_day(sent_at) = v_day)
          OR status IN ('pending', 'processing')
        )
    ),
    count(*) FILTER (
      WHERE template_id = 'campaign'
        AND (
          (status = 'sent' AND public.landing_mail_moscow_day(sent_at) = v_day)
          OR status IN ('pending', 'processing')
        )
    ),
    count(*) FILTER (
      WHERE template_id IN ('winback_14', 'winback_30')
        AND (
          (status = 'sent' AND public.landing_mail_moscow_day(sent_at) = v_day)
          OR status IN ('pending', 'processing')
        )
    )
    INTO v_sent, v_queued, v_tx, v_campaign, v_winback
    FROM public.landing_mail_outbox;

  RETURN jsonb_build_object(
    'day', v_day,
    'cap', 5000,
    'tx_reserve', 500,
    'winback_cap', 200,
    'sent', v_sent,
    'queued', v_queued,
    'used', v_sent + v_queued,
    'remaining', greatest(0, 5000 - (v_sent + v_queued)),
    'transactional', v_tx,
    'campaign', v_campaign,
    'winback', v_winback
  );
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
    'yk_abandon_40m', 'yk_abandon_24h',
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

CREATE OR REPLACE FUNCTION public.claim_mail_outbox(
  p_limit integer DEFAULT 20,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (
  outbox_id uuid,
  kind text,
  template_id text,
  to_email text,
  shared_user_id uuid,
  campaign_id uuid,
  payload jsonb,
  lease_token uuid,
  attempt_count integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT o.id
      FROM public.landing_mail_outbox o
     WHERE (
        o.status = 'pending'
        AND o.next_retry_at <= now()
      ) OR (
        o.status = 'processing'
        AND o.lease_expires_at IS NOT NULL
        AND o.lease_expires_at < now()
      )
     ORDER BY
       CASE
         WHEN o.kind = 'transactional' THEN 0
         WHEN o.template_id = 'campaign' THEN 2
         ELSE 1
       END,
       o.next_retry_at ASC,
       o.created_at ASC
     FOR UPDATE OF o SKIP LOCKED
     LIMIT least(50, greatest(1, p_limit))
  ),
  claimed AS (
    UPDATE public.landing_mail_outbox o
       SET status = 'processing',
           attempt_count = o.attempt_count + 1,
           lease_token = gen_random_uuid(),
           lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
           updated_at = now()
      FROM due
     WHERE o.id = due.id
    RETURNING
      o.id, o.kind, o.template_id, o.to_email, o.shared_user_id,
      o.campaign_id, o.payload, o.lease_token, o.attempt_count, o.max_attempts
  )
  SELECT
    c.id, c.kind, c.template_id, c.to_email, c.shared_user_id,
    c.campaign_id, c.payload, c.lease_token, c.attempt_count, c.max_attempts
  FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_schedule_due(
  p_shared_user_id uuid,
  p_template_id text,
  p_subject_key text,
  p_due_at timestamptz,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_replace boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text := nullif(btrim(coalesce(p_subject_key, '')), '');
BEGIN
  IF p_shared_user_id IS NULL OR v_key IS NULL OR p_due_at IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.landing_mail_due (
    shared_user_id, template_id, subject_key, due_at, payload, status
  ) VALUES (
    p_shared_user_id, p_template_id, v_key, p_due_at, coalesce(p_payload, '{}'::jsonb), 'scheduled'
  )
  ON CONFLICT (template_id, subject_key) DO UPDATE
    SET due_at = CASE
          WHEN p_replace AND public.landing_mail_due.status IN ('scheduled', 'cancelled')
            THEN EXCLUDED.due_at
          ELSE public.landing_mail_due.due_at
        END,
        payload = CASE
          WHEN p_replace AND public.landing_mail_due.status IN ('scheduled', 'cancelled')
            THEN EXCLUDED.payload
          ELSE public.landing_mail_due.payload
        END,
        status = CASE
          WHEN p_replace AND public.landing_mail_due.status = 'cancelled'
            THEN 'scheduled'
          ELSE public.landing_mail_due.status
        END,
        shared_user_id = public.landing_mail_due.shared_user_id,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_cancel_templates(
  p_shared_user_id uuid,
  p_template_ids text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.landing_mail_due
     SET status = 'cancelled',
         skip_reason = 'cancelled',
         updated_at = now()
   WHERE shared_user_id = p_shared_user_id
     AND template_id = ANY(p_template_ids)
     AND status = 'scheduled';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_cancel_other_subjects(
  p_shared_user_id uuid,
  p_template_ids text[],
  p_keep_subject_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.landing_mail_due
     SET status = 'cancelled',
         skip_reason = 'replaced',
         updated_at = now()
   WHERE shared_user_id = p_shared_user_id
     AND template_id = ANY(p_template_ids)
     AND subject_key IS DISTINCT FROM p_keep_subject_key
     AND status = 'scheduled';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mail_due(
  p_limit integer DEFAULT 8,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (
  due_id uuid,
  shared_user_id uuid,
  template_id text,
  subject_key text,
  payload jsonb,
  lease_token uuid,
  due_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT o.id
      FROM public.landing_mail_due o
     WHERE (
        o.status = 'scheduled'
        AND o.due_at <= now()
      ) OR (
        o.status = 'claimed'
        AND o.lease_expires_at IS NOT NULL
        AND o.lease_expires_at < now()
      )
     ORDER BY public.landing_mail_due_priority(o.template_id), o.due_at ASC, o.created_at ASC
     FOR UPDATE OF o SKIP LOCKED
     LIMIT least(40, greatest(1, p_limit))
  ),
  claimed AS (
    UPDATE public.landing_mail_due o
       SET status = 'claimed',
           lease_token = gen_random_uuid(),
           lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
           updated_at = now()
      FROM due
     WHERE o.id = due.id
    RETURNING
      o.id, o.shared_user_id, o.template_id, o.subject_key,
      o.payload, o.lease_token, o.due_at
  )
  SELECT c.id, c.shared_user_id, c.template_id, c.subject_key, c.payload, c.lease_token, c.due_at
    FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_mail_due(
  p_due_id uuid,
  p_lease_token uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('done', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_due_status' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.landing_mail_due
     SET status = p_status,
         skip_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 64),
         lease_token = NULL,
         lease_expires_at = NULL,
         done_at = now(),
         updated_at = now()
   WHERE id = p_due_id
     AND lease_token = p_lease_token
     AND status = 'claimed';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_mail_due(
  p_due_id uuid,
  p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.landing_mail_due
     SET status = 'scheduled',
         lease_token = NULL,
         lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_due_id
     AND lease_token = p_lease_token
     AND status = 'claimed';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_mail_due(
  p_due_id uuid,
  p_lease_token uuid,
  p_due_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.landing_mail_due
     SET status = 'scheduled',
         due_at = p_due_at,
         lease_token = NULL,
         lease_expires_at = NULL,
         skip_reason = NULL,
         updated_at = now()
   WHERE id = p_due_id
     AND lease_token = p_lease_token
     AND status = 'claimed';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_user_facts(p_shared_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := public.landing_mail_moscow_day(now());
BEGIN
  RETURN jsonb_build_object(
    'shared_user_id', p_shared_user_id,
    'display_name', (
      SELECT coalesce(nullif(btrim(lu.display_name), ''), nullif(btrim(iu.display_name), ''))
        FROM public.imageprompt_users iu
        LEFT JOIN public.landing_users lu ON lu.id = iu.id
       WHERE iu.id = p_shared_user_id
    ),
    'has_generation', EXISTS (
      SELECT 1 FROM public.landing_generations g
       WHERE g.user_id = p_shared_user_id AND g.status = 'completed'
    ),
    'last_generation_at', (
      SELECT max(g.generation_completed_at)
        FROM public.landing_generations g
       WHERE g.user_id = p_shared_user_id AND g.status = 'completed'
    ),
    'has_analyze', EXISTS (
      SELECT 1 FROM public.analyze_history a
       WHERE a.user_id = p_shared_user_id AND a.kind = 'analyze'
    ),
    'has_yookassa_row', EXISTS (
      SELECT 1 FROM public.landing_yookassa_payments p
       WHERE p.landing_user_id = p_shared_user_id
    ),
    'has_credited', EXISTS (
      SELECT 1 FROM public.landing_yookassa_payments p
       WHERE p.landing_user_id = p_shared_user_id AND p.credited_at IS NOT NULL
      UNION
      SELECT 1 FROM public.landing_robokassa_payments p
       WHERE p.landing_user_id = p_shared_user_id AND p.credited_at IS NOT NULL
    ),
    'credits', coalesce((
      SELECT lu.credits FROM public.landing_users lu WHERE lu.id = p_shared_user_id
    ), 0),
    'has_credit_block', EXISTS (
      SELECT 1 FROM public.landing_mail_credit_blocks b
       WHERE b.shared_user_id = p_shared_user_id
    ),
    'latest_uncredited_plan_id', (
      SELECT p.plan_id
        FROM public.landing_yookassa_payments p
       WHERE p.landing_user_id = p_shared_user_id
         AND p.credited_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT 1
    ),
    'marketing_sent_today', EXISTS (
      SELECT 1 FROM public.landing_mail_outbox o
       WHERE o.shared_user_id = p_shared_user_id
         AND o.kind = 'marketing'
         AND (
           (o.status = 'sent' AND public.landing_mail_moscow_day(o.sent_at) = v_day)
           OR o.status IN ('pending', 'processing')
         )
    ),
    'winback_sent_today', (
      SELECT count(*)::integer
        FROM public.landing_mail_outbox o
       WHERE o.template_id IN ('winback_14', 'winback_30')
         AND (
           (o.status = 'sent' AND public.landing_mail_moscow_day(o.sent_at) = v_day)
           OR o.status IN ('pending', 'processing')
         )
    ),
    'last_credits_empty_at', (
      SELECT max(coalesce(o.sent_at, o.created_at))
        FROM public.landing_mail_outbox o
       WHERE o.shared_user_id = p_shared_user_id
         AND o.template_id = 'credits_empty'
         AND o.status IN ('sent', 'pending', 'processing')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_upsert_pricing_offer(
  p_shared_user_id uuid,
  p_percent integer,
  p_source_template_id text,
  p_ttl_days integer DEFAULT 7
)
RETURNS TABLE(offer_id uuid, percent integer, applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.landing_pricing_offers%ROWTYPE;
  v_percent integer := p_percent;
  v_expires timestamptz := now() + make_interval(days => greatest(p_ttl_days, 1));
BEGIN
  IF p_shared_user_id IS NULL OR v_percent NOT IN (10, 20) THEN
    RETURN QUERY SELECT NULL::uuid, 0, false;
    RETURN;
  END IF;

  SELECT * INTO v_row
    FROM public.landing_pricing_offers
   WHERE shared_user_id = p_shared_user_id
     AND consumed_at IS NULL
   FOR UPDATE;

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
   LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_payment_open(
  p_provider text,
  p_payment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_provider = 'yookassa' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.landing_yookassa_payments p
       WHERE p.id = p_payment_id AND p.status IN ('created', 'pending')
    );
  END IF;
  IF p_provider = 'robokassa' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.landing_robokassa_payments p
       WHERE p.id = p_payment_id AND p.status IN ('created', 'pending')
    );
  END IF;
  RETURN false;
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

CREATE OR REPLACE FUNCTION public.landing_mail_record_credit_block(
  p_shared_user_id uuid,
  p_source text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_shared_user_id IS NULL OR p_source NOT IN ('generate', 'analyze') THEN
    RETURN false;
  END IF;
  INSERT INTO public.landing_mail_credit_blocks (shared_user_id, source)
  VALUES (p_shared_user_id, p_source)
  ON CONFLICT (shared_user_id) DO UPDATE
    SET last_blocked_at = now(),
        source = EXCLUDED.source;
  PERFORM public.landing_mail_schedule_due(
    p_shared_user_id,
    'no_credits',
    p_shared_user_id::text,
    now() + interval '2 hours',
    jsonb_build_object('idempotency_key', 'no_credits:' || p_shared_user_id::text)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_cancel_exploring(p_shared_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.landing_mail_cancel_templates(
    p_shared_user_id,
    ARRAY['onboard_d1', 'onboard_d3', 'onboard_d7', 'analyze_intent', 'no_credits']
  );
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.template_id = 'welcome' AND NEW.shared_user_id IS NOT NULL THEN
    PERFORM public.landing_mail_schedule_due(
      NEW.shared_user_id, 'onboard_d1', NEW.shared_user_id::text,
      now() + interval '1 day',
      jsonb_build_object('idempotency_key', 'onboard_d1:' || NEW.shared_user_id::text)
    );
    PERFORM public.landing_mail_schedule_due(
      NEW.shared_user_id, 'onboard_d3', NEW.shared_user_id::text,
      now() + interval '3 days',
      jsonb_build_object('idempotency_key', 'onboard_d3:' || NEW.shared_user_id::text)
    );
    PERFORM public.landing_mail_schedule_due(
      NEW.shared_user_id, 'onboard_d7', NEW.shared_user_id::text,
      now() + interval '7 days',
      jsonb_build_object('idempotency_key', 'onboard_d7:' || NEW.shared_user_id::text)
    );
  END IF;
  RETURN NEW;
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
    ARRAY['yk_abandon_40m', 'yk_abandon_24h'],
    NEW.id::text
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

CREATE OR REPLACE FUNCTION public.landing_mail_on_robokassa_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.landing_mail_cancel_exploring(NEW.landing_user_id);
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
      'yk_abandon_40m', 'yk_abandon_24h'
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

CREATE OR REPLACE FUNCTION public.landing_mail_on_payment_canceled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled' THEN
    UPDATE public.landing_pricing_offers
       SET reserved_payment_id = NULL,
           reserved_provider = NULL,
           updated_at = now()
     WHERE reserved_payment_id = NEW.id
       AND consumed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_generation_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_done timestamptz;
  v_cycle text;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  v_done := coalesce(NEW.generation_completed_at, now());
  v_cycle := to_char(v_done AT TIME ZONE 'Europe/Moscow', 'YYYYMMDD');

  PERFORM public.landing_mail_cancel_templates(
    NEW.user_id,
    ARRAY[
      'onboard_d1', 'onboard_d3', 'onboard_d7',
      'analyze_intent', 'paid_unused',
      'winback_14', 'winback_30'
    ]
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.user_id,
    'winback_14',
    NEW.user_id::text || ':' || v_cycle,
    v_done + interval '14 days' + make_interval(
      secs => public.landing_mail_jitter_seconds(NEW.user_id, 'winback_14')
    ),
    jsonb_build_object(
      'idempotency_key', 'winback_14:' || NEW.user_id::text || ':' || v_cycle,
      'cycle', v_cycle
    ),
    true
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_credits_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credits = 0 AND OLD.credits > 0 AND EXISTS (
    SELECT 1 FROM public.landing_yookassa_payments p
     WHERE p.landing_user_id = NEW.id AND p.credited_at IS NOT NULL
    UNION
    SELECT 1 FROM public.landing_robokassa_payments p
     WHERE p.landing_user_id = NEW.id AND p.credited_at IS NOT NULL
  ) THEN
    PERFORM public.landing_mail_schedule_due(
      NEW.id,
      'credits_empty',
      NEW.id::text || ':' || to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD'),
      now(),
      jsonb_build_object(
        'idempotency_key',
        'credits_empty:' || NEW.id::text || ':' || to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_analyze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'analyze' AND NEW.user_id IS NOT NULL THEN
    PERFORM public.landing_mail_schedule_due(
      NEW.user_id,
      'analyze_intent',
      NEW.user_id::text,
      now() + interval '6 hours',
      jsonb_build_object('idempotency_key', 'analyze_intent:' || NEW.user_id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_on_winback_14_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_cycle text;
BEGIN
  IF NEW.template_id <> 'winback_14'
     OR NEW.status <> 'sent'
     OR OLD.status IS NOT DISTINCT FROM 'sent'
     OR NEW.shared_user_id IS NULL
  THEN
    RETURN NEW;
  END IF;
  SELECT max(g.generation_completed_at) INTO v_last
    FROM public.landing_generations g
   WHERE g.user_id = NEW.shared_user_id AND g.status = 'completed';
  IF v_last IS NULL THEN
    RETURN NEW;
  END IF;
  v_cycle := to_char(v_last AT TIME ZONE 'Europe/Moscow', 'YYYYMMDD');
  PERFORM public.landing_mail_schedule_due(
    NEW.shared_user_id,
    'winback_30',
    NEW.shared_user_id::text || ':' || v_cycle,
    v_last + interval '30 days' + make_interval(
      secs => public.landing_mail_jitter_seconds(NEW.shared_user_id, 'winback_30')
    ),
    jsonb_build_object(
      'idempotency_key', 'winback_30:' || NEW.shared_user_id::text || ':' || v_cycle,
      'cycle', v_cycle
    ),
    true
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_user_ids_for_email(p_email text)
RETURNS TABLE(shared_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    SELECT public.landing_mail_normalize_email(p_email) AS email
  )
  SELECT iu.id
    FROM public.imageprompt_users iu, v
   WHERE public.landing_mail_normalize_email(iu.email) = v.email
  UNION
  SELECT au.id
    FROM auth.users au, v
   WHERE public.landing_mail_normalize_email(au.email) = v.email;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_cancel_marketing_for_email(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user uuid;
BEGIN
  FOR v_user IN SELECT u.shared_user_id FROM public.landing_mail_user_ids_for_email(p_email) u
  LOOP
    v_count := v_count + public.landing_mail_cancel_templates(
      v_user,
      ARRAY[
        'onboard_d1', 'onboard_d3', 'onboard_d7',
        'analyze_intent', 'no_credits', 'credits_empty',
        'winback_14', 'winback_30'
      ]
    );
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_unsubscribe(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := public.landing_mail_normalize_email(p_email);
BEGIN
  IF v_email IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.landing_mail_preferences (email, marketing_opt_in, unsubscribed_at, updated_at)
  VALUES (v_email, false, now(), now())
  ON CONFLICT (email) DO UPDATE
    SET marketing_opt_in = false,
        unsubscribed_at = coalesce(public.landing_mail_preferences.unsubscribed_at, now()),
        updated_at = now();
  PERFORM public.landing_mail_cancel_marketing_for_email(v_email);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_suppress(
  p_email text,
  p_reason text,
  p_source text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := public.landing_mail_normalize_email(p_email);
BEGIN
  IF v_email IS NULL OR p_reason NOT IN ('hard_bounce', 'complaint', 'invalid') THEN
    RETURN false;
  END IF;
  INSERT INTO public.landing_mail_suppression (email, reason, source, updated_at)
  VALUES (v_email, p_reason, nullif(btrim(coalesce(p_source, '')), ''), now())
  ON CONFLICT (email) DO UPDATE
    SET reason = EXCLUDED.reason,
        source = coalesce(EXCLUDED.source, public.landing_mail_suppression.source),
        updated_at = now();
  PERFORM public.landing_mail_cancel_marketing_for_email(v_email);
  RETURN true;
END;
$$;

DROP TRIGGER IF EXISTS landing_mail_outbox_welcome ON public.landing_mail_outbox;
CREATE TRIGGER landing_mail_outbox_welcome
  AFTER INSERT ON public.landing_mail_outbox
  FOR EACH ROW
  WHEN (NEW.template_id = 'welcome')
  EXECUTE FUNCTION public.landing_mail_on_welcome();

DROP TRIGGER IF EXISTS landing_mail_outbox_winback_14 ON public.landing_mail_outbox;
CREATE TRIGGER landing_mail_outbox_winback_14
  AFTER UPDATE ON public.landing_mail_outbox
  FOR EACH ROW
  WHEN (NEW.template_id = 'winback_14' AND NEW.status = 'sent')
  EXECUTE FUNCTION public.landing_mail_on_winback_14_sent();

DROP TRIGGER IF EXISTS landing_mail_yookassa_insert ON public.landing_yookassa_payments;
CREATE TRIGGER landing_mail_yookassa_insert
  AFTER INSERT ON public.landing_yookassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_yookassa_insert();

DROP TRIGGER IF EXISTS landing_mail_robokassa_insert ON public.landing_robokassa_payments;
CREATE TRIGGER landing_mail_robokassa_insert
  AFTER INSERT ON public.landing_robokassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_robokassa_insert();

DROP TRIGGER IF EXISTS landing_mail_yookassa_credited ON public.landing_yookassa_payments;
CREATE TRIGGER landing_mail_yookassa_credited
  AFTER UPDATE OF credited_at ON public.landing_yookassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_payment_credited();

DROP TRIGGER IF EXISTS landing_mail_robokassa_credited ON public.landing_robokassa_payments;
CREATE TRIGGER landing_mail_robokassa_credited
  AFTER UPDATE OF credited_at ON public.landing_robokassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_payment_credited();

DROP TRIGGER IF EXISTS landing_mail_yookassa_canceled ON public.landing_yookassa_payments;
CREATE TRIGGER landing_mail_yookassa_canceled
  AFTER UPDATE OF status ON public.landing_yookassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_payment_canceled();

DROP TRIGGER IF EXISTS landing_mail_robokassa_canceled ON public.landing_robokassa_payments;
CREATE TRIGGER landing_mail_robokassa_canceled
  AFTER UPDATE OF status ON public.landing_robokassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_payment_canceled();

DROP TRIGGER IF EXISTS landing_mail_generation_completed ON public.landing_generations;
CREATE TRIGGER landing_mail_generation_completed
  AFTER UPDATE OF status ON public.landing_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_generation_completed();

DROP TRIGGER IF EXISTS landing_mail_credits_empty ON public.landing_users;
CREATE TRIGGER landing_mail_credits_empty
  AFTER UPDATE OF credits ON public.landing_users
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_credits_empty();

DROP TRIGGER IF EXISTS landing_mail_analyze_intent ON public.analyze_history;
CREATE TRIGGER landing_mail_analyze_intent
  AFTER INSERT ON public.analyze_history
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_mail_on_analyze();

CREATE OR REPLACE FUNCTION public.landing_mail_segment_recipients(p_segment text)
RETURNS TABLE(email text, shared_user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_segment NOT IN (
    'all_email', 'paid', 'exploring', 'paid_active', 'paid_quiet', 'empty', 'trial_only'
  ) THEN
    RAISE EXCEPTION 'invalid_segment' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH paid AS (
    SELECT DISTINCT landing_user_id AS user_id
      FROM public.landing_yookassa_payments
     WHERE credited_at IS NOT NULL
    UNION
    SELECT DISTINCT landing_user_id
      FROM public.landing_robokassa_payments
     WHERE credited_at IS NOT NULL
  ),
  yk_any AS (
    SELECT DISTINCT landing_user_id AS user_id
      FROM public.landing_yookassa_payments
  ),
  gens AS (
    SELECT g.user_id, max(g.generation_completed_at) AS last_gen
      FROM public.landing_generations g
     WHERE g.status = 'completed'
     GROUP BY g.user_id
  ),
  higher_plans AS (
    SELECT DISTINCT landing_user_id AS user_id
      FROM public.landing_yookassa_payments
     WHERE credited_at IS NOT NULL AND plan_id <> 'trial'
    UNION
    SELECT DISTINCT landing_user_id
      FROM public.landing_robokassa_payments
     WHERE credited_at IS NOT NULL AND plan_id <> 'trial'
  ),
  resolved AS (
    SELECT
      public.landing_mail_normalize_email(
        coalesce(nullif(au.email, ''), nullif(iu.email, ''))
      ) AS email,
      iu.id AS shared_user_id,
      coalesce(nullif(btrim(lu.display_name), ''), nullif(btrim(iu.display_name), '')) AS display_name,
      coalesce(lu.credits, 0) AS credits,
      (iu.id IN (SELECT user_id FROM paid)) AS is_paid,
      (iu.id IN (SELECT user_id FROM yk_any)) AS has_yk,
      g.last_gen
    FROM public.imageprompt_users iu
    LEFT JOIN auth.users au ON au.id = iu.id
    LEFT JOIN public.landing_users lu ON lu.id = iu.id
    LEFT JOIN gens g ON g.user_id = iu.id
  )
  SELECT r.email, r.shared_user_id, r.display_name
    FROM resolved r
   WHERE r.email IS NOT NULL
     AND public.landing_mail_skip_reason(r.email, 'marketing') IS NULL
     AND (
       p_segment = 'all_email'
       OR (p_segment = 'paid' AND r.is_paid)
       OR (p_segment = 'exploring' AND NOT r.is_paid AND NOT r.has_yk AND r.last_gen IS NULL)
       OR (p_segment = 'paid_active' AND r.is_paid AND r.credits > 0 AND r.last_gen IS NOT NULL AND r.last_gen > now() - interval '14 days')
       OR (p_segment = 'paid_quiet' AND r.is_paid AND (r.last_gen IS NULL OR r.last_gen <= now() - interval '14 days'))
       OR (p_segment = 'empty' AND r.is_paid AND r.credits = 0)
       OR (p_segment = 'trial_only' AND r.is_paid AND r.shared_user_id NOT IN (SELECT user_id FROM higher_plans))
     )
   ORDER BY r.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_campaign_enqueue(p_campaign_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.landing_mail_campaigns%ROWTYPE;
  v_row record;
  v_enqueued integer := 0;
  v_result record;
  v_recipients integer;
  v_budget jsonb;
  v_remaining integer;
BEGIN
  SELECT * INTO v_campaign
    FROM public.landing_mail_campaigns
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_campaign.status NOT IN ('draft', 'dry_run') THEN
    RAISE EXCEPTION 'campaign_not_enqueueable' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO v_recipients
    FROM public.landing_mail_segment_recipients(v_campaign.segment);
  v_budget := public.landing_mail_daily_budget();
  v_remaining := coalesce((v_budget->>'remaining')::integer, 0);
  IF v_remaining < v_recipients THEN
    RAISE EXCEPTION 'mail_quota_exhausted' USING ERRCODE = 'P0001';
  END IF;
  IF (v_remaining - v_recipients) < 500 THEN
    RAISE EXCEPTION 'mail_tx_reserve' USING ERRCODE = 'P0001';
  END IF;

  FOR v_row IN
    SELECT * FROM public.landing_mail_segment_recipients(v_campaign.segment)
  LOOP
    SELECT * INTO v_result
      FROM public.landing_enqueue_mail(
        'marketing',
        'campaign',
        'campaign:' || p_campaign_id::text || ':' || v_row.email,
        v_row.email,
        v_row.shared_user_id,
        p_campaign_id,
        jsonb_build_object(
          'display_name', v_row.display_name,
          'subject', v_campaign.subject,
          'body_text', v_campaign.body_text
        )
      );
    IF v_result.inserted THEN
      v_enqueued := v_enqueued + 1;
    END IF;
  END LOOP;

  UPDATE public.landing_mail_campaigns
     SET status = 'sending',
         recipient_count = v_recipients,
         enqueued_count = v_enqueued,
         updated_at = now()
   WHERE id = p_campaign_id;

  RETURN v_enqueued;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_queue_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'processing', count(*) FILTER (WHERE status = 'processing'),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'skipped', count(*) FILTER (WHERE status = 'skipped'),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'oldest_pending_at', min(created_at) FILTER (WHERE status IN ('pending', 'processing')),
    'due_scheduled', (SELECT count(*) FROM public.landing_mail_due WHERE status = 'scheduled'),
    'due_ready', (
      SELECT count(*) FROM public.landing_mail_due
       WHERE status = 'scheduled' AND due_at <= now()
    ),
    'budget', public.landing_mail_daily_budget()
  )
  FROM public.landing_mail_outbox;
$$;

REVOKE ALL ON TABLE public.landing_mail_due FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.landing_pricing_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.landing_mail_credit_blocks FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.landing_mail_due TO service_role;
GRANT ALL ON TABLE public.landing_pricing_offers TO service_role;
GRANT ALL ON TABLE public.landing_mail_credit_blocks TO service_role;

REVOKE ALL ON FUNCTION public.landing_mail_moscow_day(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_next_moscow_midnight() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_jitter_seconds(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_due_priority(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_daily_budget() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_schedule_due(uuid, text, text, timestamptz, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_cancel_templates(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_cancel_other_subjects(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_mail_due(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_mail_due(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_mail_due(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_mail_due(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_user_facts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_upsert_pricing_offer(uuid, integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_live_pricing_offer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_payment_open(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_apply_checkout_offer(uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_record_credit_block(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_cancel_exploring(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_user_ids_for_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_cancel_marketing_for_email(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.landing_mail_moscow_day(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_next_moscow_midnight() TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_jitter_seconds(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_due_priority(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_daily_budget() TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_enqueue_mail(text, text, text, text, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_mail_outbox(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_schedule_due(uuid, text, text, timestamptz, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_cancel_templates(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_cancel_other_subjects(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_mail_due(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_mail_due(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_mail_due(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_mail_due(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_user_facts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_upsert_pricing_offer(uuid, integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_live_pricing_offer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_payment_open(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_apply_checkout_offer(uuid, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_record_credit_block(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_cancel_exploring(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_user_ids_for_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_cancel_marketing_for_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_unsubscribe(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_suppress(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_segment_recipients(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_campaign_enqueue(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_queue_stats() TO service_role;
