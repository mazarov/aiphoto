-- Steal This Vibe: three-step anti-copy style pipeline (spec docs/24-03-stv-three-step-style-prompt-pipeline.md).
-- Master switch: when true, extract/expand follow STV 3-step branch (implementation TBD); default off.
-- Toggle: UPDATE photo_app_config SET value = 'true' WHERE key = 'vibe_stv_anti_copy_3step';
INSERT INTO public.photo_app_config (key, value, description)
VALUES
  (
    'vibe_stv_anti_copy_3step',
    'false',
    'When true, landing uses the 3-step STV pipeline (anti-copy extract JSON → style rewrite LLM → final prompt LLM). When false, only legacy_2c23 extract/expand. Companion: vibes.prompt_chain = stv_anti_copy_3step for rows created under this mode (after CHECK migration). See docs/24-03-stv-three-step-style-prompt-pipeline.md.'
  )
ON CONFLICT (key) DO NOTHING;
