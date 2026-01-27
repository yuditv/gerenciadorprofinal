-- Tabela para armazenar os agentes de IA configurados pelo admin
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  webhook_url TEXT NOT NULL,
  icon TEXT DEFAULT 'bot',
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  is_whatsapp_enabled BOOLEAN DEFAULT true,
  is_chat_enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para histórico de mensagens do chat
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_id UUID DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ai_agents_is_active ON public.ai_agents(is_active);
CREATE INDEX idx_ai_agents_created_by ON public.ai_agents(created_by);
CREATE INDEX idx_ai_chat_messages_agent_id ON public.ai_chat_messages(agent_id);
CREATE INDEX idx_ai_chat_messages_user_id ON public.ai_chat_messages(user_id);
CREATE INDEX idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_messages_created_at ON public.ai_chat_messages(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para ai_agents
-- Admins podem gerenciar todos os agentes
CREATE POLICY "Admins can manage all agents"
ON public.ai_agents
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Usuários autenticados podem visualizar agentes ativos
CREATE POLICY "Authenticated users can view active agents"
ON public.ai_agents
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Políticas para ai_chat_messages
-- Usuários podem gerenciar suas próprias mensagens
CREATE POLICY "Users can manage own chat messages"
ON public.ai_chat_messages
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins podem visualizar todas as mensagens (para auditoria)
CREATE POLICY "Admins can view all chat messages"
ON public.ai_chat_messages
FOR SELECT
USING (is_admin(auth.uid()));

-- Trigger para atualizar updated_at nos agentes
CREATE OR REPLACE FUNCTION public.update_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_agents_updated_at();