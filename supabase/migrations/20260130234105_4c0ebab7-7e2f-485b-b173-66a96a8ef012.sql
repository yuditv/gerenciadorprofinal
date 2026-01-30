-- Add global agent setting for expired clients
ALTER TABLE public.ai_agent_preferences
ADD COLUMN IF NOT EXISTS expired_client_agent_id uuid NULL;

-- Optional: keep updated_at consistent on updates done by client
COMMENT ON COLUMN public.ai_agent_preferences.expired_client_agent_id IS 'Agente global para ativar manualmente em clientes expirados (CRM)';
