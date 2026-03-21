-- Steal This Vibe: attach Pinterest/reference pixels as IMAGE A in web image-gen (default on)
INSERT INTO photo_app_config (key, value, description)
VALUES (
  'vibe_attach_reference_image_to_generation',
  'true',
  'When true, /api/generate-process downloads vibes.source_image_url and sends it as IMAGE A before user photo. Set false for user+text only.'
)
ON CONFLICT (key) DO NOTHING;
