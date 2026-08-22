-- Persist last video compose settings with the existing auth-scoped prefs row.
-- Do not edit 173.

ALTER TABLE public.landing_generation_preferences
  ADD COLUMN IF NOT EXISTS video_model text NOT NULL DEFAULT 'veo-3.1-lite-generate-preview',
  ADD COLUMN IF NOT EXISTS video_aspect_ratio text NOT NULL DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer NOT NULL DEFAULT 4;

COMMENT ON COLUMN public.landing_generation_preferences.video_model IS
  'Last selected video / Оживить model id.';
COMMENT ON COLUMN public.landing_generation_preferences.video_aspect_ratio IS
  'Last selected video aspect ratio (9:16 or 16:9).';
COMMENT ON COLUMN public.landing_generation_preferences.video_duration_seconds IS
  'Last selected video duration in seconds.';
