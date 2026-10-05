-- GPT Image 2.5 Flare (OpenAI via OpenRouter) as a picker model and the default sticker model.
-- Only image model with a real alpha channel (`background: transparent`) — sticker jobs skip chroma key / rembg.
-- Credits: 5 (code SSOT `GPT_IMAGE_25_FLARE_CREDIT_COST`; the jsonb `cost` is informational).
-- Rollback: UPDATE landing_generation_config SET value = '<previous model id>' WHERE key = 'sticker_model';
-- Do not edit 262–265.

-- 1. Picker model list.
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
        WHERE model->>'id' = 'gpt-image-2.5-flare'
      ) THEN (
        SELECT jsonb_agg(
          CASE
            WHEN model.value->>'id' = 'gpt-image-2.5-flare'
              THEN model.value || jsonb_build_object('enabled', true, 'cost', 5)
            ELSE model.value
          END
          ORDER BY model.ordinality
        )
        FROM jsonb_array_elements(current_models.value)
          WITH ORDINALITY AS model(value, ordinality)
      )
      ELSE current_models.value || jsonb_build_array(
        jsonb_build_object(
          'id', 'gpt-image-2.5-flare',
          'label', 'GPT Image 2.5',
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

-- 2. Sticker model + GPT Image rendering tier for sticker jobs.
INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('sticker_model', 'gpt-image-2.5-flare', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- low | medium | high. Missing row → medium (worker default).
INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('sticker_image_quality', 'medium', now())
ON CONFLICT (key) DO NOTHING;

-- 3. Live P&L unit cost: 1K medium edit ≈ $0.022 (1 024 image-in + ~100 text-in + 439 image-out tokens).
UPDATE public.landing_generation_config AS config
SET value = (
      CASE WHEN config.value ~ '^\s*\{' THEN config.value::jsonb ELSE '{}'::jsonb END
      || '{"gpt-image-2.5-flare": {"perImage": {"1K": 0.022}}}'::jsonb
    )::text,
    updated_at = now()
WHERE config.key = 'finance_model_unit_costs'
  AND NOT (
    CASE WHEN config.value ~ '^\s*\{' THEN config.value::jsonb ELSE '{}'::jsonb END
    ? 'gpt-image-2.5-flare'
  );
