
-- Add infinitepay_handle to user_payment_credentials
ALTER TABLE public.user_payment_credentials
ADD COLUMN IF NOT EXISTS infinitepay_handle TEXT;

-- Add checkout_url and infinitepay_slug to subscription_payments
ALTER TABLE public.subscription_payments
ADD COLUMN IF NOT EXISTS checkout_url TEXT,
ADD COLUMN IF NOT EXISTS infinitepay_slug TEXT;

-- Add checkout_url and infinitepay_slug to client_pix_payments
ALTER TABLE public.client_pix_payments
ADD COLUMN IF NOT EXISTS checkout_url TEXT,
ADD COLUMN IF NOT EXISTS infinitepay_slug TEXT;

-- Add checkout_url and infinitepay_slug to wallet_topups
ALTER TABLE public.wallet_topups
ADD COLUMN IF NOT EXISTS checkout_url TEXT,
ADD COLUMN IF NOT EXISTS infinitepay_slug TEXT;
