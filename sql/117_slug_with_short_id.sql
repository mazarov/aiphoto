-- ============================================================
-- Migration 117: add short unique ID to all slugs
-- Format: {transliterated-title}-{5chars-from-uuid}
-- For groups: {title}-{split_index}-{5chars}
-- ============================================================

-- Step 1: Update the trigger to always append short ID
CREATE OR REPLACE FUNCTION trigger_generate_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  short_id text;
  final_slug text;
BEGIN
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.title_ru IS NULL OR NEW.title_ru = '' THEN
    RETURN NEW;
  END IF;

  base_slug := translit_ru(NEW.title_ru);

  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'promt';
  END IF;

  IF NEW.card_split_total > 1 THEN
    base_slug := base_slug || '-' || (NEW.card_split_index + 1);
  END IF;

  short_id := left(replace(NEW.id::text, '-', ''), 5);
  final_slug := base_slug || '-' || short_id;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Step 2: Backfill all existing slugs with short ID
DO $$
DECLARE
  r RECORD;
  new_slug text;
  base text;
  short_id text;
BEGIN
  FOR r IN
    SELECT id, slug, title_ru, card_split_index, card_split_total
    FROM prompt_cards
    WHERE slug IS NOT NULL
    ORDER BY source_date DESC NULLS LAST, id ASC
  LOOP
    short_id := left(replace(r.id::text, '-', ''), 5);

    -- Skip if slug already ends with short_id
    IF r.slug LIKE '%-' || short_id THEN
      CONTINUE;
    END IF;

    base := translit_ru(r.title_ru);
    IF base = '' OR base IS NULL THEN
      base := 'promt';
    END IF;

    IF r.card_split_total > 1 THEN
      base := base || '-' || (r.card_split_index + 1);
    END IF;

    new_slug := base || '-' || short_id;

    UPDATE prompt_cards SET slug = new_slug WHERE id = r.id;
  END LOOP;
END;
$$;
