-- Split scene vs reference grooming for assemble-prompt (extension checkboxes) without re-running LLM.
ALTER TABLE public.vibes
  ADD COLUMN IF NOT EXISTS prompt_scene_core text,
  ADD COLUMN IF NOT EXISTS grooming_reference jsonb,
  ADD COLUMN IF NOT EXISTS last_monolithic_prompt text;

COMMENT ON COLUMN public.vibes.prompt_scene_core IS
  'Scene prompt body without detachable grooming blocks; used with grooming_reference for POST /api/vibe/assemble-prompt.';

COMMENT ON COLUMN public.vibes.grooming_reference IS
  'JSON {"hair": string, "makeup": string} extracted with scene; optional extra keys ignored by v1 assemble.';

COMMENT ON COLUMN public.vibes.last_monolithic_prompt IS
  'Full unprefixed prompt body before image-gen prefix; fallback when prompt_scene_core is empty (legacy / one-shot monolith).';
