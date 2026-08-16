-- Image-to-video jobs on the same durable landing_generations queue.
-- Sibling of image generation: separate modality, credits, and claim cap.

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS provider_operation_id text,
  ADD COLUMN IF NOT EXISTS result_mime_type text;

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_modality_check;
ALTER TABLE public.landing_generations
  ADD CONSTRAINT landing_generations_modality_check
  CHECK (modality IN ('image', 'video'));

CREATE INDEX IF NOT EXISTS landing_generations_pending_modality_idx
  ON public.landing_generations (modality, next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS landing_generations_processing_modality_idx
  ON public.landing_generations (modality)
  WHERE status = 'processing';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  (
    'video_models',
    '[{"id":"gemini-omni-flash-preview","label":"Veo Omni Flash","cost":30,"enabled":true}]',
    now()
  ),
  ('video_animate_enabled', 'false', now()),
  ('default_video_model', 'gemini-omni-flash-preview', now())
ON CONFLICT (key) DO NOTHING;

DROP FUNCTION IF EXISTS public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text
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
  p_duration_seconds int DEFAULT NULL
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
    now()
  )
  RETURNING id INTO v_generation_id;

  RETURN QUERY SELECT v_generation_id, true, COALESCE(v_credits, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean, uuid, text, text, int
) TO service_role;

DROP FUNCTION IF EXISTS public.landing_claim_generations(text, int, int, int, int);

CREATE FUNCTION public.landing_claim_generations(
  p_worker_id text,
  p_limit int DEFAULT 1,
  p_lease_seconds int DEFAULT 180,
  p_global_limit int DEFAULT 50,
  p_max_per_user int DEFAULT 3,
  p_modality text DEFAULT 'image'
)
RETURNS SETOF landing_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available int;
  v_modality text := COALESCE(NULLIF(btrim(p_modality), ''), 'image');
BEGIN
  IF NULLIF(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'worker_id_required';
  END IF;
  IF v_modality NOT IN ('image', 'video') THEN
    RAISE EXCEPTION 'invalid_modality';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('landing_generation_claim_' || v_modality));

  SELECT GREATEST(
    0,
    LEAST(
      GREATEST(p_limit, 0),
      GREATEST(p_global_limit, 0) - count(*)::int
    )
  )
  INTO v_available
  FROM landing_generations
  WHERE status = 'processing'
    AND modality = v_modality;

  IF v_available = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH processing_by_user AS (
    SELECT COALESCE(requester_auth_user_id, user_id) AS requester_key,
           count(*)::int AS active_count
      FROM landing_generations
     WHERE status = 'processing'
       AND modality = v_modality
     GROUP BY COALESCE(requester_auth_user_id, user_id)
  ),
  eligible AS (
    SELECT g.id,
           row_number() OVER (
             PARTITION BY COALESCE(g.requester_auth_user_id, g.user_id)
             ORDER BY g.created_at
           ) AS user_rank,
           COALESCE(p.active_count, 0) AS active_count
      FROM landing_generations g
      LEFT JOIN processing_by_user p
        ON p.requester_key = COALESCE(g.requester_auth_user_id, g.user_id)
     WHERE g.status = 'pending'
       AND g.modality = v_modality
       AND g.requester_auth_user_id IS NOT NULL
       AND g.next_attempt_at <= now()
       AND g.attempts < g.max_attempts
  ),
  selected AS (
    SELECT g.id
      FROM landing_generations g
      JOIN eligible e ON e.id = g.id
     WHERE e.active_count + e.user_rank <= GREATEST(p_max_per_user, 1)
     ORDER BY g.next_attempt_at, g.created_at
     FOR UPDATE OF g SKIP LOCKED
     LIMIT v_available
  )
  UPDATE landing_generations g
     SET status = 'processing',
         worker_id = p_worker_id,
         lease_token = gen_random_uuid(),
         attempts = g.attempts + 1,
         generation_started_at = COALESCE(g.generation_started_at, now()),
         lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 30)),
         last_heartbeat_at = now(),
         error_type = NULL,
         error_message = NULL,
         updated_at = now()
    FROM selected s
   WHERE g.id = s.id
  RETURNING g.*;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_claim_generations(text, int, int, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_claim_generations(text, int, int, int, int, text) TO service_role;

CREATE OR REPLACE FUNCTION public.landing_save_provider_operation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_provider_operation_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(p_provider_operation_id), '') IS NULL THEN
    RETURN false;
  END IF;
  UPDATE landing_generations
     SET provider_operation_id = left(btrim(p_provider_operation_id), 500),
         updated_at = now()
   WHERE id = p_generation_id
     AND status = 'processing'
     AND worker_id = p_worker_id
     AND lease_token = p_lease_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_save_provider_operation(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_save_provider_operation(uuid, text, uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.landing_complete_generation(uuid, text, uuid, text, text);

CREATE FUNCTION public.landing_complete_generation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_result_bucket text,
  p_result_path text,
  p_result_mime_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE landing_generations
     SET status = 'completed',
         result_storage_bucket = p_result_bucket,
         result_storage_path = p_result_path,
         result_mime_type = NULLIF(btrim(p_result_mime_type), ''),
         generation_completed_at = now(),
         worker_id = NULL,
         lease_token = NULL,
         lease_expires_at = NULL,
         last_heartbeat_at = NULL,
         error_type = NULL,
         error_message = NULL,
         updated_at = now()
   WHERE id = p_generation_id
     AND status = 'processing'
     AND worker_id = p_worker_id
     AND lease_token = p_lease_token;

  IF FOUND THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM landing_generations
     WHERE id = p_generation_id
       AND status = 'completed'
       AND result_storage_bucket = p_result_bucket
       AND result_storage_path = p_result_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.landing_complete_generation(uuid, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_complete_generation(uuid, text, uuid, text, text, text) TO service_role;
