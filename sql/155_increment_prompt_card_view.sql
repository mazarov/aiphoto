-- Increment prompt_cards.view_count for a published card by URL slug (card page beacon).
-- Called from landing POST /api/card-view via service role.

CREATE OR REPLACE FUNCTION increment_prompt_card_view(p_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_count bigint;
BEGIN
  v_slug := nullif(trim(p_slug), '');
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE prompt_cards
  SET view_count = view_count + 1
  WHERE slug = v_slug AND is_published = true
  RETURNING view_count INTO v_count;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION increment_prompt_card_view(text) IS
  'Atomically increments view_count for published prompt_cards row matching slug; returns new count or NULL if no row.';

-- Do not expose to PostgREST anon/authenticated; landing uses service_role only.
REVOKE ALL ON FUNCTION increment_prompt_card_view(text) FROM PUBLIC;
