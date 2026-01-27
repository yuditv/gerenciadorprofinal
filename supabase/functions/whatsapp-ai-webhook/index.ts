import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Format phone number for WhatsApp API - supports international numbers
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length >= 12) return cleaned;
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    if (!areaCode.startsWith('0') && !areaCode.startsWith('1')) {
      return cleaned;
    }
  }
  
  const internationalPrefixes = ['44', '351', '54', '56', '57', '58', '34', '33', '49', '39'];
  for (const prefix of internationalPrefixes) {
    if (cleaned.startsWith(prefix) && cleaned.length >= 10 + prefix.length - 1) {
      return cleaned;
    }
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

interface WhatsAppMessage {
  phone: string;
  message: string;
  instanceKey?: string;
  instanceId?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiUrl = Deno.env.get('UAZAPI_URL')!;
    const uazapiToken = Deno.env.get('UAZAPI_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WhatsAppMessage = await req.json();
    const { phone, message, instanceKey, instanceId } = body;

    console.log(`Received WhatsApp message from: ${phone}`);

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Require instanceKey or instanceId for validation
    if (!instanceId && !instanceKey) {
      console.error('[whatsapp-ai-webhook] No instanceKey or instanceId provided');
      return new Response(
        JSON.stringify({ error: 'instanceKey or instanceId is required for validation' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the instance by key or ID - this validates the request comes from a valid source
    let query = supabase.from('whatsapp_instances').select('*');
    
    if (instanceId) {
      query = query.eq('id', instanceId);
    } else if (instanceKey) {
      query = query.eq('instance_key', instanceKey);
    }

    const { data: instance, error: instanceError } = await query.single();

    if (instanceError || !instance) {
      console.error('[whatsapp-ai-webhook] Instance validation failed - instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid instance credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found instance: ${instance.instance_name}`);

    // Check if this instance has an AI agent routing configured
    const { data: routing, error: routingError } = await supabase
      .from('whatsapp_agent_routing')
      .select(`
        *,
        agent:ai_agents(*)
      `)
      .eq('instance_id', instance.id)
      .eq('is_active', true)
      .single();

    if (routingError || !routing || !routing.agent) {
      console.log('No AI agent routing configured for this instance');
      return new Response(
        JSON.stringify({ 
          success: true, 
          handled: false,
          message: 'No AI agent routing configured' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agent = routing.agent;
    console.log(`Routing to AI agent: ${agent.name}`);

    // Check if agent is enabled for WhatsApp
    if (!agent.is_whatsapp_enabled || !agent.is_active) {
      console.log('Agent is not enabled for WhatsApp or is inactive');
      return new Response(
        JSON.stringify({ 
          success: true, 
          handled: false,
          message: 'Agent not enabled for WhatsApp' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a session ID based on phone number for continuity
    const sessionId = `whatsapp-${phone.replace(/\D/g, '')}`;

    // Save incoming message to chat history
    await supabase
      .from('ai_chat_messages')
      .insert({
        agent_id: agent.id,
        user_id: instance.user_id, // Associate with instance owner
        session_id: sessionId,
        role: 'user',
        content: message,
        metadata: { 
          source: 'whatsapp',
          phone,
          instance_id: instance.id
        }
      });

    // Call n8n webhook
    console.log(`Calling n8n webhook: ${agent.webhook_url}`);
    
    let assistantResponse = '';
    let n8nError = null;

    try {
      const n8nResponse = await fetch(agent.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          phone,
          source: 'whatsapp',
          agentName: agent.name,
          instanceName: instance.instance_name,
          metadata: {
            instance_id: instance.id,
            instance_key: instance.instance_key
          }
        }),
      });

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error('n8n webhook error:', n8nResponse.status, errorText);
        n8nError = `Webhook returned status ${n8nResponse.status}`;
        assistantResponse = 'Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente mais tarde.';
      } else {
        const n8nData = await n8nResponse.json();
        console.log('n8n response:', n8nData);
        
        assistantResponse = 
          n8nData.response || 
          n8nData.message || 
          n8nData.output || 
          n8nData.text ||
          n8nData.reply ||
          (typeof n8nData === 'string' ? n8nData : JSON.stringify(n8nData));
      }
    } catch (fetchError: unknown) {
      console.error('Error calling n8n webhook:', fetchError);
      n8nError = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      assistantResponse = 'Desculpe, não foi possível processar sua mensagem. Tente novamente.';
    }

    // Save assistant response to chat history
    await supabase
      .from('ai_chat_messages')
      .insert({
        agent_id: agent.id,
        user_id: instance.user_id,
        session_id: sessionId,
        role: 'assistant',
        content: assistantResponse,
        metadata: { 
          source: 'whatsapp',
          phone,
          instance_id: instance.id,
          error: n8nError
        }
      });

    // Format phone number with international support
    const formattedPhone = formatPhoneNumber(phone);

    // Send response back via UAZAPI - format: /send/text with token header and { number, text }
    const sendResponse = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instance.instance_key || uazapiToken
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: assistantResponse
      })
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('UAZAPI send error:', sendResponse.status, errorText);
    } else {
      console.log('Response sent successfully via WhatsApp');
    }

    return new Response(
      JSON.stringify({
        success: true,
        handled: true,
        sessionId,
        agentName: agent.name,
        response: assistantResponse
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
