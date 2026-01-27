-- Create table for subscription notification settings
CREATE TABLE public.subscription_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN DEFAULT true,
  reminder_messages JSONB DEFAULT '{"threeDays": "Olá! Sua assinatura expira em 3 dias. Renove agora para continuar aproveitando todos os recursos!", "oneDay": "Atenção! Sua assinatura expira amanhã. Não perca acesso às funcionalidades, renove já!", "today": "Sua assinatura expira HOJE! Renove agora para não perder o acesso ao sistema."}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.subscription_notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own subscription notification settings" 
ON public.subscription_notification_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscription notification settings" 
ON public.subscription_notification_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription notification settings" 
ON public.subscription_notification_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_subscription_notification_settings_updated_at
BEFORE UPDATE ON public.subscription_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_subscription_updated_at();