-- Create dispatch_configs table for storing reusable dispatch configurations
CREATE TABLE public.dispatch_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  
  -- Instâncias
  instance_ids UUID[] NOT NULL DEFAULT '{}',
  balancing_mode TEXT DEFAULT 'automatic',
  
  -- Mensagens (JSON array with variations)
  messages JSONB NOT NULL DEFAULT '[]',
  randomize_order BOOLEAN DEFAULT false,
  
  -- Timing
  min_delay_seconds INTEGER DEFAULT 2,
  max_delay_seconds INTEGER DEFAULT 5,
  pause_after_messages INTEGER DEFAULT 100,
  pause_duration_minutes INTEGER DEFAULT 30,
  stop_after_messages INTEGER DEFAULT 0,
  smart_delay BOOLEAN DEFAULT true,
  attention_call BOOLEAN DEFAULT false,
  auto_archive BOOLEAN DEFAULT false,
  ai_personalization BOOLEAN DEFAULT false,
  
  -- Janela de envio
  business_hours_enabled BOOLEAN DEFAULT false,
  business_hours_start TIME DEFAULT '08:00',
  business_hours_end TIME DEFAULT '18:00',
  allowed_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
  
  -- Verificação
  verify_numbers BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own dispatch configs" 
ON public.dispatch_configs 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add variables column to campaign_contacts for custom data per contact
ALTER TABLE public.campaign_contacts 
ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';

-- Create bulk_dispatch_history table if not exists (for tracking dispatches)
CREATE TABLE IF NOT EXISTS public.bulk_dispatch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  dispatch_type TEXT NOT NULL DEFAULT 'whatsapp',
  target_type TEXT NOT NULL DEFAULT 'contacts',
  total_recipients INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  message_content TEXT,
  config_id UUID REFERENCES public.dispatch_configs(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on bulk_dispatch_history
ALTER TABLE public.bulk_dispatch_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bulk_dispatch_history
CREATE POLICY "Users can manage own dispatch history" 
ON public.bulk_dispatch_history 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at on dispatch_configs
CREATE OR REPLACE FUNCTION public.update_dispatch_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dispatch_configs_updated_at
BEFORE UPDATE ON public.dispatch_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_dispatch_configs_updated_at();