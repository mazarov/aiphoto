-- Flip Seedream 4.5 on after OpenRouter proxy + worker env.
-- Do not edit 215. If the model row is missing, insert it enabled.

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
        WHERE model->>'id' = 'seedream-4.5'
      ) THEN (
        SELECT jsonb_agg(
          CASE
            WHEN model.value->>'id' = 'seedream-4.5'
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
          'id', 'seedream-4.5',
          'label', 'Seedream 4.5',
          'cost', 10,
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
