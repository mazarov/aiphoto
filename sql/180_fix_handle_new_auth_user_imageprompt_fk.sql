-- Fix: after sql/179 (search_path), OAuth signup still fails with
--   ERROR: insert or update on table "landing_users" violates foreign key
--          constraint "landing_users_id_fkey" (SQLSTATE 23503)
--   → 500 Database error saving new user on /auth/v1/callback
--   → browser lands on ?auth_error=no_code (no PKCE code issued)
--
-- Cause: shared-DB contract — landing_users.id REFERENCES imageprompt_users(id),
-- not auth.users. Trigger inserted landing_users with auth.users.id before
-- imageprompt_users row existed.
--
-- Fix: upsert imageprompt_users first, then landing_users. If google_sub already
-- belongs to another shared id, skip profile insert (auth.users still succeeds;
-- app resolveSharedDbUserId / ensureLandingUserForGeneration maps later).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider text;
  v_display_name text;
  v_avatar_url text;
  v_avatar_id text;
  v_sub text;
  v_email text;
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

  v_email := NULLIF(TRIM(NEW.email), '');

  -- Prefer identity subject when GoTrue already wrote auth.identities in this txn.
  SELECT COALESCE(
    NULLIF(TRIM(i.identity_data->>'sub'), ''),
    NULLIF(TRIM(i.provider_id), '')
  )
  INTO v_sub
  FROM auth.identities i
  WHERE i.user_id = NEW.id
  ORDER BY i.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_sub IS NULL THEN
    v_sub := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'sub'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'provider_id'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'id'), '')
    );
  END IF;

  -- Unique placeholder if IdP subject is not visible yet in this trigger.
  IF v_sub IS NULL OR v_sub = '' THEN
    v_sub := 'auth:' || NEW.id::text;
  END IF;

  BEGIN
    INSERT INTO public.imageprompt_users (
      id,
      google_sub,
      email,
      email_verified,
      display_name
    )
    VALUES (
      NEW.id,
      v_sub,
      v_email,
      (NEW.email_confirmed_at IS NOT NULL),
      COALESCE(v_display_name, v_email)
    )
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.imageprompt_users.email),
      display_name = COALESCE(
        EXCLUDED.display_name,
        public.imageprompt_users.display_name
      ),
      email_verified = public.imageprompt_users.email_verified
        OR EXCLUDED.email_verified;
  EXCEPTION
    WHEN unique_violation THEN
      -- google_sub (or other unique) already owned by another shared id.
      -- Leave mapping to ensureLandingUserForGeneration; do not block signup.
      RETURN NEW;
  END;

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

-- Keep AFTER INSERT timing (required so auth.users row exists for any auth FKs).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
