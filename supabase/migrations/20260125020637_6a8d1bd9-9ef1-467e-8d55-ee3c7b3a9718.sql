-- Add AI agent message sending configuration columns
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS response_delay_min INTEGER DEFAULT 2;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS response_delay_max INTEGER DEFAULT 5;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS max_lines_per_message INTEGER DEFAULT 0;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS split_mode TEXT DEFAULT 'none';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS split_delay_min INTEGER DEFAULT 1;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS split_delay_max INTEGER DEFAULT 3;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS max_chars_per_message INTEGER DEFAULT 0;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS typing_simulation BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN ai_agents.response_delay_min IS 'Minimum delay in seconds before sending the first response';
COMMENT ON COLUMN ai_agents.response_delay_max IS 'Maximum delay in seconds before sending the first response';
COMMENT ON COLUMN ai_agents.max_lines_per_message IS 'Maximum lines per message (0 = unlimited)';
COMMENT ON COLUMN ai_agents.split_mode IS 'How to split long messages: none, paragraph, lines, sentences, chars';
COMMENT ON COLUMN ai_agents.split_delay_min IS 'Minimum delay in seconds between split messages';
COMMENT ON COLUMN ai_agents.split_delay_max IS 'Maximum delay in seconds between split messages';
COMMENT ON COLUMN ai_agents.max_chars_per_message IS 'Maximum characters per message (0 = unlimited)';
COMMENT ON COLUMN ai_agents.typing_simulation IS 'Whether to simulate typing indicator before sending';