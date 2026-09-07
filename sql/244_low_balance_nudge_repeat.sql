-- Repeat the in-app nudge after dismiss. seen is analytics only.
-- SQL 242/243 stay unchanged.

CREATE OR REPLACE FUNCTION public.landing_live_pricing_offer(p_shared_user_id uuid)
RETURNS TABLE(
  offer_id uuid,
  percent integer,
  expires_at timestamptz,
  target_plan_id text,
  source_template_id text,
  show_nudge boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.percent,
    o.expires_at,
    o.target_plan_id,
    o.source_template_id,
    CASE
      WHEN o.source_template_id = 'low_balance_upgrade' THEN
        NOT EXISTS (
          SELECT 1
            FROM public.landing_pricing_offer_events e
           WHERE e.offer_id = o.id
             AND e.event = 'dismissed'
             AND e.created_at > now() - interval '24 hours'
        )
      ELSE
        NOT EXISTS (
          SELECT 1
            FROM public.landing_pricing_offer_events e
           WHERE e.offer_id = o.id
             AND e.event IN ('seen', 'dismissed')
        )
    END
  FROM public.landing_pricing_offers o
  WHERE o.shared_user_id = p_shared_user_id
    AND o.consumed_at IS NULL
    AND o.expires_at > now()
  ORDER BY
    o.percent DESC,
    (o.target_plan_id IS NULL) DESC,
    o.expires_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.landing_record_pricing_offer_event(
  p_offer_id uuid,
  p_shared_user_id uuid,
  p_event text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event NOT IN ('seen', 'clicked', 'dismissed', 'email') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.landing_pricing_offers o
     WHERE o.id = p_offer_id
       AND o.shared_user_id = p_shared_user_id
       AND o.source_template_id = 'low_balance_upgrade'
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.landing_pricing_offer_events(
    offer_id, shared_user_id, event
  ) VALUES (p_offer_id, p_shared_user_id, p_event)
  ON CONFLICT (offer_id, event) DO UPDATE
    SET created_at = CASE
          WHEN EXCLUDED.event = 'dismissed' THEN now()
          ELSE public.landing_pricing_offer_events.created_at
        END;
  RETURN true;
END;
$$;
