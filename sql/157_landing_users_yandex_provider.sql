-- Normalize Yandex OAuth provider and user profile fields in landing_users trigger

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
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

  INSERT INTO landing_users (id, display_name, avatar_url, provider)
  VALUES (NEW.id, v_display_name, v_avatar_url, v_provider)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, landing_users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, landing_users.avatar_url),
    provider = COALESCE(EXCLUDED.provider, landing_users.provider),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
