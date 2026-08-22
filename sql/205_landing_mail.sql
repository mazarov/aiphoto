-- PromptShot outgoing mail: preferences, suppression, campaigns, outbox.
-- Service-role only. Payment fulfill stays outside this file.

CREATE TABLE IF NOT EXISTS public.landing_mail_preferences (
  email text PRIMARY KEY,
  marketing_opt_in boolean,
  unsubscribed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_mail_suppression (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'invalid')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_mail_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'dry_run', 'sending', 'sent', 'cancelled')),
  segment text NOT NULL CHECK (segment IN ('all_email', 'paid')),
  subject text NOT NULL,
  body_text text NOT NULL,
  created_by_email text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  enqueued_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('transactional', 'marketing')),
  template_id text NOT NULL CHECK (template_id IN ('tokens_credited', 'welcome', 'campaign')),
  idempotency_key text NOT NULL UNIQUE,
  to_email text NOT NULL,
  shared_user_id uuid,
  campaign_id uuid REFERENCES public.landing_mail_campaigns(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  lease_token uuid,
  lease_expires_at timestamptz,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  skip_reason text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_landing_mail_outbox_due
  ON public.landing_mail_outbox(next_retry_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_landing_mail_outbox_campaign
  ON public.landing_mail_outbox(campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_landing_mail_outbox_email
  ON public.landing_mail_outbox(to_email, created_at DESC);

ALTER TABLE public.landing_mail_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_mail_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_mail_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_mail_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.landing_mail_normalize_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(btrim(coalesce(p_email, ''))), '');
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_is_internal_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(public.landing_mail_normalize_email(p_email), '') LIKE '%@promptshot.internal';
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_resolve_email(
  p_auth_user_id uuid,
  p_shared_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT public.landing_mail_normalize_email(
    coalesce(nullif(au.email, ''), nullif(iu.email, ''))
  )
    INTO v_email
    FROM (SELECT 1) AS dummy
    LEFT JOIN auth.users au ON au.id = p_auth_user_id
    LEFT JOIN public.imageprompt_users iu ON iu.id = coalesce(p_shared_user_id, p_auth_user_id);

  IF v_email IS NULL AND p_shared_user_id IS NOT NULL THEN
    SELECT public.landing_mail_normalize_email(iu.email)
      INTO v_email
      FROM public.imageprompt_users iu
     WHERE iu.id = p_shared_user_id;
  END IF;

  IF public.landing_mail_is_internal_email(v_email) THEN
    RETURN NULL;
  END IF;
  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_skip_reason(
  p_email text,
  p_kind text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := public.landing_mail_normalize_email(p_email);
  v_suppression text;
  v_unsubscribed timestamptz;
BEGIN
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN
    RETURN 'invalid';
  END IF;
  IF public.landing_mail_is_internal_email(v_email) THEN
    RETURN 'internal';
  END IF;

  SELECT s.reason INTO v_suppression
    FROM public.landing_mail_suppression s
   WHERE s.email = v_email;

  IF v_suppression = 'hard_bounce' THEN
    RETURN 'hard_bounce';
  END IF;
  IF v_suppression IN ('complaint', 'invalid') AND p_kind = 'marketing' THEN
    RETURN v_suppression;
  END IF;

  IF p_kind = 'marketing' THEN
    SELECT p.unsubscribed_at INTO v_unsubscribed
      FROM public.landing_mail_preferences p
     WHERE p.email = v_email;
    IF v_unsubscribed IS NOT NULL THEN
      RETURN 'unsubscribed';
    END IF;
  END IF;

  RETURN NULL;
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
  IF p_template_id NOT IN ('tokens_credited', 'welcome', 'campaign') THEN
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
     ORDER BY o.next_retry_at ASC, o.created_at ASC
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

CREATE OR REPLACE FUNCTION public.complete_mail_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_provider_message_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign uuid;
BEGIN
  UPDATE public.landing_mail_outbox
     SET status = 'sent',
         provider_message_id = nullif(btrim(coalesce(p_provider_message_id, '')), ''),
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = NULL,
         sent_at = now(),
         updated_at = now()
   WHERE id = p_outbox_id
     AND lease_token = p_lease_token
     AND status = 'processing'
  RETURNING campaign_id INTO v_campaign;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_campaign IS NOT NULL THEN
    UPDATE public.landing_mail_campaigns
       SET sent_count = sent_count + 1,
           updated_at = now()
     WHERE id = v_campaign;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.skip_mail_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign uuid;
BEGIN
  UPDATE public.landing_mail_outbox
     SET status = 'skipped',
         skip_reason = left(coalesce(nullif(btrim(p_reason), ''), 'skipped'), 64),
         lease_token = NULL,
         lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_outbox_id
     AND lease_token = p_lease_token
     AND status = 'processing'
  RETURNING campaign_id INTO v_campaign;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_campaign IS NOT NULL THEN
    UPDATE public.landing_mail_campaigns
       SET skipped_count = skipped_count + 1,
           updated_at = now()
     WHERE id = v_campaign;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_mail_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_delay_seconds integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.landing_mail_outbox%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_row
    FROM public.landing_mail_outbox
   WHERE id = p_outbox_id
     AND lease_token = p_lease_token
     AND status = 'processing'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;

  IF v_row.attempt_count >= v_row.max_attempts THEN
    v_status := 'failed';
    UPDATE public.landing_mail_outbox
       SET status = 'failed',
           last_error_code = left(coalesce(nullif(btrim(p_error_code), ''), 'failed'), 128),
           lease_token = NULL,
           lease_expires_at = NULL,
           updated_at = now()
     WHERE id = p_outbox_id;
    IF v_row.campaign_id IS NOT NULL THEN
      UPDATE public.landing_mail_campaigns
         SET failed_count = failed_count + 1,
             updated_at = now()
       WHERE id = v_row.campaign_id;
    END IF;
  ELSE
    v_status := 'pending';
    UPDATE public.landing_mail_outbox
       SET status = 'pending',
           last_error_code = left(coalesce(nullif(btrim(p_error_code), ''), 'retry'), 128),
           next_retry_at = now() + make_interval(secs => greatest(p_delay_seconds, 1)),
           lease_token = NULL,
           lease_expires_at = NULL,
           updated_at = now()
     WHERE id = p_outbox_id;
  END IF;

  RETURN v_status;
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
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_segment_recipients(p_segment text)
RETURNS TABLE(email text, shared_user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_segment NOT IN ('all_email', 'paid') THEN
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
  resolved AS (
    SELECT
      public.landing_mail_normalize_email(
        coalesce(nullif(au.email, ''), nullif(iu.email, ''))
      ) AS email,
      iu.id AS shared_user_id,
      coalesce(nullif(btrim(lu.display_name), ''), nullif(btrim(iu.display_name), '')) AS display_name
    FROM public.imageprompt_users iu
    LEFT JOIN auth.users au ON au.id = iu.id
    LEFT JOIN public.landing_users lu ON lu.id = iu.id
    WHERE p_segment = 'all_email'
       OR iu.id IN (SELECT user_id FROM paid)
  )
  SELECT r.email, r.shared_user_id, r.display_name
    FROM resolved r
   WHERE r.email IS NOT NULL
     AND public.landing_mail_skip_reason(r.email, 'marketing') IS NULL
   ORDER BY r.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_mail_campaign_preview(
  p_segment text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(email text, shared_user_id uuid, display_name text, recipient_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count
    FROM public.landing_mail_segment_recipients(p_segment);

  RETURN QUERY
  SELECT r.email, r.shared_user_id, r.display_name, v_count
    FROM public.landing_mail_segment_recipients(p_segment) r
   LIMIT least(20, greatest(1, p_limit));
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
         recipient_count = (
           SELECT count(*)::integer
             FROM public.landing_mail_segment_recipients(v_campaign.segment)
         ),
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
    'oldest_pending_at', min(created_at) FILTER (WHERE status IN ('pending', 'processing'))
  )
  FROM public.landing_mail_outbox;
$$;

REVOKE ALL ON TABLE public.landing_mail_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.landing_mail_suppression FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.landing_mail_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.landing_mail_outbox FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.landing_mail_normalize_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_is_internal_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_resolve_email(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_skip_reason(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_enqueue_mail(text, text, text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_mail_outbox(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_mail_outbox(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.skip_mail_outbox(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_mail_outbox(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_unsubscribe(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_suppress(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_segment_recipients(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_campaign_preview(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_campaign_enqueue(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_mail_queue_stats() FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.landing_mail_preferences TO service_role;
GRANT ALL ON TABLE public.landing_mail_suppression TO service_role;
GRANT ALL ON TABLE public.landing_mail_campaigns TO service_role;
GRANT ALL ON TABLE public.landing_mail_outbox TO service_role;

GRANT EXECUTE ON FUNCTION public.landing_mail_normalize_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_is_internal_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_resolve_email(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_skip_reason(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_enqueue_mail(text, text, text, text, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_mail_outbox(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_mail_outbox(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.skip_mail_outbox(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_mail_outbox(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_unsubscribe(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_suppress(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_segment_recipients(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_campaign_preview(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_campaign_enqueue(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_mail_queue_stats() TO service_role;
