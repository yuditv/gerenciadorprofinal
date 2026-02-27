
-- Fix overly permissive service role policies
DROP POLICY "Service role full access to knowledge" ON public.ai_knowledge_base;
DROP POLICY "Service role full access to learning sessions" ON public.ai_learning_sessions;

-- Service role access is implicit via service_role key, no need for explicit policies
-- Add insert/update/delete policies for learning sessions
CREATE POLICY "Users can insert their own learning sessions" ON public.ai_learning_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own learning sessions" ON public.ai_learning_sessions
  FOR UPDATE USING (auth.uid() = user_id);
