-- Extension Lite native generate on promptshot.ru (docs/11-10-extension-lite-generation.md).
-- Product flag only. Default closed. A later UPDATE opens the button. Do not edit older migrations.

INSERT INTO public.landing_generation_config (key, value, updated_at)
VALUES ('extension_lite_generate_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;
