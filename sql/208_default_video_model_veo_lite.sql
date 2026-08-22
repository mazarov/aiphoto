-- Default «Оживить» model: Veo 3.1 Lite.
-- Do not edit 189/201/202.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('default_video_model', 'veo-3.1-lite-generate-preview', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
