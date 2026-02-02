import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "customer-chat-ai@2026-02-02.1";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };
}

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

interface CustomerMessage {
  id: string;
  conversation_id: string;
  owner_id: string;
  customer_user_id: string;
  sender_type: 'owner' | 'customer';
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  file_name: string | null;
  created_at: string;
}

interface AIAgent {
  id: string;
  name: string;
  system_prompt: string | null;
  ai_model: string | null;
  is_active: boolean;
  max_chars_per_message: number | null;
  max_lines_per_message: number | null;
  response_delay_min: number | null;
  response_delay_max: number | null;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log(`[${VERSION}] Processing request`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { conversationId, messageId } = body;

    if (!conversationId || !messageId) {
      throw new Error('conversationId and messageId are required');
    }

    console.log(`[${VERSION}] Processing message ${messageId} in conversation ${conversationId}`);

    // Fetch the conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('customer_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error(`Conversation not found: ${convError?.message}`);
    }

    // Check if AI is enabled
    if (!conversation.ai_enabled) {
      console.log(`[${VERSION}] AI is disabled for this conversation`);
      return new Response(JSON.stringify({ success: false, reason: 'AI disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the agent
    const agentId = conversation.active_agent_id;
    if (!agentId) {
      console.log(`[${VERSION}] No agent assigned to conversation`);
      return new Response(JSON.stringify({ success: false, reason: 'No agent assigned' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      throw new Error(`Agent not found: ${agentError?.message}`);
    }

    if (!agent.is_active) {
      console.log(`[${VERSION}] Agent is not active`);
      return new Response(JSON.stringify({ success: false, reason: 'Agent inactive' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent messages for context
    const { data: recentMessages, error: msgError } = await supabaseAdmin
      .from('customer_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (msgError) {
      throw new Error(`Failed to fetch messages: ${msgError.message}`);
    }

    // Build conversation history
    const messages: Array<{ role: string; content: string }> = [];

    // System prompt
    const systemPrompt = agent.system_prompt || 
      'Você é um assistente virtual amigável e prestativo. Responda de forma clara e objetiva.';
    
    messages.push({ role: 'system', content: systemPrompt });

    // Add conversation history
    for (const msg of recentMessages || []) {
      const role = msg.sender_type === 'customer' ? 'user' : 'assistant';
      let content = msg.content || '';
      
      if (msg.media_type && msg.file_name) {
        content += content ? `\n[${msg.media_type}: ${msg.file_name}]` : `[${msg.media_type}: ${msg.file_name}]`;
      }
      
      if (content) {
        messages.push({ role, content });
      }
    }

    console.log(`[${VERSION}] Calling AI with ${messages.length} messages`);

    // Call the AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.ai_model || DEFAULT_MODEL,
        messages,
        max_tokens: agent.max_chars_per_message || 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let responseText = aiData?.choices?.[0]?.message?.content || '';

    // Apply formatting limits
    if (agent.max_lines_per_message && responseText) {
      const lines = responseText.split('\n');
      if (lines.length > agent.max_lines_per_message) {
        responseText = lines.slice(0, agent.max_lines_per_message).join('\n');
      }
    }

    if (agent.max_chars_per_message && responseText.length > agent.max_chars_per_message) {
      responseText = responseText.substring(0, agent.max_chars_per_message);
    }

    if (!responseText) {
      console.log(`[${VERSION}] AI returned empty response`);
      return new Response(JSON.stringify({ success: false, reason: 'Empty AI response' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${VERSION}] AI response: ${responseText.substring(0, 100)}...`);

    // Add optional delay for more natural feel
    const delayMin = agent.response_delay_min || 1;
    const delayMax = agent.response_delay_max || 3;
    const delay = Math.random() * (delayMax - delayMin) + delayMin;
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

    // Insert the AI response
    const { error: insertError } = await supabaseAdmin
      .from('customer_messages')
      .insert({
        conversation_id: conversationId,
        owner_id: conversation.owner_id,
        customer_user_id: conversation.customer_user_id,
        sender_type: 'owner',
        content: responseText,
      });

    if (insertError) {
      throw new Error(`Failed to insert AI response: ${insertError.message}`);
    }

    console.log(`[${VERSION}] AI response sent successfully`);

    return new Response(JSON.stringify({ success: true, response: responseText }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${VERSION}] Error:`, error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
