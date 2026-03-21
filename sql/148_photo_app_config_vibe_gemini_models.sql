-- Vibe pipeline: extract (vision) uses Pro by default; expand (text) uses Flash
INSERT INTO photo_app_config (key, value, description)
VALUES
  (
    'vibe_extract_model',
    'gemini-2.5-pro',
    'Gemini model id for POST /api/vibe/extract (reference image → style JSON)'
  ),
  (
    'vibe_expand_model',
    'gemini-2.5-flash',
    'Gemini model id for POST /api/vibe/expand (style JSON → scene prompt)'
  )
ON CONFLICT (key) DO NOTHING;
