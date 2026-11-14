-- Generate Dock v2 UX (tuck-under-CTA summary pocket, in-flow stretching sheets,
-- inline guest popup OAuth, parallel generation queue up to 3 jobs, and compact bottom result bar).
-- Product flag only. Default closed ('false'). A later UPDATE opens the UX. Do not edit older migrations.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('generate_dock_v2_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;
