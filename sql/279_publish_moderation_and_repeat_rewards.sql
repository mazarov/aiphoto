-- User publish goes to moderation. A completed paid repeat of a live card
-- grants the card author 1 credit, capped per card, and queues one transactional mail.
-- Instant publish_reward_enabled is turned off. Do not edit 178 / 186 / 231 / 255.

-- 1. Moderation state on the catalog card.
ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS moderation_status text;

UPDATE public.prompt_cards
   SET moderation_status = CASE
     WHEN is_published IS TRUE THEN 'approved'
     ELSE 'none'
   END
 WHERE moderation_status IS NULL;

ALTER TABLE public.prompt_cards
  ALTER COLUMN moderation_status SET DEFAULT 'none';

ALTER TABLE public.prompt_cards
  ALTER COLUMN moderation_status SET NOT NULL;

ALTER TABLE public.prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_moderation_status_check;

ALTER TABLE public.prompt_cards
  ADD CONSTRAINT prompt_cards_moderation_status_check
  CHECK (moderation_status IN ('none', 'pending', 'approved', 'rejected'));

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS moderation_requested_at timestamptz;

COMMENT ON COLUMN public.prompt_cards.moderation_status IS
  'none = not submitted. pending = author asked to publish. approved = live or admin-published. rejected = moderator declined.';

COMMENT ON COLUMN public.prompt_cards.moderation_requested_at IS
  'Set when the author submits the card for moderation. Not cleared on reject.';

CREATE INDEX IF NOT EXISTS idx_prompt_cards_moderation_pending
  ON public.prompt_cards (moderation_requested_at DESC)
  WHERE moderation_status = 'pending' AND is_published = false;

CREATE OR REPLACE FUNCTION public.prompt_cards_approve_moderation_on_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_published IS TRUE AND OLD.is_published IS DISTINCT FROM TRUE THEN
    NEW.moderation_status := 'approved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prompt_cards_approve_moderation_on_publish ON public.prompt_cards;
CREATE TRIGGER prompt_cards_approve_moderation_on_publish
  BEFORE UPDATE OF is_published ON public.prompt_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.prompt_cards_approve_moderation_on_publish();

-- 2. Flags. Instant click bonus off. Repeat bonus on (1 credit, 50 per card).
UPDATE public.landing_generation_config
   SET value = 'false',
       updated_at = now()
 WHERE key = 'publish_reward_enabled';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  ('card_repeat_reward_enabled', 'true', now()),
  ('card_repeat_reward_credits', '1', now()),
  ('card_repeat_reward_max_per_card', '50', now())
ON CONFLICT (key) DO NOTHING;

