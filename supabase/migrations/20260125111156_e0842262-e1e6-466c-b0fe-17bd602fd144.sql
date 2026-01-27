-- Create bot proxy configuration table
CREATE TABLE public.bot_proxy_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bot_phone VARCHAR NOT NULL,
  trigger_label_id UUID REFERENCES public.inbox_labels(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bot proxy sessions table
CREATE TABLE public.bot_proxy_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.bot_proxy_config(id) ON DELETE CASCADE,
  client_conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  bot_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  client_phone VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_proxy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_proxy_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for bot_proxy_config
CREATE POLICY "Users can manage own bot proxy config"
ON public.bot_proxy_config
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for bot_proxy_sessions
CREATE POLICY "Users can manage own bot proxy sessions"
ON public.bot_proxy_sessions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.bot_proxy_config c
  WHERE c.id = bot_proxy_sessions.config_id AND c.user_id = auth.uid()
));

-- Service role policy for webhook operations
CREATE POLICY "Service role can manage all bot proxy sessions"
ON public.bot_proxy_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_bot_proxy_config_updated_at
BEFORE UPDATE ON public.bot_proxy_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint for user config (one config per user)
ALTER TABLE public.bot_proxy_config
ADD CONSTRAINT unique_user_bot_proxy_config UNIQUE (user_id);

-- Add index for faster lookups
CREATE INDEX idx_bot_proxy_sessions_client_conv ON public.bot_proxy_sessions(client_conversation_id);
CREATE INDEX idx_bot_proxy_sessions_bot_conv ON public.bot_proxy_sessions(bot_conversation_id);
CREATE INDEX idx_bot_proxy_sessions_active ON public.bot_proxy_sessions(is_active, config_id);