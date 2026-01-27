-- ============================================
-- FASE 1: Sistema de Atendimento WhatsApp (Inbox)
-- ============================================

-- Tabela de status dos atendentes
CREATE TABLE public.agent_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'offline')),
  auto_offline BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de etiquetas do inbox
CREATE TABLE public.inbox_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Tabela de conversas
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  contact_name TEXT,
  contact_avatar TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'snoozed')),
  assigned_to UUID,
  ai_enabled BOOLEAN DEFAULT true,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_message_preview TEXT,
  first_reply_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, phone)
);

-- Tabela de mensagens do inbox
CREATE TABLE public.chat_inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent', 'ai', 'system')),
  sender_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  is_private BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de atribuição de etiquetas às conversas
CREATE TABLE public.conversation_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.inbox_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, label_id)
);

-- Índices para performance
CREATE INDEX idx_conversations_instance_id ON public.conversations(instance_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_assigned_to ON public.conversations(assigned_to);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX idx_conversations_phone ON public.conversations(phone);

CREATE INDEX idx_chat_inbox_messages_conversation_id ON public.chat_inbox_messages(conversation_id);
CREATE INDEX idx_chat_inbox_messages_created_at ON public.chat_inbox_messages(created_at DESC);
CREATE INDEX idx_chat_inbox_messages_sender_type ON public.chat_inbox_messages(sender_type);

CREATE INDEX idx_conversation_labels_conversation_id ON public.conversation_labels(conversation_id);
CREATE INDEX idx_conversation_labels_label_id ON public.conversation_labels(label_id);

CREATE INDEX idx_agent_status_user_id ON public.agent_status(user_id);
CREATE INDEX idx_agent_status_status ON public.agent_status(status);

-- Enable RLS
ALTER TABLE public.agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies para agent_status
CREATE POLICY "Users can manage own agent status"
ON public.agent_status FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all agent statuses"
ON public.agent_status FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies para inbox_labels
CREATE POLICY "Users can manage own labels"
ON public.inbox_labels FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies para conversations
CREATE POLICY "Users can view conversations from their instances"
ON public.conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_instances wi
    WHERE wi.id = conversations.instance_id 
    AND wi.user_id = auth.uid()
  )
  OR assigned_to = auth.uid()
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create conversations for their instances"
ON public.conversations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM whatsapp_instances wi
    WHERE wi.id = conversations.instance_id 
    AND wi.user_id = auth.uid()
  )
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can update conversations they have access to"
ON public.conversations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_instances wi
    WHERE wi.id = conversations.instance_id 
    AND wi.user_id = auth.uid()
  )
  OR assigned_to = auth.uid()
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can delete conversations from their instances"
ON public.conversations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_instances wi
    WHERE wi.id = conversations.instance_id 
    AND wi.user_id = auth.uid()
  )
  OR is_admin(auth.uid())
);

-- RLS Policies para chat_inbox_messages
CREATE POLICY "Users can view messages from accessible conversations"
ON public.chat_inbox_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN whatsapp_instances wi ON wi.id = c.instance_id
    WHERE c.id = chat_inbox_messages.conversation_id
    AND (wi.user_id = auth.uid() OR c.assigned_to = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can insert messages to accessible conversations"
ON public.chat_inbox_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN whatsapp_instances wi ON wi.id = c.instance_id
    WHERE c.id = chat_inbox_messages.conversation_id
    AND (wi.user_id = auth.uid() OR c.assigned_to = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can update messages in accessible conversations"
ON public.chat_inbox_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN whatsapp_instances wi ON wi.id = c.instance_id
    WHERE c.id = chat_inbox_messages.conversation_id
    AND (wi.user_id = auth.uid() OR c.assigned_to = auth.uid() OR is_admin(auth.uid()))
  )
);

-- RLS Policies para conversation_labels
CREATE POLICY "Users can manage labels on accessible conversations"
ON public.conversation_labels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN whatsapp_instances wi ON wi.id = c.instance_id
    WHERE c.id = conversation_labels.conversation_id
    AND (wi.user_id = auth.uid() OR c.assigned_to = auth.uid() OR is_admin(auth.uid()))
  )
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_agent_status_updated_at
BEFORE UPDATE ON public.agent_status
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

CREATE TRIGGER update_inbox_labels_updated_at
BEFORE UPDATE ON public.inbox_labels
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

CREATE TRIGGER update_chat_inbox_messages_updated_at
BEFORE UPDATE ON public.chat_inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

-- Adicionar permissão can_view_inbox na tabela user_permissions
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS can_view_inbox BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_manage_inbox BOOLEAN DEFAULT true;