-- Allow owner to delete messages in their conversations
CREATE POLICY "Owner can delete messages in their conversations"
ON public.customer_messages
FOR DELETE
USING (owner_id = public.account_owner_id(auth.uid()));

-- Allow owner to delete their customer conversations
CREATE POLICY "Owner can delete their customer conversations"
ON public.customer_conversations
FOR DELETE
USING (owner_id = public.account_owner_id(auth.uid()));