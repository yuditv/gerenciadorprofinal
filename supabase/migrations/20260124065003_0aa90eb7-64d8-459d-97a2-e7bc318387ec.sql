-- Habilitar Realtime para as tabelas de chat
ALTER PUBLICATION supabase_realtime ADD TABLE chat_inbox_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Replica Identity FULL para melhor tracking de UPDATEs (status, leitura, etc.)
ALTER TABLE chat_inbox_messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;