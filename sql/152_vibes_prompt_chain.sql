-- Marks which prompt pipeline created the vibe (modern vs legacy 2c23ce94 chain).
ALTER TABLE public.vibes
  ADD COLUMN IF NOT EXISTS prompt_chain text NOT NULL DEFAULT 'modern';

COMMENT ON COLUMN public.vibes.prompt_chain IS
  'modern = current extract/expand; legacy_2c23 = 8-field extract + 3-accent expand + merge (see docs/22-03-stv-single-generation-flow.md).';

ALTER TABLE public.vibes DROP CONSTRAINT IF EXISTS vibes_prompt_chain_check;
ALTER TABLE public.vibes
  ADD CONSTRAINT vibes_prompt_chain_check CHECK (prompt_chain IN ('modern', 'legacy_2c23'));
