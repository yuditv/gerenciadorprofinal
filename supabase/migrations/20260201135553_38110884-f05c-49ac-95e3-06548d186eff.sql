-- Add new columns to crm_lead_data for full CRM functionality
ALTER TABLE public.crm_lead_data 
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expected_close_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_industry TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID,
ADD COLUMN IF NOT EXISTS lost_reason TEXT,
ADD COLUMN IF NOT EXISTS won_reason TEXT,
ADD COLUMN IF NOT EXISTS products_interested TEXT[],
ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'warm';

-- Create CRM Lead Tags table
CREATE TABLE IF NOT EXISTS public.crm_lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_lead_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
CREATE POLICY "Users can view their own tags" ON public.crm_lead_tags 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags" ON public.crm_lead_tags 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON public.crm_lead_tags 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON public.crm_lead_tags 
  FOR DELETE USING (auth.uid() = user_id);

-- Create Lead-Tag assignments table
CREATE TABLE IF NOT EXISTS public.crm_lead_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_lead_data(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.crm_lead_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.crm_lead_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tag assignments
CREATE POLICY "Users can view assignments for their leads" ON public.crm_lead_tag_assignments 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.crm_lead_data WHERE id = lead_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create assignments for their leads" ON public.crm_lead_tag_assignments 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.crm_lead_data WHERE id = lead_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete assignments for their leads" ON public.crm_lead_tag_assignments 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.crm_lead_data WHERE id = lead_id AND user_id = auth.uid())
  );

-- Create CRM Lead Activities table
CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_lead_data(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'note', 'whatsapp', 'status_change', 'created'
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities
CREATE POLICY "Users can view activities for their leads" ON public.crm_lead_activities 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create activities" ON public.crm_lead_activities 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their activities" ON public.crm_lead_activities 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their activities" ON public.crm_lead_activities 
  FOR DELETE USING (auth.uid() = user_id);

-- Create CRM Lead Attachments table
CREATE TABLE IF NOT EXISTS public.crm_lead_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_lead_data(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_lead_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments for their leads" ON public.crm_lead_attachments 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create attachments" ON public.crm_lead_attachments 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their attachments" ON public.crm_lead_attachments 
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_lead_activities_lead_id ON public.crm_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_activities_type ON public.crm_lead_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crm_lead_attachments_lead_id ON public.crm_lead_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_tags_user_id ON public.crm_lead_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_data_follow_up ON public.crm_lead_data(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_crm_lead_data_priority ON public.crm_lead_data(priority);
CREATE INDEX IF NOT EXISTS idx_crm_lead_data_source ON public.crm_lead_data(lead_source);