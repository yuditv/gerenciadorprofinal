-- Tabela de sessões de aquecimento
CREATE TABLE IF NOT EXISTS public.warming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Sessão de Aquecimento',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'completed', 'error', 'scheduled')),
  selected_instances TEXT[] NOT NULL DEFAULT '{}',
  balancing_mode TEXT NOT NULL DEFAULT 'auto' CHECK (balancing_mode IN ('auto', 'round-robin', 'random')),
  conversation_speed TEXT NOT NULL DEFAULT 'normal' CHECK (conversation_speed IN ('slow', 'normal', 'fast')),
  daily_limit INTEGER NOT NULL DEFAULT 50,
  use_ai BOOLEAN NOT NULL DEFAULT false,
  templates TEXT[] NOT NULL DEFAULT '{}',
  messages_sent INTEGER NOT NULL DEFAULT 0,
  messages_received INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_start_time TIMESTAMPTZ,
  schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  schedule_recurrence TEXT CHECK (schedule_recurrence IN ('none', 'daily', 'weekly')),
  schedule_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de logs de aquecimento
CREATE TABLE IF NOT EXISTS public.warming_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.warming_sessions(id) ON DELETE CASCADE,
  from_instance_id TEXT NOT NULL,
  to_instance_id TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_warming_sessions_user_id ON public.warming_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_warming_sessions_status ON public.warming_sessions(status);
CREATE INDEX IF NOT EXISTS idx_warming_sessions_scheduled ON public.warming_sessions(scheduled_start_time) 
  WHERE schedule_enabled = true AND status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_warming_logs_session_id ON public.warming_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_warming_logs_created_at ON public.warming_logs(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.warming_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warming_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para warming_sessions
CREATE POLICY "Users can view own warming sessions"
  ON public.warming_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own warming sessions"
  ON public.warming_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own warming sessions"
  ON public.warming_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own warming sessions"
  ON public.warming_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas de segurança para warming_logs
CREATE POLICY "Users can view logs of own sessions"
  ON public.warming_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.warming_sessions 
      WHERE id = warming_logs.session_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create logs for own sessions"
  ON public.warming_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.warming_sessions 
      WHERE id = warming_logs.session_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete logs of own sessions"
  ON public.warming_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.warming_sessions 
      WHERE id = warming_logs.session_id 
      AND user_id = auth.uid()
    )
  );

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.warming_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warming_sessions;