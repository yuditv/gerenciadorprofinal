-- Add RLS policies to notification_settings table
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view own notification settings" 
ON public.notification_settings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own notification settings" 
ON public.notification_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own notification settings" 
ON public.notification_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own settings
CREATE POLICY "Users can delete own notification settings" 
ON public.notification_settings 
FOR DELETE 
USING (auth.uid() = user_id);