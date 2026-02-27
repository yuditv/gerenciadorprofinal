
-- Table for inactive/invalid contacts (no WhatsApp, invalid numbers, etc.)
CREATE TABLE public.inactive_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Sem nome',
  phone TEXT NOT NULL,
  original_phone TEXT,
  email TEXT,
  notes TEXT,
  reason TEXT NOT NULL DEFAULT 'no_whatsapp',
  fixed_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone)
);

-- Enable RLS
ALTER TABLE public.inactive_contacts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own inactive contacts"
ON public.inactive_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inactive contacts"
ON public.inactive_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inactive contacts"
ON public.inactive_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inactive contacts"
ON public.inactive_contacts FOR DELETE
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_inactive_contacts_user_id ON public.inactive_contacts (user_id);
CREATE INDEX idx_inactive_contacts_reason ON public.inactive_contacts (user_id, reason);

-- Updated at trigger
CREATE TRIGGER update_inactive_contacts_updated_at
BEFORE UPDATE ON public.inactive_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
