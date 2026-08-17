-- ============================================================
-- Migration 192: Gemini Embedding 2 visual search
--
-- Stores one 768-d image embedding per media + generation,
-- job/outbox state for async backfill, IP/global Gemini budget,
-- and ANN RPC over the active generation only.
-- Text search (sql/190) stays the rollback path.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.prompt_card_visual_search_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_generation int NOT NULL DEFAULT 1 CHECK (active_generation >= 1),
  model text NOT NULL DEFAULT 'gemini-embedding-2',
  dimensions int NOT NULL DEFAULT 768 CHECK (dimensions = 768),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.prompt_card_visual_search_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.prompt_card_visual_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.prompt_card_media(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.prompt_cards(id) ON DELETE CASCADE,
  model text NOT NULL,
  generation int NOT NULL CHECK (generation >= 1),
  embedding vector(768) NOT NULL,
  source_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, generation)
);

CREATE TABLE IF NOT EXISTS public.prompt_card_visual_embedding_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.prompt_card_media(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.prompt_cards(id) ON DELETE CASCADE,
  generation int NOT NULL CHECK (generation >= 1),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'retry', 'ready', 'dead')),
  attempt_count int NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts int NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  source_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, generation)
);

CREATE TABLE IF NOT EXISTS public.visual_search_rate_limit (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0)
);

CREATE INDEX IF NOT EXISTS prompt_card_visual_embeddings_card_gen_idx
  ON public.prompt_card_visual_embeddings (card_id, generation);

CREATE INDEX IF NOT EXISTS prompt_card_visual_embeddings_hnsw_gen1
  ON public.prompt_card_visual_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE generation = 1;

CREATE INDEX IF NOT EXISTS prompt_card_visual_embedding_jobs_due_idx
  ON public.prompt_card_visual_embedding_jobs (next_retry_at, created_at)
  WHERE status IN ('pending', 'retry', 'processing');

CREATE INDEX IF NOT EXISTS prompt_card_visual_embedding_jobs_status_gen_idx
  ON public.prompt_card_visual_embedding_jobs (generation, status);

CREATE INDEX IF NOT EXISTS visual_search_rate_limit_window_idx
  ON public.visual_search_rate_limit (window_start);

ALTER TABLE public.prompt_card_visual_search_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_card_visual_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_card_visual_embedding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_search_rate_limit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.prompt_card_visual_search_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.prompt_card_visual_embeddings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.prompt_card_visual_embedding_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visual_search_rate_limit FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.prompt_card_visual_search_config TO service_role;
GRANT ALL ON TABLE public.prompt_card_visual_embeddings TO service_role;
GRANT ALL ON TABLE public.prompt_card_visual_embedding_jobs TO service_role;
GRANT ALL ON TABLE public.visual_search_rate_limit TO service_role;

