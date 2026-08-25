-- Seedream 4.5 as the hop after Grok on image jobs.
-- Kill-switch: set value to empty / false, or enabled=false on seedream-4.5.
-- Do not edit 204/215/216.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('image_fallback_secondary_model', 'seedream-4.5', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

COMMENT ON COLUMN public.landing_generations.fallback_used IS
  'True when an image job left the user-selected model for Grok and/or Seedream.';
