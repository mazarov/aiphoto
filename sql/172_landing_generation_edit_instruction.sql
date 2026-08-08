-- Local image editing: child generations keep a full prompt snapshot for
-- history/UGC, while the worker receives a separate concise edit instruction.

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS edit_instruction text;

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_edit_instruction_valid,
  ADD CONSTRAINT landing_generations_edit_instruction_valid
    CHECK (
      edit_instruction IS NULL
      OR (
        parent_generation_id IS NOT NULL
        AND char_length(btrim(edit_instruction)) BETWEEN 1 AND 1000
      )
    );

DROP FUNCTION IF EXISTS public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid
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
  p_edit_instruction text DEFAULT NULL
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
  v_parent_requester uuid;
  v_parent_status text;
  v_parent_bucket text;
  v_parent_path text;
BEGIN
  IF p_requester_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'requester_auth_user_id_required';
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

  IF p_parent_generation_id IS NOT NULL THEN
    SELECT requester_auth_user_id, status, result_storage_bucket, result_storage_path
      INTO v_parent_requester, v_parent_status, v_parent_bucket, v_parent_path
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
  ELSIF COALESCE(array_length(p_input_photo_paths, 1), 0) < 1 THEN
    RAISE EXCEPTION 'input_photos_required' USING ERRCODE = 'P0001';
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
    COALESCE(p_input_photo_paths, '{}'),
    p_vibe_id,
    p_client_source,
    v_key,
    v_fingerprint,
    NULLIF(btrim(p_pipeline_trace_id), ''),
    COALESCE(p_create_ugc, true),
    p_parent_generation_id,
    v_edit_instruction,
    now()
  )
  RETURNING id INTO v_generation_id;

  RETURN QUERY SELECT v_generation_id, true, COALESCE(v_credits, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text
) TO service_role;
