-- YooKassa one-time token purchases for the PromptShot landing.

CREATE TABLE IF NOT EXISTS public.landing_yookassa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  landing_user_id uuid NOT NULL REFERENCES public.landing_users(id),
  plan_id text NOT NULL,
  credits int NOT NULL CHECK (credits > 0),
  amount_rub numeric(10, 2) NOT NULL CHECK (amount_rub > 0),
  idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  yookassa_payment_id text UNIQUE,
  confirmation_url text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'succeeded', 'canceled')),
  provider_status text,
  test boolean,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_yookassa_auth_created
  ON public.landing_yookassa_payments(auth_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_yookassa_user_created
  ON public.landing_yookassa_payments(landing_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_yookassa_pending
  ON public.landing_yookassa_payments(status, created_at)
  WHERE status IN ('created', 'pending');

ALTER TABLE public.landing_yookassa_payments ENABLE ROW LEVEL SECURITY;

-- No client policies: checkout routes use the service role. The function reads
-- credits from the locked payment row, so webhook input can never choose the
-- amount credited.
CREATE OR REPLACE FUNCTION public.landing_fulfill_yookassa_payment(
  p_payment_id uuid,
  p_yookassa_payment_id text,
  p_test boolean
)
RETURNS TABLE(credited boolean, credits_after int, payment_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.landing_yookassa_payments%ROWTYPE;
  v_credits_after int;
BEGIN
  SELECT *
    INTO v_payment
    FROM public.landing_yookassa_payments
   WHERE id = p_payment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_payment.yookassa_payment_id IS DISTINCT FROM p_yookassa_payment_id THEN
    RAISE EXCEPTION 'provider_payment_mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF v_payment.credited_at IS NOT NULL THEN
    SELECT credits
      INTO v_credits_after
      FROM public.landing_users
     WHERE id = v_payment.landing_user_id;

    RETURN QUERY
      SELECT false, COALESCE(v_credits_after, 0), v_payment.status;
    RETURN;
  END IF;

  UPDATE public.landing_users
     SET credits = credits + v_payment.credits,
         updated_at = now()
   WHERE id = v_payment.landing_user_id
   RETURNING credits INTO v_credits_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'landing_user_not_found' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.landing_yookassa_payments
     SET status = 'succeeded',
         provider_status = 'succeeded',
         test = p_test,
         credited_at = now(),
         updated_at = now()
   WHERE id = p_payment_id;

  RETURN QUERY SELECT true, v_credits_after, 'succeeded'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_fulfill_yookassa_payment(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_fulfill_yookassa_payment(uuid, text, boolean)
  TO service_role;

COMMENT ON TABLE public.landing_yookassa_payments IS
  'Server-only ledger for one-time PromptShot token purchases through YooKassa.';
