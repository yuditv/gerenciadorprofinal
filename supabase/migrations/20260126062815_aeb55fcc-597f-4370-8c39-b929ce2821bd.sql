-- Fix conversations that have ai_enabled = true but are blocked by assigned_to
-- This clears the human assignment so the AI can respond
UPDATE public.conversations 
SET 
  assigned_to = NULL,
  ai_paused_at = NULL
WHERE ai_enabled = true AND assigned_to IS NOT NULL;