-- Card reactions (like/dislike)
CREATE TABLE IF NOT EXISTS card_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);

CREATE INDEX idx_card_reactions_card_id ON card_reactions(card_id);
CREATE INDEX idx_card_reactions_user_id ON card_reactions(user_id);

ALTER TABLE card_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions (for counts)
CREATE POLICY "Anyone can read reactions"
  ON card_reactions FOR SELECT
  USING (true);

-- Users can insert their own reactions
CREATE POLICY "Users insert own reactions"
  ON card_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reactions
CREATE POLICY "Users update own reactions"
  ON card_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users delete own reactions"
  ON card_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Denormalized counts on prompt_cards
ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes_count integer NOT NULL DEFAULT 0;

-- Trigger to maintain counts
CREATE OR REPLACE FUNCTION update_card_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_card_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_card_id := OLD.card_id;
  ELSE
    target_card_id := NEW.card_id;
  END IF;

  -- Also update old card_id on UPDATE if card changed (shouldn't happen with UNIQUE but safe)
  IF TG_OP = 'UPDATE' AND OLD.card_id IS DISTINCT FROM NEW.card_id THEN
    UPDATE prompt_cards SET
      likes_count = (SELECT count(*) FROM card_reactions WHERE card_id = OLD.card_id AND reaction = 'like'),
      dislikes_count = (SELECT count(*) FROM card_reactions WHERE card_id = OLD.card_id AND reaction = 'dislike')
    WHERE id = OLD.card_id;
  END IF;

  UPDATE prompt_cards SET
    likes_count = (SELECT count(*) FROM card_reactions WHERE card_id = target_card_id AND reaction = 'like'),
    dislikes_count = (SELECT count(*) FROM card_reactions WHERE card_id = target_card_id AND reaction = 'dislike')
  WHERE id = target_card_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_card_reactions_counts ON card_reactions;
CREATE TRIGGER trg_card_reactions_counts
  AFTER INSERT OR UPDATE OR DELETE ON card_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_card_reaction_counts();
