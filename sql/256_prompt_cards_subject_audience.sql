-- Subject of a catalog card (who is in the canonical photo) is exclusive:
-- devushka | muzhchina | para | semya | malchik | devochka | malysh | none.
-- A man inside a couple or a family does not stay in the men listing.
-- seo_tags.audience_tag stays the listing projection. resolve_route_cards is unchanged.
-- Text classifiers keep relation tags (s_mamoy, vlyublennykh, …). The trigger
-- strips the exclusive set and prepends subject_audience when confidence is high enough.

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_audience text;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_confidence real;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_people_count smallint;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_source text;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_media_id uuid;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_model text;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_classified_at timestamptz;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_attempts smallint NOT NULL DEFAULT 0;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_last_error text;

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS subject_prev_audience jsonb;

ALTER TABLE public.prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_subject_audience_valid;

ALTER TABLE public.prompt_cards
  ADD CONSTRAINT prompt_cards_subject_audience_valid
  CHECK (
    subject_audience IS NULL
    OR subject_audience IN (
      'devushka', 'muzhchina', 'para', 'semya',
      'malchik', 'devochka', 'malysh', 'none'
    )
  );

ALTER TABLE public.prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_subject_source_valid;

ALTER TABLE public.prompt_cards
  ADD CONSTRAINT prompt_cards_subject_source_valid
  CHECK (
    subject_source IS NULL
    OR subject_source IN ('vision', 'manual')
  );

ALTER TABLE public.prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_subject_confidence_range;

ALTER TABLE public.prompt_cards
  ADD CONSTRAINT prompt_cards_subject_confidence_range
  CHECK (
    subject_confidence IS NULL
    OR (subject_confidence >= 0 AND subject_confidence <= 1)
  );

ALTER TABLE public.prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_subject_people_count_range;

ALTER TABLE public.prompt_cards
  ADD CONSTRAINT prompt_cards_subject_people_count_range
  CHECK (subject_people_count IS NULL OR subject_people_count >= 0);

ALTER TABLE public.prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_subject_attempts_range;

ALTER TABLE public.prompt_cards
  ADD CONSTRAINT prompt_cards_subject_attempts_range
  CHECK (subject_attempts >= 0);

COMMENT ON COLUMN public.prompt_cards.subject_audience IS
  'Exclusive who-is-in-frame label from the canonical photo. none = no single catalog subject. NULL = not classified.';
COMMENT ON COLUMN public.prompt_cards.subject_prev_audience IS
  'seo_tags.audience_tag snapshot taken immediately before the first vision merge. Rollback source.';
COMMENT ON COLUMN public.prompt_cards.subject_media_id IS
  'Canonical prompt_card_media id that was classified. A different canonical photo re-queues the card.';

