-- Persist photoshoot sidecars in the same complete RPC (not a follow-up UPDATE
-- after status=completed). Backfill completed jobs that have a sheet but no tiles.

DROP FUNCTION IF EXISTS public.landing_complete_generation(uuid, text, uuid, text, text, text);

CREATE FUNCTION public.landing_complete_generation(
  p_generation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_result_bucket text,
  p_result_path text,
  p_result_mime_type text DEFAULT NULL,
  p_photoshoot_tile_paths text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tiles text[];
BEGIN
  IF p_photoshoot_tile_paths IS NOT NULL AND cardinality(p_photoshoot_tile_paths) = 4 THEN
    v_tiles := p_photoshoot_tile_paths;
  ELSE
    v_tiles := NULL;
  END IF;

  UPDATE landing_generations
     SET status = 'completed',
         result_storage_bucket = p_result_bucket,
         result_storage_path = p_result_path,
         result_mime_type = NULLIF(btrim(p_result_mime_type), ''),
         photoshoot_tile_paths = COALESCE(v_tiles, photoshoot_tile_paths),
         generation_completed_at = now(),
         worker_id = NULL,
         lease_token = NULL,
         lease_expires_at = NULL,
         last_heartbeat_at = NULL,
         error_type = NULL,
         error_message = NULL,
         updated_at = now()
   WHERE id = p_generation_id
     AND status = 'processing'
     AND worker_id = p_worker_id
     AND lease_token = p_lease_token;

  IF FOUND THEN
    RETURN true;
  END IF;

  IF v_tiles IS NOT NULL THEN
    UPDATE landing_generations
       SET photoshoot_tile_paths = v_tiles,
           updated_at = now()
     WHERE id = p_generation_id
       AND status = 'completed'
       AND result_storage_bucket = p_result_bucket
       AND result_storage_path = p_result_path
       AND photoshoot_tile_paths IS NULL;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM landing_generations
     WHERE id = p_generation_id
       AND status = 'completed'
       AND result_storage_bucket = p_result_bucket
       AND result_storage_path = p_result_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.landing_complete_generation(uuid, text, uuid, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_complete_generation(uuid, text, uuid, text, text, text, text[]) TO service_role;

UPDATE public.landing_generations
   SET photoshoot_tile_paths = ARRAY[
         regexp_replace(result_storage_path, '\.[^./]+$', '-1.jpg'),
         regexp_replace(result_storage_path, '\.[^./]+$', '-2.jpg'),
         regexp_replace(result_storage_path, '\.[^./]+$', '-3.jpg'),
         regexp_replace(result_storage_path, '\.[^./]+$', '-4.jpg')
       ],
       updated_at = now()
 WHERE edit_kind = 'photoshoot'
   AND status = 'completed'
   AND photoshoot_tile_paths IS NULL
   AND result_storage_path ~ '\.[^./]+$';
