-- Update trigger to allow empty content when media is present
CREATE OR REPLACE FUNCTION public.validate_customer_message_sender()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender_type NOT IN ('owner', 'customer') THEN
    RAISE EXCEPTION 'Invalid sender_type';
  END IF;
  -- Allow empty content if media_url is present
  IF (NEW.content IS NULL OR length(trim(NEW.content)) = 0) AND NEW.media_url IS NULL THEN
    RAISE EXCEPTION 'Message content or media_url is required';
  END IF;
  IF NEW.content IS NOT NULL AND length(NEW.content) > 4000 THEN
    RAISE EXCEPTION 'Message content too long';
  END IF;
  RETURN NEW;
END;
$function$;