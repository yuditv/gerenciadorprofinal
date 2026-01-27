-- Alterar o valor padrão de ai_enabled para false (desativado por padrão)
ALTER TABLE conversations 
ALTER COLUMN ai_enabled SET DEFAULT false;

-- Desativar a IA em todas as conversas existentes
UPDATE conversations SET ai_enabled = false;