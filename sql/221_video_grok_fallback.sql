-- Video hop: any non-Grok video model → grok-imagine-video-1.5.
-- Kill-switch: empty / false the key, or enabled=false on Grok in video_models.
-- Do not edit 201/202/218/220.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('video_fallback_model', 'grok-imagine-video-1.5', now())
ON CONFLICT (key) DO NOTHING;
