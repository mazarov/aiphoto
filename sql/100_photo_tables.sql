-- ============================================================
-- AI Photo Bot — Database Schema
-- All tables prefixed with photo_ to coexist with photo2sticker
-- Same Supabase instance, separate tables
-- ============================================================

-- 1. Users
CREATE TABLE IF NOT EXISTS photo_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  lang text DEFAULT 'en',
  username text,
  credits int DEFAULT 0,
  total_generations int DEFAULT 0,
  has_purchased boolean DEFAULT false,
  onboarding_step int DEFAULT 0,
  language_code text,
  last_photo_file_id text,
  -- UTM tracking
  start_payload text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_users_telegram_id ON photo_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_photo_users_env ON photo_users(env);
CREATE INDEX IF NOT EXISTS idx_photo_users_username ON photo_users(username);
CREATE INDEX IF NOT EXISTS idx_photo_users_utm_source ON photo_users(utm_source);

-- 2. Session states
DO $$ BEGIN
  CREATE TYPE photo_session_state AS ENUM (
    'wait_photo',
    'wait_style',
    'wait_model',
    'wait_format',
    'wait_quality',
    'processing',
    'confirm_result',
    'wait_payment',
    'assistant_wait_photo',
    'assistant_chat',
    'wait_assistant_confirm'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Sessions
CREATE TABLE IF NOT EXISTS photo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES photo_users(id),
  state photo_session_state DEFAULT 'wait_photo',
  is_active boolean DEFAULT true,
  photos jsonb DEFAULT '[]'::jsonb,
  -- Generation params
  current_photo_file_id text,
  selected_style_id text,
  selected_style_group text,
  selected_model text,             -- gemini-2.5-flash-image / gemini-3-pro-image-preview
  selected_aspect_ratio text,      -- 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3
  selected_quality text,           -- fhd, 2k, 4k
  generation_type text DEFAULT 'style',
  user_input text,
  prompt_final text,
  credits_spent int DEFAULT 1,
  -- Result tracking
  last_result_file_id text,        -- telegram file_id of last generated photo
  last_result_storage_path text,   -- path in Supabase Storage
  -- Progress messages
  progress_message_id bigint,
  progress_chat_id bigint,
  -- AI Assistant
  assistant_messages jsonb DEFAULT '[]'::jsonb,
  assistant_params jsonb,
  assistant_error_count int DEFAULT 0,
  pending_photo_file_id text,
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_sessions_user ON photo_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_sessions_active ON photo_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_photo_sessions_env ON photo_sessions(env);

-- 4. Jobs queue
CREATE TABLE IF NOT EXISTS photo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES photo_sessions(id),
  user_id uuid NOT NULL REFERENCES photo_users(id),
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  error text,
  worker_id text,
  started_at timestamptz,
  completed_at timestamptz,
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_jobs_status ON photo_jobs(status);
CREATE INDEX IF NOT EXISTS idx_photo_jobs_session ON photo_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_photo_jobs_queued ON photo_jobs(status, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_photo_jobs_env ON photo_jobs(env);

-- 5. Results (generated photos)
CREATE TABLE IF NOT EXISTS photo_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES photo_users(id),
  session_id uuid NOT NULL REFERENCES photo_sessions(id),
  source_photo_file_id text NOT NULL,
  user_input text,
  generated_prompt text,
  result_storage_path text,
  telegram_file_id text,
  -- Generation params snapshot
  style_preset_id text,
  model_used text,
  aspect_ratio text,
  quality text,
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_results_user ON photo_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_results_session ON photo_results(session_id);
CREATE INDEX IF NOT EXISTS idx_photo_results_telegram ON photo_results(telegram_file_id);
CREATE INDEX IF NOT EXISTS idx_photo_results_env ON photo_results(env);

-- 6. Transactions / Payments
CREATE TABLE IF NOT EXISTS photo_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES photo_users(id),
  amount int NOT NULL,
  price int NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'created',
  is_active boolean DEFAULT true,
  pre_checkout_query_id text,
  telegram_payment_charge_id text,
  provider_payment_charge_id text,
  -- Abandoned cart tracking
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  alert_sent boolean DEFAULT false,
  alert_sent_at timestamptz,
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_transactions_user ON photo_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_transactions_state ON photo_transactions(state);
CREATE INDEX IF NOT EXISTS idx_photo_transactions_active ON photo_transactions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_photo_transactions_env ON photo_transactions(env);

-- 7. App config (runtime settings)
CREATE TABLE IF NOT EXISTS photo_app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO photo_app_config (key, value, description) VALUES
  ('gemini_model_default', 'gemini-3-pro-image-preview', 'Default Gemini model for generation'),
  ('default_aspect_ratio', '1:1', 'Default aspect ratio'),
  ('default_quality', 'fhd', 'Default quality (fhd/2k/4k)')
ON CONFLICT (key) DO NOTHING;

-- 8. Style groups
CREATE TABLE IF NOT EXISTS photo_style_groups (
  id text PRIMARY KEY,
  emoji text NOT NULL,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 9. Style presets
CREATE TABLE IF NOT EXISTS photo_style_presets (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES photo_style_groups(id),
  emoji text NOT NULL,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  prompt_hint text NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 10. Agents (LLM prompt generation)
CREATE TABLE IF NOT EXISTS photo_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  model text NOT NULL DEFAULT 'gemini-2.0-flash',
  system_prompt text NOT NULL,
  few_shot_examples jsonb DEFAULT '[]'::jsonb,
  output_schema jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. Bot texts (localization)
CREATE TABLE IF NOT EXISTS photo_bot_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text NOT NULL,
  key text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lang, key)
);

CREATE INDEX IF NOT EXISTS idx_photo_bot_texts_lang_key ON photo_bot_texts(lang, key);

-- 12. Prompt templates
CREATE TABLE IF NOT EXISTS photo_prompt_templates (
  id text PRIMARY KEY,
  template text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Atomic job claim
CREATE OR REPLACE FUNCTION photo_claim_job(p_worker_id text, p_env text DEFAULT 'prod')
RETURNS SETOF photo_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE photo_jobs
  SET
    status = 'processing',
    worker_id = p_worker_id,
    started_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  WHERE id = (
    SELECT id FROM photo_jobs
    WHERE status = 'queued'
      AND env = p_env
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- Atomic credit deduction
CREATE OR REPLACE FUNCTION photo_deduct_credits(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_credits int;
BEGIN
  UPDATE photo_users
  SET credits = credits - p_amount, updated_at = now()
  WHERE id = p_user_id AND credits >= p_amount
  RETURNING credits INTO v_credits;

  RETURN COALESCE(v_credits, -1);
END;
$$;

-- Increment generations counter
CREATE OR REPLACE FUNCTION photo_increment_generations(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE photo_users
  SET total_generations = total_generations + 1, updated_at = now()
  WHERE id = p_user_id;
END;
$$;
