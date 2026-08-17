-- Fix SQLSTATE 42702 in search_cards_visual.
-- The RETURNS TABLE output column `id` is a PL/pgSQL variable, so the
-- unqualified config predicate `WHERE id = 1` is ambiguous.

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

  SELECT coalesce(p_generation, config.active_generation)
  INTO v_gen
  FROM public.prompt_card_visual_search_config AS config
  WHERE config.id = 1;

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

COMMENT ON FUNCTION public.search_cards_visual(vector, int, int, int) IS
  'ANN search over canonical card photo embeddings; config columns are qualified to avoid PL/pgSQL output-variable ambiguity.';
