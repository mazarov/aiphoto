-- ============================================================
-- Migration 146:
-- Web (landing) transactions paid via Telegram Stars
-- ============================================================

CREATE TABLE IF NOT EXISTS landing_web_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_user_id uuid NOT NULL REFERENCES landing_users(id),
  telegram_id bigint NOT NULL,
  amount int NOT NULL,
  price_stars int NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'created',
  telegram_payment_charge_id text,
  provider_payment_charge_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lwt_landing_user
  ON landing_web_transactions(landing_user_id);

CREATE INDEX IF NOT EXISTS idx_lwt_state
  ON landing_web_transactions(state);

CREATE INDEX IF NOT EXISTS idx_lwt_charge
  ON landing_web_transactions(telegram_payment_charge_id);

CREATE OR REPLACE FUNCTION landing_add_credits(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits int;
BEGIN
  UPDATE landing_users
  SET credits = credits + p_amount, updated_at = now()
  WHERE id = p_user_id
  RETURNING credits INTO v_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN v_credits;
END;
$$;
