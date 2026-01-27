-- Add extra columns to whatsapp_instances table
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS instance_key text,
  ADD COLUMN IF NOT EXISTS daily_limit integer DEFAULT 200,
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS phone_connected text,
  ADD COLUMN IF NOT EXISTS business_hours_start time DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS business_hours_end time DEFAULT '18:00:00';

-- Add index for instance_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_key 
  ON whatsapp_instances(instance_key) 
  WHERE instance_key IS NOT NULL;