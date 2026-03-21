-- One-shot vibe: reference image → generation prompt in a single Gemini vision call (optional via photo_app_config)
ALTER TABLE public.vibes
  ADD COLUMN IF NOT EXISTS prefilled_generation_prompt text;

COMMENT ON COLUMN public.vibes.prefilled_generation_prompt IS
  'When set, POST /api/vibe/expand returns this prompt without calling Gemini (filled by one-shot extract).';

INSERT INTO photo_app_config (key, value, description)
VALUES (
  'vibe_one_shot_extract_prompt',
  'false',
  'When true, POST /api/vibe/extract runs one vision call that outputs { "prompt": "..." } for image-gen; expand uses prefilled_generation_prompt without a second LLM call.'
)
ON CONFLICT (key) DO NOTHING;
