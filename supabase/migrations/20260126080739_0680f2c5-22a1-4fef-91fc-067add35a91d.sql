-- Allow users to view sub-agent links for their own agents
DROP POLICY IF EXISTS "Authenticated users can view active links" ON public.ai_sub_agent_links;

CREATE POLICY "Users can manage own sub-agent links"
ON public.ai_sub_agent_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM ai_agents a 
    WHERE a.id = ai_sub_agent_links.principal_agent_id 
    AND a.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ai_agents a 
    WHERE a.id = ai_sub_agent_links.principal_agent_id 
    AND a.created_by = auth.uid()
  )
);