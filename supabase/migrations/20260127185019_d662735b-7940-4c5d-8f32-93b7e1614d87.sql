-- Add global "markup locked" toggle
ALTER TABLE public.pricing_settings
ADD COLUMN IF NOT EXISTS markup_locked boolean NOT NULL DEFAULT true;

-- Ensure updated_at stays consistent on updates (if you already have a trigger pattern you can add later)
COMMENT ON COLUMN public.pricing_settings.markup_locked IS 'When true, markup is mandatory and cannot be customized per user.';