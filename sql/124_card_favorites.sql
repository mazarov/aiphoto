-- Card favorites (bookmarks)
CREATE TABLE IF NOT EXISTS card_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);

CREATE INDEX idx_card_favorites_user_id ON card_favorites(user_id);
CREATE INDEX idx_card_favorites_card_id ON card_favorites(card_id);

ALTER TABLE card_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read only their own favorites
CREATE POLICY "Users read own favorites"
  ON card_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users insert own favorites"
  ON card_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users delete own favorites"
  ON card_favorites FOR DELETE
  USING (auth.uid() = user_id);
