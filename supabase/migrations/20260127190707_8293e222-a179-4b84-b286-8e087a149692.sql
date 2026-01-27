-- Extend smm_orders for provider status/charge + refill/cancel tracking
ALTER TABLE public.smm_orders
  ADD COLUMN IF NOT EXISTS provider_currency text,
  ADD COLUMN IF NOT EXISTS provider_charge numeric,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_remains integer,
  ADD COLUMN IF NOT EXISTS provider_start_count integer,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_refill_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_refill_id text,
  ADD COLUMN IF NOT EXISTS provider_refill_status text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS profit_real_brl numeric;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_smm_orders_user_created_at
  ON public.smm_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smm_orders_provider_order_id
  ON public.smm_orders (provider_order_id);

CREATE INDEX IF NOT EXISTS idx_smm_orders_status
  ON public.smm_orders (status);