-- Add country_code column to conversations table for international number identification
ALTER TABLE public.conversations 
ADD COLUMN country_code text NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.conversations.country_code IS 'ISO country code detected from phone number (e.g., US, BR, UK). Used for visual identification of international clients.';