-- Web generation results
CREATE TABLE landing_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status: pending → processing → completed | failed
  status text NOT NULL DEFAULT 'pending',

  -- What we generated
  card_id uuid REFERENCES prompt_cards(id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  model text NOT NULL,
  aspect_ratio text NOT NULL DEFAULT '1:1',
  image_size text NOT NULL DEFAULT '1K',
  credits_spent int NOT NULL DEFAULT 1,

  -- Input photos (paths in Supabase Storage)
  input_photo_paths text[] NOT NULL DEFAULT '{}',

  -- Result
  result_storage_bucket text,
  result_storage_path text,

  -- Errors
  error_message text,
  error_type text,

  -- Timing
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_gen_user
  ON landing_generations(user_id, created_at DESC);

CREATE INDEX idx_landing_gen_pending
  ON landing_generations(status)
  WHERE status IN ('pending', 'processing');

ALTER TABLE landing_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own generations"
  ON landing_generations FOR SELECT
  USING (auth.uid() = user_id);
