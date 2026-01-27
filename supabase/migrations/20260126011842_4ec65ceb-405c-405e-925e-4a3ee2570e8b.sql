-- Tabela para vincular sub-agentes ao agente principal
CREATE TABLE public.ai_sub_agent_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  principal_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  sub_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Garante que um sub-agente só pode estar vinculado uma vez a cada principal
  UNIQUE (principal_agent_id, sub_agent_id),
  
  -- Evita que um agente seja vinculado a si mesmo
  CHECK (principal_agent_id != sub_agent_id)
);

-- Habilitar RLS
ALTER TABLE public.ai_sub_agent_links ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem gerenciar todos os links
CREATE POLICY "Admins can manage all sub-agent links"
ON public.ai_sub_agent_links
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Política: Usuários autenticados podem visualizar links ativos
CREATE POLICY "Authenticated users can view active links"
ON public.ai_sub_agent_links
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ai_sub_agent_links_updated_at
BEFORE UPDATE ON public.ai_sub_agent_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_sub_agent_links_principal ON public.ai_sub_agent_links(principal_agent_id);
CREATE INDEX idx_sub_agent_links_sub_agent ON public.ai_sub_agent_links(sub_agent_id);

-- Adicionar coluna consultation_context para contexto adicional ao consultar especialista
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS consultation_context TEXT DEFAULT NULL;

-- Comentários para documentação
COMMENT ON TABLE public.ai_sub_agent_links IS 'Vincula sub-agentes especialistas ao agente principal para consultas internas';
COMMENT ON COLUMN public.ai_sub_agent_links.priority IS 'Prioridade do sub-agente (1 = mais alta)';
COMMENT ON COLUMN public.ai_agents.consultation_context IS 'Contexto adicional quando este agente é consultado como especialista';