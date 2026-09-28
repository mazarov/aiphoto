-- SEO image stack for the 25 /generaciya URLs. Seed turns every layer on.
-- A missing or empty value is still off in the app reader.
-- seo_alt_* is nullable: gated pages fall back to a cleaned card title
-- until a reviewed alt is stored.

ALTER TABLE public.prompt_card_media
  ADD COLUMN IF NOT EXISTS seo_alt_ru text;

ALTER TABLE public.prompt_card_media
  ADD COLUMN IF NOT EXISTS seo_alt_source text;

ALTER TABLE public.prompt_card_media
  ADD COLUMN IF NOT EXISTS seo_alt_version integer;

ALTER TABLE public.prompt_card_media
  ADD COLUMN IF NOT EXISTS seo_alt_updated_at timestamptz;

INSERT INTO public.landing_generation_config (key, value) VALUES
  ('generaciya_seo_image_logs_enabled', 'true'),
  ('generaciya_seo_src_1080_enabled', 'true'),
  ('generaciya_seo_single_pass_enabled', 'true'),
  ('generaciya_seo_descriptive_alt_enabled', 'true'),
  ('generaciya_seo_first_screen_rank_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
