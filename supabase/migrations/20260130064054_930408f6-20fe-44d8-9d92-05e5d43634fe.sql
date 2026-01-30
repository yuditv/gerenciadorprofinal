-- 1) Extend client_pix_payments to support automatic renewal tracking
ALTER TABLE public.client_pix_payments
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS expected_plan text,
  ADD COLUMN IF NOT EXISTS expected_plan_label text,
  ADD COLUMN IF NOT EXISTS renewal_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_error text;

-- Foreign key (optional/nullable) to link payments to a specific client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_pix_payments_client_id_fkey'
  ) THEN
    ALTER TABLE public.client_pix_payments
      ADD CONSTRAINT client_pix_payments_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clients(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Indexes for performance / reuse
CREATE INDEX IF NOT EXISTS idx_client_pix_payments_external_id
  ON public.client_pix_payments (external_id);

CREATE INDEX IF NOT EXISTS idx_client_pix_payments_user_client_status_expires
  ON public.client_pix_payments (user_id, client_id, status, expires_at);
