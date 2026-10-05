-- Sticker background removal routing (docs/05-10-sticker-quality-export-examples.md).
-- chroma_first: key out the flat #FF00FF the model painted; rembg only when the frame is not magenta.
-- rembg: always the segmentation model (behaviour before 05.10). Rollback = UPDATE this row, no redeploy.
INSERT INTO public.landing_generation_config (key, value)
VALUES ('sticker_bg_route', 'chroma_first')
ON CONFLICT (key) DO NOTHING;
