-- Admin read model for photoshoot albums (4-frame jobs) with their UGC card state.
-- /ii-fotosessiya scenario blocks only show published albums; 80% of users never
-- publish, so the admin needs a dedicated queue to publish and tag them.
-- Service-role only: exposes requester email. Pattern follows sql/178.

CREATE INDEX IF NOT EXISTS landing_generations_photoshoot_admin_queue_idx
  ON public.landing_generations (generation_completed_at DESC, id DESC)
  WHERE edit_kind = 'photoshoot'
    AND status = 'completed'
    AND client_source IS DISTINCT FROM 'admin';

CREATE OR REPLACE FUNCTION public.admin_photoshoot_albums_queue(
  p_publication_status text DEFAULT 'unpublished',
  p_cursor_completed_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  generation_completed_at timestamptz,
  prompt_text text,
  model text,
  client_source text,
  requester_auth_user_id uuid,
  user_id uuid,
  user_email text,
  user_display_name text,
  result_storage_bucket text,
  result_storage_path text,
  photoshoot_tile_paths text[],
  ugc_card_id uuid,
  card_exists boolean,
  is_published boolean,
  card_slug text,
  card_title_ru text,
  card_seo_tags jsonb,
  card_subject_audience text,
  card_subject_source text
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
    g.prompt_text,
    g.model,
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
    g.result_storage_bucket,
    g.result_storage_path,
    g.photoshoot_tile_paths,
    g.ugc_card_id,
    (c.id IS NOT NULL) AS card_exists,
    COALESCE(c.is_published, false) AS is_published,
    c.slug AS card_slug,
    c.title_ru AS card_title_ru,
    c.seo_tags AS card_seo_tags,
    c.subject_audience AS card_subject_audience,
    c.subject_source AS card_subject_source
  FROM public.landing_generations g
  LEFT JOIN auth.users au ON au.id = g.requester_auth_user_id
  LEFT JOIN public.landing_users lu ON lu.id = g.user_id
  LEFT JOIN public.imageprompt_users iu ON iu.id = g.user_id
  LEFT JOIN public.prompt_cards c ON c.id = g.ugc_card_id
  WHERE g.edit_kind = 'photoshoot'
    AND g.status = 'completed'
    AND g.client_source IS DISTINCT FROM 'admin'
    AND g.generation_completed_at IS NOT NULL
    AND CASE lower(COALESCE(p_publication_status, 'unpublished'))
      WHEN 'published' THEN c.id IS NOT NULL AND c.is_published = true
      WHEN 'unpublished' THEN g.ugc_card_id IS NULL OR c.id IS NULL OR c.is_published = false
      ELSE true
    END
    AND (
      p_cursor_completed_at IS NULL
      OR p_cursor_id IS NULL
      OR g.generation_completed_at < p_cursor_completed_at
      OR (g.generation_completed_at = p_cursor_completed_at AND g.id < p_cursor_id)
    )
  ORDER BY g.generation_completed_at DESC, g.id DESC
  LIMIT greatest(1, least(COALESCE(p_limit, 30), 100)) + 1;
$$;

REVOKE ALL ON FUNCTION public.admin_photoshoot_albums_queue(
  text, timestamptz, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_photoshoot_albums_queue(
  text, timestamptz, uuid, integer
) TO service_role;

COMMENT ON FUNCTION public.admin_photoshoot_albums_queue(
  text, timestamptz, uuid, integer
) IS 'Service-only cursor read model for completed non-admin photoshoot albums and their UGC card publication state.';
