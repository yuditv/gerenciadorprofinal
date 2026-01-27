-- Update the create_trial_subscription function to use 1 day instead of 7 days
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, status, trial_ends_at)
  VALUES (NEW.id, 'trial', now() + interval '1 day');
  RETURN NEW;
END;
$function$;