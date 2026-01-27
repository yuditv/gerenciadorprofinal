-- Add ai_paused_at column to track when AI was paused by human response
-- This enables auto-resume after 1 hour of inactivity

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS ai_paused_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient queries on ai_paused_at
CREATE INDEX IF NOT EXISTS idx_conversations_ai_paused_at 
ON public.conversations(ai_paused_at) 
WHERE ai_paused_at IS NOT NULL;

COMMENT ON COLUMN public.conversations.ai_paused_at IS 'Timestamp when AI was paused by human agent response. Used for auto-resume after 1 hour.';