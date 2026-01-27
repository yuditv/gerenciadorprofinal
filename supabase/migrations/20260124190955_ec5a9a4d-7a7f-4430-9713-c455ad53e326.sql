-- Atualizar o modelo de IA do agente existente
UPDATE ai_agents 
SET ai_model = 'google/gemini-2.5-flash'
WHERE id = '73430a88-25d8-442e-9771-fba47b089f8f';

-- Atualizar o valor padrão da coluna ai_model para novos agentes
ALTER TABLE ai_agents 
ALTER COLUMN ai_model SET DEFAULT 'google/gemini-2.5-flash';