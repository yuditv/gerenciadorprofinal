-- Adicionar colunas para agentes nativos com OpenAI
ALTER TABLE ai_agents 
  ADD COLUMN use_native_ai BOOLEAN DEFAULT false,
  ADD COLUMN system_prompt TEXT,
  ADD COLUMN ai_model TEXT DEFAULT 'gpt-4o-mini';

-- Tornar webhook_url opcional (nullable) para agentes nativos
ALTER TABLE ai_agents 
  ALTER COLUMN webhook_url DROP NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN ai_agents.use_native_ai IS 'Se true, usa OpenAI diretamente. Se false, usa webhook externo.';
COMMENT ON COLUMN ai_agents.system_prompt IS 'Prompt do sistema para agentes nativos (instrução inicial do agente).';
COMMENT ON COLUMN ai_agents.ai_model IS 'Modelo da OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo';