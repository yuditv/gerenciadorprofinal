-- Add profile_picture_url column to whatsapp_instances table
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;