-- 3. Idempotent ledger: one paid repeat generation → at most one author credit.
CREATE TABLE IF NOT EXISTS public.landing_card_repeat_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repeat_generation_id uuid NOT NULL UNIQUE REFERENCES public.landing_generations(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.prompt_cards(id) ON DELETE CASCADE,
  author_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_landing_user_id uuid NOT NULL REFERENCES public.landing_users(id) ON DELETE CASCADE,
  repeater_auth_user_id uuid NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  card_earned_total integer NOT NULL CHECK (card_earned_total > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_card_repeat_rewards_card
  ON public.landing_card_repeat_rewards (card_id);

CREATE INDEX IF NOT EXISTS idx_landing_card_repeat_rewards_author
  ON public.landing_card_repeat_rewards (author_landing_user_id);

ALTER TABLE public.landing_card_repeat_rewards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.landing_card_repeat_rewards FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.landing_card_repeat_rewards TO service_role;

COMMENT ON TABLE public.landing_card_repeat_rewards IS
  'One credit row per completed paid repeat of a published card. Cap is per card, not per day.';

-- 4. Grant. Called from the completion trigger. Never raise to the caller:
-- the trigger swallows errors so a reward failure cannot fail the generation.
CREATE OR REPLACE FUNCTION public.landing_grant_card_repeat_reward(
  p_repeat_generation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gen public.landing_generations%ROWTYPE;
  v_card public.prompt_cards%ROWTYPE;
  v_enabled text;
  v_reward integer;
  v_max integer;
  v_earned integer;
  v_balance integer;
  v_email text;
  v_inserted uuid;
BEGIN
  IF p_repeat_generation_id IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'invalid_args');
  END IF;

  SELECT c.value INTO v_enabled
  FROM public.landing_generation_config c
  WHERE c.key = 'card_repeat_reward_enabled';

  IF lower(btrim(COALESCE(v_enabled, 'false'))) IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('status', 'disabled', 'credits', 0, 'reason', 'disabled');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.landing_card_repeat_rewards r
    WHERE r.repeat_generation_id = p_repeat_generation_id
  ) THEN
    RETURN jsonb_build_object('status', 'already', 'credits', 0, 'reason', 'already');
  END IF;

  SELECT * INTO v_gen
  FROM public.landing_generations
  WHERE id = p_repeat_generation_id;

  IF NOT FOUND OR v_gen.status IS DISTINCT FROM 'completed' OR v_gen.card_id IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'not_repeat');
  END IF;

  IF v_gen.client_source IS NOT DISTINCT FROM 'admin'
     OR v_gen.parent_generation_id IS NOT NULL
     OR COALESCE(v_gen.credits_spent, 0) <= 0
     OR v_gen.requester_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'ineligible');
  END IF;

  SELECT * INTO v_card
  FROM public.prompt_cards
  WHERE id = v_gen.card_id;

  IF NOT FOUND
     OR v_card.is_published IS NOT TRUE
     OR v_card.author_user_id IS NULL
     OR v_card.author_user_id IS NOT DISTINCT FROM v_gen.requester_auth_user_id
     OR v_card.author_user_id IS NOT DISTINCT FROM v_gen.user_id THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'not_author_card');
  END IF;

  -- Serialize the per-card cap. Re-read under the lock.
  SELECT * INTO v_card
  FROM public.prompt_cards
  WHERE id = v_gen.card_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_card.is_published IS NOT TRUE
     OR v_card.author_user_id IS NULL
     OR v_card.author_user_id IS NOT DISTINCT FROM v_gen.requester_auth_user_id
     OR v_card.author_user_id IS NOT DISTINCT FROM v_gen.user_id THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'not_author_card');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.landing_users lu WHERE lu.id = v_card.author_user_id
  ) THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'no_wallet');
  END IF;

  v_reward := greatest(0, public.landing_generation_config_int('card_repeat_reward_credits', 1));
  v_max := greatest(0, public.landing_generation_config_int('card_repeat_reward_max_per_card', 50));
  IF v_reward <= 0 OR v_max <= 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'credits', 0, 'reason', 'zero');
  END IF;

  SELECT COALESCE(sum(r.credits), 0)::integer INTO v_earned
  FROM public.landing_card_repeat_rewards r
  WHERE r.card_id = v_card.id;

  IF v_earned + v_reward > v_max THEN
    RETURN jsonb_build_object('status', 'cap', 'credits', 0, 'reason', 'card_cap');
  END IF;

  INSERT INTO public.landing_card_repeat_rewards (
    repeat_generation_id,
    card_id,
    author_auth_user_id,
    author_landing_user_id,
    repeater_auth_user_id,
    credits,
    card_earned_total
  ) VALUES (
    p_repeat_generation_id,
    v_card.id,
    v_card.author_user_id,
    v_card.author_user_id,
    v_gen.requester_auth_user_id,
    v_reward,
    v_earned + v_reward
  )
  ON CONFLICT (repeat_generation_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('status', 'already', 'credits', 0, 'reason', 'already');
  END IF;

  v_balance := public.landing_add_credits(v_card.author_user_id, v_reward);
  IF v_balance < 0 THEN
    RAISE EXCEPTION 'credit_wallet_missing';
  END IF;

  BEGIN
    v_email := public.landing_mail_resolve_email(v_card.author_user_id, v_card.author_user_id);
    IF v_email IS NOT NULL THEN
      PERFORM 1
      FROM public.landing_enqueue_mail(
        'transactional',
        'card_repeat_reward',
        'card_repeat_reward:' || p_repeat_generation_id::text,
        v_email,
        v_card.author_user_id,
        NULL,
        jsonb_build_object(
          'credits', v_reward,
          'card_slug', v_card.slug,
          'card_title', v_card.title_ru,
          'card_earned_total', v_earned + v_reward,
          'card_max_credits', v_max,
          'balance', v_balance
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'card_repeat_reward_mail_failed generation=% sqlstate=%',
      p_repeat_generation_id, SQLSTATE;
  END;

  RETURN jsonb_build_object(
    'status', 'granted',
    'credits', v_reward,
    'reason', 'granted',
    'balance', v_balance,
    'card_earned_total', v_earned + v_reward
  );
END;
$$;

REVOKE ALL ON FUNCTION public.landing_grant_card_repeat_reward(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_grant_card_repeat_reward(uuid)
  TO service_role;

COMMENT ON FUNCTION public.landing_grant_card_repeat_reward(uuid) IS
  'Idempotent +1 credit to the published card author when someone else completes a paid repeat. Service-role or the completion trigger.';

CREATE OR REPLACE FUNCTION public.landing_generations_grant_card_repeat_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.landing_grant_card_repeat_reward(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'card_repeat_reward_failed generation=% sqlstate=%', NEW.id, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_generations_card_repeat_reward ON public.landing_generations;
CREATE TRIGGER landing_generations_card_repeat_reward
  AFTER UPDATE OF status ON public.landing_generations
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM 'completed'
    AND NEW.status = 'completed'
    AND NEW.card_id IS NOT NULL
  )
  EXECUTE FUNCTION public.landing_generations_grant_card_repeat_reward();

-- 5. Transactional template. Same body as 255, plus card_repeat_reward.
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
    'nps_after_2', 'nps_credits_empty',
    'card_repeat_reward'
  ));

CREATE OR REPLACE FUNCTION public.landing_mail_due_priority(p_template_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_template_id
    WHEN 'card_repeat_reward' THEN 8
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
    'nps_after_2', 'nps_credits_empty',
    'card_repeat_reward'
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

-- 6. Admin queue: pending_moderation filter + moderation_status column.
DROP FUNCTION IF EXISTS public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
);

CREATE FUNCTION public.admin_user_generations_queue(
  p_status text DEFAULT 'all',
  p_client_source text DEFAULT NULL,
  p_publication_status text DEFAULT 'all',
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  generation_completed_at timestamptz,
  status text,
  prompt_text text,
  model text,
  aspect_ratio text,
  image_size text,
  credits_spent integer,
  credits_refunded boolean,
  error_type text,
  error_message text,
  client_source text,
  requester_auth_user_id uuid,
  user_id uuid,
  user_email text,
  user_display_name text,
  user_provider text,
  input_photo_paths text[],
  result_storage_bucket text,
  result_storage_path text,
  ugc_card_id uuid,
  card_exists boolean,
  is_published boolean,
  card_slug text,
  moderation_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.created_at,
    g.generation_completed_at,
    g.status,
    g.prompt_text,
    g.model,
    g.aspect_ratio,
    g.image_size,
    g.credits_spent,
    g.credits_refunded,
    g.error_type,
    g.error_message,
    COALESCE(g.client_source, 'unknown') AS client_source,
    g.requester_auth_user_id,
    g.user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS user_email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS user_display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS user_provider,
    g.input_photo_paths,
    g.result_storage_bucket,
    g.result_storage_path,
    g.ugc_card_id,
    (c.id IS NOT NULL) AS card_exists,
    COALESCE(c.is_published, false) AS is_published,
    c.slug AS card_slug,
    COALESCE(c.moderation_status, 'none') AS moderation_status
  FROM public.landing_generations g
  LEFT JOIN auth.users au ON au.id = g.requester_auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = g.user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = g.user_id
  LEFT JOIN public.prompt_cards c ON c.id = g.ugc_card_id
  WHERE g.client_source IS DISTINCT FROM 'admin'
    AND (
      lower(COALESCE(p_status, 'all')) = 'all'
      OR g.status = lower(p_status)
    )
    AND (
      NULLIF(lower(COALESCE(p_client_source, '')), '') IS NULL
      OR COALESCE(g.client_source, 'unknown') = lower(p_client_source)
    )
    AND CASE lower(COALESCE(p_publication_status, 'all'))
      WHEN 'published' THEN c.id IS NOT NULL AND c.is_published = true
      WHEN 'unpublished' THEN g.ugc_card_id IS NULL OR c.id IS NULL OR c.is_published = false
      WHEN 'pending_moderation' THEN c.id IS NOT NULL AND c.is_published = false AND c.moderation_status = 'pending'
      ELSE true
    END
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR g.created_at < p_cursor_created_at
      OR (g.created_at = p_cursor_created_at AND g.id < p_cursor_id)
    )
  ORDER BY g.created_at DESC, g.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
) TO service_role;

COMMENT ON FUNCTION public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
) IS 'Service-only cursor of non-admin generations. pending_moderation = author submitted, not on the showcase yet.';

