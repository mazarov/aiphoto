-- ============================================================
-- Migration 145:
-- Link landing users with Telegram + one-time link tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS landing_user_telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_user_id uuid NOT NULL REFERENCES landing_users(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(landing_user_id),
  UNIQUE(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_lutl_telegram_id
  ON landing_user_telegram_links(telegram_id);

CREATE INDEX IF NOT EXISTS idx_lutl_landing_user_id
  ON landing_user_telegram_links(landing_user_id);

CREATE TABLE IF NOT EXISTS landing_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_user_id uuid NOT NULL REFERENCES landing_users(id) ON DELETE CASCADE,
  otp text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llt_otp
  ON landing_link_tokens(otp)
  WHERE NOT used;
