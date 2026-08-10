-- Align PromptShot generation costs with the paid token economy.
-- Keep labels, enabled flags, ordering, and any future model fields intact.

WITH updated_models AS (
  SELECT jsonb_agg(
    CASE model.value->>'id'
      WHEN 'gemini-2.5-flash-image'
        THEN model.value || jsonb_build_object('cost', 5)
      WHEN 'gemini-3.1-flash-lite-image'
        THEN model.value || jsonb_build_object('cost', 5)
      WHEN 'gemini-3-pro-image-preview'
        THEN model.value || jsonb_build_object('cost', 10)
      WHEN 'gemini-3.1-flash-image-preview'
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

COMMENT ON TABLE public.landing_generation_config IS
  'Runtime web-generation settings; model costs are paid PromptShot credits.';
