-- Create table to store PIX payments generated for clients in chat
CREATE TABLE public.client_pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  client_phone VARCHAR NOT NULL,
  plan_id UUID REFERENCES public.bot_proxy_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  duration_days INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  pix_code TEXT,
  pix_qr_code TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_client_pix_payments_user_id ON public.client_pix_payments(user_id);
CREATE INDEX idx_client_pix_payments_conversation_id ON public.client_pix_payments(conversation_id);
CREATE INDEX idx_client_pix_payments_status ON public.client_pix_payments(status);

-- Enable RLS
ALTER TABLE public.client_pix_payments ENABLE ROW LEVEL SECURITY;

-- RLS policy for users to manage their own payments
CREATE POLICY "Users can manage own client pix payments" 
ON public.client_pix_payments 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_client_pix_payments_updated_at
BEFORE UPDATE ON public.client_pix_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();