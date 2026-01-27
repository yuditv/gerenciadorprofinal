-- Drop the policy that allows all authenticated users to see all active agents (breaks privacy)
DROP POLICY IF EXISTS "Authenticated users can view active agents" ON public.ai_agents;

-- Now users can only see their own agents (via "Users can manage own agents" policy)
-- And admins can see all agents (via "Admins can manage all agents" policy)