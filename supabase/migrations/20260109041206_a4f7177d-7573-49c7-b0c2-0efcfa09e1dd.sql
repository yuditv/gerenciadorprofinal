-- Create table for email notification history
CREATE TABLE public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'email',
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  days_until_expiration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification history" 
ON public.notification_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create notification history" 
ON public.notification_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_notification_history_client_id ON public.notification_history(client_id);
CREATE INDEX idx_notification_history_user_id ON public.notification_history(user_id);