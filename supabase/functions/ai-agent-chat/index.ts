import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Bump when deploying to verify the newest code is running
const VERSION = "ai-agent-chat@2026-01-30.1";

function getCorsHeaders(req: Request) {
  // Some environments send requests with credentials. In that case, "*" is not allowed.
  const origin = req.headers.get('origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    // Supabase JS adds extra headers (e.g. x-supabase-client-platform) that must be allowed for CORS preflight.
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };
}

const DEFAULT_LOVABLE_MODEL = 'google/gemini-3-flash-preview';

// When true, the model receives ONLY the system_prompt + the current user message
// (no extra rules, no canned responses, no client memory context, no history, no tools).
// This is enforced for WhatsApp sources to match the expected “prompt-only” behavior.
function isPromptOnlySource(source: string | null | undefined) {
  // User-requested: enforce prompt-only for all sources.
  return true;
}

const LOVABLE_ALLOWED_MODELS = new Set([
  'openai/gpt-5-mini',
  'openai/gpt-5',
  'openai/gpt-5-nano',
  'openai/gpt-5.2',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash-image',
  'google/gemini-3-pro-preview',
  'google/gemini-3-flash-preview',
  'google/gemini-3-pro-image-preview',
]);

function normalizeLovableModel(input: string | null | undefined) {
  const raw = (input ?? '').trim();
  if (!raw) return { requestedModel: null as string | null, normalizedModel: DEFAULT_LOVABLE_MODEL };

  // If agent was previously configured for direct Gemini (e.g. "gemini-1.5-pro"),
  // map to a safe default available in Lovable AI.
  if (raw.startsWith('gemini-')) {
    return { requestedModel: raw, normalizedModel: DEFAULT_LOVABLE_MODEL };
  }

  // Keep provider-prefixed models if supported.
  if (LOVABLE_ALLOWED_MODELS.has(raw)) {
    return { requestedModel: raw, normalizedModel: raw };
  }

  return { requestedModel: raw, normalizedModel: DEFAULT_LOVABLE_MODEL };
}

interface ChatRequest {
  agentId: string;
  message: string;
  sessionId?: string;
  source?: 'web' | 'whatsapp' | 'whatsapp-inbox';
  phone?: string; // Phone number for memory lookup
  conversationId?: string; // Conversation ID for transfer updates
  metadata?: Record<string, unknown>;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  choices: Array<{
    message: {
      content: string;
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

interface ExtractedClientInfo {
  client_name?: string;
  nickname?: string;
  device?: string;
  app_name?: string;
  plan_name?: string;
  plan_price?: number;
  custom_info?: Array<{ key: string; value: string }>;
}

// Tool definition for extracting client info
const extractionToolDef = {
  type: "function",
  function: {
    name: "save_client_info",
    description: "Salva informações importantes do cliente extraídas da conversa. Use quando o cliente mencionar seu nome, aparelho, plano, aplicativo ou qualquer informação relevante.",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Nome do cliente" },
        nickname: { type: "string", description: "Apelido ou nome preferido do cliente" },
        device: { type: "string", description: "Aparelho/dispositivo do cliente (ex: TV Box, Celular, Smart TV)" },
        app_name: { type: "string", description: "Nome do aplicativo que o cliente usa" },
        plan_name: { type: "string", description: "Nome ou tipo do plano contratado (ex: Mensal, Anual, Premium)" },
        plan_price: { type: "number", description: "Valor do plano em reais" },
        custom_info: { 
          type: "array",
          description: "Outras informações relevantes sobre o cliente",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Tipo da informação (ex: preferencia_horario, quantidade_tvs)" },
              value: { type: "string", description: "Valor da informação" }
            },
            required: ["key", "value"]
          }
        }
      }
    }
  }
};

// Interface for transfer decision
interface TransferDecision {
  target_agent_id: string;
  reason: string;
  transfer_message?: string;
}

// Interface for PIX generation decision
interface PIXGenerationDecision {
  plan_option: number;  // 1, 2, 3, etc.
  custom_amount?: number;
  custom_description?: string;
}

