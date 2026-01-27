-- Add price column to clients table for custom pricing
ALTER TABLE public.clients ADD COLUMN price NUMERIC(10,2);