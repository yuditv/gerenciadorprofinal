-- Add reminder_messages column to store custom message templates
ALTER TABLE notification_settings 
ADD COLUMN IF NOT EXISTS reminder_messages JSONB DEFAULT '{
  "before": "Olá {nome}! Seu plano {plano} vence AMANHÃ ({vencimento}). Renove agora para não perder o acesso!",
  "today": "Olá {nome}! Seu plano {plano} vence HOJE ({vencimento}). Renove agora para continuar com acesso!",
  "after": "Olá {nome}! Seu plano {plano} venceu ontem ({vencimento}). Renove para reativar seu acesso!"
}'::jsonb;