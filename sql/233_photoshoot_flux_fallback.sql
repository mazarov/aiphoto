-- Photoshoot I2I: if photoshoot_model fails (incl. Seedream safety_block),
-- the same attempt hops once to Flux 2 Flex. Kill-switch: empty / false.
-- Do not edit 224 / 227 / 228.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('photoshoot_fallback_model', 'flux-2-flex', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
