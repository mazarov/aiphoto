-- ============================================================
-- Migration 159: per-view events for rolling 7d aggregation
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_card_view_events (
  id         bigserial PRIMARY KEY,
  card_id    uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_view_events_card_time
  ON prompt_card_view_events (card_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_view_events_viewed_at
  ON prompt_card_view_events (viewed_at);

COMMENT ON TABLE prompt_card_view_events IS
  'Append-only card page views; aggregated into prompt_cards.views_7d by recalculate_popularity_scores. Retention ~14d.';
