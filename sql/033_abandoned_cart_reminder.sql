-- Add fields for abandoned cart reminder tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Index for efficient abandoned cart queries
CREATE INDEX IF NOT EXISTS idx_transactions_abandoned_cart 
ON transactions (state, reminder_sent, created_at) 
WHERE state = 'created' AND reminder_sent = false;

COMMENT ON COLUMN transactions.reminder_sent IS 'Whether abandoned cart reminder was sent';
COMMENT ON COLUMN transactions.reminder_sent_at IS 'When abandoned cart reminder was sent';
