-- Seedream 5.0 Pro + Flux 2 Flex via OpenRouter, both enabled.
-- Switch image fallback secondary from Seedream 4.5 to Seedream 5.0 Pro.
-- Do not edit 215/216/217.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('image_fallback_secondary_model', 'seedream-5.0-pro', now())
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
with_seedream AS (
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(current_models.value) AS model
        WHERE model->>'id' = 'seedream-5.0-pro'
      ) THEN (
        SELECT jsonb_agg(
          CASE
            WHEN model.value->>'id' = 'seedream-5.0-pro'
              THEN model.value || jsonb_build_object('enabled', true, 'cost', 10)
            ELSE model.value
          END
          ORDER BY model.ordinality
        )
        FROM jsonb_array_elements(current_models.value)
          WITH ORDINALITY AS model(value, ordinality)
      )
      ELSE current_models.value || jsonb_build_array(
        jsonb_build_object(
          'id', 'seedream-5.0-pro',
          'label', 'Seedream 5.0 Pro',
          'cost', 10,
          'enabled', true
        )
      )
    END AS value
  FROM current_models
),
updated_models AS (
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(with_seedream.value) AS model
        WHERE model->>'id' = 'flux-2-flex'
      ) THEN (
        SELECT jsonb_agg(
          CASE
            WHEN model.value->>'id' = 'flux-2-flex'
              THEN model.value || jsonb_build_object('enabled', true, 'cost', 10)
            ELSE model.value
          END
          ORDER BY model.ordinality
        )
        FROM jsonb_array_elements(with_seedream.value)
          WITH ORDINALITY AS model(value, ordinality)
      )
      ELSE with_seedream.value || jsonb_build_array(
        jsonb_build_object(
          'id', 'flux-2-flex',
          'label', 'Flux 2 Flex',
          'cost', 10,
          'enabled', true
        )
      )
    END AS value
  FROM with_seedream
)
UPDATE public.landing_generation_config AS config
SET value = updated_models.value::text,
    updated_at = now()
FROM updated_models
WHERE config.key = 'models'
  AND updated_models.value IS NOT NULL;
