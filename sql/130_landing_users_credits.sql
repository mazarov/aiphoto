  -- Add credits to landing_users for web generation
  ALTER TABLE landing_users
    ADD COLUMN IF NOT EXISTS credits int NOT NULL DEFAULT 0;
