-- Delete all existing canned responses
DELETE FROM canned_responses;

-- Add media columns to canned_responses table
ALTER TABLE canned_responses
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS media_name TEXT;