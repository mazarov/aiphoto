-- ============================================================
-- Migration 143:
-- 1) Add DE localized title for prompt cards
-- 2) Add transactional RPC to update localized titles + slug
--    and upsert 301 redirect old_slug -> new_slug
-- ============================================================

ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS title_de text;

CREATE TABLE IF NOT EXISTS slug_redirects (
  old_slug   text PRIMARY KEY,
  new_slug   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_new_slug
  ON slug_redirects(new_slug);

ALTER TABLE slug_redirects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'slug_redirects'
      AND policyname = 'anon_read_slug_redirects'
  ) THEN
    CREATE POLICY "anon_read_slug_redirects"
      ON slug_redirects FOR SELECT USING (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION upsert_card_titles_and_slug(
  p_card_id uuid,
  p_title_ru text,
  p_title_en text,
  p_title_de text,
  p_new_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_slug text;
BEGIN
  SELECT slug
    INTO v_old_slug
  FROM prompt_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'prompt_cards row not found for id=%', p_card_id;
  END IF;

  UPDATE prompt_cards
  SET
    title_ru = p_title_ru,
    title_en = p_title_en,
    title_de = p_title_de,
    slug = p_new_slug,
    updated_at = now()
  WHERE id = p_card_id;

  IF v_old_slug IS NOT NULL AND v_old_slug IS DISTINCT FROM p_new_slug THEN
    INSERT INTO slug_redirects (old_slug, new_slug, created_at)
    VALUES (v_old_slug, p_new_slug, now())
    ON CONFLICT (old_slug)
    DO UPDATE SET
      new_slug = EXCLUDED.new_slug,
      created_at = now();
  END IF;
END;
$$;
