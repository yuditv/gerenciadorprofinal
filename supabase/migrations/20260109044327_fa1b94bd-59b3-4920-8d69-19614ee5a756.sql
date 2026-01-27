-- Add service column to clients table
ALTER TABLE public.clients ADD COLUMN service text DEFAULT 'IPTV';

-- Add check constraint for valid service values
ALTER TABLE public.clients ADD CONSTRAINT clients_service_check CHECK (service IN ('IPTV', 'VPN'));