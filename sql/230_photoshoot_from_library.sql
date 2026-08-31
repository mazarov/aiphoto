-- Photoshoot from one owned library photo (no parent).
-- Aligns landing_enqueue_generation + CHECKs with API:
-- parent image XOR exactly one upload. Do not edit 226.

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_edit_instruction_valid,
  ADD CONSTRAINT landing_generations_edit_instruction_valid
    CHECK (
      edit_instruction IS NULL
      OR (
        char_length(btrim(edit_instruction)) BETWEEN 1 AND 1000
        AND (
          parent_generation_id IS NOT NULL
          OR edit_kind = 'photoshoot'
        )
      )
    );

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_photoshoot_complete,
  ADD CONSTRAINT landing_generations_photoshoot_complete
    CHECK (
      edit_kind IS DISTINCT FROM 'photoshoot'
      OR (
        edit_instruction IS NOT NULL
        AND (
          (
            parent_generation_id IS NOT NULL
            AND COALESCE(cardinality(input_photo_paths), 0) = 0
          )
          OR (
            parent_generation_id IS NULL
            AND cardinality(input_photo_paths) = 1
          )
        )
      )
    );

CREATE OR REPLACE FUNCTION public.landing_enqueue_generation(
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
  p_session_id uuid DEFAULT NULL,
  p_edit_kind text DEFAULT NULL,
  p_scene_root_id uuid DEFAULT NULL,
  p_camera_pose jsonb DEFAULT NULL
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
  v_edit_kind text := NULLIF(btrim(p_edit_kind), '');
  v_modality text := COALESCE(NULLIF(btrim(p_modality), ''), 'image');
  v_paths text[] := COALESCE(p_input_photo_paths, '{}');
  v_vibe_id uuid := p_vibe_id;
  v_parent_requester uuid;
  v_parent_status text;
  v_parent_bucket text;
  v_parent_path text;
  v_parent_modality text;
  v_parent_edit_kind text;
  v_parent_tiles text[];
  v_path_count int := COALESCE(cardinality(v_paths), 0);
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
  IF v_edit_kind IS NOT NULL AND v_edit_kind NOT IN ('local_edit', 'camera_orbit', 'photoshoot') THEN
    RAISE EXCEPTION 'invalid_edit_kind' USING ERRCODE = 'P0001';
  END IF;
  IF v_edit_instruction IS NOT NULL
     AND p_parent_generation_id IS NULL
     AND v_edit_kind IS DISTINCT FROM 'photoshoot' THEN
    RAISE EXCEPTION 'edit_instruction_requires_parent' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_edit_instruction) > 1000 THEN
    RAISE EXCEPTION 'edit_instruction_too_long' USING ERRCODE = 'P0001';
  END IF;
  IF v_edit_kind = 'camera_orbit' THEN
    IF v_modality IS DISTINCT FROM 'image' THEN
      RAISE EXCEPTION 'camera_orbit_image_only' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NULL
       OR p_scene_root_id IS NULL
       OR p_camera_pose IS NULL
       OR v_edit_instruction IS NULL THEN
      RAISE EXCEPTION 'camera_orbit_incomplete' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS DISTINCT FROM p_scene_root_id THEN
      RAISE EXCEPTION 'camera_orbit_parent_must_be_root' USING ERRCODE = 'P0001';
    END IF;
    v_vibe_id := NULL;
    v_paths := '{}';
    v_path_count := 0;
  END IF;
  IF v_edit_kind = 'photoshoot' THEN
    IF v_modality IS DISTINCT FROM 'image' THEN
      RAISE EXCEPTION 'photoshoot_image_only' USING ERRCODE = 'P0001';
    END IF;
    IF v_edit_instruction IS NULL THEN
      RAISE EXCEPTION 'photoshoot_incomplete' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NOT NULL AND v_path_count > 0 THEN
      RAISE EXCEPTION 'photoshoot_source_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NULL AND v_path_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'photoshoot_incomplete' USING ERRCODE = 'P0001';
    END IF;
    v_vibe_id := NULL;
    IF p_parent_generation_id IS NOT NULL THEN
      v_paths := '{}';
      v_path_count := 0;
    END IF;
  END IF;
  IF v_modality = 'video' THEN
    IF v_edit_instruction IS NOT NULL THEN
      RAISE EXCEPTION 'video_edit_forbidden' USING ERRCODE = 'P0001';
    END IF;
    IF v_edit_kind IS NOT NULL THEN
      RAISE EXCEPTION 'video_edit_forbidden' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NOT NULL AND v_path_count > 0 THEN
      RAISE EXCEPTION 'video_source_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF p_parent_generation_id IS NULL AND v_path_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'video_source_required' USING ERRCODE = 'P0001';
    END IF;
    IF p_duration_seconds IS NULL OR p_duration_seconds NOT IN (4, 6, 8, 10) THEN
      RAISE EXCEPTION 'invalid_video_duration' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_parent_generation_id IS NOT NULL THEN
    SELECT requester_auth_user_id, status, result_storage_bucket, result_storage_path, modality, edit_kind, photoshoot_tile_paths
      INTO v_parent_requester, v_parent_status, v_parent_bucket, v_parent_path, v_parent_modality, v_parent_edit_kind, v_parent_tiles
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
    IF (v_modality = 'video' OR v_edit_kind IN ('camera_orbit', 'photoshoot'))
       AND COALESCE(v_parent_modality, 'image') IS DISTINCT FROM 'image' THEN
      RAISE EXCEPTION 'parent_generation_not_image' USING ERRCODE = 'P0001';
    END IF;
    IF v_edit_kind = 'photoshoot' AND v_parent_edit_kind = 'photoshoot'
       AND (v_parent_tiles IS NULL OR cardinality(v_parent_tiles) IS DISTINCT FROM 4) THEN
      RAISE EXCEPTION 'photoshoot_from_sheet' USING ERRCODE = 'P0001';
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
    edit_kind,
    scene_root_id,
    camera_pose,
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
    v_vibe_id,
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
    v_edit_kind,
    CASE WHEN v_edit_kind = 'camera_orbit' THEN p_scene_root_id ELSE NULL END,
    CASE WHEN v_edit_kind = 'camera_orbit' THEN p_camera_pose ELSE NULL END,
    now()
  )
  RETURNING id INTO v_generation_id;

  RETURN QUERY SELECT v_generation_id, true, COALESCE(v_credits, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int, uuid, uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int, uuid, uuid, text, uuid, jsonb
) TO service_role;