// Function to build transfer tool based on available target agents
function buildTransferTool(targetAgents: Array<{ id: string; name: string; description: string; specialization: string }>) {
  if (targetAgents.length === 0) return null;
  
  // Build enum of agent IDs and descriptions
  const agentDescriptions = targetAgents.map(a => 
    `"${a.id}" = ${a.name}${a.specialization ? ` (Especialista em: ${a.specialization})` : ''}${a.description ? ` - ${a.description}` : ''}`
  ).join('\n');
  
  return {
    type: "function",
    function: {
      name: "transfer_to_specialist",
      description: `Transfere o atendimento para um agente especializado quando você perceber que o cliente tem interesse em um assunto específico fora do seu escopo. Use quando o cliente demonstrar interesse claro em um tópico coberto por outro agente.

AGENTES ESPECIALIZADOS DISPONÍVEIS:
${agentDescriptions}

QUANDO TRANSFERIR:
- O cliente demonstra interesse claro em um assunto específico
- Você percebe que outro agente pode atender melhor a necessidade do cliente
- O cliente pede explicitamente para falar sobre um assunto especializado

QUANDO NÃO TRANSFERIR:
- Cliente está apenas perguntando de forma genérica
- Você ainda consegue responder adequadamente
- Cliente não demonstrou interesse específico ainda`,
      parameters: {
        type: "object",
        properties: {
          target_agent_id: { 
            type: "string", 
            description: "ID do agente especializado para o qual transferir",
            enum: targetAgents.map(a => a.id)
          },
          reason: { 
            type: "string", 
            description: "Motivo da transferência (ex: 'Cliente demonstrou interesse em pacotes de internet')" 
          },
          transfer_message: { 
            type: "string", 
            description: "Mensagem opcional para enviar ao cliente antes de transferir (ex: 'Vou te transferir para nosso especialista em pacotes de dados, ele vai te ajudar melhor!')" 
          }
        },
        required: ["target_agent_id", "reason"]
      }
    }
  };
}

// Function to build PIX generation tool based on available plans
function buildPIXTool(plans: Array<{ option_number: number; name: string; price: number; duration_days: number }>) {
  if (plans.length === 0) return null;
  
  const planDescriptions = plans.map(p => 
    `${p.option_number} = ${p.name} - R$ ${p.price.toFixed(2)} (${p.duration_days} dias)`
  ).join('\n');
  
  return {
    type: "function",
    function: {
      name: "generate_pix_payment",
      description: `Gera um pagamento PIX para o cliente quando ele escolher um plano ou pedir para pagar. Use quando o cliente demonstrar interesse em pagar ou escolher uma opção de plano.

PLANOS DISPONÍVEIS:
${planDescriptions}

QUANDO USAR:
- Cliente disse "quero o plano X" ou "vou pagar o X"
- Cliente escolheu uma opção numérica (ex: "opção 1", "quero a 2")
- Cliente pediu para gerar PIX ou código de pagamento
- Cliente confirmou que quer comprar/renovar

QUANDO NÃO USAR:
- Cliente está apenas perguntando sobre preços
- Cliente ainda não decidiu qual plano quer
- Cliente está tirando dúvidas antes de comprar`,
      parameters: {
        type: "object",
        properties: {
          plan_option: { 
            type: "number", 
            description: "Número da opção do plano escolhido pelo cliente (ex: 1, 2, 3)",
            enum: plans.map(p => p.option_number)
          },
          custom_amount: { 
            type: "number", 
            description: "Valor personalizado em reais (apenas se o cliente pediu um valor específico fora dos planos)" 
          },
          custom_description: { 
            type: "string", 
            description: "Descrição personalizada do pagamento (apenas para valores personalizados)" 
          }
        },
        required: ["plan_option"]
      }
    }
  };
}

// Function to build client context from memory and client data
function buildClientContext(memory: any, clientData: any): string {
  if (!memory && !clientData) return '';

  const name = memory?.client_name || clientData?.name;
  const nickname = memory?.nickname;
  const device = memory?.device || clientData?.device;
  const appName = memory?.app_name || clientData?.app_name;
  const planName = memory?.plan_name || clientData?.plan;
  const planPrice = memory?.plan_price || clientData?.price;
  const expiresAt = clientData?.expires_at;
  const customMemories = memory?.custom_memories || [];
  const aiSummary = memory?.ai_summary;
  const totalInteractions = memory?.total_interactions || 1;
  const sentiment = memory?.sentiment;
  const isVip = memory?.is_vip;

  let context = `\n\n## INFORMAÇÕES DO CLIENTE (Use para personalizar suas respostas)\n`;
  
  if (name) context += `- Nome: ${name}\n`;
  if (nickname) context += `- Apelido: ${nickname} (prefira usar o apelido)\n`;
  if (device) context += `- Aparelho: ${device}\n`;
  if (appName) context += `- Aplicativo: ${appName}\n`;
  if (planName) context += `- Plano: ${planName}\n`;
  if (planPrice) context += `- Valor: R$ ${planPrice}\n`;
  if (expiresAt) context += `- Vencimento: ${new Date(expiresAt).toLocaleDateString('pt-BR')}\n`;
  if (totalInteractions > 1) context += `- Interações anteriores: ${totalInteractions}\n`;
  if (isVip) context += `- Cliente VIP: Sim (trate com atenção especial)\n`;
  if (sentiment && sentiment !== 'neutral') context += `- Sentimento detectado: ${sentiment}\n`;

  if (customMemories.length > 0) {
    context += `\n### Memórias Adicionais:\n`;
    for (const mem of customMemories) {
      context += `- ${mem.key}: ${mem.value}\n`;
    }
  }

  if (aiSummary) {
    context += `\n### Resumo do Cliente:\n${aiSummary}\n`;
  }

  context += `\nIMPORTANTE: Use essas informações para personalizar suas respostas. `;
  context += `Sempre chame o cliente pelo nome/apelido quando souber. `;
  context += `Demonstre que você lembra das informações anteriores.\n`;

  return context;
}

