-- Sticky percentage rollouts for authenticated landing users.
-- Anonymous visitors remain stateless in Postgres; their bucket is derived from
-- the long-lived promptshot_vid cookie and copied here after authentication.

CREATE TABLE IF NOT EXISTS public.landing_feature_rollouts (
  feature_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_bps smallint NOT NULL DEFAULT 0
    CHECK (rollout_bps BETWEEN 0 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_user_feature_assignments (
  -- JWT auth id is intentionally not FK-bound: it follows the same shared-DB
  -- identity contract as landing_generation_preferences/landing_user_photos.
  auth_user_id uuid NOT NULL,
  feature_key text NOT NULL
    REFERENCES public.landing_feature_rollouts(feature_key) ON DELETE CASCADE,
  bucket smallint NOT NULL CHECK (bucket BETWEEN 0 AND 9999),
  source text NOT NULL DEFAULT 'auth'
    CHECK (source IN ('visitor', 'auth')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS landing_user_feature_assignments_feature_bucket_idx
  ON public.landing_user_feature_assignments(feature_key, bucket);

ALTER TABLE public.landing_feature_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_user_feature_assignments ENABLE ROW LEVEL SECURITY;

-- No client policies: rollout configuration and assignments are resolved only
-- by server routes using the service role.

INSERT INTO public.landing_feature_rollouts (
  feature_key,
  enabled,
  rollout_bps,
  updated_at
)
VALUES (
  'prompt_card_generation',
  false,
  0,
  now()
)
ON CONFLICT (feature_key) DO NOTHING;

COMMENT ON TABLE public.landing_feature_rollouts IS
  'Server-controlled percentage rollout configuration in basis points.';
COMMENT ON TABLE public.landing_user_feature_assignments IS
  'Stable rollout buckets for authenticated landing users.';
