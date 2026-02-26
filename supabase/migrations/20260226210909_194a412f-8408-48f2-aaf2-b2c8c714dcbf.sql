-- Add unique constraint on sent_contacts for upsert support
-- First check if constraint exists, then add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sent_contacts_user_id_phone_key'
  ) THEN
    -- Remove duplicates first, keeping the most recent
    DELETE FROM sent_contacts a USING sent_contacts b
    WHERE a.user_id = b.user_id AND a.phone = b.phone AND a.id < b.id;
    
    ALTER TABLE sent_contacts ADD CONSTRAINT sent_contacts_user_id_phone_key UNIQUE (user_id, phone);
  END IF;
END $$;