-- Publish-for-credits: ledger, first_published_at, grant RPC, finance rollup.
-- Feature flag off until explicitly enabled.

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS first_published_at timestamptz;

COMMENT ON COLUMN public.prompt_cards.first_published_at IS
  'Set once on first false→true publish. Not cleared on hide. NULL = legacy card, no reward.';

CREATE OR REPLACE FUNCTION public.prompt_cards_set_first_published_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_published = true
     AND (OLD.is_published IS DISTINCT FROM true)
     AND NEW.first_published_at IS NULL THEN
    NEW.first_published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prompt_cards_first_published_at ON public.prompt_cards;
CREATE TRIGGER prompt_cards_first_published_at
  BEFORE UPDATE OF is_published ON public.prompt_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.prompt_cards_set_first_published_at();

CREATE TABLE IF NOT EXISTS public.landing_publish_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL UNIQUE REFERENCES public.landing_generations(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landing_user_id uuid NOT NULL REFERENCES public.landing_users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.prompt_cards(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'video', 'photoshoot')),
  credits integer NOT NULL CHECK (credits >= 0),
  reason text NOT NULL CHECK (reason IN ('granted', 'daily_cap')),
  granted_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_publish_rewards_user_day
  ON public.landing_publish_rewards (auth_user_id, granted_on);

CREATE INDEX IF NOT EXISTS idx_landing_publish_rewards_landing_user
  ON public.landing_publish_rewards (landing_user_id)
  WHERE credits > 0;

