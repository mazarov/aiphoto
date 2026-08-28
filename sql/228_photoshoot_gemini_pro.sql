-- Photoshoot I2I uses Gemini 3 Pro Image (Nano Banana PRO), not Seedream.
-- Do not edit 224 / 227.

UPDATE public.landing_generation_config
SET value = 'gemini-3-pro-image-preview',
    updated_at = now()
WHERE key = 'photoshoot_model';
