-- Add active agent tracking to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS active_agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS transferred_from_agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS transfer_reason text;

-- Add agent type and specialization to ai_agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'principal';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS specialization text;

-- Create transfer rules table
CREATE TABLE IF NOT EXISTS ai_agent_transfer_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  target_agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  trigger_keywords text[] NOT NULL DEFAULT '{}',
  transfer_message text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT different_agents CHECK (source_agent_id != target_agent_id)
);

-- Enable RLS
ALTER TABLE ai_agent_transfer_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for transfer rules
CREATE POLICY "Users can manage own transfer rules"
ON ai_agent_transfer_rules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ai_agent_transfer_rules_updated_at
BEFORE UPDATE ON ai_agent_transfer_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE ai_agent_transfer_rules;