ALTER TABLE public.landing_publish_rewards ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.landing_publish_rewards IS
  'Idempotent publish bonus ledger. One row per generation. credits=0 when daily cap blocks the grant.';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  ('publish_reward_enabled', 'false', now()),
  ('publish_reward_photo', '1', now()),
  ('publish_reward_video', '5', now()),
  ('publish_reward_photoshoot', '2', now()),
  ('publish_reward_daily_cap', '20', now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.landing_generation_config_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(btrim(c.value), '')::integer,
    p_default
  )
  FROM public.landing_generation_config c
  WHERE c.key = p_key
  UNION ALL
  SELECT p_default
  WHERE NOT EXISTS (
    SELECT 1 FROM public.landing_generation_config c WHERE c.key = p_key
  )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.landing_grant_publish_reward(
  p_generation_id uuid,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gen public.landing_generations%ROWTYPE;
  v_card public.prompt_cards%ROWTYPE;
  v_existing public.landing_publish_rewards%ROWTYPE;
  v_enabled text;
  v_kind text;
  v_reward integer;
  v_cap integer;
  v_today date;
  v_spent_today integer;
  v_credits integer;
  v_reason text;
  v_balance integer;
BEGIN
  IF p_generation_id IS NULL OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_args';
  END IF;

  SELECT c.value INTO v_enabled
  FROM public.landing_generation_config c
  WHERE c.key = 'publish_reward_enabled';

  IF lower(btrim(COALESCE(v_enabled, 'false'))) IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object(
      'status', 'disabled',
      'credits', 0,
      'reason', 'disabled'
    );
  END IF;

  SELECT * INTO v_gen
  FROM public.landing_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'generation_not_found';
  END IF;

  IF v_gen.requester_auth_user_id IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_gen.status IS DISTINCT FROM 'completed'
     OR v_gen.result_storage_path IS NULL THEN
    RAISE EXCEPTION 'generation_result_not_available';
  END IF;

  IF v_gen.ugc_card_id IS NULL THEN
    RAISE EXCEPTION 'card_missing';
  END IF;

  SELECT * INTO v_card
  FROM public.prompt_cards
  WHERE id = v_gen.ugc_card_id
  FOR UPDATE;

  IF NOT FOUND OR v_card.is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'card_not_published';
  END IF;

  IF v_card.first_published_at IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'credits', 0,
      'reason', 'legacy_card'
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.landing_publish_rewards
  WHERE generation_id = p_generation_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already',
      'credits', v_existing.credits,
      'reason', v_existing.reason,
      'kind', v_existing.kind
    );
  END IF;

  v_kind := CASE
    WHEN v_gen.modality = 'video' THEN 'video'
    WHEN v_gen.edit_kind = 'photoshoot' THEN 'photoshoot'
    ELSE 'photo'
  END;

  v_reward := CASE v_kind
    WHEN 'video' THEN public.landing_generation_config_int('publish_reward_video', 5)
    WHEN 'photoshoot' THEN public.landing_generation_config_int('publish_reward_photoshoot', 2)
    ELSE public.landing_generation_config_int('publish_reward_photo', 1)
  END;

  IF v_reward < 0 THEN
    v_reward := 0;
  END IF;

  v_cap := greatest(0, public.landing_generation_config_int('publish_reward_daily_cap', 20));
  v_today := (timezone('Europe/Moscow', now()))::date;

  SELECT COALESCE(sum(r.credits), 0)::integer INTO v_spent_today
  FROM public.landing_publish_rewards r
  WHERE r.auth_user_id = p_auth_user_id
    AND r.granted_on = v_today;

  IF v_spent_today + v_reward > v_cap THEN
    v_credits := 0;
    v_reason := 'daily_cap';
    v_balance := NULL;
  ELSE
    v_credits := v_reward;
    v_reason := 'granted';
    v_balance := public.landing_add_credits(v_gen.user_id, v_credits);
    IF v_balance < 0 THEN
      RAISE EXCEPTION 'credit_wallet_missing';
    END IF;
  END IF;

  INSERT INTO public.landing_publish_rewards (
    generation_id,
    auth_user_id,
    landing_user_id,
    card_id,
    kind,
    credits,
    reason,
    granted_on
  ) VALUES (
    p_generation_id,
    p_auth_user_id,
    v_gen.user_id,
    v_gen.ugc_card_id,
    v_kind,
    v_credits,
    v_reason,
    v_today
  );

  RETURN jsonb_build_object(
    'status', v_reason,
    'credits', v_credits,
    'reason', v_reason,
    'kind', v_kind,
    'balance', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_publish_reward_remaining(
  p_auth_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled text;
  v_cap integer;
  v_today date;
  v_spent integer;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT c.value INTO v_enabled
  FROM public.landing_generation_config c
  WHERE c.key = 'publish_reward_enabled';

  IF lower(btrim(COALESCE(v_enabled, 'false'))) IS DISTINCT FROM 'true' THEN
    RETURN 0;
  END IF;

  v_cap := greatest(0, public.landing_generation_config_int('publish_reward_daily_cap', 20));
  v_today := (timezone('Europe/Moscow', now()))::date;

  SELECT COALESCE(sum(r.credits), 0)::integer INTO v_spent
  FROM public.landing_publish_rewards r
  WHERE r.auth_user_id = p_auth_user_id
    AND r.granted_on = v_today;

  RETURN greatest(0, v_cap - v_spent);
END;
$$;

REVOKE ALL ON FUNCTION public.landing_generation_config_int(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_generation_config_int(text, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.landing_grant_publish_reward(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_grant_publish_reward(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.landing_publish_reward_remaining(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_publish_reward_remaining(uuid)
  TO service_role;

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

DROP FUNCTION IF EXISTS public.admin_credit_liabilities(integer, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.admin_credit_liabilities(
  p_cursor_credits integer DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_search text DEFAULT NULL
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
  WITH search AS (
    SELECT NULLIF(btrim(p_search), '') AS q
  ),
  granted AS (
    SELECT landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_yookassa_payments
    WHERE status = 'succeeded'
      AND credited_at IS NOT NULL
      AND test IS NOT TRUE
    GROUP BY landing_user_id
    UNION ALL
    SELECT landing_user_id, sum(amount)::bigint AS granted
    FROM public.landing_web_transactions
    WHERE state = 'done'
    GROUP BY landing_user_id
    UNION ALL
    SELECT landing_user_id, sum(credits)::bigint AS granted
    FROM public.landing_publish_rewards
    WHERE credits > 0
    GROUP BY landing_user_id
  ),
  granted_user AS (
    SELECT landing_user_id, sum(granted)::bigint AS granted_total
    FROM granted
    GROUP BY landing_user_id
  ),
  spent_user AS (
    SELECT
      user_id,
      sum(credits_spent) FILTER (WHERE NOT credits_refunded)::bigint AS spent_total
    FROM public.landing_generations
    WHERE credits_spent > 0
      AND client_source IS DISTINCT FROM 'admin'
    GROUP BY user_id
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
  WHERE lu.credits > 0
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

REVOKE ALL ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text)
  TO service_role;

COMMENT ON FUNCTION public.admin_credit_daily_flow(integer) IS
  'Service-only daily credit grants (YooKassa/Stars/publish rewards), generation spend, and refunds.';

COMMENT ON FUNCTION public.admin_credit_liabilities(integer, uuid, integer, text) IS
  'Service-only keyset list of users with credits > 0, plus lifetime granted/spent.';

COMMENT ON FUNCTION public.landing_grant_publish_reward(uuid, uuid) IS
  'Idempotent publish bonus. Call after the card is published. Service-role only.';
