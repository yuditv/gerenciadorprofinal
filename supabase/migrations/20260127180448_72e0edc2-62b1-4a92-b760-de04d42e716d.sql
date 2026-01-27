-- Wallet / credits system

-- Timestamps helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1) Wallet balance (1 credit = R$1)
CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id UUID PRIMARY KEY,
  credits NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_wallets_set_updated_at
BEFORE UPDATE ON public.user_wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_wallets' AND policyname='Users can view their own wallet'
  ) THEN
    CREATE POLICY "Users can view their own wallet"
    ON public.user_wallets
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Wallet ledger
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup','spend','refund','adjust')),
  credits NUMERIC(12,2) NOT NULL,
  amount_brl NUMERIC(12,2),
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
ON public.wallet_transactions (user_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transactions' AND policyname='Users can view their own wallet transactions'
  ) THEN
    CREATE POLICY "Users can view their own wallet transactions"
    ON public.wallet_transactions
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3) PIX topups
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_brl NUMERIC(12,2) NOT NULL CHECK (amount_brl >= 1),
  credits NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','paid','expired','failed')) DEFAULT 'pending',
  external_id TEXT,
  pix_code TEXT,
  pix_qr_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_user_created
ON public.wallet_topups (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_external_id
ON public.wallet_topups (external_id);

CREATE TRIGGER wallet_topups_set_updated_at
BEFORE UPDATE ON public.wallet_topups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_topups' AND policyname='Users can view their own wallet topups'
  ) THEN
    CREATE POLICY "Users can view their own wallet topups"
    ON public.wallet_topups
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4) User markup settings (user-editable)
CREATE TABLE IF NOT EXISTS public.user_pricing_settings (
  user_id UUID PRIMARY KEY,
  markup_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_pricing_settings_set_updated_at
BEFORE UPDATE ON public.user_pricing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_pricing_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_pricing_settings' AND policyname='Users can view their own pricing settings'
  ) THEN
    CREATE POLICY "Users can view their own pricing settings"
    ON public.user_pricing_settings
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_pricing_settings' AND policyname='Users can insert their own pricing settings'
  ) THEN
    CREATE POLICY "Users can insert their own pricing settings"
    ON public.user_pricing_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_pricing_settings' AND policyname='Users can update their own pricing settings'
  ) THEN
    CREATE POLICY "Users can update their own pricing settings"
    ON public.user_pricing_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5) SMM orders audit
CREATE TABLE IF NOT EXISTS public.smm_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_id INTEGER NOT NULL,
  service_name TEXT,
  quantity INTEGER NOT NULL,
  link TEXT NOT NULL,
  provider_rate_per_1000 NUMERIC(12,4),
  provider_cost_brl NUMERIC(12,2) NOT NULL,
  markup_percent NUMERIC(8,2) NOT NULL,
  price_brl NUMERIC(12,2) NOT NULL,
  credits_spent NUMERIC(12,2) NOT NULL,
  profit_brl NUMERIC(12,2) NOT NULL,
  provider_order_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','submitted','failed','refunded')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smm_orders_user_created
ON public.smm_orders (user_id, created_at DESC);

ALTER TABLE public.smm_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='smm_orders' AND policyname='Users can view their own smm orders'
  ) THEN
    CREATE POLICY "Users can view their own smm orders"
    ON public.smm_orders
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;
