-- Allow users to manage their own AI agents (not just admins)
CREATE POLICY "Users can manage own agents"
ON public.ai_agents
FOR ALL
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);