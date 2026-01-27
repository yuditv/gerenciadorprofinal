-- Ativar IA e remover atribuição humana nas conversas da instância com roteamento de agente ativo
UPDATE conversations
SET 
  ai_enabled = true,
  assigned_to = null
WHERE instance_id IN (
  SELECT DISTINCT wi.id 
  FROM whatsapp_instances wi
  INNER JOIN whatsapp_agent_routing war ON war.instance_id = wi.id
  WHERE war.is_active = true
)
AND (ai_enabled = false OR assigned_to IS NOT NULL);