-- 7. Finance: repeat credits count as grants. Live liabilities RPC is the 5-arg form (SQL 186).
CREATE OR REPLACE FUNCTION public.admin_credit_daily_flow(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  granted integer,
  spent integer,
  refunded integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (timezone('utc', now())::date - (greatest(1, least(COALESCE(p_days, 30), 90)) - 1)) AS start_day,
      timezone('utc', now())::date AS end_day
  ),
  days AS (
    SELECT generate_series(b.start_day, b.end_day, interval '1 day')::date AS day
    FROM bounds b
  ),
  granted AS (
    SELECT
      timezone('utc', p.credited_at)::date AS day,
      sum(p.credits)::bigint AS granted
    FROM public.landing_yookassa_payments p
    CROSS JOIN bounds b
    WHERE p.status = 'succeeded'
      AND p.credited_at IS NOT NULL
      AND p.test IS NOT TRUE
      AND timezone('utc', p.credited_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
    UNION ALL
    SELECT
      timezone('utc', t.updated_at)::date AS day,
      sum(t.amount)::bigint AS granted
    FROM public.landing_web_transactions t
    CROSS JOIN bounds b
    WHERE t.state = 'done'
      AND timezone('utc', t.updated_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
    UNION ALL
    SELECT
      timezone('utc', r.created_at)::date AS day,
      sum(r.credits)::bigint AS granted
    FROM public.landing_publish_rewards r
    CROSS JOIN bounds b
    WHERE r.credits > 0
      AND timezone('utc', r.created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
    UNION ALL
    SELECT
      timezone('utc', r.created_at)::date AS day,
      sum(r.credits)::bigint AS granted
    FROM public.landing_card_repeat_rewards r
    CROSS JOIN bounds b
    WHERE timezone('utc', r.created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
  ),
  granted_day AS (
    SELECT g.day, sum(g.granted)::bigint AS granted
    FROM granted g
    GROUP BY g.day
  ),
  spent_day AS (
    SELECT
      timezone('utc', g.created_at)::date AS day,
      sum(g.credits_spent)::bigint AS spent
    FROM public.landing_generations g
    CROSS JOIN bounds b
    WHERE g.credits_spent > 0
      AND g.client_source IS DISTINCT FROM 'admin'
      AND timezone('utc', g.created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
  ),
  refunded_day AS (
    SELECT
      timezone('utc', g.refunded_at)::date AS day,
      sum(g.credits_spent)::bigint AS refunded
    FROM public.landing_generations g
    CROSS JOIN bounds b
    WHERE g.credits_refunded
      AND g.credits_spent > 0
      AND g.refunded_at IS NOT NULL
      AND g.client_source IS DISTINCT FROM 'admin'
      AND timezone('utc', g.refunded_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(gd.granted, 0)::integer AS granted,
    COALESCE(sd.spent, 0)::integer AS spent,
    COALESCE(rd.refunded, 0)::integer AS refunded
  FROM days d
  LEFT JOIN granted_day gd ON gd.day = d.day
  LEFT JOIN spent_day sd ON sd.day = d.day
  LEFT JOIN refunded_day rd ON rd.day = d.day
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.admin_credit_liabilities(
  p_cursor_credits integer DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_search text DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  landing_user_id uuid,
  email text,
  display_name text,
  provider text,
  credits integer,
  granted_total integer,
  spent_total integer,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (timezone('utc', now())::date - (greatest(1, least(COALESCE(p_days, 30), 90)) - 1)) AS start_day,
      timezone('utc', now())::date AS end_day
  ),
  search AS (
    SELECT NULLIF(btrim(p_search), '') AS q
  ),
  granted AS (
    SELECT landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_yookassa_payments
    CROSS JOIN bounds b
    WHERE status = 'succeeded'
      AND credited_at IS NOT NULL
      AND test IS NOT TRUE
      AND timezone('utc', credited_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY landing_user_id
    UNION ALL
    SELECT landing_user_id, sum(amount)::bigint AS granted
    FROM public.landing_web_transactions
    CROSS JOIN bounds b
    WHERE state = 'done'
      AND timezone('utc', updated_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY landing_user_id
    UNION ALL
    SELECT landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_publish_rewards
    CROSS JOIN bounds b
    WHERE credits > 0
      AND timezone('utc', created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY landing_user_id
    UNION ALL
    SELECT author_landing_user_id AS landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_card_repeat_rewards
    CROSS JOIN bounds b
    WHERE timezone('utc', created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY author_landing_user_id
  ),
  granted_user AS (
    SELECT landing_user_id, sum(granted)::bigint AS granted_total
    FROM granted
    GROUP BY landing_user_id
  ),
  spent_user AS (
    SELECT
      g.user_id,
      sum(g.credits_spent) FILTER (WHERE NOT g.credits_refunded)::bigint AS spent_total
    FROM public.landing_generations g
    CROSS JOIN bounds b
    WHERE g.credits_spent > 0
      AND g.client_source IS DISTINCT FROM 'admin'
      AND timezone('utc', g.created_at)::date BETWEEN b.start_day AND b.end_day
    GROUP BY g.user_id
  )
  SELECT
    lu.id AS landing_user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS provider,
    lu.credits,
    COALESCE(gu.granted_total, 0)::integer AS granted_total,
    COALESCE(su.spent_total, 0)::integer AS spent_total,
    lu.updated_at
  FROM public.landing_users lu
  LEFT JOIN auth.users au ON au.id = lu.id
  LEFT JOIN public.imageprompt_users iu ON iu.id = lu.id
  LEFT JOIN granted_user gu ON gu.landing_user_id = lu.id
  LEFT JOIN spent_user su ON su.user_id = lu.id
  CROSS JOIN search s
  WHERE (COALESCE(gu.granted_total, 0) > 0 OR COALESCE(su.spent_total, 0) > 0)
    AND (
      s.q IS NULL
      OR COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, ''), '') ILIKE '%' || s.q || '%'
      OR COALESCE(
        NULLIF(lu.display_name, ''),
        NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(au.raw_user_meta_data ->> 'name', ''),
        NULLIF(iu.display_name, ''),
        ''
      ) ILIKE '%' || s.q || '%'
    )
    AND (
      p_cursor_credits IS NULL
      OR p_cursor_id IS NULL
      OR lu.credits < p_cursor_credits
      OR (lu.credits = p_cursor_credits AND lu.id < p_cursor_id)
    )
  ORDER BY lu.credits DESC, lu.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_credit_daily_flow(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_daily_flow(integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text, integer)
  TO service_role;

COMMENT ON FUNCTION public.admin_credit_daily_flow(integer) IS
  'Service-only daily credit grants (YooKassa, Stars, publish rewards, card-repeat rewards), spend, and refunds.';

COMMENT ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text, integer) IS
  'Service-only users with credit grant/spend in the UTC window, including publish and card-repeat rewards.';
