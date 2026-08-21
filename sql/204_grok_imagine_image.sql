-- Grok Imagine (xAI) as a selectable image model + silent provider fallback.
-- Do not edit 173/177/201. Apply after worker has xai-image + XAI_* env.

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS requested_model text,
  ADD COLUMN IF NOT EXISTS executed_model text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false;

UPDATE public.landing_generations
   SET requested_model = model
 WHERE requested_model IS NULL;

COMMENT ON COLUMN public.landing_generations.requested_model IS
  'User-selected model at enqueue. Unchanged by image provider fallback.';
COMMENT ON COLUMN public.landing_generations.executed_model IS
  'Provider model that produced the result or last attempt.';
COMMENT ON COLUMN public.landing_generations.fallback_used IS
  'True when an image job fell back from another model to Grok Imagine.';

CREATE OR REPLACE FUNCTION public.landing_generations_fill_requested_model()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.requested_model IS NULL OR btrim(NEW.requested_model) = '' THEN
    NEW.requested_model := NEW.model;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_generations_fill_requested_model ON public.landing_generations;
CREATE TRIGGER landing_generations_fill_requested_model
  BEFORE INSERT ON public.landing_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_generations_fill_requested_model();

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('image_fallback_model', 'grok-imagine-image-2.0', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

WITH current_models AS (
  SELECT
    CASE
      WHEN config.value ~ '^\s*\[' THEN config.value::jsonb
      ELSE '[]'::jsonb
    END AS value
  FROM public.landing_generation_config AS config
  WHERE config.key = 'models'
),
updated_models AS (
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(current_models.value) AS model
        WHERE model->>'id' = 'grok-imagine-image-2.0'
      ) THEN current_models.value
      ELSE current_models.value || jsonb_build_array(
        jsonb_build_object(
          'id', 'grok-imagine-image-2.0',
          'label', 'Grok Imagine',
          'cost', 5,
          'enabled', true
        )
      )
    END AS value
  FROM current_models
)
UPDATE public.landing_generation_config AS config
SET value = updated_models.value::text,
    updated_at = now()
FROM updated_models
WHERE config.key = 'models'
  AND updated_models.value IS NOT NULL;
