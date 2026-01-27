-- Add WhatsApp integration fields to inbox_labels
ALTER TABLE inbox_labels 
ADD COLUMN IF NOT EXISTS whatsapp_label_id TEXT,
ADD COLUMN IF NOT EXISTS color_code INTEGER,
ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;

-- Create index for faster lookups by instance
CREATE INDEX IF NOT EXISTS idx_inbox_labels_instance_id ON inbox_labels(instance_id);

-- Create index for WhatsApp label ID lookups
CREATE INDEX IF NOT EXISTS idx_inbox_labels_whatsapp_label_id ON inbox_labels(whatsapp_label_id);

-- Add comment for documentation
COMMENT ON COLUMN inbox_labels.whatsapp_label_id IS 'ID da etiqueta no WhatsApp (retornado pela UAZAPI)';
COMMENT ON COLUMN inbox_labels.color_code IS 'Código de cor 0-19 da UAZAPI';
COMMENT ON COLUMN inbox_labels.instance_id IS 'Instância WhatsApp vinculada à etiqueta';