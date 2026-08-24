-- Paid-over-unpaid attribution: SEO/direct/referral may fill empty,
-- paid may replace unpaid, paid never yields to unpaid.

CREATE OR REPLACE FUNCTION public.landing_is_paid_attribution(
  p_utm_source text,
  p_utm_medium text,
  p_yclid text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_medium text;
  v_source text;
BEGIN
  IF public.landing_sanitize_yclid(p_yclid) IS NOT NULL THEN
    RETURN true;
  END IF;
  v_medium := lower(COALESCE(public.landing_sanitize_utm(p_utm_medium), ''));
  IF v_medium IN ('cpc', 'cpm', 'ppc') THEN
    RETURN true;
  END IF;
  v_source := lower(COALESCE(public.landing_sanitize_utm(p_utm_source), ''));
  RETURN v_source IN ('yandex', 'ya') AND v_medium = 'cpc';
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_attribution_tier(
  p_utm_source text,
  p_utm_medium text,
  p_yclid text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF public.landing_is_paid_attribution(p_utm_source, p_utm_medium, p_yclid) THEN
    RETURN 2;
  END IF;
  IF public.landing_sanitize_utm(p_utm_source) IS NOT NULL THEN
    RETURN 1;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.landing_should_replace_attribution(
  p_old_source text,
  p_old_medium text,
  p_old_yclid text,
  p_new_source text,
  p_new_medium text,
  p_new_yclid text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF public.landing_attribution_tier(p_new_source, p_new_medium, p_new_yclid)
     > public.landing_attribution_tier(p_old_source, p_old_medium, p_old_yclid)
  THEN
    RETURN true;
  END IF;
  RETURN public.landing_sanitize_utm(p_old_source) IS NULL
     AND public.landing_sanitize_utm(p_new_source) IS NOT NULL
     AND public.landing_is_paid_attribution(p_new_source, p_new_medium, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.landing_is_paid_attribution(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_attribution_tier(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_should_replace_attribution(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_is_paid_attribution(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_attribution_tier(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_should_replace_attribution(text, text, text, text, text, text)
  TO service_role;

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

  IF OLD.yclid IS NOT NULL THEN
    NEW.yclid := OLD.yclid;
  ELSIF NEW.yclid IS NOT NULL AND NEW.attribution_captured_at IS NULL THEN
    NEW.attribution_captured_at := now();
  END IF;

  IF public.landing_should_replace_attribution(
    OLD.utm_source, OLD.utm_medium, OLD.yclid,
    NEW.utm_source, NEW.utm_medium, NEW.yclid
  ) THEN
    NEW.attribution_captured_at := COALESCE(NEW.attribution_captured_at, now());
  ELSE
    NEW.utm_source := OLD.utm_source;
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
  END IF;

  RETURN NEW;
END;
$$;

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

  IF OLD.yclid IS NOT NULL THEN
    NEW.yclid := OLD.yclid;
  ELSIF NEW.yclid IS NOT NULL AND NEW.attribution_captured_at IS NULL THEN
    NEW.attribution_captured_at := now();
  END IF;

  IF public.landing_should_replace_attribution(
    OLD.utm_source, OLD.utm_medium, OLD.yclid,
    NEW.utm_source, NEW.utm_medium, NEW.yclid
  ) THEN
    NEW.attribution_captured_at := COALESCE(NEW.attribution_captured_at, now());
  ELSE
    NEW.utm_source := OLD.utm_source;
    NEW.utm_medium := OLD.utm_medium;
    NEW.utm_campaign := OLD.utm_campaign;
    NEW.utm_content := OLD.utm_content;
    NEW.utm_term := OLD.utm_term;
    NEW.utm_landing_path := OLD.utm_landing_path;
    NEW.attribution_captured_at := OLD.attribution_captured_at;
  END IF;

  RETURN NEW;
END;
$$;

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

  IF NOT public.landing_should_replace_attribution(
    OLD.utm_source, OLD.utm_medium, OLD.yclid,
    NEW.utm_source, NEW.utm_medium, NEW.yclid
  ) THEN
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
         utm_source = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN v.utm_source
           ELSE lu.utm_source
         END,
         utm_medium = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN v.utm_medium
           ELSE lu.utm_medium
         END,
         utm_campaign = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN v.utm_campaign
           ELSE lu.utm_campaign
         END,
         utm_content = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN v.utm_content
           ELSE lu.utm_content
         END,
         utm_term = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN v.utm_term
           ELSE lu.utm_term
         END,
         utm_landing_path = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN v.utm_landing_path
           ELSE lu.utm_landing_path
         END,
         yclid = COALESCE(lu.yclid, v.yclid),
         attribution_captured_at = CASE
           WHEN public.landing_should_replace_attribution(
             lu.utm_source, lu.utm_medium, lu.yclid,
             v.utm_source, v.utm_medium, v.yclid
           ) THEN COALESCE(v.attribution_captured_at, now())
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
       OR public.landing_should_replace_attribution(
         lu.utm_source, lu.utm_medium, lu.yclid,
         v.utm_source, v.utm_medium, v.yclid
       )
     );

  SELECT
    (v_utm_source IS DISTINCT FROM lu.utm_source),
    (v_yclid IS NULL AND lu.yclid IS NOT NULL)
    INTO v_attributed, v_yclid_updated
  FROM public.landing_users lu
  WHERE lu.id = p_landing_user_id;

  RETURN QUERY SELECT true, COALESCE(v_attributed, false), COALESCE(v_yclid_updated, false);
END;
$$;

COMMENT ON FUNCTION public.attach_landing_visitor_to_user(uuid, uuid, uuid) IS
  'Idempotent visitor→landing_user link. Copies first unpaid or upgrades unpaid→paid; never rewrites events.';
