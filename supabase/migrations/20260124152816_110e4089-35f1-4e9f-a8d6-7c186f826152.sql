-- Adicionar campo de valor do negócio aos leads CRM
ALTER TABLE crm_lead_data 
ADD COLUMN IF NOT EXISTS deal_value NUMERIC DEFAULT 0;

-- Adicionar campo de data de fechamento
ALTER TABLE crm_lead_data 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Adicionar campo de motivo de perda
ALTER TABLE crm_lead_data 
ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- Índice para performance em queries de métricas
CREATE INDEX IF NOT EXISTS idx_crm_lead_data_deal_value ON crm_lead_data(deal_value);
CREATE INDEX IF NOT EXISTS idx_crm_lead_data_closed_at ON crm_lead_data(closed_at);