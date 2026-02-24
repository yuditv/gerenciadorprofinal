
-- Create enum for provider types
CREATE TYPE public.whatsapp_provider_type AS ENUM ('uazapi', 'evolution', 'waha', 'custom');

-- Table to store WhatsApp API providers
CREATE TABLE public.whatsapp_api_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider_type public.whatsapp_provider_type NOT NULL DEFAULT 'uazapi',
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  extra_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_api_providers ENABLE ROW LEVEL SECURITY;

-- Only admins can manage providers
CREATE POLICY "Only admins can view providers"
ON public.whatsapp_api_providers FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert providers"
ON public.whatsapp_api_providers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Only admins can update providers"
ON public.whatsapp_api_providers FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete providers"
ON public.whatsapp_api_providers FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_api_providers_updated_at
BEFORE UPDATE ON public.whatsapp_api_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add provider_id column to whatsapp_instances to link instance to a specific provider
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.whatsapp_api_providers(id) ON DELETE SET NULL;
