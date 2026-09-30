-- Photo analyze can follow the frame pattern (person, object, layout, scene).
-- Missing or non-true value keeps the legacy portrait extract.

INSERT INTO public.landing_generation_config (key, value)
VALUES ('analyze_pattern_router_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.analyze_history
  ADD COLUMN IF NOT EXISTS analyze_pattern text,
  ADD COLUMN IF NOT EXISTS analyze_medium text;

ALTER TABLE public.analyze_history
  DROP CONSTRAINT IF EXISTS analyze_history_pattern_valid,
  ADD CONSTRAINT analyze_history_pattern_valid
    CHECK (
      analyze_pattern IS NULL
      OR analyze_pattern IN ('person', 'object', 'layout', 'scene')
    );

ALTER TABLE public.analyze_history
  DROP CONSTRAINT IF EXISTS analyze_history_medium_valid,
  ADD CONSTRAINT analyze_history_medium_valid
    CHECK (
      analyze_medium IS NULL
      OR analyze_medium IN ('photo', 'illustration', 'graphic', '3d')
    );

COMMENT ON COLUMN public.analyze_history.analyze_pattern IS
  'Frame pattern chosen by analyze when analyze_pattern_router_enabled is true; null on the legacy path';
COMMENT ON COLUMN public.analyze_history.analyze_medium IS
  'photo, illustration, graphic, or 3d. Null on the legacy path';
