
-- 1. Global Blacklist table
CREATE TABLE public.global_blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  reason TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint per user+phone
CREATE UNIQUE INDEX idx_blacklist_user_phone ON public.global_blacklist (user_id, phone);

-- Enable RLS
ALTER TABLE public.global_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own blacklist"
  ON public.global_blacklist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Round-robin distribution config
CREATE TABLE public.inbox_distribution_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL DEFAULT 'round_robin',
  max_active_per_agent INT DEFAULT 10,
  last_assigned_index INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_distribution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own distribution config"
  ON public.inbox_distribution_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_distribution_config_updated_at
  BEFORE UPDATE ON public.inbox_distribution_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
