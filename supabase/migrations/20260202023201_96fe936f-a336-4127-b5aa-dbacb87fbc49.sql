-- Fix: Drop the broken AI trigger (pg_net is not available)
DROP TRIGGER IF EXISTS trigger_customer_chat_ai_on_insert ON public.customer_messages;
DROP FUNCTION IF EXISTS trigger_customer_chat_ai();

-- Fix: Allow content to be NULL when media_url is present
-- The existing trigger validate_customer_message_sender already handles validation
-- but the column has NOT NULL constraint. We need to make content nullable.
ALTER TABLE public.customer_messages ALTER COLUMN content DROP NOT NULL;