CREATE INDEX IF NOT EXISTS prompt_cards_subject_audience_pending_idx
  ON public.prompt_cards (subject_attempts)
  WHERE is_published = true AND subject_audience IS NULL;

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  ('card_subject_audience_enabled', 'false', now()),
  ('card_subject_audience_daily_limit', '3000', now()),
  ('card_subject_audience_min_confidence', '0.6', now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.card_subject_audience_min_confidence()
RETURNS real
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_min real := 0.6;
BEGIN
  SELECT value INTO v_raw
  FROM public.landing_generation_config
  WHERE key = 'card_subject_audience_min_confidence';

  IF v_raw ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_min := v_raw::real;
  END IF;

  IF v_min < 0 OR v_min > 1 THEN
    v_min := 0.6;
  END IF;

  RETURN v_min;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_subject_audience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exclusive text[] := ARRAY[
    'devushka', 'muzhchina', 'para', 'semya',
    'malchik', 'devochka', 'malysh'
  ];
  v_min real;
  v_in jsonb;
  v_out jsonb := '[]'::jsonb;
  v_elem text;
BEGIN
  IF NEW.subject_audience IS NULL OR NEW.subject_confidence IS NULL THEN
    RETURN NEW;
  END IF;

  v_min := public.card_subject_audience_min_confidence();
  IF NEW.subject_confidence < v_min THEN
    RETURN NEW;
  END IF;

  IF NEW.subject_prev_audience IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.subject_prev_audience := COALESCE(OLD.seo_tags->'audience_tag', '[]'::jsonb);
    ELSE
      NEW.subject_prev_audience := COALESCE(NEW.seo_tags->'audience_tag', '[]'::jsonb);
    END IF;
  END IF;

  v_in := COALESCE(NEW.seo_tags->'audience_tag', '[]'::jsonb);
  IF jsonb_typeof(v_in) IS DISTINCT FROM 'array' THEN
    v_in := '[]'::jsonb;
  END IF;

  IF NEW.subject_audience <> 'none' THEN
    v_out := v_out || to_jsonb(NEW.subject_audience);
  END IF;

  FOR v_elem IN
    SELECT jsonb_array_elements_text(v_in)
  LOOP
    IF v_elem = ANY (v_exclusive) THEN
      CONTINUE;
    END IF;
    IF v_elem = NEW.subject_audience THEN
      CONTINUE;
    END IF;
    v_out := v_out || to_jsonb(v_elem);
  END LOOP;

  IF NEW.seo_tags IS NULL OR jsonb_typeof(NEW.seo_tags) IS DISTINCT FROM 'object' THEN
    NEW.seo_tags := '{}'::jsonb;
  END IF;
  NEW.seo_tags := jsonb_set(NEW.seo_tags, '{audience_tag}', v_out, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prompt_cards_apply_subject_audience ON public.prompt_cards;

CREATE TRIGGER prompt_cards_apply_subject_audience
BEFORE INSERT OR UPDATE OF seo_tags, subject_audience, subject_confidence
ON public.prompt_cards
FOR EACH ROW
EXECUTE FUNCTION public.apply_subject_audience();

COMMENT ON FUNCTION public.apply_subject_audience() IS
  'Project subject_audience into seo_tags.audience_tag: drop the exclusive gender/composition slugs, prepend the vision subject. Skips NULL subject and confidence below card_subject_audience_min_confidence. Idempotent.';

-- Separate bucket from compose_audience_classify_rate_limit_increment.
-- That function also increments the shared "global" key and a 15k backfill
-- would exhaust the compose-picker daily budget.
CREATE OR REPLACE FUNCTION public.card_subject_audience_take_budget(
  p_window_start timestamptz,
  p_max int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := 'card_subject:global';
  v_max int := greatest(coalesce(p_max, 3000), 1);
  v_count int := 0;
  v_window timestamptz;
BEGIN
  INSERT INTO public.compose_audience_classify_rate_limit (bucket_key, window_start, count)
  VALUES (v_key, p_window_start, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT count, window_start
  INTO v_count, v_window
  FROM public.compose_audience_classify_rate_limit
  WHERE bucket_key = v_key
  FOR UPDATE;

  IF v_window < p_window_start THEN
    v_count := 0;
    UPDATE public.compose_audience_classify_rate_limit
    SET window_start = p_window_start, count = 0
    WHERE bucket_key = v_key;
  END IF;

  IF v_count >= v_max THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'max', v_max);
  END IF;

  UPDATE public.compose_audience_classify_rate_limit
  SET count = count + 1
  WHERE bucket_key = v_key
  RETURNING count INTO v_count;

  RETURN jsonb_build_object('allowed', true, 'count', v_count, 'max', v_max);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_subject_audience_batch(
  p_limit int DEFAULT 1,
  p_priority text DEFAULT 'all',
  p_card_id uuid DEFAULT NULL
)
RETURNS TABLE (
  card_id uuid,
  media_id uuid,
  storage_bucket text,
  storage_path text,
  mime_type text,
  current_audience jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := least(500, greatest(1, coalesce(p_limit, 1)));
  v_priority text := lower(btrim(coalesce(p_priority, 'all')));
BEGIN
  IF v_priority NOT IN ('all', 'exclusive', 'visual_hook') THEN
    RAISE EXCEPTION 'invalid_priority: %', p_priority;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT c.id
    FROM public.prompt_cards c
    WHERE c.is_published = true
      AND c.subject_attempts < 3
      AND (p_card_id IS NULL OR c.id = p_card_id)
      AND EXISTS (
        SELECT 1
        FROM public.prompt_card_media m
        WHERE m.card_id = c.id
          AND m.media_type = 'photo'
      )
      AND (
        c.subject_audience IS NULL
        OR c.subject_media_id IS DISTINCT FROM (
          SELECT m2.id
          FROM public.prompt_card_media m2
          WHERE m2.card_id = c.id
            AND m2.media_type = 'photo'
          ORDER BY m2.is_primary DESC, m2.media_index ASC
          LIMIT 1
        )
      )
      AND (
        v_priority <> 'exclusive'
        OR COALESCE(c.seo_tags->'audience_tag', '[]'::jsonb) ?| ARRAY['muzhchina', 'para', 'semya']
      )
      AND (
        v_priority <> 'visual_hook'
        OR COALESCE(c.title_ru, '') LIKE 'Visual Hook%'
      )
    ORDER BY c.subject_attempts ASC, c.source_date DESC NULLS LAST, c.id ASC
    LIMIT v_limit
    FOR UPDATE OF c SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.prompt_cards pc
    SET subject_attempts = pc.subject_attempts + 1
    FROM candidates
    WHERE pc.id = candidates.id
    RETURNING pc.id, pc.seo_tags
  )
  SELECT
    claimed.id,
    canon.id,
    canon.storage_bucket,
    canon.storage_path,
    canon.mime_type,
    COALESCE(claimed.seo_tags->'audience_tag', '[]'::jsonb)
  FROM claimed
  JOIN LATERAL (
    SELECT m.id, m.storage_bucket, m.storage_path, m.mime_type
    FROM public.prompt_card_media m
    WHERE m.card_id = claimed.id
      AND m.media_type = 'photo'
    ORDER BY m.is_primary DESC, m.media_index ASC
    LIMIT 1
  ) canon ON true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_subject_audience(
  p_card_id uuid,
  p_media_id uuid,
  p_audience text,
  p_confidence real,
  p_people_count int,
  p_model text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audience text := btrim(coalesce(p_audience, ''));
  v_updated int;
BEGIN
  IF v_audience NOT IN (
    'devushka', 'muzhchina', 'para', 'semya',
    'malchik', 'devochka', 'malysh', 'none'
  ) THEN
    RETURN false;
  END IF;

  IF p_confidence IS NULL OR p_confidence < 0 OR p_confidence > 1 THEN
    RETURN false;
  END IF;

  IF p_media_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.prompt_card_media m
    WHERE m.id = p_media_id
      AND m.card_id = p_card_id
      AND m.media_type = 'photo'
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.prompt_cards
  SET
    subject_audience = v_audience,
    subject_confidence = p_confidence,
    subject_people_count = CASE
      WHEN p_people_count IS NULL THEN NULL
      WHEN p_people_count < 0 THEN NULL
      ELSE least(p_people_count, 32767)::smallint
    END,
    subject_source = 'vision',
    subject_media_id = p_media_id,
    subject_model = left(coalesce(nullif(btrim(p_model), ''), 'gemini-2.5-flash'), 80),
    subject_classified_at = now(),
    subject_last_error = NULL
  WHERE id = p_card_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_subject_audience(
  p_card_id uuid,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.prompt_cards
  SET subject_last_error = left(coalesce(nullif(btrim(p_error), ''), 'unknown'), 200)
  WHERE id = p_card_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.subject_audience_coverage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min real := public.card_subject_audience_min_confidence();
BEGIN
  RETURN (
    WITH base AS (
      SELECT
        c.subject_audience,
        c.subject_confidence,
        c.subject_attempts
      FROM public.prompt_cards c
      WHERE c.is_published = true
        AND EXISTS (
          SELECT 1
          FROM public.prompt_card_media m
          WHERE m.card_id = c.id
            AND m.media_type = 'photo'
        )
    )
    SELECT jsonb_build_object(
      'published_with_photo', count(*),
      'classified', count(*) FILTER (WHERE subject_audience IS NOT NULL),
      'none', count(*) FILTER (WHERE subject_audience = 'none'),
      'low_confidence', count(*) FILTER (
        WHERE subject_audience IS NOT NULL
          AND subject_confidence IS NOT NULL
          AND subject_confidence < v_min
      ),
      'failed', count(*) FILTER (
        WHERE subject_audience IS NULL AND subject_attempts >= 3
      ),
      'pending', count(*) FILTER (
        WHERE subject_audience IS NULL AND subject_attempts < 3
      ),
      'min_confidence', v_min,
      'by_subject', COALESCE((
        SELECT jsonb_object_agg(subject_audience, n)
        FROM (
          SELECT subject_audience, count(*) AS n
          FROM base
          WHERE subject_audience IS NOT NULL
          GROUP BY subject_audience
        ) grouped
      ), '{}'::jsonb)
    )
    FROM base
  );
END;
$$;

REVOKE ALL ON FUNCTION public.card_subject_audience_min_confidence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_subject_audience() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.card_subject_audience_take_budget(timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_subject_audience_batch(int, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_subject_audience(uuid, uuid, text, real, int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_subject_audience(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subject_audience_coverage() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.card_subject_audience_min_confidence() TO service_role;
GRANT EXECUTE ON FUNCTION public.card_subject_audience_take_budget(timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_subject_audience_batch(int, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_subject_audience(uuid, uuid, text, real, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_subject_audience(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.subject_audience_coverage() TO service_role;

COMMENT ON FUNCTION public.claim_subject_audience_batch(int, text, uuid) IS
  'Lock published cards that still need a subject label. p_priority: all | exclusive (muzhchina|para|semya) | visual_hook. p_card_id limits the claim to one card. Increments subject_attempts.';
