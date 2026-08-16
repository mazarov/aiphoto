-- Owner reads for /analyses: filter analyze_history by user_id.
CREATE INDEX IF NOT EXISTS analyze_history_user_created_at_idx
  ON public.analyze_history (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
