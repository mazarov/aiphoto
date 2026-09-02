-- Indexed first-page history for /generations.
-- PostgREST `.or(requester, legacy billing)` cannot use
-- idx_landing_gen_requester_history; this RPC scans each side with its index
-- then merges. Slim columns: no photoshoot_plan / pipeline_spec / inputs.

CREATE INDEX IF NOT EXISTS idx_landing_gen_legacy_billing_history
  ON public.landing_generations (user_id, created_at DESC)
  WHERE requester_auth_user_id IS NULL AND credits_spent > 0;

CREATE OR REPLACE FUNCTION public.landing_list_my_generations(
  p_requester uuid,
  p_billing uuid,
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  id uuid,
  status text,
  prompt_text text,
  model text,
  aspect_ratio text,
  credits_spent integer,
  created_at timestamptz,
  generation_completed_at timestamptz,
  error_message text,
  result_storage_bucket text,
  result_storage_path text,
  ugc_card_id uuid,
  modality text,
  result_mime_type text,
  duration_seconds integer,
  edit_kind text,
  photoshoot_tile_paths text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_offset int;
  v_window int;
BEGIN
  IF p_requester IS NULL THEN
    RETURN;
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 51);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_window := v_limit + v_offset;

  RETURN QUERY
  SELECT
    g.id,
    g.status,
    g.prompt_text,
    g.model,
    g.aspect_ratio,
    g.credits_spent,
    g.created_at,
    g.generation_completed_at,
    g.error_message,
    g.result_storage_bucket,
    g.result_storage_path,
    g.ugc_card_id,
    g.modality,
    g.result_mime_type,
    g.duration_seconds,
    g.edit_kind,
    g.photoshoot_tile_paths
  FROM (
    (
      SELECT
        r.id,
        r.status,
        r.prompt_text,
        r.model,
        r.aspect_ratio,
        r.credits_spent,
        r.created_at,
        r.generation_completed_at,
        r.error_message,
        r.result_storage_bucket,
        r.result_storage_path,
        r.ugc_card_id,
        r.modality,
        r.result_mime_type,
        r.duration_seconds,
        r.edit_kind,
        r.photoshoot_tile_paths
      FROM public.landing_generations r
      WHERE r.requester_auth_user_id = p_requester
      ORDER BY r.created_at DESC
      LIMIT v_window
    )
    UNION ALL
    (
      SELECT
        b.id,
        b.status,
        b.prompt_text,
        b.model,
        b.aspect_ratio,
        b.credits_spent,
        b.created_at,
        b.generation_completed_at,
        b.error_message,
        b.result_storage_bucket,
        b.result_storage_path,
        b.ugc_card_id,
        b.modality,
        b.result_mime_type,
        b.duration_seconds,
        b.edit_kind,
        b.photoshoot_tile_paths
      FROM public.landing_generations b
      WHERE p_billing IS NOT NULL
        AND b.requester_auth_user_id IS NULL
        AND b.credits_spent > 0
        AND b.user_id = p_billing
      ORDER BY b.created_at DESC
      LIMIT v_window
    )
  ) g
  ORDER BY g.created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_list_my_generations(uuid, uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_list_my_generations(uuid, uuid, int, int) TO service_role;

COMMENT ON FUNCTION public.landing_list_my_generations(uuid, uuid, int, int) IS
  'Owner history for /generations: requester index UNION legacy billing rows. Service-role only.';
