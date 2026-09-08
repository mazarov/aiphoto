-- Low-balance −20% stays live for the full 24h TTL and applies to every
-- checkout in that window. Do not consume it on credit or a second purchase.
-- Abandon/flash untargeted grants still close on any completed payment.

CREATE OR REPLACE FUNCTION public.landing_mail_on_payment_credited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_id uuid;
  v_payment_count integer;
BEGIN
  IF NEW.credited_at IS NULL OR OLD.credited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id IS NOT NULL THEN
    UPDATE public.landing_pricing_offers
       SET consumed_at = now(),
           reserved_payment_id = NEW.id,
           updated_at = now()
     WHERE id = NEW.offer_id
       AND source_template_id IS DISTINCT FROM 'low_balance_upgrade'
     RETURNING id INTO v_offer_id;

    IF EXISTS (
      SELECT 1
        FROM public.landing_pricing_offers o
       WHERE o.id = NEW.offer_id
         AND o.source_template_id = 'low_balance_upgrade'
    ) THEN
      INSERT INTO public.landing_pricing_offer_events(
        offer_id, shared_user_id, event, detail
      ) VALUES (
        NEW.offer_id,
        NEW.landing_user_id,
        'credited',
        jsonb_build_object(
          'payment_id', NEW.id,
          'plan_id', NEW.plan_id,
          'amount_rub', NEW.amount_rub
        )
      )
      ON CONFLICT (offer_id, event) DO NOTHING;
    END IF;
  END IF;

  -- General/flash grants close on any completed payment.
  -- low_balance_upgrade is TTL-scoped and stays until expires_at.
  UPDATE public.landing_pricing_offers
     SET consumed_at = coalesce(consumed_at, now()),
         updated_at = now()
   WHERE shared_user_id = NEW.landing_user_id
     AND consumed_at IS NULL
     AND target_plan_id IS NULL
     AND source_template_id IS DISTINCT FROM 'low_balance_upgrade';

  WITH live_payments AS (
    SELECT 1
      FROM public.landing_yookassa_payments
     WHERE landing_user_id = NEW.landing_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
    UNION ALL
    SELECT 1
      FROM public.landing_robokassa_payments
     WHERE landing_user_id = NEW.landing_user_id
       AND status = 'succeeded'
       AND credited_at IS NOT NULL
       AND test IS NOT TRUE
  )
  SELECT count(*)::integer INTO v_payment_count FROM live_payments;

  IF v_payment_count >= 2 THEN
    PERFORM public.landing_mail_cancel_templates(
      NEW.landing_user_id,
      ARRAY['low_balance_upgrade']
    );
  END IF;

  PERFORM public.landing_mail_cancel_templates(
    NEW.landing_user_id,
    ARRAY[
      'onboard_d1', 'onboard_d3', 'onboard_d7',
      'analyze_intent', 'no_credits',
      'yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h'
    ]
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.landing_generations g
     WHERE g.user_id = NEW.landing_user_id AND g.status = 'completed'
  ) THEN
    PERFORM public.landing_mail_schedule_due(
      NEW.landing_user_id,
      'paid_unused',
      NEW.landing_user_id::text,
      NEW.credited_at + interval '24 hours',
      jsonb_build_object(
        'idempotency_key',
        'paid_unused:' || NEW.landing_user_id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Reopen at most one still-unexpired grant per user (unique unconsumed index).
UPDATE public.landing_pricing_offers o
   SET consumed_at = NULL,
       updated_at = now()
 WHERE o.id IN (
   SELECT DISTINCT ON (closed.shared_user_id) closed.id
     FROM public.landing_pricing_offers closed
    WHERE closed.source_template_id = 'low_balance_upgrade'
      AND closed.expires_at > now()
      AND closed.consumed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
          FROM public.landing_pricing_offers live
         WHERE live.shared_user_id = closed.shared_user_id
           AND live.source_template_id = 'low_balance_upgrade'
           AND live.consumed_at IS NULL
      )
    ORDER BY closed.shared_user_id, closed.created_at DESC
 );

COMMENT ON FUNCTION public.landing_mail_on_payment_credited() IS
  'On credit: consume abandon/flash grants; keep low_balance_upgrade live until expires_at so −20% applies to every checkout in the 24h window. Second live payment cancels the upgrade email only.';
