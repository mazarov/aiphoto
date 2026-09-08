-- A live offer reserved to an unpaid checkout blocked every new attempt:
-- apply returned catalog 299, lockCheckoutCharge then 409.
-- Latest unpaid checkout takes the grant; the previous reserved row is canceled.

CREATE OR REPLACE FUNCTION public.landing_apply_checkout_offer(
  p_shared_user_id uuid,
  p_payment_id uuid,
  p_provider text,
  p_catalog_amount numeric
)
RETURNS TABLE(quoted_amount_rub numeric, quoted_offer_id uuid, quoted_percent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.landing_pricing_offers%ROWTYPE;
  v_amount numeric := p_catalog_amount;
  v_plan_id text;
BEGIN
  IF p_provider NOT IN ('yookassa', 'robokassa') OR p_payment_id IS NULL THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  IF p_provider = 'yookassa' THEN
    SELECT p.plan_id INTO v_plan_id
      FROM public.landing_yookassa_payments p
     WHERE p.id = p_payment_id AND p.landing_user_id = p_shared_user_id;
  ELSE
    SELECT p.plan_id INTO v_plan_id
      FROM public.landing_robokassa_payments p
     WHERE p.id = p_payment_id AND p.landing_user_id = p_shared_user_id;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  SELECT * INTO v_offer
    FROM public.landing_pricing_offers o
   WHERE o.shared_user_id = p_shared_user_id
     AND o.consumed_at IS NULL
     AND o.expires_at > now()
     AND (o.target_plan_id IS NULL OR o.target_plan_id = v_plan_id)
   ORDER BY o.percent DESC, (o.target_plan_id IS NOT NULL) DESC, o.expires_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_catalog_amount, NULL::uuid, 0;
    RETURN;
  END IF;

  IF v_offer.reserved_payment_id IS NOT NULL
     AND v_offer.reserved_payment_id IS DISTINCT FROM p_payment_id
  THEN
    IF v_offer.reserved_provider = 'yookassa' THEN
      UPDATE public.landing_yookassa_payments
         SET status = 'canceled',
             provider_status = 'superseded_by_checkout',
             updated_at = now()
       WHERE id = v_offer.reserved_payment_id
         AND credited_at IS NULL
         AND status IN ('created', 'pending');
    ELSIF v_offer.reserved_provider = 'robokassa' THEN
      UPDATE public.landing_robokassa_payments
         SET status = 'canceled',
             provider_status = 'superseded_by_checkout',
             updated_at = now()
       WHERE id = v_offer.reserved_payment_id
         AND credited_at IS NULL
         AND status IN ('created', 'pending');
    END IF;
  END IF;

  IF v_offer.reserved_payment_id IS NOT DISTINCT FROM p_payment_id THEN
    IF p_provider = 'yookassa' THEN
      SELECT p.amount_rub INTO v_amount
        FROM public.landing_yookassa_payments p
       WHERE p.id = p_payment_id;
    ELSE
      SELECT p.amount_rub INTO v_amount
        FROM public.landing_robokassa_payments p
       WHERE p.id = p_payment_id;
    END IF;
    RETURN QUERY SELECT coalesce(v_amount, p_catalog_amount), v_offer.id, v_offer.percent;
    RETURN;
  END IF;

  v_amount := greatest(1, floor(p_catalog_amount * (100 - v_offer.percent) / 100));

  UPDATE public.landing_pricing_offers
     SET reserved_payment_id = p_payment_id,
         reserved_provider = p_provider,
         updated_at = now()
   WHERE id = v_offer.id;

  IF p_provider = 'yookassa' THEN
    UPDATE public.landing_yookassa_payments
       SET amount_rub = v_amount,
           offer_id = v_offer.id,
           updated_at = now()
     WHERE id = p_payment_id AND credited_at IS NULL;
  ELSE
    UPDATE public.landing_robokassa_payments
       SET amount_rub = v_amount,
           offer_id = v_offer.id,
           updated_at = now()
     WHERE id = p_payment_id AND credited_at IS NULL;
  END IF;

  INSERT INTO public.landing_pricing_offer_events(
    offer_id, shared_user_id, event, detail
  ) VALUES (
    v_offer.id,
    p_shared_user_id,
    'checkout',
    jsonb_build_object(
      'provider', p_provider,
      'payment_id', p_payment_id,
      'plan_id', v_plan_id,
      'amount_rub', v_amount
    )
  )
  ON CONFLICT (offer_id, event) DO NOTHING;

  RETURN QUERY SELECT v_amount, v_offer.id, v_offer.percent;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_apply_checkout_offer(uuid, uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_apply_checkout_offer(uuid, uuid, text, numeric)
  TO service_role;

COMMENT ON FUNCTION public.landing_apply_checkout_offer(uuid, uuid, text, numeric) IS
  'Lock a live pricing offer onto the latest unpaid checkout. A previous reserved unpaid payment is canceled so a new attempt can take the grant. Re-apply on the same payment returns the stored amount.';
