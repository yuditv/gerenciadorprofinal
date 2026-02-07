
-- ============================================================
-- 1. TICKET/PROTOCOL NUMBER: Auto-generated protocol per conversation
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.conversation_ticket_seq START WITH 1000;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- Populate existing conversations with ticket numbers
UPDATE public.conversations
SET ticket_number = 'ATD-' || LPAD(nextval('conversation_ticket_seq')::text, 6, '0')
WHERE ticket_number IS NULL;

-- Function to auto-assign ticket number on new conversations
CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'ATD-' || LPAD(nextval('conversation_ticket_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_ticket_number
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_ticket_number();

-- ============================================================
-- 2. CONVERSATION SUMMARY (AI auto-summary on close)
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- 3. CONTACT REASONS (categorize why customers contact)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_contact_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT DEFAULT 'help-circle',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_contact_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contact reasons"
  ON public.inbox_contact_reasons FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ))
  WITH CHECK (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ));

-- Link conversations to contact reasons
CREATE TABLE IF NOT EXISTS public.conversation_contact_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  reason_id UUID REFERENCES public.inbox_contact_reasons(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, reason_id)
);

ALTER TABLE public.conversation_contact_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage conversation reasons"
  ON public.conversation_contact_reasons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR c.user_id IN (
      SELECT owner_id FROM public.account_members WHERE member_id = auth.uid()
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR c.user_id IN (
      SELECT owner_id FROM public.account_members WHERE member_id = auth.uid()
    ))
  ));

-- ============================================================
-- 4. CSAT SURVEYS (Customer Satisfaction)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_csat_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_csat_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CSAT surveys"
  ON public.inbox_csat_surveys FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ))
  WITH CHECK (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ));

-- ============================================================
-- 5. SLA CONFIGURATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Padrão',
  first_response_minutes INTEGER NOT NULL DEFAULT 15,
  resolution_minutes INTEGER NOT NULL DEFAULT 240,
  priority_multipliers JSONB NOT NULL DEFAULT '{"low": 2, "medium": 1, "high": 0.5, "urgent": 0.25}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own SLA config"
  ON public.inbox_sla_config FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ))
  WITH CHECK (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ));

CREATE TRIGGER update_sla_config_updated_at
  BEFORE UPDATE ON public.inbox_sla_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. BUSINESS HOURS CONFIGURATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  auto_reply_message TEXT DEFAULT 'Olá! Nosso horário de atendimento é de {start} às {end}. Retornaremos em breve! 😊',
  schedule JSONB NOT NULL DEFAULT '[
    {"day": 0, "enabled": false, "start": "09:00", "end": "18:00"},
    {"day": 1, "enabled": true, "start": "09:00", "end": "18:00"},
    {"day": 2, "enabled": true, "start": "09:00", "end": "18:00"},
    {"day": 3, "enabled": true, "start": "09:00", "end": "18:00"},
    {"day": 4, "enabled": true, "start": "09:00", "end": "18:00"},
    {"day": 5, "enabled": true, "start": "09:00", "end": "18:00"},
    {"day": 6, "enabled": false, "start": "09:00", "end": "18:00"}
  ]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.inbox_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own business hours"
  ON public.inbox_business_hours FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ))
  WITH CHECK (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ));

CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON public.inbox_business_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. TRIAGE BOT CONFIGURATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_triage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  welcome_message TEXT DEFAULT 'Olá! Para direcionarmos seu atendimento, por favor selecione uma opção:',
  collect_name BOOLEAN NOT NULL DEFAULT true,
  collect_reason BOOLEAN NOT NULL DEFAULT true,
  departments JSONB NOT NULL DEFAULT '[
    {"name": "Suporte Técnico", "description": "Problemas técnicos e configurações", "label_id": null},
    {"name": "Financeiro", "description": "Pagamentos e renovações", "label_id": null},
    {"name": "Comercial", "description": "Novos planos e upgrades", "label_id": null}
  ]',
  fallback_message TEXT DEFAULT 'Obrigado! Um atendente irá atendê-lo em breve.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.inbox_triage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own triage config"
  ON public.inbox_triage_config FOR ALL
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ))
  WITH CHECK (auth.uid() = user_id OR auth.uid() IN (
    SELECT member_id FROM public.account_members WHERE owner_id = user_id
  ));

CREATE TRIGGER update_triage_config_updated_at
  BEFORE UPDATE ON public.inbox_triage_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
