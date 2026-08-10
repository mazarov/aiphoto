-- Fix: GoTrue signup fails with
--   ERROR: relation "landing_users" does not exist (SQLSTATE 42P01)
--   → 500 Database error saving new user on /auth/v1/callback
--
-- Cause: handle_new_auth_user() is SECURITY DEFINER without search_path,
-- so when the trigger runs under GoTrue the unqualified landing_users
-- resolves outside public.
--
-- Keep Yandex provider normalization from sql/157_*.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text;
  v_display_name text;
  v_avatar_url text;
  v_avatar_id text;
BEGIN
  v_provider := NEW.raw_app_meta_data->>'provider';
  IF v_provider = 'custom:yandex' THEN
    v_provider := 'yandex';
  END IF;

  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'real_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), '')
  );

  v_avatar_id := NULLIF(TRIM(NEW.raw_user_meta_data->>'default_avatar_id'), '');
  v_avatar_url := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'), ''),
    CASE
      WHEN v_avatar_id IS NOT NULL THEN
        'https://avatars.yandex.net/get-yapic/' || v_avatar_id || '/islands-200'
      ELSE NULL
    END
  );

  INSERT INTO public.landing_users (id, display_name, avatar_url, provider)
  VALUES (NEW.id, v_display_name, v_avatar_url, v_provider)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.landing_users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.landing_users.avatar_url),
    provider = COALESCE(EXCLUDED.provider, public.landing_users.provider),
    updated_at = now();

  RETURN NEW;
END;
$$;
