-- Add DELETE policy for chat_inbox_messages table
-- This allows users to delete messages from conversations they have access to

CREATE POLICY "Users can delete messages from accessible conversations"
ON chat_inbox_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM conversations c
    JOIN whatsapp_instances wi ON wi.id = c.instance_id
    WHERE c.id = chat_inbox_messages.conversation_id
    AND (
      wi.user_id = auth.uid()
      OR c.assigned_to = auth.uid()
      OR is_admin(auth.uid())
    )
  )
);