-- Solo child identity photos filter the example picker by catalog child tags.
-- 240 only allowed adult/couple/family; null cache must be reclassified.

ALTER TABLE public.landing_user_photos
  DROP CONSTRAINT IF EXISTS landing_user_photos_audience_tag_valid;

ALTER TABLE public.landing_user_photos
  ADD CONSTRAINT landing_user_photos_audience_tag_valid
  CHECK (
    audience_tag IS NULL
    OR audience_tag IN (
      'devushka',
      'muzhchina',
      'para',
      'semya',
      'malchik',
      'devochka',
      'malysh'
    )
  );

UPDATE public.landing_user_photos
SET
  audience_tagged_at = NULL,
  audience_confidence = NULL
WHERE audience_tag IS NULL
  AND audience_tagged_at IS NOT NULL;
