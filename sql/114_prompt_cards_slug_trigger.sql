-- ============================================================
-- Trigger: auto-generate slug on INSERT/UPDATE if slug IS NULL
-- Uses translit_ru() from migration 113
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_generate_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  -- Only act when slug is NULL and title_ru is present
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.title_ru IS NULL OR NEW.title_ru = '' THEN
    RETURN NEW;
  END IF;

  base_slug := translit_ru(NEW.title_ru);

  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'promt-' || left(NEW.id::text, 8);
  END IF;

  IF NEW.card_split_total > 1 THEN
    base_slug := base_slug || '-' || (NEW.card_split_index + 1);
  END IF;

  final_slug := base_slug;
  counter := 1;
  WHILE EXISTS (SELECT 1 FROM prompt_cards WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prompt_cards_auto_slug ON prompt_cards;

CREATE TRIGGER trg_prompt_cards_auto_slug
  BEFORE INSERT OR UPDATE ON prompt_cards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_slug();
