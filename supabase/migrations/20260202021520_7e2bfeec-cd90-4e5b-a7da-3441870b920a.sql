-- Create a function to call the customer-chat-ai edge function when a customer message arrives
CREATE OR REPLACE FUNCTION public.trigger_customer_chat_ai()
RETURNS TRIGGER AS $$
DECLARE
  conv_record RECORD;
  edge_url TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only process messages from customers
  IF NEW.sender_type != 'customer' THEN
    RETURN NEW;
  END IF;
  
  -- Check if conversation has AI enabled
  SELECT ai_enabled, active_agent_id INTO conv_record
  FROM public.customer_conversations
  WHERE id = NEW.conversation_id;
  
  -- Skip if AI not enabled or no agent assigned
  IF NOT COALESCE(conv_record.ai_enabled, false) OR conv_record.active_agent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Call the edge function using pg_net
  -- The edge function URL will be constructed from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    edge_url := supabase_url || '/functions/v1/customer-chat-ai';
    
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'conversationId', NEW.conversation_id,
        'messageId', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't fail the insert
    RAISE WARNING 'Failed to trigger customer chat AI: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_customer_chat_ai_on_insert ON public.customer_messages;

CREATE TRIGGER trigger_customer_chat_ai_on_insert
  AFTER INSERT ON public.customer_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_customer_chat_ai();