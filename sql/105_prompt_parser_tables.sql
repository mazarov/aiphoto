-- ============================================================
-- Prompt Parser — core tables for parse + ingest (phase 1-2)
-- ============================================================

CREATE TABLE IF NOT EXISTS import_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_slug text NOT NULL UNIQUE,
  channel_title text NOT NULL,
  source_type text NOT NULL DEFAULT 'telegram_html_export',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES import_datasets(id),
  mode text NOT NULL CHECK (mode IN ('backfill', 'incremental')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  html_files_total int NOT NULL DEFAULT 0,
  groups_total int NOT NULL DEFAULT 0,
  groups_parsed int NOT NULL DEFAULT 0,
  groups_skipped int NOT NULL DEFAULT 0,
  groups_failed int NOT NULL DEFAULT 0,
  error_summary text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS source_message_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES import_datasets(id),
  run_id uuid NOT NULL REFERENCES import_runs(id),
  source_group_key text NOT NULL,
  source_message_id bigint NOT NULL,
  source_message_ids bigint[] NOT NULL,
  source_published_at timestamptz NOT NULL,
  raw_text_html text,
  raw_text_plain text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, source_message_id)
);

CREATE TABLE IF NOT EXISTS prompt_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_group_id uuid NOT NULL UNIQUE REFERENCES source_message_groups(id) ON DELETE CASCADE,
  slug text,
  title_ru text NOT NULL,
  title_en text,
  hashtags text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  source_channel text NOT NULL,
  source_dataset_slug text NOT NULL,
  source_message_id bigint NOT NULL,
  source_date timestamptz NOT NULL,
  parse_status text NOT NULL CHECK (parse_status IN ('parsed', 'parsed_with_warnings', 'failed')) DEFAULT 'parsed',
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_dataset_slug, source_message_id)
);

CREATE TABLE IF NOT EXISTS prompt_card_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  media_index int NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'video')),
  storage_bucket text NOT NULL DEFAULT 'prompt-images',
  storage_path text NOT NULL,
  original_relative_path text NOT NULL,
  thumb_relative_path text,
  is_primary boolean NOT NULL DEFAULT false,
  width int,
  height int,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, media_index),
  UNIQUE(storage_bucket, storage_path)
);

CREATE TABLE IF NOT EXISTS prompt_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  variant_index int NOT NULL,
  label_raw text,
  prompt_text_ru text NOT NULL,
  prompt_text_en text,
  prompt_normalized_ru text,
  prompt_normalized_en text,
  match_strategy text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, variant_index)
);

CREATE TABLE IF NOT EXISTS prompt_variant_media (
  variant_id uuid NOT NULL REFERENCES prompt_variants(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES prompt_card_media(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_source_message_groups_dataset_source_id
  ON source_message_groups(dataset_id, source_message_id DESC);
CREATE INDEX IF NOT EXISTS idx_source_message_groups_published_at
  ON source_message_groups(source_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_source_key
  ON prompt_cards(source_dataset_slug, source_message_id);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_publish_sort
  ON prompt_cards(is_published, source_date DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_tags
  ON prompt_cards USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_prompt_card_media_card_primary
  ON prompt_card_media(card_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_variants_card_index
  ON prompt_variants(card_id, variant_index);
CREATE INDEX IF NOT EXISTS idx_prompt_variant_media_media
  ON prompt_variant_media(media_id);

