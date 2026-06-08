-- ============================================================
-- Migration 158: popularity_score + views_7d on prompt_cards
-- Materialized ranking fields for category listing sort=popular
-- ============================================================

ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS views_7d bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popularity_score double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popularity_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prompt_cards_published_popularity
  ON prompt_cards (is_published, popularity_score DESC, created_at DESC, id DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_prompt_cards_published_created_at
  ON prompt_cards (is_published, created_at DESC, id DESC)
  WHERE is_published = true;
