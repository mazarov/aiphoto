-- Grok Imagine image: 5 → 10 PromptShot credits.
-- Do not edit 177/204.

WITH updated_models AS (
  SELECT jsonb_agg(
    CASE
      WHEN model.value->>'id' = 'grok-imagine-image-2.0'
        THEN model.value || jsonb_build_object('cost', 10)
      ELSE model.value
    END
    ORDER BY model.ordinality
  ) AS value
  FROM public.landing_generation_config AS config
  CROSS JOIN LATERAL jsonb_array_elements(config.value::jsonb)
    WITH ORDINALITY AS model(value, ordinality)
  WHERE config.key = 'models'
)
UPDATE public.landing_generation_config AS config
SET value = updated_models.value::text,
    updated_at = now()
FROM updated_models
WHERE config.key = 'models'
  AND updated_models.value IS NOT NULL;
