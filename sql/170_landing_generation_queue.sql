-- Durable queue for landing web generations.
-- landing_generations remains both the job record and the result record.

ALTER TABLE landing_generations
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS credits_refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS pipeline_trace_id text,
  ADD COLUMN IF NOT EXISTS requester_auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS request_fingerprint text,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS create_ugc boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_gen_user_idempotency
  ON landing_generations(requester_auth_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_landing_gen_requester_history
  ON landing_generations(requester_auth_user_id, created_at DESC)
  WHERE requester_auth_user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landing_generations_credits_nonnegative'
  ) THEN
    ALTER TABLE landing_generations
      ADD CONSTRAINT landing_generations_credits_nonnegative CHECK (credits_spent >= 0);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Users read own generations" ON landing_generations;
CREATE POLICY "Requesters read own generations"
  ON landing_generations FOR SELECT
  USING (
    auth.uid() = requester_auth_user_id
    OR (
      requester_auth_user_id IS NULL
      AND credits_spent > 0
      AND auth.uid() = user_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_landing_gen_claim
  ON landing_generations(next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_landing_gen_stale
  ON landing_generations(lease_expires_at)
  WHERE status = 'processing';

-- Deduct credits and enqueue in one transaction. Retrying the same user/key
-- returns the original generation without charging again.
CREATE OR REPLACE FUNCTION landing_enqueue_generation(
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
  p_create_ugc boolean
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

  IF v_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_requester_auth_user_id::text || ':' || v_key, 0)
    );

    SELECT id, request_fingerprint
      INTO v_existing_id, v_existing_fingerprint
      FROM landing_generations
     WHERE requester_auth_user_id = p_requester_auth_user_id
       AND idempotency_key = v_key;

    IF v_existing_id IS NOT NULL THEN
      IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
      END IF;
      SELECT credits INTO v_credits FROM landing_users WHERE id = p_user_id;
      RETURN QUERY SELECT v_existing_id, false, COALESCE(v_credits, 0);
      RETURN;
    END IF;
  END IF;

  IF p_credits_spent > 0 THEN
    UPDATE landing_users
       SET credits = credits - p_credits_spent,
           updated_at = now()
     WHERE id = p_user_id
       AND credits >= p_credits_spent
    RETURNING credits INTO v_credits;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT credits INTO v_credits FROM landing_users WHERE id = p_user_id;
  END IF;

  INSERT INTO landing_generations (
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
    now()
  )
  RETURNING id INTO v_generation_id;

  RETURN QUERY SELECT v_generation_id, true, COALESCE(v_credits, 0);
END;
$$;

-- Claims a batch while serializing global-capacity calculations. SKIP LOCKED
-- keeps this safe when several worker replicas poll concurrently.
CREATE OR REPLACE FUNCTION landing_claim_generations(
  p_worker_id text,
  p_limit int DEFAULT 1,
  p_lease_seconds int DEFAULT 180,
  p_global_limit int DEFAULT 50,
  p_max_per_user int DEFAULT 3
)
RETURNS SETOF landing_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available int;
BEGIN
  IF NULLIF(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'worker_id_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('landing_generation_claim'));

  SELECT GREATEST(
    0,
    LEAST(
      GREATEST(p_limit, 0),
      GREATEST(p_global_limit, 0) - count(*)::int
    )
  )
  INTO v_available
  FROM landing_generations
  WHERE status = 'processing';

  IF v_available = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH processing_by_user AS (
    SELECT COALESCE(requester_auth_user_id, user_id) AS requester_key,
           count(*)::int AS active_count
      FROM landing_generations
     WHERE status = 'processing'
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

CREATE OR REPLACE FUNCTION landing_heartbeat_generation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_lease_seconds int DEFAULT 180
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE landing_generations
     SET lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 30)),
         last_heartbeat_at = now(),
         updated_at = now()
   WHERE id = p_generation_id
     AND status = 'processing'
     AND worker_id = p_worker_id
     AND lease_token = p_lease_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION landing_retry_generation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_type text,
  p_error_message text,
  p_delay_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE landing_generations
     SET status = 'pending',
         worker_id = NULL,
         lease_token = NULL,
         lease_expires_at = NULL,
         last_heartbeat_at = NULL,
         next_attempt_at = now() + make_interval(secs => GREATEST(p_delay_seconds, 1)),
         error_type = left(p_error_type, 200),
         error_message = left(p_error_message, 2000),
         updated_at = now()
   WHERE id = p_generation_id
     AND status = 'processing'
     AND worker_id = p_worker_id
     AND lease_token = p_lease_token
     AND attempts < max_attempts;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION landing_complete_generation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_result_bucket text,
  p_result_path text
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

-- Terminal failure and credit compensation happen under one row lock and one
-- transaction. credits_refunded makes this safe to call repeatedly.
CREATE OR REPLACE FUNCTION landing_fail_generation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_type text,
  p_error_message text,
  p_refund boolean DEFAULT true
)
RETURNS TABLE(refunded boolean, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job landing_generations%ROWTYPE;
  v_refunded boolean := false;
BEGIN
  SELECT *
    INTO v_job
    FROM landing_generations
   WHERE id = p_generation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_job.status IN ('completed', 'failed') THEN
    RETURN QUERY SELECT v_job.credits_refunded, v_job.status;
    RETURN;
  END IF;

  IF v_job.status <> 'processing'
     OR v_job.worker_id IS DISTINCT FROM p_worker_id
     OR v_job.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN QUERY SELECT v_job.credits_refunded, v_job.status;
    RETURN;
  END IF;

  IF p_refund
     AND v_job.credits_spent > 0
     AND NOT v_job.credits_refunded THEN
    UPDATE landing_users
       SET credits = credits + v_job.credits_spent,
           updated_at = now()
     WHERE id = v_job.user_id;
    v_refunded := FOUND;
  ELSE
    v_refunded := v_job.credits_refunded;
  END IF;

  UPDATE landing_generations
     SET status = 'failed',
         error_type = left(p_error_type, 200),
         error_message = left(p_error_message, 2000),
         credits_refunded = credits_refunded OR v_refunded,
         refunded_at = CASE
           WHEN credits_refunded OR v_refunded THEN COALESCE(refunded_at, now())
           ELSE refunded_at
         END,
         generation_completed_at = now(),
         worker_id = NULL,
         lease_token = NULL,
         lease_expires_at = NULL,
         last_heartbeat_at = NULL,
         updated_at = now()
   WHERE id = p_generation_id;

  RETURN QUERY SELECT (v_job.credits_refunded OR v_refunded), 'failed'::text;
END;
$$;

CREATE OR REPLACE FUNCTION landing_reap_stale_generations(
  p_limit int DEFAULT 100
)
RETURNS TABLE(generation_id uuid, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job landing_generations%ROWTYPE;
  v_refunded boolean;
BEGIN
  FOR v_job IN
    SELECT *
      FROM landing_generations
     WHERE status = 'processing'
       AND lease_expires_at < now()
     ORDER BY lease_expires_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(p_limit, 1)
  LOOP
    IF v_job.attempts < v_job.max_attempts THEN
      UPDATE landing_generations
         SET status = 'pending',
             worker_id = NULL,
             lease_token = NULL,
             lease_expires_at = NULL,
             last_heartbeat_at = NULL,
             next_attempt_at = now(),
             error_type = 'lease_expired',
             error_message = 'Worker lease expired; generation requeued',
             updated_at = now()
       WHERE id = v_job.id;
      generation_id := v_job.id;
      action := 'requeued';
      RETURN NEXT;
    ELSE
      v_refunded := v_job.credits_refunded;
      IF v_job.credits_spent > 0 AND NOT v_job.credits_refunded THEN
        UPDATE landing_users
           SET credits = credits + v_job.credits_spent,
               updated_at = now()
         WHERE id = v_job.user_id;
        v_refunded := FOUND;
      END IF;

      UPDATE landing_generations
         SET status = 'failed',
             error_type = 'lease_expired',
             error_message = 'Worker lease expired after maximum attempts',
             credits_refunded = credits_refunded OR v_refunded,
             refunded_at = CASE
               WHEN credits_refunded OR v_refunded THEN COALESCE(refunded_at, now())
               ELSE refunded_at
             END,
             generation_completed_at = now(),
             worker_id = NULL,
             lease_token = NULL,
             lease_expires_at = NULL,
             last_heartbeat_at = NULL,
             updated_at = now()
       WHERE id = v_job.id;
      generation_id := v_job.id;
      action := 'failed_refunded';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION landing_claim_generations(text, int, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION landing_heartbeat_generation(uuid, text, uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION landing_retry_generation(uuid, text, uuid, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION landing_complete_generation(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION landing_fail_generation(uuid, text, uuid, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION landing_reap_stale_generations(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION landing_enqueue_generation(
  uuid, uuid, text, text, uuid, text, text, text, text, int, text[], uuid, text, text, boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION landing_claim_generations(text, int, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION landing_heartbeat_generation(uuid, text, uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION landing_retry_generation(uuid, text, uuid, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION landing_complete_generation(uuid, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION landing_fail_generation(uuid, text, uuid, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION landing_reap_stale_generations(int) TO service_role;
