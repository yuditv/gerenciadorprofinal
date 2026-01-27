-- Create table for plan settings
CREATE TABLE public.plan_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_key TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  plan_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_key)
);

-- Enable RLS
ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own plan settings" 
ON public.plan_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plan settings" 
ON public.plan_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan settings" 
ON public.plan_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plan settings" 
ON public.plan_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_plan_settings_updated_at
BEFORE UPDATE ON public.plan_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();