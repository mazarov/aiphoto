-- UGC: link prompt_cards to auth user; link landing_generations to user's card

ALTER TABLE public.prompt_cards
  ADD COLUMN IF NOT EXISTS author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_cards_author_user_id
  ON public.prompt_cards(author_user_id)
  WHERE author_user_id IS NOT NULL;

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS ugc_card_id uuid REFERENCES public.prompt_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_landing_gen_ugc_card
  ON public.landing_generations(ugc_card_id)
  WHERE ugc_card_id IS NOT NULL;
