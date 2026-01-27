-- Create table for owner notification settings
CREATE TABLE public.owner_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Notification channels
  notify_via_whatsapp BOOLEAN DEFAULT true,
  notification_phone TEXT,
  notification_instance_id UUID,
  
  -- Event types to notify
  notify_on_ai_uncertainty BOOLEAN DEFAULT true,
  notify_on_payment_proof BOOLEAN DEFAULT true,
  notify_on_new_contact BOOLEAN DEFAULT true,
  notify_on_complaint BOOLEAN DEFAULT true,
  notify_on_vip_message BOOLEAN DEFAULT true,
  notify_on_long_wait BOOLEAN DEFAULT false,
  long_wait_minutes INTEGER DEFAULT 10,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  
  -- Anti-spam
  min_interval_minutes INTEGER DEFAULT 5,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Create table for notification history/log
CREATE TABLE public.owner_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  contact_phone TEXT,
  contact_name TEXT,
  summary TEXT,
  urgency TEXT DEFAULT 'medium',
  conversation_id UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.owner_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_notification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for owner_notification_settings
CREATE POLICY "Users can manage own notification settings"
ON public.owner_notification_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for owner_notification_log
CREATE POLICY "Users can view own notification logs"
ON public.owner_notification_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification logs"
ON public.owner_notification_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role policy for edge functions
CREATE POLICY "Service role can manage all notification logs"
ON public.owner_notification_log
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage all notification settings"
ON public.owner_notification_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_owner_notification_settings_updated_at
BEFORE UPDATE ON public.owner_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();