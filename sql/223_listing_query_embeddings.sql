-- Persist Gemini query embeddings for the 4 birthday listing SSOT queries.
-- Public /api/search does not read or write this table.

CREATE TABLE IF NOT EXISTS public.listing_query_embeddings (
  query_hash text PRIMARY KEY,
  query_norm text NOT NULL,
  model text NOT NULL,
  generation int NOT NULL CHECK (generation >= 1),
  use_task_prefix boolean NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_query_embeddings_norm_idx
  ON public.listing_query_embeddings (query_norm, model, generation);

ALTER TABLE public.listing_query_embeddings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.listing_query_embeddings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.listing_query_embeddings TO service_role;

CREATE OR REPLACE FUNCTION public.get_listing_query_embedding(
  p_query_hash text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.embedding::text
  FROM public.listing_query_embeddings e
  WHERE e.query_hash = btrim(coalesce(p_query_hash, ''))
$$;

CREATE OR REPLACE FUNCTION public.upsert_listing_query_embedding(
  p_query_hash text,
  p_query_norm text,
  p_model text,
  p_generation int,
  p_use_task_prefix boolean,
  p_embedding text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := btrim(coalesce(p_query_hash, ''));
  v_norm text := left(btrim(coalesce(p_query_norm, '')), 160);
  v_model text := coalesce(nullif(btrim(coalesce(p_model, '')), ''), 'gemini-embedding-2');
  v_embedding vector(768);
BEGIN
  IF v_hash = '' OR v_norm = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_embedding := p_embedding::vector;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'listing query embedding must be a 768-d vector';
  END;

  IF v_embedding IS NULL OR vector_dims(v_embedding) <> 768 THEN
    RAISE EXCEPTION 'listing query embedding must have 768 dimensions';
  END IF;

  INSERT INTO public.listing_query_embeddings (
    query_hash,
    query_norm,
    model,
    generation,
    use_task_prefix,
    embedding
  ) VALUES (
    v_hash,
    v_norm,
    v_model,
    greatest(1, coalesce(p_generation, 1)),
    coalesce(p_use_task_prefix, true),
    v_embedding
  )
  ON CONFLICT (query_hash) DO UPDATE SET
    query_norm = excluded.query_norm,
    model = excluded.model,
    generation = excluded.generation,
    use_task_prefix = excluded.use_task_prefix,
    embedding = excluded.embedding,
    updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_listing_query_embedding(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_listing_query_embedding(text, text, text, int, boolean, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_listing_query_embedding(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_listing_query_embedding(text, text, text, int, boolean, text)
  TO service_role;

COMMENT ON TABLE public.listing_query_embeddings IS
  'Cached Gemini query vectors for birthday listing SSOT q only. Not a general search cache.';
COMMENT ON FUNCTION public.get_listing_query_embedding(text) IS
  'Return stored listing query embedding literal, or null on miss.';
COMMENT ON FUNCTION public.upsert_listing_query_embedding(text, text, text, int, boolean, text) IS
  'Idempotent write of one birthday listing query embedding.';