CREATE OR REPLACE FUNCTION public.visual_embedding_source_fingerprint(
  p_bucket text,
  p_path text,
  p_generation int,
  p_model text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(
    sha256(
      convert_to(
        coalesce(p_bucket, '') || E'\n' ||
        coalesce(p_path, '') || E'\n' ||
        coalesce(p_generation, 0)::text || E'\n' ||
        coalesce(p_model, ''),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.enqueue_canonical_visual_embedding_job(
  p_card_id uuid,
  p_generation int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gen int;
  v_model text;
  v_media public.prompt_card_media%ROWTYPE;
  v_fingerprint text;
  v_job_id uuid;
BEGIN
  SELECT
    coalesce(p_generation, active_generation),
    model
  INTO v_gen, v_model
  FROM public.prompt_card_visual_search_config
  WHERE id = 1;

  IF v_gen IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.prompt_cards c
    WHERE c.id = p_card_id
      AND c.is_published = true
  ) THEN
    RETURN NULL;
  END IF;

  SELECT m.*
  INTO v_media
  FROM public.prompt_card_media m
  WHERE m.card_id = p_card_id
    AND m.media_type = 'photo'
  ORDER BY m.is_primary DESC, m.media_index ASC
  LIMIT 1;

  IF v_media.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_fingerprint := public.visual_embedding_source_fingerprint(
    v_media.storage_bucket,
    v_media.storage_path,
    v_gen,
    v_model
  );

  IF EXISTS (
    SELECT 1
    FROM public.prompt_card_visual_embeddings e
    WHERE e.media_id = v_media.id
      AND e.generation = v_gen
      AND e.source_fingerprint = v_fingerprint
  ) THEN
    INSERT INTO public.prompt_card_visual_embedding_jobs (
      media_id, card_id, generation, status, source_fingerprint, next_retry_at
    ) VALUES (
      v_media.id, p_card_id, v_gen, 'ready', v_fingerprint, now()
    )
    ON CONFLICT (media_id, generation) DO UPDATE
      SET status = 'ready',
          source_fingerprint = EXCLUDED.source_fingerprint,
          last_error_code = NULL,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = now()
    RETURNING id INTO v_job_id;
    RETURN v_job_id;
  END IF;

  INSERT INTO public.prompt_card_visual_embedding_jobs (
    media_id, card_id, generation, status, source_fingerprint, next_retry_at
  ) VALUES (
    v_media.id, p_card_id, v_gen, 'pending', v_fingerprint, now()
  )
  ON CONFLICT (media_id, generation) DO UPDATE
    SET status = CASE
          WHEN prompt_card_visual_embedding_jobs.status = 'processing'
            AND prompt_card_visual_embedding_jobs.lease_expires_at IS NOT NULL
            AND prompt_card_visual_embedding_jobs.lease_expires_at > now()
            AND prompt_card_visual_embedding_jobs.source_fingerprint = EXCLUDED.source_fingerprint
          THEN prompt_card_visual_embedding_jobs.status
          ELSE 'pending'
        END,
        source_fingerprint = EXCLUDED.source_fingerprint,
        next_retry_at = CASE
          WHEN prompt_card_visual_embedding_jobs.status = 'processing'
            AND prompt_card_visual_embedding_jobs.lease_expires_at IS NOT NULL
            AND prompt_card_visual_embedding_jobs.lease_expires_at > now()
            AND prompt_card_visual_embedding_jobs.source_fingerprint = EXCLUDED.source_fingerprint
          THEN prompt_card_visual_embedding_jobs.next_retry_at
          ELSE now()
        END,
        last_error_code = CASE
          WHEN prompt_card_visual_embedding_jobs.source_fingerprint IS DISTINCT FROM EXCLUDED.source_fingerprint
          THEN NULL
          ELSE prompt_card_visual_embedding_jobs.last_error_code
        END,
        updated_at = now()
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_enqueue_visual_embedding_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.media_type = 'photo' THEN
    PERFORM public.enqueue_canonical_visual_embedding_job(NEW.card_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_enqueue_visual_embedding_job_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published IS DISTINCT FROM true) THEN
    PERFORM public.enqueue_canonical_visual_embedding_job(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prompt_card_media_visual_embedding_job ON public.prompt_card_media;
CREATE TRIGGER prompt_card_media_visual_embedding_job
AFTER INSERT OR UPDATE OF is_primary, media_index, storage_bucket, storage_path, media_type
ON public.prompt_card_media
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_visual_embedding_job();

DROP TRIGGER IF EXISTS prompt_cards_visual_embedding_job ON public.prompt_cards;
CREATE TRIGGER prompt_cards_visual_embedding_job
AFTER INSERT OR UPDATE OF is_published
ON public.prompt_cards
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_visual_embedding_job_on_publish();

CREATE OR REPLACE FUNCTION public.enqueue_missing_visual_embedding_jobs(
  p_generation int DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gen int;
  v_count int := 0;
  v_card uuid;
BEGIN
  SELECT coalesce(p_generation, active_generation)
  INTO v_gen
  FROM public.prompt_card_visual_search_config
  WHERE id = 1;

  FOR v_card IN
    SELECT c.id
    FROM public.prompt_cards c
    WHERE c.is_published = true
      AND EXISTS (
        SELECT 1
        FROM public.prompt_card_media m
        WHERE m.card_id = c.id
          AND m.media_type = 'photo'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.prompt_card_visual_embeddings e
        JOIN public.prompt_card_media canon
          ON canon.id = e.media_id
        WHERE e.card_id = c.id
          AND e.generation = v_gen
          AND canon.card_id = c.id
          AND canon.media_type = 'photo'
          AND canon.id = (
            SELECT m2.id
            FROM public.prompt_card_media m2
            WHERE m2.card_id = c.id
              AND m2.media_type = 'photo'
            ORDER BY m2.is_primary DESC, m2.media_index ASC
            LIMIT 1
          )
      )
    ORDER BY c.source_date DESC NULLS LAST, c.id ASC
    LIMIT least(2000, greatest(1, p_limit))
  LOOP
    IF public.enqueue_canonical_visual_embedding_job(v_card, v_gen) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_visual_embedding_jobs(
  p_limit int DEFAULT 8,
  p_lease_seconds int DEFAULT 120
)
RETURNS TABLE (
  job_id uuid,
  media_id uuid,
  card_id uuid,
  generation int,
  lease_token uuid,
  storage_bucket text,
  storage_path text,
  mime_type text,
  attempt_count int,
  source_fingerprint text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT j.id
    FROM public.prompt_card_visual_embedding_jobs j
    WHERE (
        j.status IN ('pending', 'retry')
        AND j.next_retry_at <= now()
      )
      OR (
        j.status = 'processing'
        AND j.lease_expires_at IS NOT NULL
        AND j.lease_expires_at < now()
      )
    ORDER BY j.next_retry_at ASC, j.created_at ASC
    FOR UPDATE OF j SKIP LOCKED
    LIMIT least(50, greatest(1, p_limit))
  ),
  claimed AS (
    UPDATE public.prompt_card_visual_embedding_jobs j
    SET status = 'processing',
        attempt_count = j.attempt_count + 1,
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
        updated_at = now()
    FROM due
    WHERE j.id = due.id
    RETURNING
      j.id,
      j.media_id,
      j.card_id,
      j.generation,
      j.lease_token,
      j.attempt_count,
      j.source_fingerprint
  )
  SELECT
    c.id,
    c.media_id,
    c.card_id,
    c.generation,
    c.lease_token,
    m.storage_bucket,
    m.storage_path,
    m.mime_type,
    c.attempt_count,
    c.source_fingerprint
  FROM claimed c
  JOIN public.prompt_card_media m ON m.id = c.media_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_visual_embedding_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_embedding vector,
  p_fingerprint text,
  p_model text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.prompt_card_visual_embedding_jobs%ROWTYPE;
BEGIN
  IF p_embedding IS NULL OR vector_dims(p_embedding) <> 768 THEN
    RAISE EXCEPTION 'visual embedding must have 768 dimensions';
  END IF;

  SELECT *
  INTO v_job
  FROM public.prompt_card_visual_embedding_jobs
  WHERE id = p_job_id
    AND lease_token = p_lease_token
    AND status = 'processing'
  FOR UPDATE;

  IF v_job.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.prompt_card_visual_embeddings (
    media_id, card_id, model, generation, embedding, source_fingerprint
  ) VALUES (
    v_job.media_id,
    v_job.card_id,
    coalesce(nullif(btrim(p_model), ''), 'gemini-embedding-2'),
    v_job.generation,
    p_embedding,
    coalesce(nullif(btrim(p_fingerprint), ''), v_job.source_fingerprint, '')
  )
  ON CONFLICT (media_id, generation) DO UPDATE
    SET embedding = EXCLUDED.embedding,
        model = EXCLUDED.model,
        source_fingerprint = EXCLUDED.source_fingerprint,
        updated_at = now();

  UPDATE public.prompt_card_visual_embedding_jobs
  SET status = 'ready',
      source_fingerprint = coalesce(nullif(btrim(p_fingerprint), ''), source_fingerprint),
      last_error_code = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_visual_embedding_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.prompt_card_visual_embedding_jobs%ROWTYPE;
  v_code text := left(coalesce(nullif(btrim(p_error_code), ''), 'unknown'), 64);
  v_dead boolean;
BEGIN
  SELECT *
  INTO v_job
  FROM public.prompt_card_visual_embedding_jobs
  WHERE id = p_job_id
    AND lease_token = p_lease_token
    AND status = 'processing'
  FOR UPDATE;

  IF v_job.id IS NULL THEN
    RETURN false;
  END IF;

  v_dead := v_job.attempt_count >= v_job.max_attempts;

  UPDATE public.prompt_card_visual_embedding_jobs
  SET status = CASE WHEN v_dead THEN 'dead' ELSE 'retry' END,
      last_error_code = v_code,
      next_retry_at = CASE
        WHEN v_dead THEN next_retry_at
        ELSE now() + make_interval(secs => least(3600, 30 * (2 ^ least(v_job.attempt_count, 8))))
      END,
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.visual_embedding_coverage(
  p_generation int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gen int;
  v_published int;
  v_ready int;
BEGIN
  SELECT coalesce(p_generation, active_generation)
  INTO v_gen
  FROM public.prompt_card_visual_search_config
  WHERE id = 1;

  SELECT count(*)
  INTO v_published
  FROM public.prompt_cards c
  WHERE c.is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.prompt_card_media m
      WHERE m.card_id = c.id
        AND m.media_type = 'photo'
    );

  SELECT count(*)
  INTO v_ready
  FROM public.prompt_cards c
  WHERE c.is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.prompt_card_visual_embeddings e
      JOIN public.prompt_card_media canon ON canon.id = e.media_id
      WHERE e.card_id = c.id
        AND e.generation = v_gen
        AND canon.id = (
          SELECT m2.id
          FROM public.prompt_card_media m2
          WHERE m2.card_id = c.id
            AND m2.media_type = 'photo'
          ORDER BY m2.is_primary DESC, m2.media_index ASC
          LIMIT 1
        )
    );

  RETURN jsonb_build_object(
    'generation', v_gen,
    'published_with_photo', v_published,
    'ready', v_ready,
    'pending', (
      SELECT count(*) FROM public.prompt_card_visual_embedding_jobs
      WHERE generation = v_gen AND status = 'pending'
    ),
    'retry', (
      SELECT count(*) FROM public.prompt_card_visual_embedding_jobs
      WHERE generation = v_gen AND status = 'retry'
    ),
    'processing', (
      SELECT count(*) FROM public.prompt_card_visual_embedding_jobs
      WHERE generation = v_gen AND status = 'processing'
    ),
    'dead', (
      SELECT count(*) FROM public.prompt_card_visual_embedding_jobs
      WHERE generation = v_gen AND status = 'dead'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.search_cards_visual(
  p_embedding vector,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_generation int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  title_ru text,
  title_en text,
  seo_tags jsonb,
  relevance_score int,
  match_type text,
  visual_distance real,
  source_date timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET hnsw.ef_search = 64
AS $$
DECLARE
  v_gen int;
  v_limit int;
  v_offset int;
  v_overfetch int;
BEGIN
  IF p_embedding IS NULL OR vector_dims(p_embedding) <> 768 THEN
    RAISE EXCEPTION 'visual embedding must have 768 dimensions';
  END IF;

  SELECT coalesce(p_generation, active_generation)
  INTO v_gen
  FROM public.prompt_card_visual_search_config
  WHERE id = 1;

  v_limit := least(300, greatest(1, p_limit));
  v_offset := greatest(0, p_offset);
  v_overfetch := least(300, greatest((v_limit + v_offset) * 3, 80));

  RETURN QUERY
  WITH knn AS (
    SELECT
      e.card_id,
      e.media_id,
      (e.embedding <=> p_embedding)::real AS dist
    FROM public.prompt_card_visual_embeddings e
    WHERE e.generation = v_gen
    ORDER BY e.embedding <=> p_embedding
    LIMIT v_overfetch
  ),
  canonical AS (
    SELECT DISTINCT ON (m.card_id)
      m.id,
      m.card_id
    FROM public.prompt_card_media m
    JOIN knn k ON k.card_id = m.card_id
    WHERE m.media_type = 'photo'
    ORDER BY m.card_id, m.is_primary DESC, m.media_index ASC
  ),
  filtered AS (
    SELECT
      c.id,
      c.slug,
      c.title_ru,
      c.title_en,
      c.seo_tags,
      (
        (1 - least(k.dist, 2.0) / 2.0) * 1000
      )::int AS relevance_score,
      'visual'::text AS match_type,
      k.dist AS visual_distance,
      c.source_date
    FROM knn k
    JOIN canonical can
      ON can.card_id = k.card_id
     AND can.id = k.media_id
    JOIN public.prompt_cards c ON c.id = k.card_id
    WHERE c.is_published = true
  )
  SELECT
    f.id,
    f.slug,
    f.title_ru,
    f.title_en,
    f.seo_tags,
    f.relevance_score,
    f.match_type,
    f.visual_distance,
    f.source_date
  FROM filtered f
  ORDER BY
    f.visual_distance ASC,
    f.source_date DESC NULLS LAST,
    f.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.visual_search_rate_limit_increment(
  p_ip_hash text,
  p_window_start timestamptz,
  p_ip_max int DEFAULT 60,
  p_global_max int DEFAULT 4000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text := left(coalesce(nullif(btrim(p_ip_hash), ''), 'unknown'), 128);
  v_ip_max int := greatest(p_ip_max, 1);
  v_global_max int := greatest(p_global_max, 1);
  v_global_key text := 'global';
  v_ip_count int := 0;
  v_global_count int := 0;
  v_ip_window timestamptz;
  v_global_window timestamptz;
BEGIN
  INSERT INTO public.visual_search_rate_limit (bucket_key, window_start, count)
  VALUES (v_global_key, p_window_start, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  INSERT INTO public.visual_search_rate_limit (bucket_key, window_start, count)
  VALUES (v_ip, p_window_start, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT count, window_start
  INTO v_global_count, v_global_window
  FROM public.visual_search_rate_limit
  WHERE bucket_key = v_global_key
  FOR UPDATE;

  SELECT count, window_start
  INTO v_ip_count, v_ip_window
  FROM public.visual_search_rate_limit
  WHERE bucket_key = v_ip
  FOR UPDATE;

  IF v_global_window < p_window_start THEN
    v_global_count := 0;
    UPDATE public.visual_search_rate_limit
    SET window_start = p_window_start, count = 0
    WHERE bucket_key = v_global_key;
  END IF;

  IF v_ip_window < p_window_start THEN
    v_ip_count := 0;
    UPDATE public.visual_search_rate_limit
    SET window_start = p_window_start, count = 0
    WHERE bucket_key = v_ip;
  END IF;

  IF v_ip_count >= v_ip_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'ip',
      'ip_count', v_ip_count,
      'global_count', v_global_count
    );
  END IF;

  IF v_global_count >= v_global_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'global',
      'ip_count', v_ip_count,
      'global_count', v_global_count
    );
  END IF;

  UPDATE public.visual_search_rate_limit
  SET count = count + 1
  WHERE bucket_key = v_global_key
  RETURNING count INTO v_global_count;

  UPDATE public.visual_search_rate_limit
  SET count = count + 1
  WHERE bucket_key = v_ip
  RETURNING count INTO v_ip_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'ip_count', v_ip_count,
    'global_count', v_global_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.visual_embedding_source_fingerprint(text, text, int, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_canonical_visual_embedding_job(uuid, int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enqueue_visual_embedding_job()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enqueue_visual_embedding_job_on_publish()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_missing_visual_embedding_jobs(int, int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_visual_embedding_jobs(int, int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_visual_embedding_job(uuid, uuid, vector, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_visual_embedding_job(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visual_embedding_coverage(int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_cards_visual(vector, int, int, int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visual_search_rate_limit_increment(text, timestamptz, int, int)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.visual_embedding_source_fingerprint(text, text, int, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_canonical_visual_embedding_job(uuid, int)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_missing_visual_embedding_jobs(int, int)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_visual_embedding_jobs(int, int)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_visual_embedding_job(uuid, uuid, vector, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_visual_embedding_job(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visual_embedding_coverage(int)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.search_cards_visual(vector, int, int, int)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.visual_search_rate_limit_increment(text, timestamptz, int, int)
  TO service_role;
