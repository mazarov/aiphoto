-- Pinned sticker examples for the landing and the generate modal.
-- JSON: { "<style_presets_v2.id>": ["<stickers.id>", ...] } in display order, 3 per style.
-- The site reads this instead of the newest stickers.is_example rows (that flag also feeds the Telegram bot).
-- Rollback: DELETE FROM landing_generation_config WHERE key = 'sticker_landing_example_ids';
-- The listed stickers must have a public_url in the stickers-examples bucket.

INSERT INTO public.landing_generation_config (key, value)
VALUES (
  'sticker_landing_example_ids',
  '{"cartoon_telegram":["419006e8-7386-45f0-bf08-750c9ef79237","6589a6e4-0917-4569-b5cc-4474cb7b6b7d","ac9ca279-7651-4693-9238-69b66d04b029"],"photo_realistic":["510b7553-91b6-41a4-842e-660597d2d5ed","9f5d3d1f-e5d4-45d7-9e7f-ea1d83fc8232","6efdbad4-bbb7-43c8-8dfc-28798e50e2bb"],"anime_classic":["2d63424f-3677-4fcf-8951-7417bb60689b","38e0b5b8-b410-446f-bcac-eabd23fef650","077ead4a-7abb-4e07-986d-5182ad80e433"],"anime_romance":["e468c678-eea5-4720-b741-1c34618bb028","280056f3-ddca-4364-bc46-5992368c9e0d","b4355692-ac94-408e-aa80-b2148260bf64"],"anime_chibi":["95be009c-dff9-4c1e-8b44-ce46c0d09fbc","14cc6317-a698-4f2f-a380-021f7e4bb9ef","c1ccc2e7-0520-45a5-90a9-e06cfd781258"],"cute_kawaii":["c9b8954d-b639-4e36-a5be-ec9e8bb7da98","85c09324-5b22-41bd-91b2-632a96d2dbce","c6d71885-d443-4c15-a536-85076f02b27a"],"cute_cat":["aa95eb31-6ea2-4f34-b6de-3c1e0a8f69f1","b6cd11fd-bd03-4a2b-851f-4d9fd15b8ce8","77a14ac1-8f98-471d-88fb-ddb7d67448db"],"manhwa_classic":["b9d122e9-e100-4246-8a26-25ebe35e4942","b10db95f-7e1e-4fde-80ba-24f274871a6f","13e025df-c43e-4054-aea0-aaa8a3cc474c"]}'
)
ON CONFLICT (key) DO NOTHING;
