-- ============================================================
-- Migration 121: Include prompt texts in FTS (denormalization)
--
-- Replaces GENERATED ALWAYS AS fts column with a trigger-maintained
-- tsvector that covers title_ru (A), title_en (B), and all
-- prompt_variants.prompt_text_ru (C) for the card.
-- ============================================================

-- 1. Drop the GENERATED column and recreate as plain column
ALTER TABLE prompt_cards DROP COLUMN IF EXISTS fts;
ALTER TABLE prompt_cards ADD COLUMN fts tsvector;

-- 2. Rebuild GIN index
DROP INDEX IF EXISTS idx_cards_fts;
CREATE INDEX idx_cards_fts ON prompt_cards USING GIN(fts);

-- 3. Function that computes the tsvector for a given card
CREATE OR REPLACE FUNCTION rebuild_card_fts(p_card_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_title_ru  text;
  v_title_en  text;
  v_prompts   text;
BEGIN
  SELECT c.title_ru, c.title_en
    INTO v_title_ru, v_title_en
    FROM prompt_cards c
   WHERE c.id = p_card_id;

  SELECT string_agg(v.prompt_text_ru, ' ')
    INTO v_prompts
    FROM prompt_variants v
   WHERE v.card_id = p_card_id
     AND v.prompt_text_ru IS NOT NULL
     AND v.prompt_text_ru != '';

  UPDATE prompt_cards
     SET fts =
       setweight(to_tsvector('russian', coalesce(v_title_ru, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(v_title_en, '')), 'B') ||
       setweight(to_tsvector('russian', coalesce(v_prompts, '')), 'C')
   WHERE id = p_card_id;
END;
$$;

-- 4. Trigger on prompt_cards (title changes)
CREATE OR REPLACE FUNCTION trg_card_fts_on_card()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM rebuild_card_fts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rebuild_fts_on_card ON prompt_cards;
CREATE TRIGGER trg_rebuild_fts_on_card
  AFTER INSERT OR UPDATE OF title_ru, title_en
  ON prompt_cards
  FOR EACH ROW
  EXECUTE FUNCTION trg_card_fts_on_card();

-- 5. Trigger on prompt_variants (prompt text changes)
CREATE OR REPLACE FUNCTION trg_card_fts_on_variant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM rebuild_card_fts(OLD.card_id);
  ELSE
    PERFORM rebuild_card_fts(NEW.card_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rebuild_fts_on_variant ON prompt_variants;
CREATE TRIGGER trg_rebuild_fts_on_variant
  AFTER INSERT OR UPDATE OF prompt_text_ru OR DELETE
  ON prompt_variants
  FOR EACH ROW
  EXECUTE FUNCTION trg_card_fts_on_variant();

-- 6. Backfill: rebuild fts for all existing cards
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM prompt_cards LOOP
    PERFORM rebuild_card_fts(r.id);
  END LOOP;
END;
$$;
