-- First-party visitor/session identity, first-known non-direct attribution,
-- immutable visitor→user links, and actor-safe analytics.
-- Extends latest contracts from 160 / 175 / 186 / 189 / 195. Does not edit them.

-- ---------------------------------------------------------------------------
-- Sanitize helpers (UTM ≤64, path ≤200, yclid = existing numeric rule)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.landing_sanitize_control_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(btrim(COALESCE(p_value, '')), E'[\\000-\\037\\177]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.landing_sanitize_utm(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(v, 64)
  FROM (SELECT public.landing_sanitize_control_text(p_value) AS v) s
  WHERE v IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.landing_sanitize_utm_path(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := public.landing_sanitize_control_text(p_value);
BEGIN
  IF v IS NULL THEN
    RETURN NULL;
  END IF;
  IF v ~* '^https?://' THEN
    v := regexp_replace(v, '^[a-zA-Z][a-zA-Z+.-]*://[^/]+', '');
  END IF;
  v := split_part(split_part(v, '?', 1), '#', 1);
  v := NULLIF(v, '');
  IF v IS NULL THEN
    RETURN NULL;
  END IF;
  IF left(v, 1) IS DISTINCT FROM '/' THEN
    v := '/' || v;
  END IF;
  RETURN left(v, 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_sanitize_yclid(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT v
  FROM (SELECT public.landing_sanitize_control_text(p_value) AS v) s
  WHERE v ~ '^[0-9]{9,32}$';
$$;

REVOKE ALL ON FUNCTION public.landing_sanitize_control_text(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_sanitize_utm(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_sanitize_utm_path(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_sanitize_yclid(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_sanitize_control_text(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_sanitize_utm(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_sanitize_utm_path(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_sanitize_yclid(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Visitor dimension
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.landing_acquisition_visitors (
  visitor_id uuid PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_landing_path text,
  yclid text,
  attribution_captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT landing_acquisition_visitors_yclid_format
    CHECK (yclid IS NULL OR yclid ~ '^[0-9]{9,32}$')
);

CREATE INDEX IF NOT EXISTS landing_acquisition_visitors_source_campaign_seen_idx
  ON public.landing_acquisition_visitors (utm_source, utm_campaign, first_seen_at);

CREATE INDEX IF NOT EXISTS landing_acquisition_visitors_yclid_idx
  ON public.landing_acquisition_visitors (yclid)
  WHERE yclid IS NOT NULL;

COMMENT ON TABLE public.landing_acquisition_visitors IS
  'First-party visitor dimension. UTM bag is first-known non-direct; yclid backfills independently.';

ALTER TABLE public.landing_acquisition_visitors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.landing_acquisition_visitors FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.landing_acquisition_visitors TO service_role;

CREATE OR REPLACE FUNCTION public.landing_acquisition_visitors_protect()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.utm_source := public.landing_sanitize_utm(NEW.utm_source);
  NEW.utm_medium := public.landing_sanitize_utm(NEW.utm_medium);
  NEW.utm_campaign := public.landing_sanitize_utm(NEW.utm_campaign);
  NEW.utm_content := public.landing_sanitize_utm(NEW.utm_content);
  NEW.utm_term := public.landing_sanitize_utm(NEW.utm_term);
  NEW.utm_landing_path := public.landing_sanitize_utm_path(NEW.utm_landing_path);
  NEW.yclid := public.landing_sanitize_yclid(NEW.yclid);

  IF TG_OP = 'INSERT' THEN
    NEW.first_seen_at := COALESCE(NEW.first_seen_at, now());
    NEW.last_seen_at := COALESCE(NEW.last_seen_at, NEW.first_seen_at, now());
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    IF NEW.utm_source IS NOT NULL OR NEW.yclid IS NOT NULL THEN
      NEW.attribution_captured_at := COALESCE(NEW.attribution_captured_at, now());
    END IF;
    RETURN NEW;
  END IF;

  NEW.first_seen_at := OLD.first_seen_at;
  NEW.last_seen_at := GREATEST(OLD.last_seen_at, COALESCE(NEW.last_seen_at, now()));
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();

  IF OLD.utm_source IS NOT NULL THEN
    NEW.utm_source := OLD.utm_source;
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
  ELSIF NEW.utm_source IS NOT NULL THEN
    NEW.attribution_captured_at := COALESCE(NEW.attribution_captured_at, now());
  ELSE
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
  END IF;

  IF OLD.yclid IS NOT NULL THEN
    NEW.yclid := OLD.yclid;
  ELSIF NEW.yclid IS NOT NULL AND NEW.attribution_captured_at IS NULL THEN
    NEW.attribution_captured_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_acquisition_visitors_protect ON public.landing_acquisition_visitors;
CREATE TRIGGER landing_acquisition_visitors_protect
  BEFORE INSERT OR UPDATE ON public.landing_acquisition_visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_acquisition_visitors_protect();

REVOKE ALL ON FUNCTION public.landing_acquisition_visitors_protect() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Immutable visitor → landing_user links
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.landing_visitor_user_links (
  visitor_id uuid NOT NULL REFERENCES public.landing_acquisition_visitors(visitor_id),
  landing_user_id uuid NOT NULL REFERENCES public.landing_users(id) ON DELETE CASCADE,
  auth_user_id uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, landing_user_id)
);

CREATE INDEX IF NOT EXISTS landing_visitor_user_links_user_idx
  ON public.landing_visitor_user_links (landing_user_id, linked_at DESC);

CREATE INDEX IF NOT EXISTS landing_visitor_user_links_auth_idx
  ON public.landing_visitor_user_links (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON TABLE public.landing_visitor_user_links IS
  'Immutable anonymous→user identity links. Does not rewrite historical event facts.';

ALTER TABLE public.landing_visitor_user_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.landing_visitor_user_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.landing_visitor_user_links TO service_role;

-- ---------------------------------------------------------------------------
-- landing_users first-known attribution
-- ---------------------------------------------------------------------------

ALTER TABLE public.landing_users
  ADD COLUMN IF NOT EXISTS acquisition_visitor_id uuid
    REFERENCES public.landing_acquisition_visitors(visitor_id),
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_landing_path text,
  ADD COLUMN IF NOT EXISTS yclid text,
  ADD COLUMN IF NOT EXISTS attribution_captured_at timestamptz;

CREATE INDEX IF NOT EXISTS landing_users_utm_source_idx
  ON public.landing_users (utm_source)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_users_utm_campaign_idx
  ON public.landing_users (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_users_acquisition_visitor_idx
  ON public.landing_users (acquisition_visitor_id)
  WHERE acquisition_visitor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.landing_users_protect_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.acquisition_visitor_id := OLD.acquisition_visitor_id;
    NEW.utm_source := OLD.utm_source;
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.yclid := OLD.yclid;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
    RETURN NEW;
  END IF;

  NEW.utm_source := public.landing_sanitize_utm(NEW.utm_source);
  NEW.utm_medium := public.landing_sanitize_utm(NEW.utm_medium);
  NEW.utm_campaign := public.landing_sanitize_utm(NEW.utm_campaign);
  NEW.utm_content := public.landing_sanitize_utm(NEW.utm_content);
  NEW.utm_term := public.landing_sanitize_utm(NEW.utm_term);
  NEW.utm_landing_path := public.landing_sanitize_utm_path(NEW.utm_landing_path);
  NEW.yclid := public.landing_sanitize_yclid(NEW.yclid);

  IF OLD.acquisition_visitor_id IS NOT NULL THEN
    NEW.acquisition_visitor_id := OLD.acquisition_visitor_id;
  END IF;

  IF OLD.utm_source IS NOT NULL THEN
    NEW.utm_source := OLD.utm_source;
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
  ELSIF NEW.utm_source IS NOT NULL THEN
    NEW.attribution_captured_at := COALESCE(NEW.attribution_captured_at, now());
  ELSE
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
  END IF;

  IF OLD.yclid IS NOT NULL THEN
    NEW.yclid := OLD.yclid;
  ELSIF NEW.yclid IS NOT NULL AND NEW.attribution_captured_at IS NULL THEN
    NEW.attribution_captured_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_users_protect_attribution ON public.landing_users;
CREATE TRIGGER landing_users_protect_attribution
  BEFORE UPDATE ON public.landing_users
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_users_protect_attribution();

REVOKE ALL ON FUNCTION public.landing_users_protect_attribution() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payment ledger snapshots (yclid/ym_client_id already exist — do not duplicate)
-- ---------------------------------------------------------------------------

ALTER TABLE public.landing_yookassa_payments
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_landing_path text;

ALTER TABLE public.landing_robokassa_payments
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_landing_path text;

CREATE INDEX IF NOT EXISTS landing_yookassa_payments_utm_source_created_idx
  ON public.landing_yookassa_payments (utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_yookassa_payments_utm_campaign_created_idx
  ON public.landing_yookassa_payments (utm_campaign, created_at DESC)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_robokassa_payments_utm_source_created_idx
  ON public.landing_robokassa_payments (utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_robokassa_payments_utm_campaign_created_idx
  ON public.landing_robokassa_payments (utm_campaign, created_at DESC)
  WHERE utm_campaign IS NOT NULL;

CREATE OR REPLACE FUNCTION public.landing_payment_protect_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.utm_source := public.landing_sanitize_utm(NEW.utm_source);
  NEW.utm_medium := public.landing_sanitize_utm(NEW.utm_medium);
  NEW.utm_campaign := public.landing_sanitize_utm(NEW.utm_campaign);
  NEW.utm_content := public.landing_sanitize_utm(NEW.utm_content);
  NEW.utm_term := public.landing_sanitize_utm(NEW.utm_term);
  NEW.utm_landing_path := public.landing_sanitize_utm_path(NEW.utm_landing_path);
  NEW.yclid := public.landing_sanitize_yclid(NEW.yclid);

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  NEW.visitor_id := COALESCE(OLD.visitor_id, NEW.visitor_id);
  NEW.session_id := COALESCE(OLD.session_id, NEW.session_id);
  NEW.yclid := COALESCE(OLD.yclid, NEW.yclid);

  IF OLD.utm_source IS NOT NULL THEN
    NEW.utm_source := OLD.utm_source;
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_yookassa_payments_protect_attribution
  ON public.landing_yookassa_payments;
CREATE TRIGGER landing_yookassa_payments_protect_attribution
  BEFORE INSERT OR UPDATE ON public.landing_yookassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_payment_protect_attribution();

DROP TRIGGER IF EXISTS landing_robokassa_payments_protect_attribution
  ON public.landing_robokassa_payments;
CREATE TRIGGER landing_robokassa_payments_protect_attribution
  BEFORE INSERT OR UPDATE ON public.landing_robokassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_payment_protect_attribution();

REVOKE ALL ON FUNCTION public.landing_payment_protect_attribution() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Existing funnel facts: nullable visitor/session. No FK so facts can land
-- before the visitor dimension row exists. Event rows stay immutable.
-- extension_client_events.session_id already exists as text (175) — reuse it.
-- ---------------------------------------------------------------------------

ALTER TABLE public.extension_analyze_events
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.extension_client_events
  ADD COLUMN IF NOT EXISTS visitor_id uuid;

ALTER TABLE public.analyze_history
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.prompt_card_view_events
  ADD COLUMN IF NOT EXISTS visitor_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE INDEX IF NOT EXISTS extension_analyze_events_visitor_idx
  ON public.extension_analyze_events (visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS extension_client_events_visitor_idx
  ON public.extension_client_events (visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS analyze_history_visitor_idx
  ON public.analyze_history (visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS landing_generations_visitor_idx
  ON public.landing_generations (visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS prompt_card_view_events_visitor_idx
  ON public.prompt_card_view_events (visitor_id)
  WHERE visitor_id IS NOT NULL;

ALTER TABLE public.prompt_card_view_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prompt_card_view_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prompt_card_view_events TO service_role;

-- ---------------------------------------------------------------------------
-- Shared guest owner + unique-actor helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.landing_is_shared_guest_owner(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
          FROM public.photo_app_config c
         WHERE c.key = 'stv_guest_owner_user_id'
           AND NULLIF(btrim(c.value), '') = p_user_id::text
      )
      OR EXISTS (
        SELECT 1
          FROM public.landing_users lu
         WHERE lu.id = p_user_id
           AND lu.provider = 'stv_guest_owner'
      )
      OR EXISTS (
        SELECT 1
          FROM public.imageprompt_users iu
         WHERE iu.id = p_user_id
           AND lower(iu.email) = 'stv-guest-owner@promptshot.internal'
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.landing_analytics_actor_key(
  p_user_id text,
  p_ip_hash text,
  p_visitor_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_visitor_id::text,
    CASE
      WHEN p_user_id IS NOT NULL
           AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND NOT public.landing_is_shared_guest_owner(p_user_id::uuid)
      THEN p_user_id
      ELSE NULL
    END,
    NULLIF(btrim(p_ip_hash), '')
  );
$$;

REVOKE ALL ON FUNCTION public.landing_is_shared_guest_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_analytics_actor_key(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_is_shared_guest_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_analytics_actor_key(text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Visitor upsert + attach RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_landing_acquisition_visitor(
  p_visitor_id uuid,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_utm_landing_path text DEFAULT NULL,
  p_yclid text DEFAULT NULL,
  p_attribution_captured_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  visitor_id uuid,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_landing_path text,
  yclid text,
  attribution_captured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_visitor_id IS NULL THEN
    RAISE EXCEPTION 'visitor_id_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.landing_acquisition_visitors (
    visitor_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    utm_landing_path,
    yclid,
    attribution_captured_at
  ) VALUES (
    p_visitor_id,
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_utm_content,
    p_utm_term,
    p_utm_landing_path,
    p_yclid,
    p_attribution_captured_at
  )
  ON CONFLICT (visitor_id) DO UPDATE
    SET last_seen_at = now(),
        utm_source = EXCLUDED.utm_source,
        utm_medium = EXCLUDED.utm_medium,
        utm_campaign = EXCLUDED.utm_campaign,
        utm_content = EXCLUDED.utm_content,
        utm_term = EXCLUDED.utm_term,
        utm_landing_path = EXCLUDED.utm_landing_path,
        yclid = EXCLUDED.yclid,
        attribution_captured_at = EXCLUDED.attribution_captured_at,
        updated_at = now();

  RETURN QUERY
  SELECT
    v.visitor_id,
    v.first_seen_at,
    v.last_seen_at,
    v.utm_source,
    v.utm_medium,
    v.utm_campaign,
    v.utm_content,
    v.utm_term,
    v.utm_landing_path,
    v.yclid,
    v.attribution_captured_at
  FROM public.landing_acquisition_visitors v
  WHERE v.visitor_id = p_visitor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_landing_visitor_to_user(
  p_visitor_id uuid,
  p_landing_user_id uuid,
  p_auth_user_id uuid DEFAULT NULL
)
RETURNS TABLE(linked boolean, attributed boolean, yclid_updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_exists boolean;
  v_utm_source text;
  v_yclid text;
  v_attributed boolean := false;
  v_yclid_updated boolean := false;
BEGIN
  IF p_visitor_id IS NULL THEN
    RAISE EXCEPTION 'visitor_id_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_landing_user_id IS NULL THEN
    RAISE EXCEPTION 'landing_user_id_required' USING ERRCODE = 'P0001';
  END IF;
  IF public.landing_is_shared_guest_owner(p_landing_user_id) THEN
    RAISE EXCEPTION 'shared_guest_owner_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT true INTO v_user_exists
    FROM public.landing_users
   WHERE id = p_landing_user_id;

  IF v_user_exists IS NOT TRUE THEN
    RAISE EXCEPTION 'landing_user_not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.landing_acquisition_visitors (visitor_id)
  VALUES (p_visitor_id)
  ON CONFLICT (visitor_id) DO NOTHING;

  INSERT INTO public.landing_visitor_user_links (
    visitor_id,
    landing_user_id,
    auth_user_id,
    linked_at
  ) VALUES (
    p_visitor_id,
    p_landing_user_id,
    p_auth_user_id,
    now()
  )
  ON CONFLICT (visitor_id, landing_user_id) DO UPDATE
    SET auth_user_id = COALESCE(
      public.landing_visitor_user_links.auth_user_id,
      EXCLUDED.auth_user_id
    );

  SELECT lu.utm_source, lu.yclid
    INTO v_utm_source, v_yclid
    FROM public.landing_users lu
   WHERE lu.id = p_landing_user_id
   FOR UPDATE;

  UPDATE public.landing_users lu
     SET acquisition_visitor_id = COALESCE(lu.acquisition_visitor_id, p_visitor_id),
         utm_source = CASE WHEN lu.utm_source IS NULL THEN v.utm_source ELSE lu.utm_source END,
         utm_medium = CASE WHEN lu.utm_source IS NULL THEN v.utm_medium ELSE lu.utm_medium END,
         utm_campaign = CASE WHEN lu.utm_source IS NULL THEN v.utm_campaign ELSE lu.utm_campaign END,
         utm_content = CASE WHEN lu.utm_source IS NULL THEN v.utm_content ELSE lu.utm_content END,
         utm_term = CASE WHEN lu.utm_source IS NULL THEN v.utm_term ELSE lu.utm_term END,
         utm_landing_path = CASE WHEN lu.utm_source IS NULL THEN v.utm_landing_path ELSE lu.utm_landing_path END,
         yclid = COALESCE(lu.yclid, v.yclid),
         attribution_captured_at = CASE
           WHEN lu.utm_source IS NULL AND v.utm_source IS NOT NULL
             THEN COALESCE(v.attribution_captured_at, now())
           WHEN lu.yclid IS NULL AND v.yclid IS NOT NULL AND lu.attribution_captured_at IS NULL
             THEN COALESCE(v.attribution_captured_at, now())
           ELSE lu.attribution_captured_at
         END,
         updated_at = now()
    FROM public.landing_acquisition_visitors v
   WHERE lu.id = p_landing_user_id
     AND v.visitor_id = p_visitor_id
     AND (
       lu.acquisition_visitor_id IS NULL
       OR lu.utm_source IS NULL
       OR lu.yclid IS NULL
     );

  SELECT
    (v_utm_source IS NULL AND lu.utm_source IS NOT NULL),
    (v_yclid IS NULL AND lu.yclid IS NOT NULL)
    INTO v_attributed, v_yclid_updated
  FROM public.landing_users lu
  WHERE lu.id = p_landing_user_id;

  RETURN QUERY SELECT true, COALESCE(v_attributed, false), COALESCE(v_yclid_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_landing_acquisition_visitor(
  uuid, text, text, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_landing_acquisition_visitor(
  uuid, text, text, text, text, text, text, text, timestamptz
) TO service_role;

REVOKE ALL ON FUNCTION public.attach_landing_visitor_to_user(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_landing_visitor_to_user(uuid, uuid, uuid)
  TO service_role;

COMMENT ON FUNCTION public.attach_landing_visitor_to_user(uuid, uuid, uuid) IS
  'Idempotent visitor→landing_user link. Copies first-known UTM/yclid onto the user; never rewrites events.';

-- ---------------------------------------------------------------------------
-- Latest increment_prompt_card_view (160) + optional visitor/session
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_prompt_card_view(text);
DROP FUNCTION IF EXISTS public.increment_prompt_card_view(text, uuid, uuid);

CREATE FUNCTION public.increment_prompt_card_view(
  p_slug text,
  p_visitor_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_card_id uuid;
  v_count bigint;
BEGIN
  v_slug := nullif(trim(p_slug), '');
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE prompt_cards
  SET view_count = view_count + 1
  WHERE slug = v_slug AND is_published = true
  RETURNING id, view_count INTO v_card_id, v_count;

  IF v_card_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO prompt_card_view_events (card_id, viewed_at, visitor_id, session_id)
  VALUES (v_card_id, now(), p_visitor_id, p_session_id);

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.increment_prompt_card_view(text, uuid, uuid) IS
  'Increments view_count and appends prompt_card_view_events for a published card by slug.';

REVOKE ALL ON FUNCTION public.increment_prompt_card_view(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_prompt_card_view(text, uuid, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Latest landing_enqueue_generation (189) + optional visitor/session
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int
);
DROP FUNCTION IF EXISTS public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int, uuid, uuid
);

CREATE FUNCTION public.landing_enqueue_generation(
  p_user_id uuid,
  p_requester_auth_user_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_card_id uuid,
  p_prompt_text text,
  p_model text,
  p_aspect_ratio text,
  p_image_size text,
  p_credits_spent int,
  p_input_photo_paths text[],
  p_vibe_id uuid,
  p_client_source text,
  p_pipeline_trace_id text,
  p_create_ugc boolean,
  p_parent_generation_id uuid DEFAULT NULL,
  p_edit_instruction text DEFAULT NULL,
  p_modality text DEFAULT 'image',
  p_duration_seconds int DEFAULT NULL,
  p_visitor_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS TABLE(generation_id uuid, created boolean, credits_after int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_fingerprint text;
  v_generation_id uuid;
  v_credits int;
  v_key text := NULLIF(btrim(p_idempotency_key), '');
  v_fingerprint text := NULLIF(btrim(p_request_fingerprint), '');
  v_edit_instruction text := NULLIF(btrim(p_edit_instruction), '');
  v_modality text := COALESCE(NULLIF(btrim(p_modality), ''), 'image');
  v_paths text[] := COALESCE(p_input_photo_paths, '{}');
  v_parent_requester uuid;
  v_parent_status text;
  v_parent_bucket text;
  v_parent_path text;
  v_parent_modality text;
BEGIN
  IF p_requester_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'requester_auth_user_id_required';
  END IF;
  IF v_modality NOT IN ('image', 'video') THEN
    RAISE EXCEPTION 'invalid_modality' USING ERRCODE = 'P0001';
  END IF;
  IF p_credits_spent IS NULL OR p_credits_spent < 0 THEN
    RAISE EXCEPTION 'invalid_credits_spent';
  END IF;
  IF v_key IS NOT NULL AND v_fingerprint IS NULL THEN
    RAISE EXCEPTION 'request_fingerprint_required';
  END IF;
  IF v_edit_instruction IS NOT NULL AND p_parent_generation_id IS NULL THEN
    RAISE EXCEPTION 'edit_instruction_requires_parent' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_edit_instruction) > 1000 THEN
    RAISE EXCEPTION 'edit_instruction_too_long' USING ERRCODE = 'P0001';
  END IF;
  IF v_modality = 'video' THEN
    IF v_edit_instruction IS NOT NULL THEN
      RAISE EXCEPTION 'video_edit_forbidden' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NOT NULL AND COALESCE(array_length(v_paths, 1), 0) > 0 THEN
      RAISE EXCEPTION 'video_source_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NULL AND COALESCE(array_length(v_paths, 1), 0) <> 1 THEN
      RAISE EXCEPTION 'video_source_required' USING ERRCODE = 'P0001';
    END IF;
    IF p_duration_seconds IS DISTINCT FROM 4 THEN
      RAISE EXCEPTION 'invalid_video_duration' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_parent_generation_id IS NOT NULL THEN
    SELECT requester_auth_user_id, status, result_storage_bucket, result_storage_path, modality
      INTO v_parent_requester, v_parent_status, v_parent_bucket, v_parent_path, v_parent_modality
      FROM public.landing_generations
     WHERE id = p_parent_generation_id
     FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent_generation_not_found' USING ERRCODE = 'P0001';
    END IF;
    IF v_parent_requester IS DISTINCT FROM p_requester_auth_user_id THEN
      RAISE EXCEPTION 'parent_generation_forbidden' USING ERRCODE = 'P0001';
    END IF;
    IF v_parent_status IS DISTINCT FROM 'completed'
       OR NULLIF(btrim(v_parent_bucket), '') IS NULL
       OR NULLIF(btrim(v_parent_path), '') IS NULL THEN
      RAISE EXCEPTION 'parent_generation_not_ready' USING ERRCODE = 'P0001';
    END IF;
    IF v_modality = 'video' AND COALESCE(v_parent_modality, 'image') IS DISTINCT FROM 'image' THEN
      RAISE EXCEPTION 'parent_generation_not_image' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_requester_auth_user_id::text || ':' || v_key, 0)
    );

    SELECT id, request_fingerprint
      INTO v_existing_id, v_existing_fingerprint
      FROM public.landing_generations
     WHERE requester_auth_user_id = p_requester_auth_user_id
       AND idempotency_key = v_key;

    IF v_existing_id IS NOT NULL THEN
      IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
      END IF;
      SELECT credits INTO v_credits FROM public.landing_users WHERE id = p_user_id;
      RETURN QUERY SELECT v_existing_id, false, COALESCE(v_credits, 0);
      RETURN;
    END IF;
  END IF;

  IF p_credits_spent > 0 THEN
    UPDATE public.landing_users
       SET credits = credits - p_credits_spent,
           updated_at = now()
     WHERE id = p_user_id
       AND credits >= p_credits_spent
    RETURNING credits INTO v_credits;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT credits INTO v_credits FROM public.landing_users WHERE id = p_user_id;
  END IF;

  INSERT INTO public.landing_generations (
    user_id,
    requester_auth_user_id,
    status,
    card_id,
    prompt_text,
    model,
    aspect_ratio,
    image_size,
    credits_spent,
    input_photo_paths,
    vibe_id,
    client_source,
    idempotency_key,
    request_fingerprint,
    pipeline_trace_id,
    create_ugc,
    parent_generation_id,
    edit_instruction,
    modality,
    duration_seconds,
    visitor_id,
    session_id,
    next_attempt_at
  )
  VALUES (
    p_user_id,
    p_requester_auth_user_id,
    'pending',
    p_card_id,
    p_prompt_text,
    p_model,
    p_aspect_ratio,
    p_image_size,
    p_credits_spent,
    v_paths,
    p_vibe_id,
    p_client_source,
    v_key,
    v_fingerprint,
    NULLIF(btrim(p_pipeline_trace_id), ''),
    CASE WHEN v_modality = 'video' THEN false ELSE COALESCE(p_create_ugc, true) END,
    p_parent_generation_id,
    v_edit_instruction,
    v_modality,
    CASE WHEN v_modality = 'video' THEN COALESCE(p_duration_seconds, 4) ELSE NULL END,
    p_visitor_id,
    p_session_id,
    now()
  )
  RETURNING id INTO v_generation_id;

  RETURN QUERY SELECT v_generation_id, true, COALESCE(v_credits, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int, uuid, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int, uuid, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- Latest admin_landing_payments (195) + snapshot columns and source/campaign
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer
);
DROP FUNCTION IF EXISTS public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text
);

CREATE FUNCTION public.admin_landing_payments(
  p_status text DEFAULT 'all',
  p_test boolean DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  provider text,
  provider_payment_id text,
  created_at timestamptz,
  updated_at timestamptz,
  auth_user_id uuid,
  landing_user_id uuid,
  payer_email text,
  payer_display_name text,
  payer_provider text,
  plan_id text,
  credits integer,
  amount_rub numeric,
  status text,
  provider_status text,
  test boolean,
  paywall_variant text,
  credited_at timestamptz,
  visitor_id uuid,
  session_id uuid,
  yclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_landing_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filters AS (
    SELECT
      public.landing_sanitize_utm(p_source) AS source,
      public.landing_sanitize_utm(p_campaign) AS campaign
  ),
  payments AS (
    SELECT
      yp.id,
      'yookassa'::text AS provider,
      yp.yookassa_payment_id AS provider_payment_id,
      yp.created_at,
      yp.updated_at,
      yp.auth_user_id,
      yp.landing_user_id,
      yp.plan_id,
      yp.credits,
      yp.amount_rub,
      yp.status,
      yp.provider_status,
      yp.test,
      yp.paywall_variant,
      yp.credited_at,
      yp.visitor_id,
      yp.session_id,
      yp.yclid,
      yp.utm_source,
      yp.utm_medium,
      yp.utm_campaign,
      yp.utm_content,
      yp.utm_term,
      yp.utm_landing_path
    FROM public.landing_yookassa_payments yp
    UNION ALL
    SELECT
      rp.id,
      'robokassa'::text AS provider,
      rp.invoice_id::text AS provider_payment_id,
      rp.created_at,
      rp.updated_at,
      rp.auth_user_id,
      rp.landing_user_id,
      rp.plan_id,
      rp.credits,
      rp.amount_rub,
      rp.status,
      rp.provider_status,
      rp.test,
      rp.paywall_variant,
      rp.credited_at,
      rp.visitor_id,
      rp.session_id,
      rp.yclid,
      rp.utm_source,
      rp.utm_medium,
      rp.utm_campaign,
      rp.utm_content,
      rp.utm_term,
      rp.utm_landing_path
    FROM public.landing_robokassa_payments rp
  )
  SELECT
    p.id,
    p.provider,
    p.provider_payment_id,
    p.created_at,
    p.updated_at,
    p.auth_user_id,
    p.landing_user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS payer_email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS payer_display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS payer_provider,
    p.plan_id,
    p.credits,
    p.amount_rub,
    p.status,
    p.provider_status,
    p.test,
    p.paywall_variant,
    p.credited_at,
    p.visitor_id,
    p.session_id,
    p.yclid,
    p.utm_source,
    p.utm_medium,
    p.utm_campaign,
    p.utm_content,
    p.utm_term,
    p.utm_landing_path
  FROM payments p
  CROSS JOIN filters f
  LEFT JOIN auth.users au ON au.id = p.auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = p.landing_user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = p.landing_user_id
  WHERE (
      lower(COALESCE(p_status, 'all')) = 'all'
      OR p.status = lower(p_status)
    )
    AND (p_test IS NULL OR p.test IS NOT DISTINCT FROM p_test)
    AND (
      f.source IS NULL
      OR lower(p.utm_source) = lower(f.source)
      OR (
        lower(f.source) IN ('yandex', 'ya')
        AND lower(p.utm_source) IN ('yandex', 'ya')
      )
    )
    AND (f.campaign IS NULL OR p.utm_campaign = f.campaign)
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR p.created_at < p_cursor_created_at
      OR (p.created_at = p_cursor_created_at AND p.id < p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_landing_payments(
  text,
  boolean,
  timestamptz,
  uuid,
  integer,
  text,
  text
) TO service_role;

-- ---------------------------------------------------------------------------
-- Actor-safe analytics views (175) and top-users RPC (186)
-- user_id stays the raw FK. Unique actors prefer visitor, skip guest owner.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.analytics_requests AS
  SELECT
    g.id::text AS event_id,
    'generation'::text AS kind,
    g.created_at AS event_time,
    g.user_id::text AS user_id,
    NULL::text AS ip_hash,
    COALESCE(g.client_source, 'unknown') AS client_source,
    true AS allowed,
    NULL::text AS request_origin,
    g.visitor_id
  FROM public.landing_generations g
  UNION ALL
  SELECT
    e.id::text,
    e.endpoint,
    e.created_at,
    e.user_id::text,
    e.ip_hash,
    COALESCE(e.client_source, 'unknown'),
    e.allowed,
    e.request_origin,
    e.visitor_id
  FROM public.extension_analyze_events e
  WHERE e.allowed = true;

CREATE OR REPLACE VIEW public.analytics_user_activity AS
  SELECT
    u.id::text AS user_id,
    u.email,
    u.created_at AS user_created_at,
    count(r.event_id) AS total_requests,
    count(r.event_id) FILTER (WHERE r.kind = 'generation') AS generations,
    count(r.event_id) FILTER (WHERE r.kind = 'analyze') AS analyzes,
    min(r.event_time) AS first_seen,
    max(r.event_time) AS last_seen
  FROM public.imageprompt_users u
  LEFT JOIN public.analytics_requests r ON r.user_id = u.id::text
  WHERE NOT public.landing_is_shared_guest_owner(u.id)
  GROUP BY u.id, u.email, u.created_at;

CREATE OR REPLACE VIEW public.analytics_clients_daily AS
  SELECT
    date_trunc('day', event_time) AS day,
    client_source,
    kind,
    count(*) AS requests,
    count(DISTINCT public.landing_analytics_actor_key(user_id, ip_hash, visitor_id)) AS unique_actors
  FROM public.analytics_requests
  WHERE allowed = true
  GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW public.analytics_extension_funnel AS
  SELECT
    date_trunc('day', created_at) AS day,
    COALESCE(mode, 'unknown') AS mode,
    COALESCE(client_source, 'unknown') AS client_source,
    COALESCE(locale, 'unknown') AS locale,
    COALESCE(platform, 'unknown') AS platform,
    COALESCE(browser, 'unknown') AS browser,
    count(*) FILTER (WHERE event = 'mode_click') AS clicks,
    count(*) FILTER (WHERE event = 'request_start_ok') AS starts_ok,
    count(*) FILTER (WHERE event = 'request_start_error') AS starts_err,
    count(*) FILTER (WHERE event = 'result_shown') AS results_shown,
    count(*) FILTER (WHERE event = 'error_shown') AS errors_shown,
    count(*) FILTER (WHERE event = 'copy_prompt') AS copies,
    count(DISTINCT public.landing_analytics_actor_key(user_id::text, ip_hash, visitor_id))
      FILTER (WHERE event = 'mode_click') AS unique_users_clicked
  FROM public.extension_client_events
  GROUP BY 1, 2, 3, 4, 5, 6;

CREATE OR REPLACE VIEW public.analytics_extension_outcomes_daily AS
  SELECT
    date_trunc('day', created_at) AS day,
    endpoint,
    COALESCE(client_source, 'unknown') AS client_source,
    COALESCE(locale, 'unknown') AS locale,
    COALESCE(style, 'unknown') AS style,
    count(*) AS requests,
    count(*) FILTER (WHERE outcome = 'success') AS success,
    count(*) FILTER (WHERE truncated) AS truncated,
    count(*) FILTER (WHERE outcome = 'rate_limited') AS rate_limited,
    count(*) FILTER (WHERE outcome = 'upstream_error') AS upstream_error,
    count(*) FILTER (WHERE outcome = 'empty_response') AS empty_response,
    count(DISTINCT public.landing_analytics_actor_key(user_id::text, ip_hash, visitor_id)) AS unique_actors
  FROM public.extension_analyze_events
  GROUP BY 1, 2, 3, 4, 5;

REVOKE ALL ON public.analytics_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.analytics_user_activity FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.analytics_clients_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.analytics_extension_funnel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.analytics_extension_outcomes_daily FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.analytics_requests TO service_role;
GRANT SELECT ON public.analytics_user_activity TO service_role;
GRANT SELECT ON public.analytics_clients_daily TO service_role;
GRANT SELECT ON public.analytics_extension_funnel TO service_role;
GRANT SELECT ON public.analytics_extension_outcomes_daily TO service_role;

CREATE OR REPLACE FUNCTION public.admin_analytics_top_users(p_days integer DEFAULT 30)
RETURNS TABLE (
  email text,
  total_requests integer,
  generations integer,
  analyzes integer,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (timezone('utc', now())::date - (greatest(1, least(COALESCE(p_days, 30), 90)) - 1))
        ::timestamp AT TIME ZONE 'utc' AS since
  )
  SELECT
    u.email,
    count(*)::integer AS total_requests,
    count(*) FILTER (WHERE r.kind = 'generation')::integer AS generations,
    count(*) FILTER (WHERE r.kind IS DISTINCT FROM 'generation')::integer AS analyzes,
    max(r.event_time) AS last_seen
  FROM public.analytics_requests r
  JOIN public.imageprompt_users u ON u.id::text = r.user_id
  CROSS JOIN bounds b
  WHERE r.allowed
    AND r.user_id IS NOT NULL
    AND r.event_time >= b.since
    AND NOT public.landing_is_shared_guest_owner(u.id)
  GROUP BY u.id, u.email
  ORDER BY count(*) DESC, max(r.event_time) DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_top_users(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_top_users(integer) TO service_role;
