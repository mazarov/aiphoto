-- Fix PL/pgSQL ambiguity between the RETURNS TABLE visitor_id variable and
-- ON CONFLICT (visitor_id) in migration 196.

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
  ON CONFLICT ON CONSTRAINT landing_acquisition_visitors_pkey DO UPDATE
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

REVOKE ALL ON FUNCTION public.upsert_landing_acquisition_visitor(
  uuid, text, text, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_landing_acquisition_visitor(
  uuid, text, text, text, text, text, text, text, timestamptz
) TO service_role;

COMMENT ON FUNCTION public.upsert_landing_acquisition_visitor(
  uuid, text, text, text, text, text, text, text, timestamptz
) IS 'Atomic first-known visitor attribution upsert; conflict target uses the named PK to avoid PL/pgSQL output-variable ambiguity.';
