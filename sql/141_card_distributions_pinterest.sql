-- ============================================================
-- Card distributions tracking + Pinterest board_id on clusters
-- For pinterest distribution pipeline (docs/15-03-pinterest-distribution.md)
-- ============================================================

CREATE TABLE IF NOT EXISTS card_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_id text,
  board_id text,
  status text NOT NULL DEFAULT 'pending',
  published_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_card_distributions_status
  ON card_distributions(status) WHERE status = 'failed';

ALTER TABLE prompt_clusters
  ADD COLUMN IF NOT EXISTS pinterest_board_id text;
