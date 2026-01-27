-- Drop trigger first, then function, then recreate with proper search_path
DROP TRIGGER IF EXISTS update_dispatch_configs_updated_at ON public.dispatch_configs;
DROP FUNCTION IF EXISTS public.update_dispatch_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_dispatch_configs_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_dispatch_configs_updated_at
BEFORE UPDATE ON public.dispatch_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_dispatch_configs_updated_at();