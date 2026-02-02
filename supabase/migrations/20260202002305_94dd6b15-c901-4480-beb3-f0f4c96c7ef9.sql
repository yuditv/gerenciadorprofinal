-- Add media columns to customer_messages table
ALTER TABLE public.customer_messages
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT;