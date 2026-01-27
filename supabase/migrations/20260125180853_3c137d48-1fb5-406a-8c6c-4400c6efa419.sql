-- Create table for bot proxy VIP plans
CREATE TABLE public.bot_proxy_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.bot_proxy_config(id) ON DELETE CASCADE,
  option_number INTEGER NOT NULL CHECK (option_number BETWEEN 1 AND 3),
  name VARCHAR(100) NOT NULL,
  duration_days INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(config_id, option_number)
);

-- Enable RLS
ALTER TABLE public.bot_proxy_plans ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can manage plans via their config
CREATE POLICY "Users can manage own bot proxy plans"
ON public.bot_proxy_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.bot_proxy_config c
    WHERE c.id = bot_proxy_plans.config_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bot_proxy_config c
    WHERE c.id = bot_proxy_plans.config_id
    AND c.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_bot_proxy_plans_updated_at
BEFORE UPDATE ON public.bot_proxy_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();