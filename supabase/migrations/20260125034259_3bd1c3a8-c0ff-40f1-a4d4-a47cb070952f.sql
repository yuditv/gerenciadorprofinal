-- Tabela para buffer de mensagens da IA
CREATE TABLE public.ai_message_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  instance_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]'::jsonb,
  first_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  scheduled_response_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'buffering',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ai_buffer_status ON ai_message_buffer(status, scheduled_response_at);
CREATE UNIQUE INDEX idx_ai_buffer_conversation_active ON ai_message_buffer(conversation_id) 
  WHERE status = 'buffering';

-- RLS
ALTER TABLE ai_message_buffer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own message buffers"
  ON ai_message_buffer FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all buffers"
  ON ai_message_buffer FOR ALL
  USING (true)
  WITH CHECK (true);

-- Novas colunas na tabela ai_agents para configuração do buffer
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS 
  message_buffer_enabled BOOLEAN DEFAULT true;
  
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS 
  buffer_wait_seconds INTEGER DEFAULT 5;
  
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS 
  buffer_max_messages INTEGER DEFAULT 10;

-- Adicionar coluna para regras anti-alucinação customizáveis
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS 
  anti_hallucination_enabled BOOLEAN DEFAULT true;