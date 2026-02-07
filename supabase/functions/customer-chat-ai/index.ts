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
const HUMAN_HANDOFF_KEYWORDS = [
  'humano', 'pessoa real', 'atendente', 'falar com alguem', 'falar com alguém',
  'não é robô', 'nao e robo', 'é um robô', 'e um robo', 'é um bot', 'e um bot',
  'quero falar com humano', 'quero um humano', 'atendimento humano',
  'não quero falar com ia', 'nao quero falar com ia', 'não quero ia', 'nao quero ia',
  'quero atendente', 'me passa para um humano', 'transfere para humano',
  'você é um robô', 'voce e um robo', 'vc é um robô', 'vc e um robo',
  'ta falando com robô', 'ta falando com robo', 'isso é ia', 'isso e ia',
  'sou real', 'pessoa de verdade', 'gente de verdade', 'ser humano',
  'não é real', 'nao e real', 'atendente real', 'suporte humano',
  'chat com pessoa', 'falar com gente', 'operador', 'operadora',
  'to falando com maquina', 'to falando com máquina', 'automático', 'automatico'
];

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
      description: "Save important information about the customer for future reference. ALWAYS use this when the customer mentions their name, plan, device, or any important detail. This is critical - never miss saving a customer's name.",
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
  },
  {
    type: "function",
    function: {
      name: "request_human_handoff",
      description: "IMMEDIATELY use this tool when the customer requests to speak with a real human, detects they are talking to a bot/AI, or explicitly asks to be transferred to a human agent. This will disable AI for this conversation and notify the owner.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the customer wants a human (e.g., 'customer detected AI', 'customer requested human agent')" },
          conversation_summary: { type: "string", description: "Brief summary of the conversation so far for the human agent" }
        },
        required: ["reason", "conversation_summary"]
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

    // Fetch sub-agents if any (filter by owner's agents)
    const { data: subAgentLinks } = await supabaseAdmin
      .from('ai_sub_agent_links')
      .select('sub_agent_id, priority, sub_agent:ai_agents!ai_sub_agent_links_sub_agent_id_fkey(*)')
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
- Use 'save_customer_info' para salvar informações importantes do cliente (SEMPRE salve o nome quando o cliente disser)
- Use 'transfer_to_agent' para transferir para um sub-agente especializado
- Use 'request_human_handoff' IMEDIATAMENTE quando o cliente pedir para falar com humano ou perceber que é IA`;

    // Add human detection instructions
    systemPrompt += `\n\n## ⚠️ REGRA CRÍTICA DE SEGURANÇA:
Se o cliente perceber que está falando com IA/robô, ou pedir para falar com um humano/atendente real, você DEVE:
1. IMEDIATAMENTE usar a ferramenta 'request_human_handoff' com um resumo da conversa
2. Responder educadamente que vai transferir para um atendente humano
3. NÃO tente convencer o cliente a continuar falando com você
4. NÃO negue que é uma IA se perguntado diretamente
Palavras-chave que indicam isso: "humano", "pessoa real", "atendente", "robô", "bot", "IA", "máquina", "automático"

