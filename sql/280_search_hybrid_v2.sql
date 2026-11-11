-- ============================================================
-- Migration 280: Hybrid Search V2
--
-- 0. DB feature flags in landing_generation_config:
--    - search_visual_enabled (default 'false'; set 'true' before deploy on prod)
--    - search_visual_max_distance (default '0.70')
-- 1. L2 persistent query vector cache: search_query_embeddings + RPCs
-- 2. Denormalized 30-day search click counter on prompt_cards + refresh RPC
-- 3. FTS v2: yo->e normalization, title_en (english A + simple B), title_en trgm GIN,
--    (N-1)-of-N quorum soft FTS for 3+ word queries, synonym expansion overload
-- 4. Visual ANN v2: 9-arg search_cards_visual overload with p_max_distance + engagement columns
--
-- Rolling-deploy safe: existing 3/7-arg search_cards_text and 4/8-arg search_cards_visual
-- keep their exact return signatures.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 0. Feature flags in landing_generation_config ────────────────────────────
INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  ('search_visual_enabled', 'false', now()),
  ('search_visual_max_distance', '0.70', now())
ON CONFLICT (key) DO NOTHING;

-- ── 1. L2 persistent query embedding cache ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_query_embeddings (
  query_hash text PRIMARY KEY,
  query_norm text NOT NULL,
  model text NOT NULL,
  generation int NOT NULL CHECK (generation >= 1),
  use_task_prefix boolean NOT NULL,
  embedding vector(768) NOT NULL,
  hit_count bigint NOT NULL DEFAULT 1 CHECK (hit_count >= 1),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_query_embeddings_last_used_idx
  ON public.search_query_embeddings (last_used_at);

CREATE INDEX IF NOT EXISTS search_query_embeddings_norm_model_gen_idx
  ON public.search_query_embeddings (query_norm, model, generation, use_task_prefix);

ALTER TABLE public.search_query_embeddings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.search_query_embeddings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.search_query_embeddings TO service_role;

COMMENT ON TABLE public.search_query_embeddings IS
  'L2 persistent cache of 768-d Gemini query vectors for /api/search. Service-role only.';

CREATE OR REPLACE FUNCTION public.get_search_query_embedding(
  p_query_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := btrim(coalesce(p_query_hash, ''));
  v_embedding text;
  v_last_used timestamptz;
BEGIN
  IF v_hash = '' THEN
    RETURN NULL;
  END IF;

  SELECT e.embedding::text, e.last_used_at
    INTO v_embedding, v_last_used
    FROM public.search_query_embeddings e
   WHERE e.query_hash = v_hash;

  IF v_embedding IS NULL THEN
    RETURN NULL;
  END IF;

  -- Throttle hit_count / last_used_at writes to at most once per hour per query_hash
  -- so hot queries remain pure PK reads without row-lock contention.
  IF v_last_used IS NULL OR v_last_used < now() - interval '1 hour' THEN
    UPDATE public.search_query_embeddings
       SET hit_count = hit_count + 1,
           last_used_at = now()
     WHERE query_hash = v_hash
       AND (last_used_at IS NULL OR last_used_at < now() - interval '1 hour');
  END IF;

  RETURN v_embedding;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_search_query_embedding(
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
  v_norm text := left(replace(lower(btrim(coalesce(p_query_norm, ''))), 'ё', 'е'), 160);
  v_model text := coalesce(nullif(btrim(coalesce(p_model, '')), ''), 'gemini-embedding-2');
  v_embedding vector(768);
BEGIN
  IF v_hash = '' OR length(v_norm) < 2 THEN
    RETURN false;
  END IF;

  BEGIN
    v_embedding := p_embedding::vector;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'search query embedding must be a 768-d vector';
  END;

  IF v_embedding IS NULL OR vector_dims(v_embedding) <> 768 THEN
    RAISE EXCEPTION 'search query embedding must have 768 dimensions';
  END IF;

  INSERT INTO public.search_query_embeddings (
    query_hash,
    query_norm,
    model,
    generation,
    use_task_prefix,
    embedding,
    hit_count,
    last_used_at
  ) VALUES (
    v_hash,
    v_norm,
    v_model,
    greatest(1, coalesce(p_generation, 1)),
    coalesce(p_use_task_prefix, true),
    v_embedding,
    1,
    now()
  )
  ON CONFLICT (query_hash) DO UPDATE SET
    query_norm = excluded.query_norm,
    model = excluded.model,
    generation = excluded.generation,
    use_task_prefix = excluded.use_task_prefix,
    embedding = excluded.embedding,
    hit_count = public.search_query_embeddings.hit_count + 1,
    last_used_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_uncached_popular_search_queries(
  p_days int DEFAULT 7,
  p_min_searches int DEFAULT 2,
  p_model text DEFAULT 'gemini-embedding-2',
  p_generation int DEFAULT 1,
  p_use_task_prefix boolean DEFAULT true,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  query_norm text,
  searches int,
  clicks int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90))) AS since,
      greatest(1, coalesce(p_min_searches, 2)) AS min_searches,
      coalesce(nullif(btrim(coalesce(p_model, '')), ''), 'gemini-embedding-2') AS model,
      greatest(1, coalesce(p_generation, 1)) AS generation,
      coalesce(p_use_task_prefix, true) AS use_task_prefix,
      greatest(1, least(coalesce(p_limit, 10), 100)) AS max_rows
  ),
  events AS (
    SELECT
      e.id,
      regexp_replace(replace(lower(btrim(e.query_norm)), 'ё', 'е'), '\s+', ' ', 'g') AS q_norm
    FROM public.landing_search_events e
    CROSS JOIN params p
    WHERE e.created_at >= p.since
  ),
  bounded_events AS (
    SELECT ev.id, ev.q_norm
    FROM events ev
    WHERE length(ev.q_norm) BETWEEN 2 AND 80
  ),
  click_counts AS (
    SELECT c.search_id, count(*)::int AS cnt
    FROM public.landing_search_clicks c
    WHERE c.search_id IN (SELECT id FROM bounded_events)
    GROUP BY c.search_id
  ),
  grouped AS (
    SELECT
      be.q_norm AS query_norm,
      count(*)::int AS searches,
      coalesce(sum(cc.cnt), 0)::int AS clicks
    FROM bounded_events be
    LEFT JOIN click_counts cc ON cc.search_id = be.id
    GROUP BY be.q_norm
  )
  SELECT
    g.query_norm,
    g.searches,
    g.clicks
  FROM grouped g
  CROSS JOIN params p
  WHERE (g.searches >= p.min_searches OR g.clicks > 0)
    AND NOT EXISTS (
      SELECT 1
      FROM public.search_query_embeddings sqe
      WHERE sqe.query_norm = g.query_norm
        AND sqe.model = p.model
        AND sqe.generation = p.generation
        AND sqe.use_task_prefix = p.use_task_prefix
    )
  ORDER BY g.clicks DESC, g.searches DESC, g.query_norm ASC
  LIMIT (SELECT max_rows FROM params);
