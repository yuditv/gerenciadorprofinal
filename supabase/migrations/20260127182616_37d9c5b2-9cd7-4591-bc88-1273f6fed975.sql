-- 1) Global pricing settings (single row)
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id integer PRIMARY KEY,
  markup_percent numeric(8,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure singleton row exists
INSERT INTO public.pricing_settings (id, markup_percent)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user
DROP POLICY IF EXISTS "Pricing settings readable by authenticated" ON public.pricing_settings;
CREATE POLICY "Pricing settings readable by authenticated"
ON public.pricing_settings
FOR SELECT
TO authenticated
USING (true);

-- Writable only by admins
DROP POLICY IF EXISTS "Pricing settings writable by admin" ON public.pricing_settings;
CREATE POLICY "Pricing settings writable by admin"
ON public.pricing_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pricing settings updatable by admin" ON public.pricing_settings;
CREATE POLICY "Pricing settings updatable by admin"
ON public.pricing_settings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pricing settings deletable by admin" ON public.pricing_settings;
CREATE POLICY "Pricing settings deletable by admin"
ON public.pricing_settings
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS update_pricing_settings_updated_at ON public.pricing_settings;
CREATE TRIGGER update_pricing_settings_updated_at
BEFORE UPDATE ON public.pricing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Atomic wallet operations (debit/credit) used by edge functions
-- These functions assume existing tables:
--   public.user_wallets(user_id uuid, credits numeric)
--   public.wallet_transactions(user_id uuid, type text, credits numeric, amount_brl numeric, reference_type text, reference_id text)

CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_user_id uuid,
  p_amount numeric,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  -- Ensure wallet row exists
  INSERT INTO public.user_wallets (user_id, credits)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock row for update
  SELECT credits INTO v_credits
  FROM public.user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF COALESCE(v_credits, 0) < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  UPDATE public.user_wallets
  SET credits = credits - p_amount
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    credits,
    amount_brl,
    reference_type,
    reference_id
  ) VALUES (
    p_user_id,
    'spend',
    p_amount,
    p_amount,
    p_reference_type,
    p_reference_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id uuid,
  p_amount numeric,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_tx_type text DEFAULT 'refund'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  INSERT INTO public.user_wallets (user_id, credits)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_wallets
  SET credits = credits + p_amount
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    credits,
    amount_brl,
    reference_type,
    reference_id
  ) VALUES (
    p_user_id,
    COALESCE(NULLIF(p_tx_type, ''), 'refund'),
    p_amount,
    p_amount,
    p_reference_type,
    p_reference_id
  );
END;
$$;

-- Reduce attack surface: only callable by service role (edge functions)
REVOKE ALL ON FUNCTION public.wallet_debit(uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_credit(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_debit(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid, numeric, text, text, text) TO service_role;
