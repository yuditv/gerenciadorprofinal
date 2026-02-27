
-- Table to store learned knowledge extracted from conversations
CREATE TABLE public.ai_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  question_pattern TEXT NOT NULL,
  best_answer TEXT NOT NULL,
  context_tags TEXT[] DEFAULT '{}',
  confidence_score NUMERIC DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  source_message_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own knowledge" ON public.ai_knowledge_base
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own knowledge" ON public.ai_knowledge_base
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own knowledge" ON public.ai_knowledge_base
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own knowledge" ON public.ai_knowledge_base
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to knowledge" ON public.ai_knowledge_base
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_knowledge_base_user_agent ON public.ai_knowledge_base(user_id, agent_id);
CREATE INDEX idx_ai_knowledge_base_category ON public.ai_knowledge_base(category);
CREATE INDEX idx_ai_knowledge_base_confidence ON public.ai_knowledge_base(confidence_score DESC);

CREATE TRIGGER update_ai_knowledge_base_updated_at
  BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table to track learning sessions
CREATE TABLE public.ai_learning_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  messages_analyzed INTEGER DEFAULT 0,
  knowledge_extracted INTEGER DEFAULT 0,
  knowledge_updated INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning sessions" ON public.ai_learning_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to learning sessions" ON public.ai_learning_sessions
  FOR ALL USING (true) WITH CHECK (true);
