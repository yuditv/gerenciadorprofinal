import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "customer-chat-ai@2026-02-02.2";

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
const LOCK_TTL_SECONDS = 30; // Lock expires after 30 seconds

// Tools for the AI agent
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "analyze_image",
      description: "Analyze an image sent by the customer. Use this to read payment receipts, documents, screenshots, etc.",
      parameters: {
        type: "object",
        properties: {
          image_url: { type: "string", description: "URL of the image to analyze" },
          analysis_type: { 
            type: "string", 
            enum: ["payment_receipt", "document", "screenshot", "general"],
            description: "Type of analysis to perform"
          }
        },
        required: ["image_url", "analysis_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_pix",
      description: "Generate a PIX payment code for the customer. Use when customer wants to make a payment.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Payment amount in BRL" },
          description: { type: "string", description: "Payment description" },
          plan_name: { type: "string", description: "Name of the plan being purchased" }
        },
        required: ["amount", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "notify_owner",
      description: "Send an important notification to the business owner via WhatsApp. Use for urgent matters, payment confirmations, complaints, or when you need human assistance.",
      parameters: {
        type: "object",
        properties: {
          event_type: { 
            type: "string", 
            enum: ["payment_proof", "complaint", "ai_uncertainty", "vip_message", "new_contact"],
            description: "Type of notification"
          },
          summary: { type: "string", description: "Summary of what happened (max 200 chars)" },
          urgency: { 
            type: "string", 
            enum: ["low", "medium", "high"],
            description: "Urgency level"
          }
        },
        required: ["event_type", "summary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_customer_info",
      description: "Save important information about the customer for future reference. Use this to remember names, preferences, plan details, etc.",
      parameters: {
        type: "object",
        properties: {
          info_type: { 
            type: "string", 
            enum: ["name", "plan", "device", "preference", "note"],
            description: "Type of information"
          },
          value: { type: "string", description: "The information to save" }
        },
        required: ["info_type", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "transfer_to_agent",
      description: "Transfer the conversation to a specialized sub-agent for specific topics.",
      parameters: {
        type: "object",
        properties: {
          agent_id: { type: "string", description: "ID of the agent to transfer to" },
          reason: { type: "string", description: "Reason for transfer" }
        },
        required: ["agent_id", "reason"]
      }
    }
  }
];

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

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    console.log(`[${VERSION}] Processing request`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const body = await req.json();
    const { conversationId, messageId } = body;

    if (!conversationId || !messageId) {
      throw new Error('conversationId and messageId are required');
    }

    console.log(`[${VERSION}] Processing message ${messageId} in conversation ${conversationId}`);

    // ============ LOCK MECHANISM TO PREVENT DUPLICATE RESPONSES ============
    const lockKey = `customer_chat_ai_lock_${conversationId}`;
    const lockExpiry = new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString();
    
    // Try to acquire lock using upsert with conflict detection
    const { data: lockResult, error: lockError } = await supabaseAdmin
      .from('customer_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'owner')
      .gt('created_at', new Date(Date.now() - 5000).toISOString()) // Check for AI response in last 5 seconds
      .limit(1);

    if (lockResult && lockResult.length > 0) {
      console.log(`[${VERSION}] Recent AI response found, skipping to prevent duplicate`);
      return new Response(JSON.stringify({ success: false, reason: 'duplicate_prevention' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also check if this specific message was already processed
    const { data: targetMessage } = await supabaseAdmin
      .from('customer_messages')
      .select('id, created_at')
      .eq('id', messageId)
      .single();

    if (!targetMessage) {
      console.log(`[${VERSION}] Message ${messageId} not found`);
      return new Response(JSON.stringify({ success: false, reason: 'message_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for any AI response after this message
    const { data: existingResponse } = await supabaseAdmin
      .from('customer_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'owner')
      .gt('created_at', targetMessage.created_at)
      .limit(1);

    if (existingResponse && existingResponse.length > 0) {
      console.log(`[${VERSION}] AI already responded to this message`);
      return new Response(JSON.stringify({ success: false, reason: 'already_responded' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Fetch sub-agents if any
    const { data: subAgentLinks } = await supabaseAdmin
      .from('ai_sub_agent_links')
      .select('sub_agent_id, priority, sub_agent:ai_agents(*)')
      .eq('principal_agent_id', agentId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // Fetch customer memory
    const { data: customerMemory } = await supabaseAdmin
      .from('ai_client_memories')
      .select('*')
      .eq('user_id', conversation.owner_id)
      .eq('phone', conversation.customer_user_id)
      .maybeSingle();

    // Fetch recent messages for context
    const { data: recentMessages, error: msgError } = await supabaseAdmin
      .from('customer_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(30);

    if (msgError) {
      throw new Error(`Failed to fetch messages: ${msgError.message}`);
    }

    // Build conversation history with multimodal support
    const messages: Array<{ role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}> }> = [];

    // Build enhanced system prompt
    let systemPrompt = agent.system_prompt || 
      'Você é um assistente virtual amigável e prestativo. Responda de forma clara e objetiva.';

    // Add customer memory context
    if (customerMemory) {
      systemPrompt += `\n\n## Informações do Cliente:`;
      if (customerMemory.client_name) systemPrompt += `\n- Nome: ${customerMemory.client_name}`;
      if (customerMemory.plan_name) systemPrompt += `\n- Plano: ${customerMemory.plan_name}`;
      if (customerMemory.device) systemPrompt += `\n- Dispositivo: ${customerMemory.device}`;
      if (customerMemory.expiration_date) systemPrompt += `\n- Vencimento: ${customerMemory.expiration_date}`;
      if (customerMemory.is_vip) systemPrompt += `\n- Cliente VIP ⭐`;
      if (customerMemory.ai_summary) systemPrompt += `\n- Histórico: ${customerMemory.ai_summary}`;
    }

    // Add sub-agents info
    if (subAgentLinks && subAgentLinks.length > 0) {
      systemPrompt += `\n\n## Sub-agentes Disponíveis:`;
      systemPrompt += `\nVocê pode transferir a conversa para agentes especializados quando necessário:`;
      for (const link of subAgentLinks) {
        const subAgent = link.sub_agent as any;
        if (subAgent) {
          systemPrompt += `\n- ${subAgent.name} (ID: ${subAgent.id}): ${subAgent.description || subAgent.specialization || 'Agente especializado'}`;
        }
      }
    }

    // Add tool usage instructions
    systemPrompt += `\n\n## Ferramentas Disponíveis:
- Use 'analyze_image' para analisar imagens/comprovantes enviados pelo cliente
- Use 'generate_pix' para gerar códigos PIX quando o cliente quiser pagar
- Use 'notify_owner' para notificar o dono sobre coisas importantes (pagamentos, reclamações, etc)
- Use 'save_customer_info' para salvar informações importantes do cliente
- Use 'transfer_to_agent' para transferir para um sub-agente especializado`;
    
    messages.push({ role: 'system', content: systemPrompt });

    // Add conversation history with image support
    for (const msg of recentMessages || []) {
      const role = msg.sender_type === 'customer' ? 'user' : 'assistant';
      
      // Handle multimodal content
      if (msg.media_url && msg.media_type?.startsWith('image')) {
        // For images, use multimodal format
        const contentParts: Array<{type: string; text?: string; image_url?: {url: string}}> = [];
        
        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content });
        }
        
        contentParts.push({
          type: 'image_url',
          image_url: { url: msg.media_url }
        });
        
        if (contentParts.length > 0) {
          messages.push({ role, content: contentParts });
        }
      } else {
        // Text only
        let content = msg.content || '';
        if (msg.media_type && msg.file_name) {
          content += content ? `\n[${msg.media_type}: ${msg.file_name}]` : `[${msg.media_type}: ${msg.file_name}]`;
        }
        if (content) {
          messages.push({ role, content });
        }
      }
    }

    console.log(`[${VERSION}] Calling AI with ${messages.length} messages`);

    // Call the AI with tools
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.ai_model || DEFAULT_MODEL,
        messages,
        tools: AI_TOOLS,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const choice = aiData?.choices?.[0];
    let responseText = choice?.message?.content || '';
    const toolCalls = choice?.message?.tool_calls;

    // Process tool calls if any
    if (toolCalls && toolCalls.length > 0) {
      console.log(`[${VERSION}] Processing ${toolCalls.length} tool calls`);
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || '{}');
        
        console.log(`[${VERSION}] Tool call: ${functionName}`, args);
        
        switch (functionName) {
          case 'notify_owner':
            // Send notification to owner
            try {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-owner-notification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  userId: conversation.owner_id,
                  eventType: args.event_type,
                  contactPhone: conversation.customer_user_id,
                  contactName: customerMemory?.client_name,
                  summary: args.summary,
                  urgency: args.urgency || 'medium',
                  conversationId: conversationId
                })
              });
              console.log(`[${VERSION}] Owner notification sent`);
            } catch (e) {
              console.error(`[${VERSION}] Failed to notify owner:`, e);
            }
            break;
            
          case 'save_customer_info':
            // Save to customer memory
            try {
              const updates: Record<string, any> = { updated_at: new Date().toISOString() };
              switch (args.info_type) {
                case 'name': updates.client_name = args.value; break;
                case 'plan': updates.plan_name = args.value; break;
                case 'device': updates.device = args.value; break;
                default: 
                  // Store in custom_memories JSON
                  const customMemories = customerMemory?.custom_memories || {};
                  customMemories[args.info_type] = args.value;
                  updates.custom_memories = customMemories;
              }
              
              await supabaseAdmin
                .from('ai_client_memories')
                .upsert({
                  user_id: conversation.owner_id,
                  phone: conversation.customer_user_id,
                  ...updates
                }, { onConflict: 'user_id,phone' });
                
              console.log(`[${VERSION}] Customer info saved: ${args.info_type}`);
            } catch (e) {
              console.error(`[${VERSION}] Failed to save customer info:`, e);
            }
            break;
            
          case 'generate_pix':
            // Generate PIX payment
            try {
              const pixResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mercado-pago-pix`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  userId: conversation.owner_id,
                  amount: args.amount,
                  description: args.description,
                  planName: args.plan_name || args.description,
                  customerPhone: conversation.customer_user_id,
                  conversationId: conversationId,
                  source: 'customer_chat'
                })
              });
              
              if (pixResponse.ok) {
                const pixData = await pixResponse.json();
                if (pixData.pix_code) {
                  responseText += `\n\n💰 *PIX Gerado!*\n\nValor: R$ ${args.amount.toFixed(2)}\nDescrição: ${args.description}\n\n\`\`\`\n${pixData.pix_code}\n\`\`\`\n\n_Copie o código acima e cole no seu banco para pagar._`;
                }
              }
              console.log(`[${VERSION}] PIX generated`);
            } catch (e) {
              console.error(`[${VERSION}] Failed to generate PIX:`, e);
            }
            break;
            
          case 'transfer_to_agent':
            // Transfer to sub-agent
            try {
              await supabaseAdmin
                .from('customer_conversations')
                .update({ 
                  active_agent_id: args.agent_id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', conversationId);
                
              const { data: newAgent } = await supabaseAdmin
                .from('ai_agents')
                .select('name')
                .eq('id', args.agent_id)
                .single();
                
              if (newAgent) {
                responseText = `*Transferindo para ${newAgent.name}...*\n\n${args.reason}`;
              }
              console.log(`[${VERSION}] Transferred to agent: ${args.agent_id}`);
            } catch (e) {
              console.error(`[${VERSION}] Failed to transfer:`, e);
            }
            break;
        }
      }
    }

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

    // Final check before inserting (prevent race conditions)
    const { data: lastCheck } = await supabaseAdmin
      .from('customer_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'owner')
      .gt('created_at', targetMessage.created_at)
      .limit(1);

    if (lastCheck && lastCheck.length > 0) {
      console.log(`[${VERSION}] AI response already sent by another process, skipping`);
      return new Response(JSON.stringify({ success: false, reason: 'race_condition' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
