-- Curated hero membership for prompt-card marquees.
-- Row presence is manual (plus a one-time popularity seed). Display order is
-- popularity_score at read time, so this table has no position column.
-- Service role only: no anon/authenticated policies.

CREATE TABLE IF NOT EXISTS public.page_hero_cards (
  page_path text NOT NULL CHECK (
    char_length(page_path) BETWEEN 1 AND 200
    AND page_path LIKE '/%'
    AND position(' ' in page_path) = 0
  ),
  card_id uuid NOT NULL REFERENCES public.prompt_cards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_path, card_id)
);

CREATE INDEX IF NOT EXISTS page_hero_cards_card_id_idx
  ON public.page_hero_cards (card_id);

ALTER TABLE public.page_hero_cards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.page_hero_cards FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.page_hero_cards TO service_role;
