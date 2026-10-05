-- Sticker edge policy (docs/05-10-sticker-quality-export-examples.md).
-- soft: the saved PNG keeps the antialiased alpha from GPT Image / rembg; hair and hems stay smooth.
-- hard: every sticker is snapped at alpha 128 (behaviour before this change). Rollback = UPDATE this row, no redeploy.
-- Chroma-keyed frames and the «Обводка» ring are always hard regardless of this row.
INSERT INTO public.landing_generation_config (key, value)
VALUES ('sticker_edge_mode', 'soft')
ON CONFLICT (key) DO NOTHING;
