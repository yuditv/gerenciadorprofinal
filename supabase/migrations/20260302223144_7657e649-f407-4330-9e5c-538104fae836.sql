-- Add referral_code column to clients table
ALTER TABLE public.clients ADD COLUMN referral_code TEXT UNIQUE;

-- Generate referral codes for existing clients using first 8 chars of their id
UPDATE public.clients SET referral_code = UPPER(LEFT(REPLACE(id::text, '-', ''), 8)) WHERE referral_code IS NULL;

-- Make it NOT NULL with a default for new records
ALTER TABLE public.clients ALTER COLUMN referral_code SET DEFAULT UPPER(LEFT(REPLACE(gen_random_uuid()::text, '-', ''), 8));
ALTER TABLE public.clients ALTER COLUMN referral_code SET NOT NULL;

-- Create index for fast lookups
CREATE INDEX idx_clients_referral_code ON public.clients (referral_code);