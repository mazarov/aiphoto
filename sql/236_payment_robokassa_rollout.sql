-- Robokassa percentage rollout + canary emails + abandon dues on Robokassa insert.
-- Default closed: enable with UPDATE landing_feature_rollouts, not a redeploy.

INSERT INTO public.landing_feature_rollouts (
  feature_key,
  enabled,
  rollout_bps,
  updated_at
)
VALUES (
  'payment_robokassa',
  false,
  0,
  now()
)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('robokassa_canary_emails', 'azarov.maxim@gmail.com', now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.landing_mail_on_robokassa_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.landing_mail_cancel_exploring(NEW.landing_user_id);
  PERFORM public.landing_mail_cancel_other_subjects(
    NEW.landing_user_id,
    ARRAY['yk_abandon_5m', 'yk_abandon_40m', 'yk_abandon_24h'],
    NEW.id::text
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.landing_user_id,
    'yk_abandon_5m',
    NEW.id::text,
    NEW.created_at + interval '5 minutes',
    jsonb_build_object(
      'plan_id', NEW.plan_id,
      'payment_id', NEW.id,
      'idempotency_key', 'yk_abandon_5m:' || NEW.id::text
    )
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.landing_user_id,
    'yk_abandon_40m',
    NEW.id::text,
    NEW.created_at + interval '40 minutes',
    jsonb_build_object(
      'plan_id', NEW.plan_id,
      'payment_id', NEW.id,
      'idempotency_key', 'yk_abandon_40m:' || NEW.id::text
    )
  );
  PERFORM public.landing_mail_schedule_due(
    NEW.landing_user_id,
    'yk_abandon_24h',
    NEW.id::text,
    NEW.created_at + interval '24 hours',
    jsonb_build_object(
      'plan_id', NEW.plan_id,
      'payment_id', NEW.id,
      'idempotency_key', 'yk_abandon_24h:' || NEW.id::text
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.landing_mail_on_robokassa_insert() IS
  'Same abandon dues as YooKassa insert: 5m/40m/24h on the new Robokassa payment_id.';
