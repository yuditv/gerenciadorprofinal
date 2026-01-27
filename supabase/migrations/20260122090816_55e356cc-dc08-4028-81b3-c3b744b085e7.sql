-- Canned Responses (Respostas Prontas)
CREATE TABLE public.canned_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  short_code VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own canned responses"
ON public.canned_responses FOR ALL
USING (auth.uid() = user_id OR is_global = true)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view global canned responses"
ON public.canned_responses FOR SELECT
USING (is_global = true OR auth.uid() = user_id);

-- Inbox Teams (Equipes)
CREATE TABLE public.inbox_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  auto_assign BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own teams"
ON public.inbox_teams FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Inbox Team Members
CREATE TABLE public.inbox_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.inbox_teams(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage team members for own teams"
ON public.inbox_team_members FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.inbox_teams t
  WHERE t.id = inbox_team_members.team_id AND t.user_id = auth.uid()
));

-- Inbox Macros
CREATE TABLE public.inbox_macros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  visibility VARCHAR(20) DEFAULT 'personal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own macros"
ON public.inbox_macros FOR ALL
USING (auth.uid() = user_id OR visibility = 'global')
WITH CHECK (auth.uid() = user_id);

-- Inbox Automation Rules
CREATE TABLE public.inbox_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own automation rules"
ON public.inbox_automation_rules FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Inbox Audit Logs
CREATE TABLE public.inbox_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  auditable_type VARCHAR(50),
  auditable_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
ON public.inbox_audit_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
ON public.inbox_audit_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_canned_responses_updated_at
BEFORE UPDATE ON public.canned_responses
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

CREATE TRIGGER update_inbox_teams_updated_at
BEFORE UPDATE ON public.inbox_teams
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

CREATE TRIGGER update_inbox_macros_updated_at
BEFORE UPDATE ON public.inbox_macros
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();

CREATE TRIGGER update_inbox_automation_rules_updated_at
BEFORE UPDATE ON public.inbox_automation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_inbox_updated_at();