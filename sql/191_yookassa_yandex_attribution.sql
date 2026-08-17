-- ============================================================
-- Migration 191: Yandex Direct attribution on YooKassa ledger
--
-- Store Metrika ClientID + first-touch yclid at checkout, then mark
-- Measurement Protocol purchase uploads after fulfillment.
-- ============================================================

ALTER TABLE public.landing_yookassa_payments
  ADD COLUMN IF NOT EXISTS ym_client_id text,
  ADD COLUMN IF NOT EXISTS yclid text,
  ADD COLUMN IF NOT EXISTS yandex_conversion_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS yandex_conversion_error text,
  ADD COLUMN IF NOT EXISTS yandex_conversion_attempts int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS landing_yookassa_payments_yandex_unsent_idx
  ON public.landing_yookassa_payments (created_at DESC)
  WHERE status = 'succeeded'
    AND yandex_conversion_sent_at IS NULL;

COMMENT ON COLUMN public.landing_yookassa_payments.ym_client_id IS
  'Yandex Metrika ClientID captured at checkout (cookie _ym_uid / ym getClientID).';
COMMENT ON COLUMN public.landing_yookassa_payments.yclid IS
  'First-touch Yandex Direct click id, if present at checkout.';
COMMENT ON COLUMN public.landing_yookassa_payments.yandex_conversion_sent_at IS
  'When Measurement Protocol purchase was accepted by Metrika.';
