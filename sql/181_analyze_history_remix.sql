-- Prompt remix history for /admin/analyze-history:
-- kind distinguishes analyze vs remix; change_request stores the user edit text.

ALTER TABLE public.analyze_history
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'analyze';

ALTER TABLE public.analyze_history
  ADD COLUMN IF NOT EXISTS change_request text;

ALTER TABLE public.analyze_history
  DROP CONSTRAINT IF EXISTS analyze_history_kind_valid,
  ADD CONSTRAINT analyze_history_kind_valid
    CHECK (kind IN ('analyze', 'remix'));

ALTER TABLE public.analyze_history
  DROP CONSTRAINT IF EXISTS analyze_history_change_request_valid,
  ADD CONSTRAINT analyze_history_change_request_valid
    CHECK (
      (kind = 'analyze' AND change_request IS NULL)
      OR (
        kind = 'remix'
        AND change_request IS NOT NULL
        AND char_length(btrim(change_request)) BETWEEN 1 AND 1000
      )
    );

CREATE INDEX IF NOT EXISTS analyze_history_kind_created_at_idx
  ON public.analyze_history (kind, created_at DESC);

COMMENT ON COLUMN public.analyze_history.kind IS
  'analyze = photo→prompt; remix = /api/prompt-remix rewrite';
COMMENT ON COLUMN public.analyze_history.change_request IS
  'User «Что изменить?» text for remix rows; null for analyze';
