-- ============================================================
-- Migration 129: Backfill short-id into slugs + redirect table
--
-- Cards ingested before migration 117 have slugs without the
-- 5-char hex suffix (e.g. "muzhchina-v-snegu" instead of
-- "muzhchina-v-snegu-a1b2c"). This migration:
--   1. Creates slug_redirects table for 301 lookups
--   2. Updates all slugs missing short-id, recording old→new
-- ============================================================

-- Step 1: Redirect lookup table
CREATE TABLE IF NOT EXISTS slug_redirects (
  old_slug   text PRIMARY KEY,
  new_slug   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_new_slug
  ON slug_redirects(new_slug);

ALTER TABLE slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_slug_redirects"
  ON slug_redirects FOR SELECT USING (true);

-- Step 2: Backfill slugs and populate redirects
DO $$
DECLARE
  r       RECORD;
  new_slug text;
  base     text;
  short_id text;
BEGIN
  FOR r IN
    SELECT id, slug, title_ru, card_split_index, card_split_total
    FROM prompt_cards
    WHERE slug IS NOT NULL
    ORDER BY source_date DESC NULLS LAST, id ASC
  LOOP
    short_id := left(replace(r.id::text, '-', ''), 5);

    -- Already has short-id suffix → skip
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

    -- Record redirect old → new
    INSERT INTO slug_redirects (old_slug, new_slug)
    VALUES (r.slug, new_slug)
    ON CONFLICT (old_slug) DO NOTHING;

    -- Update the card (trigger won't interfere: NEW.slug IS NOT NULL → passthrough)
    UPDATE prompt_cards SET slug = new_slug WHERE id = r.id;
  END LOOP;
END;
$$;
