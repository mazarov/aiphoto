-- Camera orbit I2I model. Default Grok; change value to switch without redeploy.
-- Must be an id from landing_generation_config.models. Empty/unknown → API 503.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('camera_orbit_model', 'grok-imagine-image-2.0', now())
ON CONFLICT (key) DO NOTHING;
