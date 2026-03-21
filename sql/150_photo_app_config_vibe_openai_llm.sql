-- Optional OpenAI Chat Completions for vibe extract (vision+JSON) / expand (text+JSON). Defaults keep Gemini.
INSERT INTO photo_app_config (key, value, description)
VALUES
  (
    'vibe_extract_llm',
    'gemini',
    'Which API runs POST /api/vibe/extract: gemini | openai. OpenAI requires OPENAI_API_KEY and a vision-capable model (vibe_openai_extract_model).'
  ),
  (
    'vibe_expand_llm',
    'gemini',
    'Which API runs POST /api/vibe/expand: gemini | openai. OpenAI requires OPENAI_API_KEY.'
  ),
  (
    'vibe_openai_extract_model',
    'gpt-4o',
    'OpenAI model id when vibe_extract_llm=openai (must support vision + JSON).'
  ),
  (
    'vibe_openai_expand_model',
    'gpt-4.1-mini',
    'OpenAI model id when vibe_expand_llm=openai (text JSON output).'
  )
ON CONFLICT (key) DO NOTHING;
