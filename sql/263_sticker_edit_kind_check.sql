-- 262 taught landing_enqueue_generation to insert edit_kind 'sticker',
-- but the column check from 224 still allows only local_edit, camera_orbit, photoshoot.
-- Do not edit 224 or 262.

ALTER TABLE public.landing_generations
  DROP CONSTRAINT IF EXISTS landing_generations_edit_kind_valid,
  ADD CONSTRAINT landing_generations_edit_kind_valid
    CHECK (
      edit_kind IS NULL
      OR edit_kind IN ('local_edit', 'camera_orbit', 'photoshoot', 'sticker')
    );
