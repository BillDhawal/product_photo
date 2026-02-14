-- Run this in Supabase SQL Editor to create the credits table
CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  daily_credits_used INT DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  purchased_credits INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_daily_reset ON user_credits(daily_reset_at);

-- Enable RLS if needed (optional - service role bypasses RLS)
-- ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
