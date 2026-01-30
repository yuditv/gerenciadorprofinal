-- Add presence_status column to whatsapp_instances table
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'available' CHECK (presence_status IN ('available', 'unavailable'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_presence_status ON public.whatsapp_instances(presence_status);