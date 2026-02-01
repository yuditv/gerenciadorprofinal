-- Customer real-time chat (owner <-> customer)

-- 1) Links (invites) the owner shares with the customer
CREATE TABLE IF NOT EXISTS public.customer_chat_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz NULL,
  customer_user_id uuid NULL,
  customer_name text NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_chat_links_owner_id ON public.customer_chat_links(owner_id);
CREATE INDEX IF NOT EXISTS idx_customer_chat_links_customer_user_id ON public.customer_chat_links(customer_user_id);

-- 2) Conversations (1:1)
CREATE TABLE IF NOT EXISTS public.customer_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  link_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NULL,
  unread_owner_count integer NOT NULL DEFAULT 0,
  unread_customer_count integer NOT NULL DEFAULT 0
);

-- Ensure one conversation per (owner, customer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_customer_conversations_owner_customer'
  ) THEN
    CREATE UNIQUE INDEX uq_customer_conversations_owner_customer
      ON public.customer_conversations(owner_id, customer_user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_conversations_owner_id ON public.customer_conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_customer_conversations_customer_user_id ON public.customer_conversations(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_conversations_last_message_at ON public.customer_conversations(last_message_at DESC);

-- 3) Messages
CREATE TABLE IF NOT EXISTS public.customer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.customer_conversations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  sender_type text NOT NULL, -- 'owner' | 'customer'
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_read_by_owner boolean NOT NULL DEFAULT false,
  is_read_by_customer boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_conversation_id_created_at ON public.customer_messages(conversation_id, created_at);

-- 4) Updated-at trigger (reuse existing function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_customer_conversations_updated_at'
  ) THEN
    CREATE TRIGGER trg_customer_conversations_updated_at
    BEFORE UPDATE ON public.customer_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) RLS
ALTER TABLE public.customer_chat_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

-- Helper: stable owner resolution for attendants (already exists: public.account_owner_id)

-- Links policies: only owner (or their attendants via account_owner_id) can manage; customers cannot select tokens.
CREATE POLICY "Owner can manage customer chat links"
ON public.customer_chat_links
FOR ALL
TO authenticated
USING (owner_id = public.account_owner_id(auth.uid()))
WITH CHECK (owner_id = public.account_owner_id(auth.uid()));

-- Conversations policies
CREATE POLICY "Owner can view their customer conversations"
ON public.customer_conversations
FOR SELECT
TO authenticated
USING (owner_id = public.account_owner_id(auth.uid()));

CREATE POLICY "Customer can view own conversation"
ON public.customer_conversations
FOR SELECT
TO authenticated
USING (customer_user_id = auth.uid());

-- Only owner-side creates conversations (via edge function with service role), but allow owner update (e.g., read counters)
CREATE POLICY "Owner can update their customer conversations"
ON public.customer_conversations
FOR UPDATE
TO authenticated
USING (owner_id = public.account_owner_id(auth.uid()))
WITH CHECK (owner_id = public.account_owner_id(auth.uid()));

-- Messages policies
CREATE POLICY "Owner can read messages in their conversations"
ON public.customer_messages
FOR SELECT
TO authenticated
USING (owner_id = public.account_owner_id(auth.uid()));

CREATE POLICY "Customer can read messages in own conversation"
ON public.customer_messages
FOR SELECT
TO authenticated
USING (customer_user_id = auth.uid());

CREATE POLICY "Owner can send messages"
ON public.customer_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'owner'
  AND owner_id = public.account_owner_id(auth.uid())
);

CREATE POLICY "Customer can send messages"
ON public.customer_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'customer'
  AND customer_user_id = auth.uid()
);

-- Owner can mark read flags
CREATE POLICY "Owner can update message read flags"
ON public.customer_messages
FOR UPDATE
TO authenticated
USING (owner_id = public.account_owner_id(auth.uid()))
WITH CHECK (owner_id = public.account_owner_id(auth.uid()));

-- Customer can mark read flags
CREATE POLICY "Customer can update message read flags"
ON public.customer_messages
FOR UPDATE
TO authenticated
USING (customer_user_id = auth.uid())
WITH CHECK (customer_user_id = auth.uid());

-- Basic validation trigger for sender_type values (avoid CHECK immutability pitfalls not needed; use trigger)
CREATE OR REPLACE FUNCTION public.validate_customer_message_sender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type NOT IN ('owner', 'customer') THEN
    RAISE EXCEPTION 'Invalid sender_type';
  END IF;
  IF length(trim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  IF length(NEW.content) > 4000 THEN
    RAISE EXCEPTION 'Message content too long';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_customer_message_sender'
  ) THEN
    CREATE TRIGGER trg_validate_customer_message_sender
    BEFORE INSERT OR UPDATE ON public.customer_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_customer_message_sender();
  END IF;
END $$;