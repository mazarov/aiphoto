-- Steal This Vibe: legacy prompt chain from commit 2c23ce94 (8-field extract + 3-accent expand + merge).
-- Toggle in Supabase: UPDATE photo_app_config SET value = 'true' WHERE key = 'vibe_legacy_prompt_chain_2c23ce94';
INSERT INTO public.photo_app_config (key, value, description)
VALUES
  (
    'vibe_legacy_prompt_chain_2c23ce94',
    'false',
    'When true, POST /api/vibe/extract uses legacy 8-field JSON and sets vibes.prompt_chain=legacy_2c23; one-shot extract config is ignored for that path. See docs/22-03-stv-single-generation-flow.md.'
  )
ON CONFLICT (key) DO NOTHING;
