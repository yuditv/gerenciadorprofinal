-- Create table for bot proxy text replacements
CREATE TABLE public.bot_proxy_replacements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid NOT NULL REFERENCES public.bot_proxy_config(id) ON DELETE CASCADE,
  search_text text NOT NULL,
  replace_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bot_proxy_replacements ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can manage replacements for their own config
CREATE POLICY "Users can manage own bot proxy replacements"
ON public.bot_proxy_replacements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.bot_proxy_config c
    WHERE c.id = bot_proxy_replacements.config_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bot_proxy_config c
    WHERE c.id = bot_proxy_replacements.config_id
    AND c.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_bot_proxy_replacements_updated_at
BEFORE UPDATE ON public.bot_proxy_replacements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();