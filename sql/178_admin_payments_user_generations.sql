-- Admin read models for YooKassa payments and non-admin landing generations.
-- Both RPCs are service-role only: they expose operational identity data.

CREATE INDEX IF NOT EXISTS landing_yookassa_payments_admin_status_created_idx
  ON public.landing_yookassa_payments (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS landing_generations_user_admin_queue_idx
  ON public.landing_generations (created_at DESC, id DESC)
  WHERE client_source IS DISTINCT FROM 'admin';

CREATE OR REPLACE FUNCTION public.admin_yookassa_payments(
  p_status text DEFAULT 'all',
  p_test boolean DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  auth_user_id uuid,
  landing_user_id uuid,
  payer_email text,
  payer_display_name text,
  payer_provider text,
  plan_id text,
  credits integer,
  amount_rub numeric,
  status text,
  provider_status text,
  test boolean,
  credited_at timestamptz,
  yookassa_payment_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.created_at,
    p.updated_at,
    p.auth_user_id,
    p.landing_user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS payer_email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS payer_display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS payer_provider,
    p.plan_id,
    p.credits,
    p.amount_rub,
    p.status,
    p.provider_status,
    p.test,
    p.credited_at,
    p.yookassa_payment_id
  FROM public.landing_yookassa_payments p
  LEFT JOIN auth.users au ON au.id = p.auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = p.landing_user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = p.landing_user_id
  WHERE (
      lower(COALESCE(p_status, 'all')) = 'all'
      OR p.status = lower(p_status)
    )
    AND (p_test IS NULL OR p.test IS NOT DISTINCT FROM p_test)
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR p.created_at < p_cursor_created_at
      OR (p.created_at = p_cursor_created_at AND p.id < p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_generations_queue(
  p_status text DEFAULT 'all',
  p_client_source text DEFAULT NULL,
  p_publication_status text DEFAULT 'all',
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  generation_completed_at timestamptz,
  status text,
  prompt_text text,
  model text,
  aspect_ratio text,
  image_size text,
  credits_spent integer,
  credits_refunded boolean,
  error_type text,
  error_message text,
  client_source text,
  requester_auth_user_id uuid,
  user_id uuid,
  user_email text,
  user_display_name text,
  user_provider text,
  input_photo_paths text[],
  result_storage_bucket text,
  result_storage_path text,
  ugc_card_id uuid,
  card_exists boolean,
  is_published boolean,
  card_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.created_at,
    g.generation_completed_at,
    g.status,
    g.prompt_text,
    g.model,
    g.aspect_ratio,
    g.image_size,
    g.credits_spent,
    g.credits_refunded,
    g.error_type,
    g.error_message,
    COALESCE(g.client_source, 'unknown') AS client_source,
    g.requester_auth_user_id,
    g.user_id,
    COALESCE(NULLIF(au.email, ''), NULLIF(iu.email, '')) AS user_email,
    COALESCE(
      NULLIF(lu.display_name, ''),
      NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(au.raw_user_meta_data ->> 'name', ''),
      NULLIF(iu.display_name, '')
    ) AS user_display_name,
    COALESCE(
      NULLIF(lu.provider, ''),
      NULLIF(au.raw_app_meta_data ->> 'provider', '')
    ) AS user_provider,
    g.input_photo_paths,
    g.result_storage_bucket,
    g.result_storage_path,
    g.ugc_card_id,
    (c.id IS NOT NULL) AS card_exists,
    COALESCE(c.is_published, false) AS is_published,
    c.slug AS card_slug
  FROM public.landing_generations g
  LEFT JOIN auth.users au ON au.id = g.requester_auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = g.user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = g.user_id
  LEFT JOIN public.prompt_cards c ON c.id = g.ugc_card_id
  WHERE g.client_source IS DISTINCT FROM 'admin'
    AND (
      lower(COALESCE(p_status, 'all')) = 'all'
      OR g.status = lower(p_status)
    )
    AND (
      NULLIF(lower(COALESCE(p_client_source, '')), '') IS NULL
      OR COALESCE(g.client_source, 'unknown') = lower(p_client_source)
    )
    AND CASE lower(COALESCE(p_publication_status, 'all'))
      WHEN 'published' THEN c.id IS NOT NULL AND c.is_published = true
      WHEN 'unpublished' THEN g.ugc_card_id IS NULL OR c.id IS NULL OR c.is_published = false
      ELSE true
    END
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR g.created_at < p_cursor_created_at
      OR (g.created_at = p_cursor_created_at AND g.id < p_cursor_id)
    )
  ORDER BY g.created_at DESC, g.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_yookassa_payments(
  text, boolean, timestamptz, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_yookassa_payments(
  text, boolean, timestamptz, uuid, integer
) TO service_role;

REVOKE ALL ON FUNCTION public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
) TO service_role;

COMMENT ON FUNCTION public.admin_yookassa_payments(
  text, boolean, timestamptz, uuid, integer
) IS 'Service-only cursor read model for PromptShot YooKassa operations.';

COMMENT ON FUNCTION public.admin_user_generations_queue(
  text, text, text, timestamptz, uuid, integer
) IS 'Service-only cursor read model for non-admin PromptShot generations.';
