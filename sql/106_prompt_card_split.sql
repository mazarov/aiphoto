-- ============================================================
-- Prompt Cards split support:
-- allow multiple cards per same source_message_id
-- ============================================================

ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS card_split_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_split_total int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS split_strategy text NOT NULL DEFAULT 'single_card';

UPDATE prompt_cards
SET
  card_split_index = COALESCE(card_split_index, 0),
  card_split_total = COALESCE(card_split_total, 1),
  split_strategy = COALESCE(split_strategy, 'single_card')
WHERE card_split_index IS NULL OR card_split_total IS NULL OR split_strategy IS NULL;

ALTER TABLE prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_source_group_id_key;

ALTER TABLE prompt_cards
  DROP CONSTRAINT IF EXISTS prompt_cards_source_dataset_slug_source_message_id_key;

ALTER TABLE prompt_cards
  ADD CONSTRAINT prompt_cards_source_dataset_source_message_split_unique
    UNIQUE (source_dataset_slug, source_message_id, card_split_index);

ALTER TABLE prompt_cards
  ADD CONSTRAINT prompt_cards_split_total_check
    CHECK (card_split_total >= 1);

ALTER TABLE prompt_cards
  ADD CONSTRAINT prompt_cards_split_index_check
    CHECK (card_split_index >= 0 AND card_split_index < card_split_total);

CREATE INDEX IF NOT EXISTS idx_prompt_cards_source_key
  ON prompt_cards(source_dataset_slug, source_message_id, card_split_index);

