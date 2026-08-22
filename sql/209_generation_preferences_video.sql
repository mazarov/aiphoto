-- Persist last video compose settings with the auth-scoped prefs row.
-- Table may be missing if 173 was skipped (173 also overwrites models config).
-- Do not edit 173. Do not rerun 173 on prod.

CREATE TABLE IF NOT EXISTS public.landing_generation_preferences (
  auth_user_id uuid PRIMARY KEY,
  model text NOT NULL DEFAULT 'gemini-2.5-flash-image',
  aspect_ratio text NOT NULL DEFAULT '9:16',
  image_size text NOT NULL DEFAULT '1K',
  selected_photo_ids uuid[] NOT NULL DEFAULT '{}',
  video_model text NOT NULL DEFAULT 'veo-3.1-lite-generate-preview',
  video_aspect_ratio text NOT NULL DEFAULT '9:16',
  video_duration_seconds integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_generation_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.landing_generation_preferences
  ADD COLUMN IF NOT EXISTS video_model text NOT NULL DEFAULT 'veo-3.1-lite-generate-preview',
  ADD COLUMN IF NOT EXISTS video_aspect_ratio text NOT NULL DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer NOT NULL DEFAULT 4;

COMMENT ON TABLE public.landing_generation_preferences IS
  'Server-managed generation choices scoped to the authenticated landing user.';
COMMENT ON COLUMN public.landing_generation_preferences.video_model IS
  'Last selected video / Оживить model id.';
COMMENT ON COLUMN public.landing_generation_preferences.video_aspect_ratio IS
  'Last selected video aspect ratio (9:16 or 16:9).';
COMMENT ON COLUMN public.landing_generation_preferences.video_duration_seconds IS
  'Last selected video duration in seconds.';
