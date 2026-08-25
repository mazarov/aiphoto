-- Seedream 4.5 via Replicate. Append to picker JSON, keep disabled until
-- DO /u/ allowlist + REPLICATE_* env are live. Do not edit 204/207.
-- Flip: set enabled=true on the seedream-4.5 object after smoke.

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
      ) THEN current_models.value
      ELSE current_models.value || jsonb_build_array(
        jsonb_build_object(
          'id', 'seedream-4.5',
          'label', 'Seedream 4.5',
          'cost', 10,
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
WHERE config.key = 'models'
  AND updated_models.value IS NOT NULL;