// Function to save/update client memory
async function saveClientMemory(
  supabaseAdmin: any,
  userId: string,
  agentId: string,
  phone: string,
  extractedInfo: ExtractedClientInfo,
  existingMemory: any
) {
  try {
    const now = new Date().toISOString();
    
    // Build custom memories array
    let customMemories = existingMemory?.custom_memories || [];
    if (extractedInfo.custom_info && extractedInfo.custom_info.length > 0) {
      for (const info of extractedInfo.custom_info) {
        const existingIdx = customMemories.findIndex((m: any) => m.key === info.key);
        const newMem = { key: info.key, value: info.value, extracted_at: now };
        if (existingIdx >= 0) {
          customMemories[existingIdx] = newMem;
        } else {
          customMemories.push(newMem);
        }
      }
    }

    const memoryData = {
      user_id: userId,
      agent_id: agentId,
      phone: phone,
      client_name: extractedInfo.client_name || existingMemory?.client_name,
      nickname: extractedInfo.nickname || existingMemory?.nickname,
      device: extractedInfo.device || existingMemory?.device,
      app_name: extractedInfo.app_name || existingMemory?.app_name,
      plan_name: extractedInfo.plan_name || existingMemory?.plan_name,
      plan_price: extractedInfo.plan_price || existingMemory?.plan_price,
      custom_memories: customMemories,
      last_interaction_at: now,
      total_interactions: (existingMemory?.total_interactions || 0) + 1,
      updated_at: now,
    };

    const { error } = await supabaseAdmin
      .from('ai_client_memories')
      .upsert(memoryData, { onConflict: 'user_id,agent_id,phone' });

    if (error) {
      console.error('[ai-agent-chat] Error saving memory:', error);
    } else {
      console.log('[ai-agent-chat] Memory saved successfully for phone:', phone);
    }
  } catch (err) {
    console.error('[ai-agent-chat] Error in saveClientMemory:', err);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client for fetching agent data (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body first
    let body: ChatRequest | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const {
      agentId,
      message,
      sessionId,
      source = 'web',
      phone,
      conversationId,
      metadata = {},
    } = body;

    // Validate required fields early (before any DB lookups)
    if (!agentId || !message) {
      return new Response(
        JSON.stringify({ error: 'agentId and message are required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Always resolve agent owner first so fallback is reliable
    const { data: agentOwnerRow, error: agentOwnerError } = await supabaseAdmin
      .from('ai_agents')
      .select('created_by')
      .eq('id', agentId)
      .maybeSingle();

    if (agentOwnerError) {
      console.error('[ai-agent-chat] Error fetching agent owner:', agentOwnerError);
    }

    const agentOwnerId = agentOwnerRow?.created_by || '';
    if (!agentOwnerId) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

    // Check if this is an internal call from whatsapp-inbox-webhook
    const isInternalCall = source === 'whatsapp-inbox' || source === 'whatsapp';
    const isServiceRoleKey = !!token && token === supabaseServiceKey;

    let userId: string = agentOwnerId;
    let supabaseUser: any = supabaseAdmin;

    if (isInternalCall && isServiceRoleKey) {
      // Internal webhook call - bypass user auth, use service role for DB operations
      console.log(`[ai-agent-chat] Internal webhook call detected for agent: ${agentId}`);
      userId = agentOwnerId;
      supabaseUser = supabaseAdmin;
      console.log(`[ai-agent-chat] Using agent owner as user context: ${userId}`);
    } else {
      // Normal web/chat call - try to authenticate user; if missing/invalid, fallback to agent owner
      if (authHeader && authHeader !== 'Bearer ') {
        const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        try {
          const { data, error: authError } = await supabaseAuthed.auth.getUser();
          if (!authError && data?.user) {
            userId = data.user.id;
            supabaseUser = supabaseAuthed;
          } else {
            // Fallback when token is missing/invalid
            userId = agentOwnerId;
            supabaseUser = supabaseAdmin;
          }
        } catch (e) {
          console.log('[ai-agent-chat] Auth error (non-fatal):', e);
          userId = agentOwnerId;
          supabaseUser = supabaseAdmin;
        }
      } else {
        // No auth header
        userId = agentOwnerId;
        supabaseUser = supabaseAdmin;
      }
    }

    console.log(`[${VERSION}] Processing chat request for agent: ${agentId}, user: ${userId}, source: ${source}, phone: ${phone || 'N/A'}`);

    // Fetch agent details (using admin client to get all fields)
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('Agent not found:', agentError);
      return new Response(
        JSON.stringify({ error: 'Agent not found or inactive' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is enabled for the source
    if (source === 'web' && !agent.is_chat_enabled) {
      return new Response(
        JSON.stringify({ error: 'Agent is not enabled for web chat' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (source === 'whatsapp' && !agent.is_whatsapp_enabled) {
      return new Response(
        JSON.stringify({ error: 'Agent is not enabled for WhatsApp' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Generate or use provided session ID
    const chatSessionId = sessionId || crypto.randomUUID();

    // ============ MEMORY SYSTEM ============
    let clientContext = '';
    let existingMemory: any = null;
    let clientData: any = null;

    if (agent.memory_enabled && phone) {
      console.log(`[ai-agent-chat] Memory enabled, fetching context for phone: ${phone}`);
      
      // Fetch existing memory for this phone
      const { data: memoryData } = await supabaseAdmin
        .from('ai_client_memories')
        .select('*')
        .eq('phone', phone)
        .eq('agent_id', agentId)
        .maybeSingle();
      
      existingMemory = memoryData;

      // If memory_sync_clients is enabled, also fetch from clients table
      if (agent.memory_sync_clients) {
        // Try multiple phone formats for matching
        const phoneVariants = [
          phone,
          phone.replace(/\D/g, ''),
          phone.startsWith('55') ? phone.slice(2) : `55${phone}`,
        ];

        const { data: clientResult } = await supabaseAdmin
          .from('clients')
          .select('*')
          .or(phoneVariants.map(p => `whatsapp.ilike.%${p}%`).join(','))
          .eq('user_id', userId)
          .maybeSingle();
        
        clientData = clientResult;
      }

      // Build context string
      clientContext = buildClientContext(existingMemory, clientData);
      
      if (clientContext) {
        console.log(`[ai-agent-chat] Client context loaded for phone: ${phone}`);
      }
    }

    // Save user message to database
    const { error: saveUserMsgError } = await supabaseUser
      .from('ai_chat_messages')
      .insert({
        agent_id: agentId,
        user_id: userId,
        session_id: chatSessionId,
        role: 'user',
        content: message,
        metadata: { source, phone, ...metadata }
      });

    if (saveUserMsgError) {
      console.error('Error saving user message:', saveUserMsgError);
    }

    let assistantResponse = '';
    let aiError = null;
    let extractedInfo: ExtractedClientInfo | null = null;
    let transferDecision: TransferDecision | null = null;
    let pixDecision: PIXGenerationDecision | null = null;

    // ============ FETCH AVAILABLE TARGET AGENTS FOR TRANSFER ============
    let availableTargetAgents: Array<{ id: string; name: string; description: string; specialization: string }> = [];
    
    // Only fetch transfer targets for WhatsApp sources and if conversationId is provided
    if ((source === 'whatsapp-inbox' || source === 'whatsapp') && conversationId) {
      // Get transfer rules from current agent to others
      const { data: transferRules } = await supabaseAdmin
        .from('ai_agent_transfer_rules')
        .select(`
          target_agent_id,
          target_agent:ai_agents!ai_agent_transfer_rules_target_agent_id_fkey(
            id, name, description, specialization, is_active
          )
        `)
        .eq('source_agent_id', agentId)
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (transferRules && transferRules.length > 0) {
        availableTargetAgents = transferRules
          .filter((r: any) => r.target_agent && r.target_agent.is_active)
          .map((r: any) => ({
            id: r.target_agent.id,
            name: r.target_agent.name,
            description: r.target_agent.description || '',
            specialization: r.target_agent.specialization || ''
          }));
        
        console.log(`[ai-agent-chat] Found ${availableTargetAgents.length} available transfer targets`);
      }
    }

    // ============ FETCH AVAILABLE PAYMENT PLANS FOR PIX ============
    let availablePlans: Array<{ option_number: number; name: string; price: number; duration_days: number; id: string }> = [];
    
    // Only fetch plans for WhatsApp sources
    if ((source === 'whatsapp-inbox' || source === 'whatsapp') && phone) {
      // Get bot_proxy_config for this user to fetch plans
      const { data: proxyConfig } = await supabaseAdmin
        .from('bot_proxy_config')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (proxyConfig) {
        const { data: plans } = await supabaseAdmin
          .from('bot_proxy_plans')
          .select('id, option_number, name, price, duration_days')
          .eq('config_id', proxyConfig.id)
          .eq('is_active', true)
          .order('option_number');
        
        if (plans && plans.length > 0) {
          availablePlans = plans.map(p => ({
            id: p.id,
            option_number: p.option_number,
            name: p.name,
            price: Number(p.price),
            duration_days: p.duration_days
          }));
          console.log(`[ai-agent-chat] Found ${availablePlans.length} available payment plans`);
        }
      }
    }

    // Check if using native AI (Google Gemini API) or external webhook
    if (agent.use_native_ai) {
      // ============ NATIVE AI INTEGRATION (LOVABLE AI GATEWAY) ============
      const { requestedModel, normalizedModel } = normalizeLovableModel(agent.ai_model);
      console.log(`[${VERSION}] Using Lovable AI Gateway. requestedModel=${requestedModel ?? 'null'} normalizedModel=${normalizedModel}`);

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        console.error('[ai-agent-chat] LOVABLE_API_KEY not configured');
        aiError = 'Lovable AI key not configured';
        assistantResponse = 'Desculpe, o serviço de IA não está configurado corretamente. Contate o administrador.';
      } else {
        try {
          const promptOnly = isPromptOnlySource(source);
          if (promptOnly) {
            console.log(`[${VERSION}] Prompt-only mode enabled for source=${source} (ignoring history/memory/tools/system injections)`);
          }

          // Fetch conversation history for context (disabled for prompt-only sources).
          // IMPORTANT: When the agent config changes, old history can keep the model behaving like before.
          // To make config updates take effect immediately, we only include messages created AFTER agent.updated_at.
          let history: Array<{ role: string; content: string; created_at: string }> | null = null;
          if (!promptOnly) {
            const historyQuery = supabaseAdmin
              .from('ai_chat_messages')
              .select('role, content, created_at')
              .eq('session_id', chatSessionId)
              .order('created_at', { ascending: true })
              .limit(20);

            const agentUpdatedAt = agent.updated_at ? String(agent.updated_at) : null;
            const { data } = agentUpdatedAt
              ? await historyQuery.gt('created_at', agentUpdatedAt)
              : await historyQuery;
            history = data ?? null;

            if (agentUpdatedAt) {
              console.log(`[${VERSION}] Context cutoff enabled: only messages after agent.updated_at=${agentUpdatedAt}`);
            }
          }

          // Build system prompt with client context and anti-hallucination rules
          const baseSystemPrompt = agent.system_prompt || 'Você é um assistente útil e prestativo. Responda sempre em português brasileiro.';

          // Anti-hallucination rules (disabled for prompt-only)
          const antiHallucinationRules = (!promptOnly && agent.anti_hallucination_enabled !== false) ? `

## REGRAS CRÍTICAS DE COMPORTAMENTO (OBEDEÇA SEMPRE)

1. **NUNCA INVENTE INFORMAÇÕES**
   - Se não souber preços, planos ou detalhes, diga "não tenho essa informação disponível"
   - Não crie valores, funcionalidades ou características fictícias
   - Quando em dúvida, pergunte ao cliente ou peça para aguardar um atendente

2. **RESPONDA APENAS AO QUE FOI PERGUNTADO**
   - Não antecipe perguntas que o cliente não fez
   - Uma pergunta simples = uma resposta focada e breve
   - Evite respostas longas quando não solicitadas

3. **MÚLTIPLAS MENSAGENS = CONTEXTO ÚNICO**
   - Se receber várias mensagens seguidas, trate como UMA conversa
   - Considere todas as mensagens antes de responder
   - Responda de forma que cubra todos os pontos mencionados

4. **SEJA CONCISO E NATURAL**
   - Respostas de 1-3 frases para perguntas simples
   - Use linguagem natural, como um humano conversando
   - Evite parecer robótico ou repetitivo

5. **CONSISTÊNCIA**
   - Não contradiga informações já dadas na conversa
   - Mantenha o mesmo tom e estilo durante toda a interação

6. **LIMITAÇÕES**
   - Você NÃO pode acessar sistemas externos, realizar pagamentos ou modificar cadastros
   - Se o cliente pedir algo fora do seu escopo, direcione para um atendente humano
` : '';

          // ============ CANNED RESPONSES INTEGRATION (disabled for prompt-only) ==========
          let cannedResponsesContext = '';
          if (!promptOnly && agent.use_canned_responses !== false) {
            const { data: cannedResponses, error: cannedError } = await supabaseAdmin
              .from('canned_responses')
              .select('short_code, content')
              .or(`user_id.eq.${agent.created_by},is_global.eq.true`)
              .order('short_code');

            if (cannedError) {
              console.error('[ai-agent-chat] Error fetching canned responses:', cannedError);
            } else if (cannedResponses && cannedResponses.length > 0) {
              console.log(`[ai-agent-chat] Loaded ${cannedResponses.length} canned responses for context`);

              cannedResponsesContext = `

## RESPOSTAS RÁPIDAS DISPONÍVEIS (BASE DE CONHECIMENTO)

INSTRUÇÕES IMPORTANTES:
- Quando o cliente perguntar sobre preços, planos, formas de pagamento ou qualquer tópico coberto abaixo, USE EXATAMENTE o conteúdo fornecido
- NÃO invente valores, preços ou informações diferentes do que está aqui
- Você pode adaptar a linguagem para ser mais natural, mas os VALORES e INFORMAÇÕES devem ser EXATOS
- Se não houver resposta rápida para o assunto, responda normalmente ou diga que não tem a informação

`;
              for (const response of cannedResponses) {
                cannedResponsesContext += `### /${response.short_code}\n${response.content}\n\n`;
              }
            }
          }

          // In prompt-only mode we enforce EXACTLY the system prompt.
          // Otherwise we enrich with rules/knowledge/memory.
          const enrichedSystemPrompt = promptOnly
            ? baseSystemPrompt
            : (baseSystemPrompt + antiHallucinationRules + cannedResponsesContext + clientContext);

          // Build messages array with system prompt and (optional) history
          const messages: AIMessage[] = [{ role: 'system', content: enrichedSystemPrompt }];

          if (!promptOnly) {
            // Add history (excluding the message we just saved)
            if (history && history.length > 0) {
              for (const msg of history) {
                if (msg.role === 'user' && msg.content === message) continue;
                messages.push({
                  role: msg.role as 'user' | 'assistant',
                  content: msg.content,
                });
              }
            }
          }

          // Add current user message
          messages.push({ role: 'user', content: message });

          // Build OpenAI-compatible tools array (Lovable AI Gateway)
          // Disabled entirely for prompt-only sources.
          const tools: any[] = [];
          if (!promptOnly) {
            if (agent.memory_enabled && agent.memory_auto_extract && phone) {
              tools.push({ type: 'function', function: extractionToolDef.function });
            }

            const transferTool = buildTransferTool(availableTargetAgents);
            if (transferTool) {
              tools.push({ type: 'function', function: transferTool.function });
              console.log(`[ai-agent-chat] Transfer tool added with ${availableTargetAgents.length} target agents`);
            }

            const pixTool = buildPIXTool(availablePlans);
            if (pixTool) {
              tools.push({ type: 'function', function: pixTool.function });
              console.log(`[ai-agent-chat] PIX tool added with ${availablePlans.length} plans`);
            }
          }

           console.log(`[${VERSION}] Sending ${messages.length} messages to Lovable AI Gateway`);

          const gatewayResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: normalizedModel,
              messages,
              ...(tools.length > 0 ? { tools } : {}),
            }),
          });

          if (!gatewayResp.ok) {
            const t = await gatewayResp.text();
            console.error('[ai-agent-chat] Lovable AI Gateway error:', gatewayResp.status, t);
            if (gatewayResp.status === 429) {
              aiError = 'Rate limits exceeded';
              assistantResponse = 'Desculpe, estamos com muitas requisições no momento. Por favor, tente novamente em alguns segundos.';
            } else if (gatewayResp.status === 402) {
              aiError = 'Payment required';
              assistantResponse = 'Desculpe, a IA está sem créditos no momento. Contate o administrador.';
            } else {
              aiError = `AI gateway returned status ${gatewayResp.status}`;
              assistantResponse = 'Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente mais tarde.';
            }
          } else {
            const gatewayData: AIResponse = await gatewayResp.json();
            if (gatewayData.error?.message) {
              aiError = gatewayData.error.message;
              assistantResponse = 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.';
            } else {
              const msg = gatewayData.choices?.[0]?.message;
              if (msg?.content) assistantResponse = msg.content;

              const toolCalls = msg?.tool_calls || [];
              for (const tc of toolCalls) {
                const fn = tc?.function?.name;
                const argsStr = tc?.function?.arguments;
                if (!fn || !argsStr) continue;
                try {
                  const parsedArgs = JSON.parse(argsStr);
                  if (fn === 'save_client_info') {
                    extractedInfo = parsedArgs as ExtractedClientInfo;
                    console.log('[ai-agent-chat] Extracted client info:', extractedInfo);
                  } else if (fn === 'transfer_to_specialist') {
                    transferDecision = parsedArgs as TransferDecision;
                    console.log('[ai-agent-chat] AI decided to transfer:', transferDecision);
                  } else if (fn === 'generate_pix_payment') {
                    pixDecision = parsedArgs as PIXGenerationDecision;
                    console.log('[ai-agent-chat] AI decided to generate PIX:', pixDecision);
                  }
                } catch (e) {
                  console.error('[ai-agent-chat] Error parsing tool arguments:', fn, e);
                }
              }

              // Guardrail: some models may respond with tool_calls but empty content.
              // Never return an empty assistant message, otherwise inbox/WhatsApp flows will appear to “stop responding”.
              if (!assistantResponse || assistantResponse.trim().length === 0) {
                aiError = aiError || 'Empty AI response';
                assistantResponse = 'Certo! 😊 Como posso te ajudar agora?';
                console.warn('[ai-agent-chat] Empty assistant content detected; using fallback message.');
              }
            }
          }
        } catch (err) {
          console.error('[ai-agent-chat] Error calling Lovable AI Gateway:', err);
          aiError = err instanceof Error ? err.message : 'Unknown error';
          assistantResponse = 'Desculpe, não foi possível conectar ao serviço de IA. Por favor, tente novamente.';
        }
      }
    } else {
      // ============ EXTERNAL WEBHOOK (n8n) ============
      if (!agent.webhook_url) {
        console.error('No webhook URL configured for non-native agent');
        aiError = 'Webhook URL not configured';
        assistantResponse = 'Desculpe, este agente não está configurado corretamente. Contate o administrador.';
      } else {
        console.log(`Calling external webhook: ${agent.webhook_url}`);
        
        try {
          // Include client context in webhook payload
          const n8nResponse = await fetch(agent.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message,
              sessionId: chatSessionId,
              userId: userId,
              source,
              phone,
              agentName: agent.name,
              clientContext: existingMemory || clientData ? {
                name: existingMemory?.client_name || clientData?.name,
                nickname: existingMemory?.nickname,
                device: existingMemory?.device || clientData?.device,
                appName: existingMemory?.app_name || clientData?.app_name,
                planName: existingMemory?.plan_name || clientData?.plan,
                customMemories: existingMemory?.custom_memories || [],
              } : null,
              metadata: {
                ...metadata,
              }
            }),
          });

          if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error('Webhook error:', n8nResponse.status, errorText);
            aiError = `Webhook returned status ${n8nResponse.status}`;
            assistantResponse = 'Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente mais tarde.';
          } else {
            const n8nData = await n8nResponse.json();
            console.log('Webhook response:', n8nData);
            
            // n8n can return response in different formats
            assistantResponse = 
              n8nData.response || 
              n8nData.message || 
              n8nData.output || 
              n8nData.text ||
              n8nData.reply ||
              (typeof n8nData === 'string' ? n8nData : JSON.stringify(n8nData));
            
            // n8n can also return extracted info
            if (n8nData.extractedInfo) {
              extractedInfo = n8nData.extractedInfo as ExtractedClientInfo;
            }
          }
        } catch (fetchError: unknown) {
          console.error('Error calling webhook:', fetchError);
          aiError = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          assistantResponse = 'Desculpe, não foi possível conectar ao agente. Por favor, tente novamente.';
        }
      }
    }

    // ============ SAVE EXTRACTED MEMORY ============
    if (agent.memory_enabled && phone && extractedInfo) {
      // Check if any info was actually extracted
      const hasInfo = extractedInfo.client_name || 
                      extractedInfo.nickname || 
                      extractedInfo.device || 
                      extractedInfo.app_name || 
                      extractedInfo.plan_name || 
                      extractedInfo.plan_price ||
                      (extractedInfo.custom_info && extractedInfo.custom_info.length > 0);
      
      if (hasInfo) {
        await saveClientMemory(supabaseAdmin, userId, agentId, phone, extractedInfo, existingMemory);
      }
    } else if (agent.memory_enabled && phone && !existingMemory) {
      // Create initial memory record to track interaction count
      await saveClientMemory(supabaseAdmin, userId, agentId, phone, {}, null);
    } else if (agent.memory_enabled && phone && existingMemory) {
      // Update interaction count
      await supabaseAdmin
        .from('ai_client_memories')
        .update({
          last_interaction_at: new Date().toISOString(),
          total_interactions: (existingMemory.total_interactions || 0) + 1,
        })
        .eq('id', existingMemory.id);
    }

    // ============ EXECUTE TRANSFER IF AI DECIDED ============
    let transferExecuted = false;
    if (transferDecision && conversationId) {
      console.log(`[ai-agent-chat] Executing transfer to agent ${transferDecision.target_agent_id}`);
      
      // Update conversation with new active agent
      const { error: transferError } = await supabaseAdmin
        .from('conversations')
        .update({
          active_agent_id: transferDecision.target_agent_id,
          transferred_from_agent_id: agentId,
          transfer_reason: transferDecision.reason
        })
        .eq('id', conversationId);
      
      if (transferError) {
        console.error('[ai-agent-chat] Error executing transfer:', transferError);
      } else {
        transferExecuted = true;
        console.log(`[ai-agent-chat] Transfer executed successfully to ${transferDecision.target_agent_id}`);
        
        // If AI decided to transfer but didn't provide a response, use the transfer message
        if (!assistantResponse && transferDecision.transfer_message) {
          assistantResponse = transferDecision.transfer_message;
        }
      }
    }

    // ============ EXECUTE PIX GENERATION IF AI DECIDED ============
    let pixGenerated: {
      plan_name: string;
      amount: number;
      duration_days: number;
      pix_code: string;
      pix_qr_code: string;
      external_id: string;
    } | null = null;
    
    if (pixDecision && phone && conversationId) {
      console.log(`[ai-agent-chat] Generating PIX for plan option ${pixDecision.plan_option}`);
      
      // Find the plan by option number
      const selectedPlan = availablePlans.find(p => p.option_number === pixDecision.plan_option);
      
      if (selectedPlan) {
        try {
          const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
          
          if (!MERCADO_PAGO_ACCESS_TOKEN) {
            console.error('[ai-agent-chat] MERCADO_PAGO_ACCESS_TOKEN not configured');
          } else {
            // Generate PIX via Mercado Pago
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
            
            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `ai-pix-${conversationId}-${Date.now()}`
              },
              body: JSON.stringify({
                transaction_amount: selectedPlan.price,
                description: `${selectedPlan.name} - ${selectedPlan.duration_days} dias`,
                payment_method_id: 'pix',
                payer: {
                  email: `${phone.replace(/\D/g, '')}@pix.generated.com`
                },
                date_of_expiration: expiresAt.toISOString()
              })
            });
            
            if (mpResponse.ok) {
              const mpData = await mpResponse.json();
              
              // Extract PIX data
              const pixCode = mpData.point_of_interaction?.transaction_data?.qr_code || '';
              const pixQrCode = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';
              
              // Save to database
              const { error: savePixError } = await supabaseAdmin
                .from('client_pix_payments')
                .insert({
                  user_id: userId,
                  conversation_id: conversationId,
                  client_phone: phone,
                  plan_id: selectedPlan.id,
                  plan_name: selectedPlan.name,
                  amount: selectedPlan.price,
                  duration_days: selectedPlan.duration_days,
                  external_id: String(mpData.id),
                  pix_code: pixCode,
                  pix_qr_code: pixQrCode,
                  status: 'pending',
                  expires_at: expiresAt.toISOString()
                });
              
              if (savePixError) {
                console.error('[ai-agent-chat] Error saving PIX payment:', savePixError);
              } else {
                pixGenerated = {
                  plan_name: selectedPlan.name,
                  amount: selectedPlan.price,
                  duration_days: selectedPlan.duration_days,
                  pix_code: pixCode,
                  pix_qr_code: pixQrCode,
                  external_id: String(mpData.id)
                };
                console.log(`[ai-agent-chat] PIX generated successfully: ${mpData.id}`);
              }
            } else {
              const errorText = await mpResponse.text();
              console.error('[ai-agent-chat] Mercado Pago error:', mpResponse.status, errorText);
            }
          }
        } catch (pixError) {
          console.error('[ai-agent-chat] Error generating PIX:', pixError);
        }
      } else {
        console.warn(`[ai-agent-chat] Plan option ${pixDecision.plan_option} not found`);
      }
    }

    // Save assistant response to database
    const { data: savedMessage, error: saveAssistantMsgError } = await supabaseUser
      .from('ai_chat_messages')
      .insert({
        agent_id: agentId,
        user_id: userId,
        session_id: chatSessionId,
        role: 'assistant',
        content: assistantResponse,
        metadata: { 
          source, 
          phone,
          error: aiError,
          model: agent.use_native_ai ? (agent.ai_model || DEFAULT_LOVABLE_MODEL) : 'webhook',
          extractedInfo: extractedInfo || undefined,
          transferDecision: transferDecision || undefined,
          transferExecuted,
          pixDecision: pixDecision || undefined,
          pixGenerated: pixGenerated ? true : undefined,
          ...metadata
        }
      })
      .select()
      .single();

    if (saveAssistantMsgError) {
      console.error('Error saving assistant message:', saveAssistantMsgError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: chatSessionId,
        _version: VERSION,
        message: {
          id: savedMessage?.id,
          role: 'assistant',
          content: assistantResponse,
          created_at: savedMessage?.created_at || new Date().toISOString()
        },
        extractedInfo,
        transferDecision,
        transferExecuted,
        pixDecision,
        pixGenerated,
        error: aiError
      }),
      { 
        status: 200, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
