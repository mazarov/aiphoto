-- Auth-scoped preferences for the inline landing generator.
CREATE TABLE IF NOT EXISTS public.landing_generation_preferences (
  auth_user_id uuid PRIMARY KEY,
  model text NOT NULL DEFAULT 'gemini-2.5-flash-image',
  aspect_ratio text NOT NULL DEFAULT '9:16',
  image_size text NOT NULL DEFAULT '1K',
  selected_photo_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_generation_preferences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.landing_generation_preferences IS
  'Server-managed generation choices scoped to the authenticated landing user.';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES
  (
    'models',
    '[
      {"id":"gemini-2.5-flash-image","label":"Nano Banana","cost":1,"enabled":true},
      {"id":"gemini-3-pro-image-preview","label":"Nano Banana PRO","cost":2,"enabled":true},
      {"id":"gemini-3.1-flash-image-preview","label":"Nano Banana 2","cost":3,"enabled":true},
      {"id":"gemini-3.1-flash-lite-image","label":"Nano Banana 2 Lite","cost":1,"enabled":true}
    ]',
    now()
  ),
  ('default_model', 'gemini-2.5-flash-image', now()),
  ('default_aspect_ratio', '9:16', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
