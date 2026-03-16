-- Config for web generation (models, limits)
CREATE TABLE landing_generation_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO landing_generation_config (key, value) VALUES
  ('models', '[
    {"id":"gemini-2.5-flash-image","label":"Flash","cost":1,"enabled":true},
    {"id":"gemini-3-pro-image-preview","label":"Pro","cost":2,"enabled":true},
    {"id":"gemini-3.1-flash-image-preview","label":"Ultra","cost":3,"enabled":true}
  ]'),
  ('default_model', 'gemini-2.5-flash-image'),
  ('default_aspect_ratio', '1:1'),
  ('default_image_size', '1K'),
  ('max_photos', '4'),
  ('max_file_size_mb', '10'),
  ('min_prompt_length', '8')
ON CONFLICT (key) DO NOTHING;
