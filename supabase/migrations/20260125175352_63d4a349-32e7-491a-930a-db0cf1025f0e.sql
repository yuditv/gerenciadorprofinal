-- Add Mercado Pago integration fields to bot_proxy_config
ALTER TABLE public.bot_proxy_config 
ADD COLUMN IF NOT EXISTS use_mercado_pago BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mercado_pago_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bot_proxy_config.use_mercado_pago IS 'When true, generates Mercado Pago PIX payment instead of sending static payment info';
COMMENT ON COLUMN public.bot_proxy_config.mercado_pago_plan_id IS 'The subscription plan to use for generating PIX payments';