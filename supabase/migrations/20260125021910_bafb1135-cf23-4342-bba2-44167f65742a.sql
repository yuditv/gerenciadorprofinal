-- Create table for AI client memories
CREATE TABLE public.ai_client_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  
  -- Basic client data
  client_name TEXT,
  nickname TEXT,
  
  -- Purchase/service data
  device TEXT,
  app_name TEXT,
  plan_name TEXT,
  plan_price NUMERIC,
  purchase_date TIMESTAMP WITH TIME ZONE,
  expiration_date TIMESTAMP WITH TIME ZONE,
  
  -- Dynamic memories (free format)
  custom_memories JSONB DEFAULT '[]',
  
  -- AI generated summary
  ai_summary TEXT,
  
  -- Flags
  is_vip BOOLEAN DEFAULT false,
  sentiment TEXT DEFAULT 'neutral',
  
  -- Metadata
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_interactions INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, agent_id, phone)
);

-- Enable RLS
ALTER TABLE public.ai_client_memories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own client memories"
ON public.ai_client_memories
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all client memories"
ON public.ai_client_memories
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Indexes for fast lookup
CREATE INDEX idx_ai_client_memories_phone ON ai_client_memories(user_id, phone);
CREATE INDEX idx_ai_client_memories_agent ON ai_client_memories(agent_id, phone);

-- Add memory configuration columns to ai_agents
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS memory_auto_extract BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS memory_sync_clients BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS memory_generate_summary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS memory_max_items INTEGER DEFAULT 20;

-- Trigger to update updated_at
CREATE TRIGGER update_ai_client_memories_updated_at
BEFORE UPDATE ON public.ai_client_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();