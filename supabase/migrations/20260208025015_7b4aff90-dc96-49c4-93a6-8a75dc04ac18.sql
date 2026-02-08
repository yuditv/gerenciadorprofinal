
-- Table to store custom API credentials for AI agents
CREATE TABLE public.user_api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_name TEXT NOT NULL,
  api_label TEXT NOT NULL,
  api_key_enc TEXT NOT NULL,
  base_url TEXT,
  model_default TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_api_credentials_user_id ON public.user_api_credentials(user_id);
CREATE UNIQUE INDEX idx_user_api_credentials_user_label ON public.user_api_credentials(user_id, api_label);

-- Enable RLS
ALTER TABLE public.user_api_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own credentials
CREATE POLICY "Users can view their own API credentials"
  ON public.user_api_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API credentials"
  ON public.user_api_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API credentials"
  ON public.user_api_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API credentials"
  ON public.user_api_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_api_credentials_updated_at
  BEFORE UPDATE ON public.user_api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add api_credential_id column to ai_agents table
ALTER TABLE public.ai_agents 
  ADD COLUMN api_credential_id UUID REFERENCES public.user_api_credentials(id) ON DELETE SET NULL;
