-- Tabela de configuração dos campos CRM customizados
CREATE TABLE crm_fields_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_id UUID,
  field_key VARCHAR(20) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) DEFAULT 'text',
  field_options JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, instance_id, field_key)
);

-- Tabela de dados do lead CRM
CREATE TABLE crm_lead_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID,
  phone VARCHAR(50) NOT NULL,
  instance_id UUID,
  lead_name VARCHAR(255),
  lead_full_name VARCHAR(255),
  lead_email VARCHAR(255),
  lead_personal_id VARCHAR(100),
  lead_status VARCHAR(100) DEFAULT 'lead',
  lead_notes TEXT,
  lead_kanban_order INTEGER DEFAULT 1000,
  is_ticket_open BOOLEAN DEFAULT true,
  custom_fields JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone, instance_id)
);

-- Habilitar RLS
ALTER TABLE crm_fields_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_data ENABLE ROW LEVEL SECURITY;

-- Políticas para crm_fields_config
CREATE POLICY "Users can manage own CRM field configs"
ON crm_fields_config FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Políticas para crm_lead_data
CREATE POLICY "Users can manage own CRM lead data"
ON crm_lead_data FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_crm_fields_config_updated_at
BEFORE UPDATE ON crm_fields_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_lead_data_updated_at
BEFORE UPDATE ON crm_lead_data
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_crm_lead_data_phone ON crm_lead_data(phone);
CREATE INDEX idx_crm_lead_data_instance ON crm_lead_data(instance_id);
CREATE INDEX idx_crm_lead_data_conversation ON crm_lead_data(conversation_id);
CREATE INDEX idx_crm_lead_data_status ON crm_lead_data(lead_status);
CREATE INDEX idx_crm_fields_config_user ON crm_fields_config(user_id);