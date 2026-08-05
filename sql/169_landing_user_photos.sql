-- Persistent per-user photo library for inline landing generation.
CREATE TABLE IF NOT EXISTS public.landing_user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  original_filename text,
  byte_size integer,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landing_user_photos_owner_created_idx
  ON public.landing_user_photos (auth_user_id, created_at DESC);

ALTER TABLE public.landing_user_photos ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.landing_user_photos IS
  'Private uploaded-photo library. Access is server-side only and scoped by authenticated JWT user id.';

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('max_photos', '10', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
