-- Two one-shot NPS emails: after the 2nd paid generation, and +24h after credits hit 0.
-- Does not edit prior mail/lifecycle migrations. Flag off by default.
-- Column is survey_trigger, not trigger: unquoted TRIGGER is reserved and aborts CREATE TABLE.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('nps_survey_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.landing_nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.landing_users(id),
  survey_trigger text NOT NULL CHECK (survey_trigger IN ('after_2', 'credits_empty')),
  sent_at timestamptz,
  score smallint CHECK (score IS NULL OR (score >= 1 AND score <= 10)),
  comment text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, survey_trigger)
);

CREATE INDEX IF NOT EXISTS landing_nps_surveys_submitted_at_idx
  ON public.landing_nps_surveys (submitted_at DESC)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_nps_surveys_sent_at_idx
  ON public.landing_nps_surveys (sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_nps_surveys_user_sent_idx
  ON public.landing_nps_surveys (user_id)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_generations_nps_completed_user_idx
  ON public.landing_generations (user_id)
  WHERE status = 'completed'
    AND credits_spent > 0
    AND coalesce(client_source, '') <> 'admin';

COMMENT ON TABLE public.landing_nps_surveys IS
  'One NPS invite per user per survey_trigger. Score 1-10 + optional comment.';

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
    'winback_14', 'winback_30',
    'nps_after_2', 'nps_credits_empty'
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
    WHEN 'nps_after_2' THEN 16
    WHEN 'nps_credits_empty' THEN 17
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
    'winback_14', 'winback_30',
    'nps_after_2', 'nps_credits_empty'
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
    ),
    'nps_after_2_sent', EXISTS (
      SELECT 1 FROM public.landing_nps_surveys s
       WHERE s.user_id = p_shared_user_id
         AND s.survey_trigger = 'after_2'
         AND s.sent_at IS NOT NULL
    ),
    'nps_empty_sent', EXISTS (
      SELECT 1 FROM public.landing_nps_surveys s
       WHERE s.user_id = p_shared_user_id
         AND s.survey_trigger = 'credits_empty'
         AND s.sent_at IS NOT NULL
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_nps_completed_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
    FROM public.landing_generations g
   WHERE g.user_id = p_user_id
     AND g.status = 'completed'
     AND g.credits_spent > 0
     AND coalesce(g.client_source, '') <> 'admin';
$$;

CREATE OR REPLACE FUNCTION public.landing_nps_ensure_survey(
  p_user_id uuid,
  p_trigger text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_trigger NOT IN ('after_2', 'credits_empty') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.landing_nps_surveys (user_id, survey_trigger)
  VALUES (p_user_id, p_trigger)
  ON CONFLICT (user_id, survey_trigger) DO UPDATE
    SET user_id = EXCLUDED.user_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_nps_schedule_empty(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.landing_mail_schedule_due(
    p_user_id,
    'nps_credits_empty',
    p_user_id::text,
    now() + interval '24 hours',
    jsonb_build_object(
      'idempotency_key', 'nps_credits_empty:' || p_user_id::text
    ),
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_nps_on_generation_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey uuid;
  v_credits integer;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF NOT public.landing_mail_config_on('nps_survey_enabled') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.landing_nps_surveys s
     WHERE s.user_id = NEW.user_id AND s.survey_trigger = 'after_2'
  ) THEN
    RETURN NEW;
  END IF;
  IF public.landing_nps_completed_count(NEW.user_id) <> 2 THEN
    RETURN NEW;
  END IF;

  v_survey := public.landing_nps_ensure_survey(NEW.user_id, 'after_2');
  IF v_survey IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.landing_mail_schedule_due(
    NEW.user_id,
    'nps_after_2',
    NEW.user_id::text,
    now(),
    jsonb_build_object(
      'idempotency_key', 'nps_after_2:' || NEW.user_id::text,
      'survey_id', v_survey::text
    ),
    false
  );

  SELECT lu.credits INTO v_credits
    FROM public.landing_users lu
   WHERE lu.id = NEW.user_id;
  IF coalesce(v_credits, 0) = 0 THEN
    PERFORM public.landing_nps_schedule_empty(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_nps_on_credits_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credits <> 0 OR OLD.credits <= 0 THEN
    RETURN NEW;
  END IF;
  IF NOT public.landing_mail_config_on('nps_survey_enabled') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.landing_nps_surveys s
     WHERE s.user_id = NEW.id
       AND s.survey_trigger = 'credits_empty'
       AND s.sent_at IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.landing_nps_surveys s
     WHERE s.user_id = NEW.id
       AND s.survey_trigger = 'after_2'
       AND s.sent_at IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.landing_nps_schedule_empty(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_nps_on_outbox_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger text;
  v_survey uuid;
BEGIN
  IF NEW.status <> 'sent' OR OLD.status IS NOT DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;
  IF NEW.template_id = 'nps_after_2' THEN
    v_trigger := 'after_2';
  ELSIF NEW.template_id = 'nps_credits_empty' THEN
    v_trigger := 'credits_empty';
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    v_survey := NULLIF(btrim(coalesce(NEW.payload->>'survey_id', '')), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_survey := NULL;
  END;

  UPDATE public.landing_nps_surveys s
     SET sent_at = coalesce(s.sent_at, NEW.sent_at, now())
   WHERE (v_survey IS NOT NULL AND s.id = v_survey)
      OR (
        v_survey IS NULL
        AND NEW.shared_user_id IS NOT NULL
        AND s.user_id = NEW.shared_user_id
        AND s.survey_trigger = v_trigger
        AND s.sent_at IS NULL
      );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_nps_generation_completed ON public.landing_generations;
CREATE TRIGGER trg_landing_nps_generation_completed
  AFTER UPDATE OF status ON public.landing_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_nps_on_generation_completed();

DROP TRIGGER IF EXISTS trg_landing_nps_credits_empty ON public.landing_users;
CREATE TRIGGER trg_landing_nps_credits_empty
  AFTER UPDATE OF credits ON public.landing_users
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_nps_on_credits_empty();

DROP TRIGGER IF EXISTS trg_landing_nps_outbox_sent ON public.landing_mail_outbox;
CREATE TRIGGER trg_landing_nps_outbox_sent
  AFTER UPDATE OF status ON public.landing_mail_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_nps_on_outbox_sent();

CREATE OR REPLACE FUNCTION public.landing_nps_submit(
  p_survey_id uuid,
  p_score integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment text := nullif(btrim(left(coalesce(p_comment, ''), 2000)), '');
BEGIN
  IF p_survey_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF p_score IS NULL OR p_score < 1 OR p_score > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_score');
  END IF;

  UPDATE public.landing_nps_surveys
     SET score = p_score,
         comment = v_comment,
         submitted_at = now()
   WHERE id = p_survey_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'score', p_score, 'comment', v_comment);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_nps_summary(p_days integer DEFAULT 30)
RETURNS TABLE (
  sent integer,
  responses integer,
  avg_score numeric,
  promoters integer,
  passives integer,
  detractors integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      public.landing_mail_moscow_day(now()) AS today,
      greatest(1, least(COALESCE(p_days, 30), 90)) AS span
  )
  SELECT
    (
      SELECT count(*)::integer
        FROM public.landing_nps_surveys s
       WHERE s.sent_at IS NOT NULL
         AND public.landing_mail_moscow_day(s.sent_at)
           BETWEEN b.today - (b.span - 1) AND b.today
    ) AS sent,
    (
      SELECT count(*)::integer
        FROM public.landing_nps_surveys s
       WHERE s.submitted_at IS NOT NULL
         AND public.landing_mail_moscow_day(s.submitted_at)
           BETWEEN b.today - (b.span - 1) AND b.today
    ) AS responses,
    (
      SELECT avg(s.score)::numeric
        FROM public.landing_nps_surveys s
       WHERE s.submitted_at IS NOT NULL
         AND s.score IS NOT NULL
         AND public.landing_mail_moscow_day(s.submitted_at)
           BETWEEN b.today - (b.span - 1) AND b.today
    ) AS avg_score,
    (
      SELECT count(*)::integer
        FROM public.landing_nps_surveys s
       WHERE s.submitted_at IS NOT NULL
         AND s.score >= 9
         AND public.landing_mail_moscow_day(s.submitted_at)
           BETWEEN b.today - (b.span - 1) AND b.today
    ) AS promoters,
    (
      SELECT count(*)::integer
        FROM public.landing_nps_surveys s
       WHERE s.submitted_at IS NOT NULL
         AND s.score BETWEEN 7 AND 8
         AND public.landing_mail_moscow_day(s.submitted_at)
           BETWEEN b.today - (b.span - 1) AND b.today
    ) AS passives,
    (
      SELECT count(*)::integer
        FROM public.landing_nps_surveys s
       WHERE s.submitted_at IS NOT NULL
         AND s.score <= 6
         AND public.landing_mail_moscow_day(s.submitted_at)
           BETWEEN b.today - (b.span - 1) AND b.today
    ) AS detractors
  FROM bounds b;
$$;

CREATE OR REPLACE FUNCTION public.admin_nps_daily(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  sent integer,
  responses integer,
  avg_score numeric,
  promoters integer,
  passives integer,
  detractors integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      public.landing_mail_moscow_day(now()) AS today,
      greatest(1, least(COALESCE(p_days, 30), 90)) AS span
  ),
  days AS (
    SELECT generate_series(
      b.today - (b.span - 1),
      b.today,
      interval '1 day'
    )::date AS day
    FROM bounds b
  ),
  sent AS (
    SELECT public.landing_mail_moscow_day(s.sent_at) AS day,
           count(*)::integer AS sent
      FROM public.landing_nps_surveys s
      CROSS JOIN bounds b
     WHERE s.sent_at IS NOT NULL
       AND public.landing_mail_moscow_day(s.sent_at)
         BETWEEN b.today - (b.span - 1) AND b.today
     GROUP BY 1
  ),
  resp AS (
    SELECT public.landing_mail_moscow_day(s.submitted_at) AS day,
           count(*)::integer AS responses,
           avg(s.score)::numeric AS avg_score,
           count(*) FILTER (WHERE s.score >= 9)::integer AS promoters,
           count(*) FILTER (WHERE s.score BETWEEN 7 AND 8)::integer AS passives,
           count(*) FILTER (WHERE s.score <= 6)::integer AS detractors
      FROM public.landing_nps_surveys s
      CROSS JOIN bounds b
     WHERE s.submitted_at IS NOT NULL
       AND s.score IS NOT NULL
       AND public.landing_mail_moscow_day(s.submitted_at)
         BETWEEN b.today - (b.span - 1) AND b.today
     GROUP BY 1
  )
  SELECT
    d.day,
    coalesce(s.sent, 0) AS sent,
    coalesce(r.responses, 0) AS responses,
    r.avg_score,
    coalesce(r.promoters, 0) AS promoters,
    coalesce(r.passives, 0) AS passives,
    coalesce(r.detractors, 0) AS detractors
  FROM days d
  LEFT JOIN sent s ON s.day = d.day
  LEFT JOIN resp r ON r.day = d.day
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.admin_nps_responses(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  survey_id uuid,
  user_id uuid,
  email text,
  survey_trigger text,
  sent_at timestamptz,
  score smallint,
  comment text,
  submitted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      public.landing_mail_moscow_day(now()) AS today,
      greatest(1, least(COALESCE(p_days, 30), 90)) AS span
  )
  SELECT
    s.id AS survey_id,
    s.user_id,
    coalesce(nullif(btrim(iu.email), ''), nullif(btrim(au.email), '')) AS email,
    s.survey_trigger,
    s.sent_at,
    s.score,
    s.comment,
    s.submitted_at
  FROM public.landing_nps_surveys s
  CROSS JOIN bounds b
  LEFT JOIN public.imageprompt_users iu ON iu.id = s.user_id
  LEFT JOIN auth.users au ON au.id = s.user_id
  WHERE (
      (s.sent_at IS NOT NULL AND public.landing_mail_moscow_day(s.sent_at)
        BETWEEN b.today - (b.span - 1) AND b.today)
      OR (s.submitted_at IS NOT NULL AND public.landing_mail_moscow_day(s.submitted_at)
        BETWEEN b.today - (b.span - 1) AND b.today)
    )
  ORDER BY s.submitted_at DESC NULLS LAST, s.sent_at DESC NULLS LAST, s.created_at DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 100), 200));
$$;

ALTER TABLE public.landing_nps_surveys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.landing_nps_surveys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.landing_nps_surveys TO service_role;

REVOKE ALL ON FUNCTION public.landing_nps_completed_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_nps_ensure_survey(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_nps_schedule_empty(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_nps_on_generation_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_nps_on_credits_empty() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_nps_on_outbox_sent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_nps_submit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_nps_summary(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_nps_daily(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_nps_responses(integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.landing_nps_completed_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_nps_ensure_survey(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_nps_schedule_empty(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_nps_submit(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_nps_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_nps_daily(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_nps_responses(integer, integer) TO service_role;
