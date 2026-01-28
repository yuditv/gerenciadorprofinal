-- Add metadata column to store conversation state (e.g., bot_menu)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Optional index for querying metadata (future-proof)
CREATE INDEX IF NOT EXISTS idx_conversations_metadata_gin
ON public.conversations
USING gin (metadata);