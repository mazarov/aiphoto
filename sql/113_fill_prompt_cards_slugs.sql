-- ============================================================
-- Fill slug for all prompt_cards where slug IS NULL
-- Slug = transliterated title_ru, lowercased, deduped with suffix
-- ============================================================

-- Step 1: Create a helper function for Cyrillic transliteration
CREATE OR REPLACE FUNCTION translit_ru(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $$
DECLARE
  result text;
BEGIN
  result := lower(input);
  result := replace(result, 'щ', 'shch');
  result := replace(result, 'ш', 'sh');
  result := replace(result, 'ч', 'ch');
  result := replace(result, 'ц', 'ts');
  result := replace(result, 'ж', 'zh');
  result := replace(result, 'ё', 'yo');
  result := replace(result, 'э', 'e');
  result := replace(result, 'ю', 'yu');
  result := replace(result, 'я', 'ya');
  result := replace(result, 'а', 'a');
  result := replace(result, 'б', 'b');
  result := replace(result, 'в', 'v');
  result := replace(result, 'г', 'g');
  result := replace(result, 'д', 'd');
  result := replace(result, 'е', 'e');
  result := replace(result, 'з', 'z');
  result := replace(result, 'и', 'i');
  result := replace(result, 'й', 'y');
  result := replace(result, 'к', 'k');
  result := replace(result, 'л', 'l');
  result := replace(result, 'м', 'm');
  result := replace(result, 'н', 'n');
  result := replace(result, 'о', 'o');
  result := replace(result, 'п', 'p');
  result := replace(result, 'р', 'r');
  result := replace(result, 'с', 's');
  result := replace(result, 'т', 't');
  result := replace(result, 'у', 'u');
  result := replace(result, 'ф', 'f');
  result := replace(result, 'х', 'kh');
  result := replace(result, 'ъ', '');
  result := replace(result, 'ы', 'y');
  result := replace(result, 'ь', '');
  -- Remove anything not alphanumeric, space or dash
  result := regexp_replace(result, '[^a-z0-9 \-]', '', 'g');
  -- Replace spaces/multiple dashes with single dash
  result := regexp_replace(result, '[\s\-]+', '-', 'g');
  -- Trim leading/trailing dashes
  result := trim(both '-' from result);
  -- Limit to 80 chars
  result := left(result, 80);
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

-- Step 2: Fill slugs (with dedup suffix for duplicates)
DO $$
DECLARE
  r RECORD;
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  FOR r IN
    SELECT id, title_ru, card_split_index, card_split_total
    FROM prompt_cards
    WHERE slug IS NULL AND title_ru IS NOT NULL
    ORDER BY source_date DESC NULLS LAST, id ASC
  LOOP
    base_slug := translit_ru(r.title_ru);

    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'promt-' || left(r.id::text, 8);
    END IF;

    -- For split cards, add index suffix
    IF r.card_split_total > 1 THEN
      base_slug := base_slug || '-' || (r.card_split_index + 1);
    END IF;

    -- Check for duplicates, add counter suffix if needed
    final_slug := base_slug;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM prompt_cards WHERE slug = final_slug AND id != r.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;

    UPDATE prompt_cards SET slug = final_slug WHERE id = r.id;
  END LOOP;
END;
$$;
