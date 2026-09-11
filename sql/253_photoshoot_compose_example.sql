-- Empty-plate photoshoot example inside the generate dock.
-- Catalog: /p/photoshoot-plannertemperature200-four-frame-contact-sheet-from-the-attached-phot-c0b56
-- Visual: one source photo, then four result tiles (photoshoot-example-source.jpg + -1…-4.jpg).

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('photoshoot_compose_example_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;
