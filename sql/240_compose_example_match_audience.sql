-- Compose example picker: match catalog by who is in the identity photo.
-- Audience tag cache on library photos + feature flag + dedicated Gemini budget.
-- Do not reuse visual_search_rate_limit / SEARCH_VISUAL_* env.

ALTER TABLE public.landing_user_photos
  ADD COLUMN IF NOT EXISTS audience_tag text;

ALTER TABLE public.landing_user_photos
  ADD COLUMN IF NOT EXISTS audience_confidence real;

ALTER TABLE public.landing_user_photos
  ADD COLUMN IF NOT EXISTS audience_tagged_at timestamptz;

ALTER TABLE public.landing_user_photos
  DROP CONSTRAINT IF EXISTS landing_user_photos_audience_tag_valid;

ALTER TABLE public.landing_user_photos
  ADD CONSTRAINT landing_user_photos_audience_tag_valid
  CHECK (
    audience_tag IS NULL
    OR audience_tag IN ('devushka', 'muzhchina', 'para', 'semya')
  );

COMMENT ON COLUMN public.landing_user_photos.audience_tag IS
  'Cached compose-example audience for listing filter. Not a face embedding.';
COMMENT ON COLUMN public.landing_user_photos.audience_confidence IS
  'Model confidence 0..1 when audience_tag was last written.';
COMMENT ON COLUMN public.landing_user_photos.audience_tagged_at IS
  'When audience_tag was last classified or confirmed from cache.';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  ('compose_example_match_enabled', 'false', now()),
  ('compose_example_match_ip_daily_limit', '40', now()),
  ('compose_example_match_global_daily_limit', '4000', now())
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.compose_audience_classify_rate_limit (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0)
);

CREATE INDEX IF NOT EXISTS compose_audience_classify_rate_limit_window_idx
  ON public.compose_audience_classify_rate_limit (window_start);

ALTER TABLE public.compose_audience_classify_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.compose_audience_classify_rate_limit_increment(
  p_ip_hash text,
  p_window_start timestamptz,
  p_ip_max int DEFAULT 40,
  p_global_max int DEFAULT 4000,
  p_user_key text DEFAULT NULL,
  p_user_max int DEFAULT 80
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text := left(coalesce(nullif(btrim(p_ip_hash), ''), 'unknown'), 128);
  v_user text := left(coalesce(nullif(btrim(p_user_key), ''), ''), 128);
  v_ip_max int := greatest(p_ip_max, 1);
  v_global_max int := greatest(p_global_max, 1);
  v_user_max int := greatest(p_user_max, 1);
  v_global_key text := 'global';
  v_ip_count int := 0;
  v_global_count int := 0;
  v_user_count int := 0;
  v_ip_window timestamptz;
  v_global_window timestamptz;
  v_user_window timestamptz;
BEGIN
  INSERT INTO public.compose_audience_classify_rate_limit (bucket_key, window_start, count)
  VALUES (v_global_key, p_window_start, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  INSERT INTO public.compose_audience_classify_rate_limit (bucket_key, window_start, count)
  VALUES (v_ip, p_window_start, 0)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT count, window_start
  INTO v_global_count, v_global_window
  FROM public.compose_audience_classify_rate_limit
  WHERE bucket_key = v_global_key
  FOR UPDATE;

  SELECT count, window_start
  INTO v_ip_count, v_ip_window
  FROM public.compose_audience_classify_rate_limit
  WHERE bucket_key = v_ip
  FOR UPDATE;

  IF v_user <> '' THEN
    INSERT INTO public.compose_audience_classify_rate_limit (bucket_key, window_start, count)
    VALUES (v_user, p_window_start, 0)
    ON CONFLICT (bucket_key) DO NOTHING;

    SELECT count, window_start
    INTO v_user_count, v_user_window
    FROM public.compose_audience_classify_rate_limit
    WHERE bucket_key = v_user
    FOR UPDATE;
  END IF;

  IF v_global_window < p_window_start THEN
    v_global_count := 0;
    UPDATE public.compose_audience_classify_rate_limit
    SET window_start = p_window_start, count = 0
    WHERE bucket_key = v_global_key;
  END IF;

  IF v_ip_window < p_window_start THEN
    v_ip_count := 0;
    UPDATE public.compose_audience_classify_rate_limit
    SET window_start = p_window_start, count = 0
    WHERE bucket_key = v_ip;
  END IF;

  IF v_user <> '' AND v_user_window < p_window_start THEN
    v_user_count := 0;
    UPDATE public.compose_audience_classify_rate_limit
    SET window_start = p_window_start, count = 0
    WHERE bucket_key = v_user;
  END IF;

  IF v_ip_count >= v_ip_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'ip',
      'ip_count', v_ip_count,
      'global_count', v_global_count,
      'user_count', v_user_count
    );
  END IF;

  IF v_global_count >= v_global_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'global',
      'ip_count', v_ip_count,
      'global_count', v_global_count,
      'user_count', v_user_count
    );
  END IF;

  IF v_user <> '' AND v_user_count >= v_user_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'user',
      'ip_count', v_ip_count,
      'global_count', v_global_count,
      'user_count', v_user_count
    );
  END IF;

  UPDATE public.compose_audience_classify_rate_limit
  SET count = count + 1
  WHERE bucket_key = v_global_key
  RETURNING count INTO v_global_count;

  UPDATE public.compose_audience_classify_rate_limit
  SET count = count + 1
  WHERE bucket_key = v_ip
  RETURNING count INTO v_ip_count;

  IF v_user <> '' THEN
    UPDATE public.compose_audience_classify_rate_limit
    SET count = count + 1
    WHERE bucket_key = v_user
    RETURNING count INTO v_user_count;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'ip_count', v_ip_count,
    'global_count', v_global_count,
    'user_count', v_user_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compose_audience_classify_rate_limit_increment(
  text, timestamptz, int, int, text, int
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compose_audience_classify_rate_limit_increment(
  text, timestamptz, int, int, text, int
) TO service_role;

COMMENT ON FUNCTION public.compose_audience_classify_rate_limit_increment(
  text, timestamptz, int, int, text, int
) IS
  'Daily Gemini budget for compose audience classify. Separate from visual_search_rate_limit.';
