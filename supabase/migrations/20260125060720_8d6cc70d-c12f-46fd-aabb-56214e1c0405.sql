-- Add use_canned_responses column to ai_agents table
ALTER TABLE public.ai_agents 
ADD COLUMN IF NOT EXISTS use_canned_responses BOOLEAN DEFAULT true;