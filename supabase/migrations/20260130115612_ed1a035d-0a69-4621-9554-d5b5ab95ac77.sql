-- Scheduled messages (per conversation)
CREATE TABLE IF NOT EXISTS public.inbox_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  instance_id uuid,
  phone text NOT NULL,
  template_key text NOT NULL,
  template_vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | processing | sent | failed | cancelled
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_inbox_scheduled_messages_user_id ON public.inbox_scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_scheduled_messages_conversation_id ON public.inbox_scheduled_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_scheduled_messages_send_at ON public.inbox_scheduled_messages(send_at);
CREATE INDEX IF NOT EXISTS idx_inbox_scheduled_messages_status_send_at ON public.inbox_scheduled_messages(status, send_at);

-- Logs for auditing
CREATE TABLE IF NOT EXISTS public.inbox_scheduled_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scheduled_message_id uuid NOT NULL REFERENCES public.inbox_scheduled_messages(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- created | updated | cancelled | processing | sent | failed
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_scheduled_message_logs_msg_id ON public.inbox_scheduled_message_logs(scheduled_message_id);

-- Updated-at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inbox_scheduled_messages_updated_at'
  ) THEN
    CREATE TRIGGER trg_inbox_scheduled_messages_updated_at
    BEFORE UPDATE ON public.inbox_scheduled_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.inbox_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_scheduled_message_logs ENABLE ROW LEVEL SECURITY;

-- Policies: user can manage their scheduled messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_scheduled_messages' AND policyname='Users can view their scheduled messages'
  ) THEN
    CREATE POLICY "Users can view their scheduled messages"
    ON public.inbox_scheduled_messages
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_scheduled_messages' AND policyname='Users can create their scheduled messages'
  ) THEN
    CREATE POLICY "Users can create their scheduled messages"
    ON public.inbox_scheduled_messages
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_scheduled_messages' AND policyname='Users can update their scheduled messages'
  ) THEN
    CREATE POLICY "Users can update their scheduled messages"
    ON public.inbox_scheduled_messages
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_scheduled_messages' AND policyname='Users can delete their scheduled messages'
  ) THEN
    CREATE POLICY "Users can delete their scheduled messages"
    ON public.inbox_scheduled_messages
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;

  -- Logs: user can view/insert their logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_scheduled_message_logs' AND policyname='Users can view their scheduled message logs'
  ) THEN
    CREATE POLICY "Users can view their scheduled message logs"
    ON public.inbox_scheduled_message_logs
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_scheduled_message_logs' AND policyname='Users can insert their scheduled message logs'
  ) THEN
    CREATE POLICY "Users can insert their scheduled message logs"
    ON public.inbox_scheduled_message_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
