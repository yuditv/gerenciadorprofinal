-- Create automation_flows table
CREATE TABLE public.automation_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_config JSONB NOT NULL DEFAULT '{"type": "new_conversation", "conditions": {}}',
  actions_config JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own automation flows" 
ON public.automation_flows 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automation flows" 
ON public.automation_flows 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automation flows" 
ON public.automation_flows 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automation flows" 
ON public.automation_flows 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_automation_flows_updated_at
BEFORE UPDATE ON public.automation_flows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for user_id
CREATE INDEX idx_automation_flows_user_id ON public.automation_flows(user_id);
CREATE INDEX idx_automation_flows_is_active ON public.automation_flows(is_active);