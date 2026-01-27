-- Table to track registration IPs (prevent multiple accounts from same IP)
CREATE TABLE public.registration_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registration_ips ENABLE ROW LEVEL SECURITY;

-- Only service role can manage this table (security)
CREATE POLICY "Service role only" ON public.registration_ips
  FOR ALL USING (false);

-- Table to store email verification codes
CREATE TABLE public.email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  ip_address text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '15 minutes'),
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can manage verification codes
CREATE POLICY "Service role only" ON public.email_verification_codes
  FOR ALL USING (false);

-- Index for quick lookups
CREATE INDEX idx_verification_codes_email ON public.email_verification_codes(email);
CREATE INDEX idx_registration_ips_ip ON public.registration_ips(ip_address);