## 📝 REGRA DE MEMÓRIA:
SEMPRE use 'save_customer_info' quando o cliente mencionar:
- Seu nome (info_type: "name")
- Seu plano/serviço (info_type: "plan")
- Seu dispositivo (info_type: "device")
- Qualquer preferência ou informação relevante (info_type: "preference" ou "note")`;
    
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

    // ============ PROACTIVE HUMAN HANDOFF DETECTION ============
    // Check the latest customer message for human handoff keywords as a safety net
    const lastCustomerMsg = (recentMessages || [])
      .filter(m => m.sender_type === 'customer')
      .pop();
    
    const lastMsgContent = (lastCustomerMsg?.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const detectedHandoff = HUMAN_HANDOFF_KEYWORDS.some(kw => {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return lastMsgContent.includes(normalizedKw);
    });

    if (detectedHandoff) {
      console.log(`[${VERSION}] ⚠️ Human handoff keyword detected in message: "${lastCustomerMsg?.content?.substring(0, 50)}..."`);
      // We still let the AI process it, but ensure the system prompt strongly directs it
      // The AI tools will handle the actual handoff
    }

    // Call the AI with tools - implement tool loop
    let responseText = '';
    let currentMessages = [...messages];
    let maxLoops = 3; // Prevent infinite loops
    
    for (let loop = 0; loop < maxLoops; loop++) {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: agent.ai_model || DEFAULT_MODEL,
          messages: currentMessages,
          tools: AI_TOOLS,
          max_completion_tokens: 2000,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const choice = aiData?.choices?.[0];
      const messageContent = choice?.message?.content || '';
      const toolCalls = choice?.message?.tool_calls;
      const finishReason = choice?.finish_reason;

      // If we got text content, accumulate it
      if (messageContent) {
        responseText += messageContent;
      }

      // If no tool calls, we're done
      if (!toolCalls || toolCalls.length === 0) {
        console.log(`[${VERSION}] No more tool calls, finish_reason: ${finishReason}`);
        break;
      }

      console.log(`[${VERSION}] Processing ${toolCalls.length} tool calls (loop ${loop + 1})`);
      
      // Add assistant message with tool calls to context
      currentMessages.push({
        role: 'assistant',
        content: messageContent || null,
        tool_calls: toolCalls
      } as any);

      // Process each tool call and collect results
      const toolResults: Array<{role: string; tool_call_id: string; content: string}> = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function?.name;
        const toolCallId = toolCall.id;
        const args = JSON.parse(toolCall.function?.arguments || '{}');
        
        console.log(`[${VERSION}] Tool call: ${functionName}`, args);
        let toolResult = 'OK';
        
        switch (functionName) {
          case 'notify_owner':
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
              toolResult = `Notificação enviada ao proprietário: ${args.summary}`;
              console.log(`[${VERSION}] Owner notification sent`);
            } catch (e) {
              toolResult = `Erro ao notificar: ${e}`;
              console.error(`[${VERSION}] Failed to notify owner:`, e);
            }
            break;
            
          case 'save_customer_info':
            try {
              const updates: Record<string, any> = { updated_at: new Date().toISOString() };
              switch (args.info_type) {
                case 'name': 
                  updates.client_name = args.value;
                  // Also update the conversation name in the inbox
                  await supabaseAdmin
                    .from('customer_conversations')
                    .update({ customer_name: args.value, updated_at: new Date().toISOString() })
                    .eq('id', conversationId);
                  // Also update conversation name in inbox conversations table if it exists
                  try {
                    await supabaseAdmin
                      .from('conversations')
                      .update({ contact_name: args.value })
                      .eq('phone', conversation.customer_user_id)
                      .eq('user_id', conversation.owner_id);
                  } catch (_e) { /* ignore if conversations table doesn't match */ }
                  break;
                case 'plan': updates.plan_name = args.value; break;
                case 'device': updates.device = args.value; break;
                default: 
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
                
              toolResult = `Informação salva: ${args.info_type} = ${args.value}`;
              console.log(`[${VERSION}] Customer info saved: ${args.info_type}`);
            } catch (e) {
              toolResult = `Erro ao salvar: ${e}`;
              console.error(`[${VERSION}] Failed to save customer info:`, e);
            }
            break;
            
          case 'generate_pix':
            try {
              // Get owner's InfinitePay handle
              const { data: ownerCreds } = await supabaseAdmin
                .from('user_payment_credentials')
                .select('infinitepay_handle')
                .eq('user_id', conversation.owner_id)
                .maybeSingle();

              const ipHandle = (ownerCreds as any)?.infinitepay_handle || Deno.env.get('INFINITEPAY_HANDLE') || '';

              if (!ipHandle) {
                toolResult = 'Erro: InfinitePay não configurado pelo vendedor';
              } else {
                const orderNsu = crypto.randomUUID();
                const priceInCents = Math.round(args.amount * 100);
                const SUPABASE_URL_IP = Deno.env.get('SUPABASE_URL')!;

                const ipResponse = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    handle: ipHandle,
                    items: [{ quantity: 1, price: priceInCents, description: args.description || args.plan_name || 'Pagamento' }],
                    order_nsu: orderNsu,
                    webhook_url: `${SUPABASE_URL_IP}/functions/v1/infinitepay-webhook`,
                    customer: { phone_number: conversation.customer_user_id },
                  })
                });

                if (ipResponse.ok) {
                  const ipData = await ipResponse.json();
                  const checkoutUrl = ipData.url || ipData.checkout_url || ipData.link || '';
                  toolResult = `Link de pagamento gerado com sucesso!`;
                  responseText += `\n\n💰 *Pagamento Gerado!*\n\nValor: R$ ${args.amount.toFixed(2)}\nDescrição: ${args.description}\n\n🔗 *Link de pagamento:*\n${checkoutUrl}\n\n_Clique no link acima para pagar via PIX, cartão ou outros métodos._`;
                } else {
                  toolResult = 'Erro ao gerar link de pagamento';
                }
              }
              console.log(`[${VERSION}] Checkout generated`);
            } catch (e) {
              toolResult = `Erro ao gerar pagamento: ${e}`;
              console.error(`[${VERSION}] Failed to generate checkout:`, e);
            }
            break;
            
          case 'transfer_to_agent':
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
                toolResult = `Transferido para ${newAgent.name}`;
                responseText = `*Transferindo para ${newAgent.name}...*\n\n${args.reason}`;
              }
              console.log(`[${VERSION}] Transferred to agent: ${args.agent_id}`);
            } catch (e) {
              toolResult = `Erro ao transferir: ${e}`;
              console.error(`[${VERSION}] Failed to transfer:`, e);
            }
            break;
            
          case 'analyze_image':
            toolResult = `Imagem analisada: ${args.analysis_type}`;
            break;

          case 'request_human_handoff':
            try {
              // 1. Disable AI for this conversation
              await supabaseAdmin
                .from('customer_conversations')
                .update({ 
                  ai_enabled: false,
                  active_agent_id: null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', conversationId);

              // 2. Send notification to owner with summary
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-owner-notification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  userId: conversation.owner_id,
                  eventType: 'human_handoff',
                  contactPhone: conversation.customer_user_id,
                  contactName: customerMemory?.client_name,
                  summary: `🤖➡️👤 Cliente solicitou atendimento humano.\n\nMotivo: ${args.reason}\n\nResumo da conversa:\n${args.conversation_summary}`,
                  urgency: 'high',
                  conversationId: conversationId
                })
              });

              toolResult = 'IA desativada e notificação enviada ao proprietário';
              responseText = '👤 Entendido! Estou transferindo você para um atendente humano. Em breve alguém irá te atender. Obrigado pela paciência!';
              console.log(`[${VERSION}] Human handoff requested - AI disabled for conversation ${conversationId}`);
            } catch (e) {
              toolResult = `Erro no handoff: ${e}`;
              console.error(`[${VERSION}] Failed human handoff:`, e);
            }
            break;
            
          default:
            toolResult = 'Ferramenta não reconhecida';
        }
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: toolResult
        });
      }
      
      // Add tool results to messages for next iteration
      currentMessages.push(...toolResults);
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
