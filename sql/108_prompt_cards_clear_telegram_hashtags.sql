-- ============================================================
-- Clear legacy Telegram hashtags in prompt_cards
-- Strategy update: hashtags are generated only from prompt text
-- ============================================================

UPDATE prompt_cards
SET hashtags = '{}'::text[]
WHERE hashtags IS NULL
   OR array_length(hashtags, 1) IS DISTINCT FROM 0;

