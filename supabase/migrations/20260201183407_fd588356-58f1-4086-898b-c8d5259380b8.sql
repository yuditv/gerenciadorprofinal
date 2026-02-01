-- Add AI support columns to customer_conversations
ALTER TABLE public.customer_conversations
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS active_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- Create index for AI-enabled conversations
CREATE INDEX IF NOT EXISTS idx_customer_conversations_ai_enabled 
ON public.customer_conversations(ai_enabled) 
WHERE ai_enabled = true;

-- Add comment
COMMENT ON COLUMN public.customer_conversations.ai_enabled IS 'Whether AI agent is enabled for this customer chat';
COMMENT ON COLUMN public.customer_conversations.active_agent_id IS 'The AI agent assigned to this customer chat';