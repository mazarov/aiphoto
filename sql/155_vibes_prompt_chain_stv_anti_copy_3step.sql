-- Allow STV 3-step anti-copy pipeline rows (see docs/24-03-stv-three-step-style-prompt-pipeline.md).
ALTER TABLE public.vibes DROP CONSTRAINT IF EXISTS vibes_prompt_chain_check;
ALTER TABLE public.vibes
  ADD CONSTRAINT vibes_prompt_chain_check CHECK (
    prompt_chain IN ('modern', 'legacy_2c23', 'stv_anti_copy_3step')
  );

COMMENT ON COLUMN public.vibes.prompt_chain IS
  'modern = historical; legacy_2c23 = 8-field extract + deterministic expand; stv_anti_copy_3step = 3-LLM anti-copy style pipeline when photo_app_config.vibe_stv_anti_copy_3step is true.';