$$;

CREATE OR REPLACE FUNCTION public.prune_search_query_embeddings(
  p_older_than_days int DEFAULT 90
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.search_query_embeddings
     WHERE hit_count <= 1
       AND last_used_at < now() - make_interval(days => greatest(7, coalesce(p_older_than_days, 90)))
    RETURNING query_hash
  )
  SELECT count(*)::int INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.get_search_query_embedding(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_search_query_embedding(text, text, text, int, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_uncached_popular_search_queries(int, int, text, int, boolean, int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_search_query_embeddings(int)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_search_query_embedding(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_search_query_embedding(text, text, text, int, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_uncached_popular_search_queries(int, int, text, int, boolean, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_search_query_embeddings(int) TO service_role;

-- ── 2. Denormalized 30-day search clicks on prompt_cards ─────────────────────
ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS search_clicks_30d integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_card_search_clicks_30d()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_zeroed integer := 0;
BEGIN
  WITH agg AS (
    SELECT
      c.card_slug,
      least(2147483647, count(*))::integer AS clicks_30d
    FROM public.landing_search_clicks c
    WHERE c.created_at >= now() - interval '30 days'
      AND c.card_slug IS NOT NULL
      AND c.card_slug <> ''
    GROUP BY c.card_slug
  ),
  upd AS (
    UPDATE public.prompt_cards pc
       SET search_clicks_30d = agg.clicks_30d
      FROM agg
     WHERE pc.slug = agg.card_slug
       AND pc.search_clicks_30d IS DISTINCT FROM agg.clicks_30d
    RETURNING pc.id
  )
  SELECT count(*)::integer INTO v_updated FROM upd;

  WITH rst AS (
    UPDATE public.prompt_cards pc
       SET search_clicks_30d = 0
     WHERE pc.search_clicks_30d <> 0
       AND NOT EXISTS (
         SELECT 1
         FROM public.landing_search_clicks c
         WHERE c.card_slug = pc.slug
           AND c.created_at >= now() - interval '30 days'
       )
    RETURNING pc.id
  )
  SELECT count(*)::integer INTO v_zeroed FROM rst;

  RETURN v_updated + v_zeroed;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_card_search_clicks_30d()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_card_search_clicks_30d() TO service_role;

SELECT public.refresh_card_search_clicks_30d();

-- ── 3. FTS v2: yo->e, title_en, trigram on title_en, quorum soft FTS ─────────
CREATE INDEX IF NOT EXISTS idx_cards_title_en_trgm
  ON public.prompt_cards USING GIN (title_en gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.rebuild_card_fts(p_card_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_title_ru text;
  v_title_en text;
  v_prompts  text;
BEGIN
  SELECT c.title_ru, c.title_en
    INTO v_title_ru, v_title_en
    FROM public.prompt_cards c
   WHERE c.id = p_card_id;

  SELECT string_agg(v.prompt_text_ru, ' ')
    INTO v_prompts
    FROM public.prompt_variants v
   WHERE v.card_id = p_card_id
     AND v.prompt_text_ru IS NOT NULL
     AND v.prompt_text_ru != '';

  UPDATE public.prompt_cards
     SET fts =
       setweight(to_tsvector('russian', replace(lower(coalesce(v_title_ru, '')), 'ё', 'е')), 'A') ||
       setweight(to_tsvector('english', coalesce(v_title_en, '')), 'A') ||
       setweight(to_tsvector('simple', lower(coalesce(v_title_en, ''))), 'B') ||
       setweight(to_tsvector('russian', replace(lower(coalesce(v_prompts, '')), 'ё', 'е')), 'B')
   WHERE id = p_card_id;
END;
$$;

DROP TRIGGER IF EXISTS trg_rebuild_fts_on_card ON public.prompt_cards;
CREATE TRIGGER trg_rebuild_fts_on_card
  AFTER INSERT OR UPDATE OF title_ru, title_en, seo_tags
  ON public.prompt_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_card_fts_on_card();

-- Set-based backfill of fts for published cards (does not fire UPDATE OF title_ru/title_en/seo_tags).
UPDATE public.prompt_cards c
   SET fts =
     setweight(to_tsvector('russian', replace(lower(coalesce(c.title_ru, '')), 'ё', 'е')), 'A') ||
     setweight(to_tsvector('english', coalesce(c.title_en, '')), 'A') ||
     setweight(to_tsvector('simple', lower(coalesce(c.title_en, ''))), 'B') ||
     setweight(to_tsvector('russian', replace(lower(coalesce(pv.prompts_ru, '')), 'ё', 'е')), 'B')
  FROM (
    SELECT
      card_id,
      string_agg(prompt_text_ru, ' ') AS prompts_ru
    FROM public.prompt_variants
    WHERE prompt_text_ru IS NOT NULL
      AND prompt_text_ru != ''
    GROUP BY card_id
  ) pv
 WHERE c.id = pv.card_id
   AND c.is_published = true;

UPDATE public.prompt_cards c
   SET fts =
     setweight(to_tsvector('russian', replace(lower(coalesce(c.title_ru, '')), 'ё', 'е')), 'A') ||
     setweight(to_tsvector('english', coalesce(c.title_en, '')), 'A') ||
     setweight(to_tsvector('simple', lower(coalesce(c.title_en, ''))), 'B')
 WHERE c.is_published = true
   AND NOT EXISTS (
     SELECT 1
     FROM public.prompt_variants pv
     WHERE pv.card_id = c.id
       AND pv.prompt_text_ru IS NOT NULL
       AND pv.prompt_text_ru != ''
   );

-- Helper: builds (N-1)-of-N conjunction quorum tsquery for 3..6 distinct lexemes.
-- Keeps every clause a GIN-friendly bitmap-AND instead of scanning single common words.
CREATE OR REPLACE FUNCTION public.search_quorum_tsquery(p_tsq tsquery)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_parts text[];
  v_terms text[];
  v_len int;
  v_clauses text[] := ARRAY[]::text[];
  v_sub text[];
  i int;
  j int;
BEGIN
  IF p_tsq IS NULL OR numnode(p_tsq) < 5 THEN
    RETURN NULL;
  END IF;

  v_raw := p_tsq::text;
  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN NULL;
  END IF;

  v_parts := string_to_array(v_raw, ' & ');
  SELECT coalesce(array_agg(t ORDER BY first_ord), ARRAY[]::text[])
    INTO v_terms
    FROM (
      SELECT p.term AS t, min(p.ord) AS first_ord
        FROM unnest(v_parts) WITH ORDINALITY AS p(term, ord)
       WHERE btrim(p.term) <> ''
       GROUP BY p.term
    ) dedup;

  v_len := coalesce(cardinality(v_terms), 0);
  IF v_len < 3 THEN
    RETURN NULL;
  END IF;

  IF v_len > 6 THEN
    v_terms := v_terms[1:6];
    v_len := 6;
  END IF;

  FOR i IN 1..v_len LOOP
    v_sub := ARRAY[]::text[];
    FOR j IN 1..v_len LOOP
      IF j <> i THEN
        v_sub := array_append(v_sub, v_terms[j]);
      END IF;
    END LOOP;
    v_clauses := array_append(v_clauses, '(' || array_to_string(v_sub, ' & ') || ')');
  END LOOP;

  RETURN array_to_string(v_clauses, ' | ')::tsquery;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 8-arg V2 text search overload: supports synonym expansion + returns engagement fields.
CREATE OR REPLACE FUNCTION public.search_cards_text(
  p_query text,
  p_limit int,
  p_offset int,
  p_audience_tag text,
  p_style_tag text,
  p_occasion_tag text,
  p_object_tag text,
  p_synonym_query text
)
RETURNS TABLE (
  id uuid,
  slug text,
  title_ru text,
  title_en text,
  seo_tags jsonb,
  relevance_score int,
  match_type text,
  search_clicks_30d int,
  view_count bigint,
  source_date timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH raw_norm AS (
  SELECT
    replace(lower(left(btrim(coalesce(p_query, '')), 160)), 'ё', 'е') AS q,
    nullif(replace(lower(left(btrim(coalesce(p_synonym_query, '')), 200)), 'ё', 'е'), '') AS q_syn
),
norm AS (
  SELECT
    r.q,
    r.q_syn,
    (r.q ~ '[a-z]') AS has_latin,
    plainto_tsquery('russian', r.q) AS tsq_ru,
    CASE
      WHEN r.q ~ '[a-z]' THEN plainto_tsquery('english', r.q)
      ELSE NULL::tsquery
    END AS tsq_en,
    CASE
      WHEN r.q_syn IS NOT NULL AND r.q_syn <> r.q THEN plainto_tsquery('russian', r.q_syn)
      ELSE NULL::tsquery
    END AS tsq_syn_ru,
    CASE
      WHEN r.q_syn IS NOT NULL AND r.q_syn <> r.q AND r.q_syn ~ '[a-z]'
        THEN plainto_tsquery('english', r.q_syn)
      ELSE NULL::tsquery
    END AS tsq_syn_en,
    public.search_quorum_tsquery(plainto_tsquery('russian', r.q)) AS tsq_quorum,
    replace(
      replace(
        replace(r.q, E'\\', E'\\\\'),
        '%',
        E'\\%'
      ),
      '_',
      E'\\_'
    ) AS like_q
  FROM raw_norm r
),
fts_strict_hits AS (
  SELECT
    c.id,
    GREATEST(
      CASE WHEN numnode(n.tsq_ru) > 0 AND c.fts @@ n.tsq_ru THEN ts_rank(c.fts, n.tsq_ru) ELSE 0::real END,
      CASE WHEN n.tsq_en IS NOT NULL AND numnode(n.tsq_en) > 0 AND c.fts @@ n.tsq_en THEN ts_rank(c.fts, n.tsq_en) ELSE 0::real END,
      CASE WHEN n.tsq_syn_ru IS NOT NULL AND numnode(n.tsq_syn_ru) > 0 AND c.fts @@ n.tsq_syn_ru THEN ts_rank(c.fts, n.tsq_syn_ru) * 0.92::real ELSE 0::real END,
      CASE WHEN n.tsq_syn_en IS NOT NULL AND numnode(n.tsq_syn_en) > 0 AND c.fts @@ n.tsq_syn_en THEN ts_rank(c.fts, n.tsq_syn_en) * 0.92::real ELSE 0::real END
    ) AS fts_rank
  FROM public.prompt_cards c
  CROSS JOIN norm n
  WHERE n.q <> ''
    AND c.is_published = true
    AND (p_audience_tag IS NULL OR coalesce(c.seo_tags -> 'audience_tag', '[]'::jsonb) ? p_audience_tag)
    AND (p_style_tag IS NULL OR coalesce(c.seo_tags -> 'style_tag', '[]'::jsonb) ? p_style_tag)
    AND (p_occasion_tag IS NULL OR coalesce(c.seo_tags -> 'occasion_tag', '[]'::jsonb) ? p_occasion_tag)
    AND (p_object_tag IS NULL OR coalesce(c.seo_tags -> 'object_tag', '[]'::jsonb) ? p_object_tag)
    AND (
      (numnode(n.tsq_ru) > 0 AND c.fts @@ n.tsq_ru)
      OR (n.tsq_en IS NOT NULL AND numnode(n.tsq_en) > 0 AND c.fts @@ n.tsq_en)
      OR (n.tsq_syn_ru IS NOT NULL AND numnode(n.tsq_syn_ru) > 0 AND c.fts @@ n.tsq_syn_ru)
      OR (n.tsq_syn_en IS NOT NULL AND numnode(n.tsq_syn_en) > 0 AND c.fts @@ n.tsq_syn_en)
    )
),
fts_soft_hits AS (
  SELECT
    c.id,
    ts_rank(c.fts, n.tsq_quorum) AS soft_rank
  FROM public.prompt_cards c
  CROSS JOIN norm n
  WHERE n.tsq_quorum IS NOT NULL
    AND c.is_published = true
    AND (p_audience_tag IS NULL OR coalesce(c.seo_tags -> 'audience_tag', '[]'::jsonb) ? p_audience_tag)
    AND (p_style_tag IS NULL OR coalesce(c.seo_tags -> 'style_tag', '[]'::jsonb) ? p_style_tag)
    AND (p_occasion_tag IS NULL OR coalesce(c.seo_tags -> 'occasion_tag', '[]'::jsonb) ? p_occasion_tag)
    AND (p_object_tag IS NULL OR coalesce(c.seo_tags -> 'object_tag', '[]'::jsonb) ? p_object_tag)
    AND c.fts @@ n.tsq_quorum
),
title_hits AS (
  SELECT
    c.id,
    GREATEST(
      CASE
        WHEN c.title_ru IS NOT NULL THEN GREATEST(
          similarity(replace(lower(c.title_ru), 'ё', 'е'), n.q),
          word_similarity(n.q, replace(lower(c.title_ru), 'ё', 'е')),
          CASE
            WHEN replace(lower(c.title_ru), 'ё', 'е') LIKE ('%' || n.like_q || '%') ESCAPE E'\\' THEN 0.9
            ELSE 0
          END
        )
        ELSE 0::real
      END,
      CASE
        WHEN n.has_latin AND c.title_en IS NOT NULL THEN GREATEST(
          similarity(lower(c.title_en), n.q),
          word_similarity(n.q, lower(c.title_en)),
          CASE
            WHEN lower(c.title_en) LIKE ('%' || n.like_q || '%') ESCAPE E'\\' THEN 0.9
            ELSE 0
          END
        )
        ELSE 0::real
      END
    ) AS title_sim
  FROM public.prompt_cards c
  CROSS JOIN norm n
  WHERE length(n.q) >= 2
    AND c.is_published = true
    AND (p_audience_tag IS NULL OR coalesce(c.seo_tags -> 'audience_tag', '[]'::jsonb) ? p_audience_tag)
    AND (p_style_tag IS NULL OR coalesce(c.seo_tags -> 'style_tag', '[]'::jsonb) ? p_style_tag)
    AND (p_occasion_tag IS NULL OR coalesce(c.seo_tags -> 'occasion_tag', '[]'::jsonb) ? p_occasion_tag)
    AND (p_object_tag IS NULL OR coalesce(c.seo_tags -> 'object_tag', '[]'::jsonb) ? p_object_tag)
    AND (
      (
        c.title_ru IS NOT NULL
        AND (
          c.title_ru % n.q
          OR replace(lower(c.title_ru), 'ё', 'е') LIKE ('%' || n.like_q || '%') ESCAPE E'\\'
        )
      )
      OR (
        n.has_latin
        AND c.title_en IS NOT NULL
        AND (
          c.title_en % n.q
          OR lower(c.title_en) LIKE ('%' || n.like_q || '%') ESCAPE E'\\'
        )
      )
    )
),
candidate_scores AS (
  SELECT f.id, f.fts_rank, 0::real AS soft_rank, 0::real AS title_sim, true AS has_strict_fts, false AS has_soft_fts
  FROM fts_strict_hits f
  UNION ALL
  SELECT sf.id, 0::real AS fts_rank, sf.soft_rank, 0::real AS title_sim, false AS has_strict_fts, true AS has_soft_fts
  FROM fts_soft_hits sf
  UNION ALL
  SELECT t.id, 0::real AS fts_rank, 0::real AS soft_rank, t.title_sim, false AS has_strict_fts, false AS has_soft_fts
  FROM title_hits t
),
merged AS (
  SELECT
    cs.id,
    max(cs.fts_rank) AS fts_rank,
    max(cs.soft_rank) AS soft_rank,
    max(cs.title_sim) AS title_sim,
    bool_or(cs.has_strict_fts) AS has_strict_fts,
    bool_or(cs.has_soft_fts) AS has_soft_fts
  FROM candidate_scores cs
  GROUP BY cs.id
),
scored AS (
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    CASE
      WHEN m.has_strict_fts THEN (
        m.fts_rank * 1000
        + m.title_sim * 350
        + coalesce(c.seo_readiness_score, 0)
      )::int
      WHEN m.has_soft_fts THEN least(
        195,
        (
          m.soft_rank * 220
          + m.title_sim * 180
          + coalesce(c.seo_readiness_score, 0)
        )::int
      )
      ELSE (
        m.title_sim * 350
        + coalesce(c.seo_readiness_score, 0)
      )::int
    END AS relevance_score,
    CASE
      WHEN m.has_strict_fts AND m.title_sim > 0 THEN 'fts+trgm'
      WHEN m.has_strict_fts THEN 'fts'
      WHEN m.has_soft_fts AND m.title_sim > 0 THEN 'fts_soft+trgm'
      WHEN m.has_soft_fts THEN 'fts_soft'
      ELSE 'trgm'
    END AS match_type,
    m.has_strict_fts,
    m.has_soft_fts,
    coalesce(c.search_clicks_30d, 0) AS search_clicks_30d,
    coalesce(c.view_count, 0) AS view_count,
    c.source_date
  FROM merged m
  JOIN public.prompt_cards c ON c.id = m.id
  WHERE EXISTS (
    SELECT 1
    FROM public.prompt_card_media media
    WHERE media.card_id = c.id
      AND media.media_type = 'photo'
  )
)
SELECT
  s.id,
  s.slug,
  s.title_ru,
  s.title_en,
  s.seo_tags,
  s.relevance_score,
  s.match_type,
  s.search_clicks_30d,
  s.view_count,
  s.source_date
FROM scored s
ORDER BY
  s.has_strict_fts DESC,
  s.has_soft_fts DESC,
  s.relevance_score DESC,
  s.search_clicks_30d DESC,
  s.source_date DESC NULLS LAST,
  s.id ASC
LIMIT least(500, greatest(1, p_limit))
OFFSET greatest(0, p_offset);
$$;

-- Upgrade legacy 7-arg and 3-arg search_cards_text bodies in-place while keeping their 7-column return signature.
CREATE OR REPLACE FUNCTION public.search_cards_text(
  p_query text,
  p_limit int,
  p_offset int,
  p_audience_tag text,
  p_style_tag text,
  p_occasion_tag text,
  p_object_tag text
)
RETURNS TABLE (
  id uuid,
  slug text,
  title_ru text,
  title_en text,
  seo_tags jsonb,
  relevance_score int,
  match_type text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.slug,
    v.title_ru,
    v.title_en,
    v.seo_tags,
    v.relevance_score,
    v.match_type
  FROM public.search_cards_text(
    p_query,
    p_limit,
    p_offset,
    p_audience_tag,
    p_style_tag,
    p_occasion_tag,
    p_object_tag,
    NULL
  ) v;
$$;

CREATE OR REPLACE FUNCTION public.search_cards_text(
  p_query   text,
  p_limit   int DEFAULT 24,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  slug            text,
  title_ru        text,
  title_en        text,
  seo_tags        jsonb,
  relevance_score int,
  match_type      text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.slug,
    v.title_ru,
    v.title_en,
    v.seo_tags,
    v.relevance_score,
    v.match_type
  FROM public.search_cards_text(
    p_query,
    p_limit,
    p_offset,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  ) v;
$$;

-- ── 4. Visual ANN v2: 9-arg overload with p_max_distance + engagement columns ─
CREATE OR REPLACE FUNCTION public.search_cards_visual(
  p_embedding vector,
  p_limit int,
  p_offset int,
  p_generation int,
  p_audience_tag text,
  p_style_tag text,
  p_occasion_tag text,
  p_object_tag text,
  p_max_distance real
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
  source_date timestamptz,
  search_clicks_30d int,
  view_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET hnsw.ef_search = 128
AS $$
DECLARE
  v_gen int;
  v_limit int;
  v_offset int;
  v_overfetch int;
  v_max_dist real;
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
  v_max_dist := CASE
    WHEN p_max_distance IS NOT NULL AND p_max_distance > 0 AND p_max_distance <= 2.0
      THEN p_max_distance
    ELSE NULL
  END;

  RETURN QUERY
  WITH knn AS (
    SELECT
      e.card_id,
      e.media_id,
      (e.embedding <=> p_embedding)::real AS dist
    FROM public.prompt_card_visual_embeddings e
    JOIN public.prompt_cards candidate ON candidate.id = e.card_id
    WHERE e.generation = v_gen
      AND candidate.is_published = true
      AND (p_audience_tag IS NULL OR coalesce(candidate.seo_tags -> 'audience_tag', '[]'::jsonb) ? p_audience_tag)
      AND (p_style_tag IS NULL OR coalesce(candidate.seo_tags -> 'style_tag', '[]'::jsonb) ? p_style_tag)
      AND (p_occasion_tag IS NULL OR coalesce(candidate.seo_tags -> 'occasion_tag', '[]'::jsonb) ? p_occasion_tag)
      AND (p_object_tag IS NULL OR coalesce(candidate.seo_tags -> 'object_tag', '[]'::jsonb) ? p_object_tag)
      AND (v_max_dist IS NULL OR (e.embedding <=> p_embedding) <= v_max_dist)
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
      c.source_date,
      coalesce(c.search_clicks_30d, 0) AS search_clicks_30d,
      coalesce(c.view_count, 0) AS view_count
    FROM knn k
    JOIN canonical can
      ON can.card_id = k.card_id
     AND can.id = k.media_id
    JOIN public.prompt_cards c ON c.id = k.card_id
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
    f.source_date,
    f.search_clicks_30d,
    f.view_count
  FROM filtered f
  ORDER BY
    f.visual_distance ASC,
    f.search_clicks_30d DESC,
    f.source_date DESC NULLS LAST,
    f.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_quorum_tsquery(tsquery)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_cards_visual(vector, int, int, int, text, text, text, text, real)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_quorum_tsquery(tsquery) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_cards_visual(vector, int, int, int, text, text, text, text, real) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.search_cards_text(text, int, int, text, text, text, text, text) IS
  'Hybrid Search V2 text branch: yo->e, RU+EN FTS, (N-1)-of-N quorum soft FTS, title_ru/en trigram, synonym expansion, and engagement fields.';
COMMENT ON FUNCTION public.search_cards_visual(vector, int, int, int, text, text, text, text, real) IS
  'Hybrid Search V2 visual ANN branch: dimension filters, optional max cosine distance threshold, and engagement fields.';
