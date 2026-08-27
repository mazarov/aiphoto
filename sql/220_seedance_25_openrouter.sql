-- Seedance 2.5 via OpenRouter Video API. Hidden until smoke.
-- Do not edit 201/202/208.

WITH current_models AS (
  SELECT
    CASE
      WHEN config.value ~ '^\s*\[' THEN config.value::jsonb
      ELSE '[]'::jsonb
    END AS value
  FROM public.landing_generation_config AS config
  WHERE config.key = 'video_models'
),
updated_models AS (
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(current_models.value) AS model
        WHERE model->>'id' = 'seedance-2.5'
      ) THEN (
        SELECT jsonb_agg(
          CASE
            WHEN model.value->>'id' = 'seedance-2.5'
              THEN model.value || jsonb_build_object(
                'label', 'Seedance 2.5',
                'cost', 96,
                'enabled', false
              )
            ELSE model.value
          END
          ORDER BY model.ordinality
        )
        FROM jsonb_array_elements(current_models.value)
          WITH ORDINALITY AS model(value, ordinality)
      )
      ELSE current_models.value || jsonb_build_array(
        jsonb_build_object(
          'id', 'seedance-2.5',
          'label', 'Seedance 2.5',
          'cost', 96,
          'enabled', false
        )
      )
    END AS value
  FROM current_models
)
UPDATE public.landing_generation_config AS config
SET value = updated_models.value::text,
    updated_at = now()
FROM updated_models
WHERE config.key = 'video_models'
  AND updated_models.value IS NOT NULL;
