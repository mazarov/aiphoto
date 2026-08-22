-- Admin daily send stats for /admin/mail.
-- Read-only. Service-role only. Does not join auth.users or scan landing_mail_due.
-- Do not edit 205 / 206.

CREATE INDEX IF NOT EXISTS idx_landing_mail_outbox_sent_at
  ON public.landing_mail_outbox (sent_at DESC)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_landing_mail_outbox_skip_fail_at
  ON public.landing_mail_outbox (updated_at DESC)
  WHERE status IN ('skipped', 'failed');

CREATE OR REPLACE FUNCTION public.landing_mail_admin_daily_stats(p_from date, p_to date)
RETURNS TABLE(
  day date,
  template_id text,
  kind text,
  status text,
  n bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_ts timestamptz;
  v_to_ts timestamptz;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR (p_to - p_from) > 29 THEN
    RAISE EXCEPTION 'invalid_mail_stats_window' USING ERRCODE = 'P0001';
  END IF;

  v_from_ts := (p_from::timestamp AT TIME ZONE 'Europe/Moscow');
  v_to_ts := ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Moscow');

  RETURN QUERY
  SELECT
    public.landing_mail_moscow_day(o.sent_at) AS day,
    o.template_id,
    o.kind,
    o.status,
    count(*)::bigint AS n
  FROM public.landing_mail_outbox o
  WHERE o.status = 'sent'
    AND o.sent_at IS NOT NULL
    AND o.sent_at >= v_from_ts
    AND o.sent_at < v_to_ts
  GROUP BY 1, 2, 3, 4

  UNION ALL

  SELECT
    public.landing_mail_moscow_day(o.updated_at) AS day,
    o.template_id,
    o.kind,
    o.status,
    count(*)::bigint AS n
  FROM public.landing_mail_outbox o
  WHERE o.status IN ('skipped', 'failed')
    AND o.updated_at >= v_from_ts
    AND o.updated_at < v_to_ts
  GROUP BY 1, 2, 3, 4;
END;
$$;

REVOKE ALL ON FUNCTION public.landing_mail_admin_daily_stats(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_mail_admin_daily_stats(date, date) TO service_role;
