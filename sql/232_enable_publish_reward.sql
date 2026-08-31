-- Turn on publish-for-credits after video UGC publish works.
-- 231 must be applied first (keys + RPC + first_published_at).

UPDATE public.landing_generation_config
SET value = 'true', updated_at = now()
WHERE key = 'publish_reward_enabled';

-- Recent UGC published before the trigger existed would otherwise stay
-- first_published_at NULL and skip the grant as "legacy".
UPDATE public.prompt_cards
SET first_published_at = now()
WHERE is_published = true
  AND first_published_at IS NULL
  AND source_dataset_slug = 'web_generation_ugc'
  AND updated_at > now() - interval '2 days';
