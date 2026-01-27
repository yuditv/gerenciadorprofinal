-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create status_schedules table for scheduling WhatsApp statuses
CREATE TABLE public.status_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Status content
  status_type TEXT NOT NULL CHECK (status_type IN ('text', 'image', 'video', 'audio')),
  text_content TEXT,
  background_color INTEGER DEFAULT 1,
  font_style INTEGER DEFAULT 0,
  media_url TEXT,
  media_mimetype TEXT,
  
  -- Selected instances
  instance_ids UUID[] NOT NULL,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  recurrence_type TEXT DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly')),
  recurrence_days INTEGER[],
  recurrence_end_date TIMESTAMPTZ,
  
  -- Schedule status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_status_schedules_user_id ON public.status_schedules(user_id);
CREATE INDEX idx_status_schedules_scheduled_at ON public.status_schedules(scheduled_at);
CREATE INDEX idx_status_schedules_status ON public.status_schedules(status);

-- Enable RLS
ALTER TABLE public.status_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own status schedules"
ON public.status_schedules FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_status_schedules_updated_at
BEFORE UPDATE ON public.status_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();