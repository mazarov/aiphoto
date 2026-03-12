-- ============================================================
-- SEO tags for prompt_cards (programmatic SEO foundation)
-- Phase 0.1 per docs/07-03-prompt-landing-plan.md
-- ============================================================

ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS seo_tags jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE prompt_cards
  ADD COLUMN IF NOT EXISTS seo_readiness_score int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_prompt_cards_seo_tags
  ON prompt_cards USING gin(seo_tags);

CREATE INDEX IF NOT EXISTS idx_prompt_cards_seo_readiness
  ON prompt_cards(seo_readiness_score DESC);
