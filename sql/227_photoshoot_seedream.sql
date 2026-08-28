-- Photoshoot I2I uses Seedream 5.0 Pro (picker Seedream), not Grok.
-- Do not edit 224.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('photoshoot_model', 'seedream-5.0-pro', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
