-- Add rating column to ai_chat_messages table
ALTER TABLE public.ai_chat_messages 
ADD COLUMN rating TEXT CHECK (rating IN ('up', 'down')) DEFAULT NULL;

-- Create index for analytics queries
CREATE INDEX idx_ai_chat_messages_rating ON public.ai_chat_messages(rating) WHERE rating IS NOT NULL;

-- Create table for WhatsApp agent routing
CREATE TABLE public.whatsapp_agent_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instance_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_agent_routing ENABLE ROW LEVEL SECURITY;

-- Users can manage routing for their own instances
CREATE POLICY "Users can manage routing for own instances"
ON public.whatsapp_agent_routing
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.id = whatsapp_agent_routing.instance_id
    AND wi.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instances wi
    WHERE wi.id = whatsapp_agent_routing.instance_id
    AND wi.user_id = auth.uid()
  )
);

-- Admins can view all routings
CREATE POLICY "Admins can manage all routings"
ON public.whatsapp_agent_routing
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));