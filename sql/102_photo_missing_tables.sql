-- ============================================================
-- AI Photo Bot — Missing Tables & Columns
-- Added: photo_assistant_sessions, photo_user_outreach,
--        photo_user_feedback, photo_issues
-- Added: is_example column on photo_results
-- ============================================================

-- 13. Assistant sessions (AI chat with function calling)
CREATE TABLE IF NOT EXISTS photo_assistant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES photo_sessions(id),
  user_id uuid NOT NULL REFERENCES photo_users(id),
  goal text,
  style text,
  emotion text,
  pose text,
  sticker_text text,          -- legacy column name, stores text overlay
  border boolean DEFAULT false,
  confirmed boolean DEFAULT false,
  current_step int DEFAULT 0,
  messages jsonb DEFAULT '[]'::jsonb,
  error_count int DEFAULT 0,
  pending_photo_file_id text,
  -- Sales / paywall tracking
  paywall_shown boolean DEFAULT false,
  paywall_shown_at timestamptz,
  sales_attempts int DEFAULT 0,
  -- Status
  status text NOT NULL DEFAULT 'active',  -- active, completed, abandoned, error
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_photo_assistant_sessions_user ON photo_assistant_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_assistant_sessions_active ON photo_assistant_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_photo_assistant_sessions_env ON photo_assistant_sessions(env);

-- 14. User outreach (personalized messages from alert channel)
CREATE TABLE IF NOT EXISTS photo_user_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES photo_users(id),
  telegram_id bigint NOT NULL,
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft',   -- draft, sent, replied, failed
  sent_at timestamptz,
  reply_text text,
  replied_at timestamptz,
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_user_outreach_user ON photo_user_outreach(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_user_outreach_status ON photo_user_outreach(status);
CREATE INDEX IF NOT EXISTS idx_photo_user_outreach_telegram ON photo_user_outreach(telegram_id);

-- 15. User feedback (support bot)
CREATE TABLE IF NOT EXISTS photo_user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  username text,
  answer_text text,
  answer_at timestamptz,
  admin_reply text,
  admin_reply_at timestamptz,
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_user_feedback_telegram ON photo_user_feedback(telegram_id);

-- 16. Issues (support bot — problem reports)
CREATE TABLE IF NOT EXISTS photo_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_id text,              -- legacy column name, stores result_id
  telegram_id bigint NOT NULL,
  username text,
  issue_text text NOT NULL,
  status text DEFAULT 'open',   -- open, resolved, closed
  -- Meta
  env text DEFAULT 'prod',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_issues_telegram ON photo_issues(telegram_id);

-- ============================================================
-- Missing column on photo_results
-- ============================================================

-- is_example flag for style preview examples
ALTER TABLE photo_results ADD COLUMN IF NOT EXISTS is_example boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_photo_results_example ON photo_results(style_preset_id, is_example) WHERE is_example = true;
