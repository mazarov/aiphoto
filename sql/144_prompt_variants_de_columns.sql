-- ============================================================
-- Migration 144:
-- Add German (DE) prompt text columns to prompt_variants
-- for multilingual prompt storage (ru/en/de)
-- ============================================================

ALTER TABLE prompt_variants
  ADD COLUMN IF NOT EXISTS prompt_text_de text,
  ADD COLUMN IF NOT EXISTS prompt_normalized_de text;
