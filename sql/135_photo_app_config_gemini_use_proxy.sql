-- Runtime toggle for Gemini routing (proxy vs direct)
INSERT INTO photo_app_config (key, value, description)
VALUES ('gemini_use_proxy', 'true', 'Use GEMINI_PROXY_BASE_URL for Gemini calls when true')
ON CONFLICT (key) DO NOTHING;
