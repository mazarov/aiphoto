-- Add Grok Imagine Video 1.5 as default video model; keep Veo Omni Flash enabled.
-- Apply after worker has XAI_BASE_URL + XAI_API_KEY. Do not edit 189/200.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  (
    'video_models',
    '[{"id":"grok-imagine-video-1.5","label":"Grok 1.5","cost":30,"enabled":true},{"id":"gemini-omni-flash-preview","label":"Veo Omni Flash","cost":30,"enabled":true}]',
    now()
  ),
  ('default_video_model', 'grok-imagine-video-1.5', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
