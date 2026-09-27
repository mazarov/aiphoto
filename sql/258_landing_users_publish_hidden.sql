-- Per-user switch: hide «Опубликовать» and reject new publications.
-- Also take the listed cards off the public catalog.

ALTER TABLE public.landing_users
  ADD COLUMN IF NOT EXISTS publish_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.landing_users.publish_hidden IS
  'When true, this user does not see Publish and cannot publish cards. Admin service-role only.';

CREATE OR REPLACE FUNCTION public.landing_users_protect_publish_hidden()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.publish_hidden := OLD.publish_hidden;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_users_protect_publish_hidden ON public.landing_users;
CREATE TRIGGER landing_users_protect_publish_hidden
  BEFORE UPDATE ON public.landing_users
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_users_protect_publish_hidden();

REVOKE ALL ON FUNCTION public.landing_users_protect_publish_hidden()
  FROM PUBLIC, anon, authenticated;

UPDATE public.landing_users AS lu
SET
  publish_hidden = true,
  updated_at = now()
WHERE lu.id IN (
  SELECT c.author_user_id
  FROM public.prompt_cards AS c
  WHERE c.author_user_id IS NOT NULL
    AND c.slug IN (
      'visual-hook-elegantnyy-i-soblaznitelnyy-obraz-sochetayushchiy-strogiy-pidzhak-s-f91d2',
      '9-mesyats-beremennosti-85468',
      '9-mesyats-beremennosti-motion-ona-medlenno-podnimaet-vzglyad-ulybka-stanovitsya-503d1',
      '4-i-5-mesyats-beremennosti-ccbf3',
      '4-i-5-mesyats-beremennosti-ce111'
    )
);

UPDATE public.prompt_cards
SET
  is_published = false,
  updated_at = now()
WHERE slug IN (
  'visual-hook-elegantnyy-i-soblaznitelnyy-obraz-sochetayushchiy-strogiy-pidzhak-s-f91d2',
  '9-mesyats-beremennosti-85468',
  '9-mesyats-beremennosti-motion-ona-medlenno-podnimaet-vzglyad-ulybka-stanovitsya-503d1',
  '4-i-5-mesyats-beremennosti-ccbf3',
  '4-i-5-mesyats-beremennosti-ce111'
)
AND is_published IS DISTINCT FROM false;
