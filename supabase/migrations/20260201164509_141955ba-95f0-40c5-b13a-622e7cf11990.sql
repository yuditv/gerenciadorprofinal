-- Enable realtime events for customer chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_conversations;

-- (Optional sanity) ensure replica identity is full for updates, if you later listen for UPDATE events
ALTER TABLE public.customer_messages REPLICA IDENTITY FULL;
ALTER TABLE public.customer_conversations REPLICA IDENTITY FULL;