-- Link library photos saved from a generation so video can recover
-- Image1 = that generation result and Image2 = the original upload.

ALTER TABLE public.landing_user_photos
  ADD COLUMN IF NOT EXISTS source_generation_id uuid
    REFERENCES public.landing_generations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS landing_user_photos_source_generation_idx
  ON public.landing_user_photos (source_generation_id)
  WHERE source_generation_id IS NOT NULL;

UPDATE public.landing_user_photos AS photos
SET source_generation_id = generations.id
FROM public.landing_generations AS generations
WHERE photos.source_generation_id IS NULL
  AND (
    photos.original_filename ILIKE 'generation-' || generations.id::text || '.jpg'
    OR photos.original_filename ILIKE 'generation-' || generations.id::text || '.jpeg'
  );

COMMENT ON COLUMN public.landing_user_photos.source_generation_id IS
  'When the library photo was saved from a completed image generation, the source generation id.';
