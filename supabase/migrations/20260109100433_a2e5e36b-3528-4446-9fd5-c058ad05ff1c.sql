-- Create table for bulk dispatch history
CREATE TABLE public.bulk_dispatch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dispatch_type TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp or email
  target_type TEXT NOT NULL DEFAULT 'numbers', -- clients or numbers
  total_recipients INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  message_content TEXT,
  phone_group_id UUID REFERENCES public.phone_groups(id) ON DELETE SET NULL,
  client_filter TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bulk_dispatch_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own dispatch history" 
ON public.bulk_dispatch_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dispatch history" 
ON public.bulk_dispatch_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dispatch history" 
ON public.bulk_dispatch_history 
FOR DELETE 
USING (auth.uid() = user_id);