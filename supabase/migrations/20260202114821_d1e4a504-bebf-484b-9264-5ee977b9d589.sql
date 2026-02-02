-- Add new columns to ai_agent_preferences for Customer Chat settings
ALTER TABLE public.ai_agent_preferences 
  ADD COLUMN IF NOT EXISTS customer_chat_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_chat_auto_start boolean NOT NULL DEFAULT false;