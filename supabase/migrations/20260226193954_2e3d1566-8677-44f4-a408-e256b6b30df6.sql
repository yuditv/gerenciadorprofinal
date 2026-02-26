-- Create unique index on (user_id, phone) for contacts upsert to work
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_id_phone_unique ON public.contacts (user_id, phone);