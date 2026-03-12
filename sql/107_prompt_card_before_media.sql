-- ============================================================
-- Prompt card before media (0..1 per card)
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_card_before_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL UNIQUE REFERENCES prompt_cards(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'prompt-images',
  storage_path text NOT NULL,
  original_relative_path text,
  mime_type text,
  file_size_bytes bigint,
  source_rule text NOT NULL DEFAULT 'fallback_last_photo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_prompt_card_before_media_card
  ON prompt_card_before_media(card_id);

