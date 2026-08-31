-- Listing video Repeat = image I2I (catalog look) then video I2V (stored motion).
-- Do not replace landing_enqueue_generation. Followup is a second enqueue
-- with parent_generation_id = the completed look photo.

ALTER TABLE public.landing_generations
  ADD COLUMN IF NOT EXISTS pipeline_spec jsonb;

COMMENT ON COLUMN public.landing_generations.pipeline_spec IS
  'Optional followup contract. listing_video_repeat: worker enqueues video I2V after this image completes.';

CREATE INDEX IF NOT EXISTS landing_generations_pipeline_kind_idx
  ON public.landing_generations ((pipeline_spec->>'kind'))
  WHERE pipeline_spec IS NOT NULL;

INSERT INTO public.landing_generation_config (key, value)
VALUES ('listing_video_repeat_chain', 'true')
ON CONFLICT (key) DO NOTHING;
