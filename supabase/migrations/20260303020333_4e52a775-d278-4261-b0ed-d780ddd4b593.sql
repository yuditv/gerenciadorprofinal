
-- Create referral clicks tracking table
CREATE TABLE public.referral_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_referral_clicks_code ON public.referral_clicks (referral_code);
CREATE INDEX idx_referral_clicks_client ON public.referral_clicks (client_id);
CREATE INDEX idx_referral_clicks_user ON public.referral_clicks (user_id);

-- Enable RLS
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Owner can see their referral clicks
CREATE POLICY "Users can view their own referral clicks"
ON public.referral_clicks
FOR SELECT
USING (auth.uid() = user_id);

-- Anyone can insert (public tracking)
CREATE POLICY "Anyone can insert referral clicks"
ON public.referral_clicks
FOR INSERT
WITH CHECK (true);
