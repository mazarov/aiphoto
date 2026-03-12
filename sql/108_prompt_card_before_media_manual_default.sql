-- Set manual default for before-media source rule
ALTER TABLE prompt_card_before_media
  ALTER COLUMN source_rule SET DEFAULT 'manual_admin';

