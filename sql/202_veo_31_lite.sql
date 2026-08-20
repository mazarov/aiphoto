-- Add Veo 3.1 Lite as a cheaper video model. Keep Grok default and Omni enabled.
-- Do not edit 189/200/201.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  (
    'video_models',
    '[{"id":"grok-imagine-video-1.5","label":"Grok 1.5","cost":30,"enabled":true},{"id":"gemini-omni-flash-preview","label":"Veo Omni Flash","cost":30,"enabled":true},{"id":"veo-3.1-lite-generate-preview","label":"Veo 3.1 Lite","cost":15,"enabled":true}]',
    now()
  )
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
