-- Add recurrence fields to scheduled_messages
ALTER TABLE public.scheduled_messages 
ADD COLUMN recurrence_type TEXT CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')) DEFAULT 'none',
ADD COLUMN recurrence_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN parent_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL;