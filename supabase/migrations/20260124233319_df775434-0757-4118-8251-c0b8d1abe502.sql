-- Forçar ativação da IA em TODAS as conversas da instância com agente configurado
UPDATE conversations
SET 
  ai_enabled = true,
  assigned_to = null
WHERE instance_id = 'f23e78e7-0c8f-40ce-bdc3-a93fb1f14ca2';