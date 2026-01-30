-- Preferences for how AI should behave on NEW conversations
CREATE TABLE IF NOT EXISTS public.ai_agent_preferences (
  user_id UUID PRIMARY KEY,
  auto_start_ai BOOLEAN NOT NULL DEFAULT false,
  default_agent_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can view own AI preferences"
ON public.ai_agent_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own AI preferences"
ON public.ai_agent_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own AI preferences"
ON public.ai_agent_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Ensure updated_at is maintained
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_ai_agent_preferences_updated_at ON public.ai_agent_preferences;
CREATE TRIGGER update_ai_agent_preferences_updated_at
BEFORE UPDATE ON public.ai_agent_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ai_agent_preferences_default_agent_id
ON public.ai_agent_preferences(default_agent_id);