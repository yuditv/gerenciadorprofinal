import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UAZAPI utilities
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // Brazil: 10-11 digits starting with certain patterns
  if (cleaned.length === 10 || cleaned.length === 11) {
    if (!cleaned.startsWith('55') && !cleaned.startsWith('1') && !cleaned.startsWith('44')) {
      cleaned = '55' + cleaned;
    }
  }
  
  return cleaned;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendTypingIndicator(uazapiUrl: string, token: string, phone: string): Promise<void> {
  try {
    await fetch(`${uazapiUrl}/send/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      body: JSON.stringify({
        number: phone,
        presence: 'composing'
      })
    });
  } catch (e) {
    console.log('[Buffer Processor] Typing indicator error (ignored):', e);
  }
}

function calculateTypingTime(message: string): number {
  const wordsPerMinute = 40;
  const words = message.split(/\s+/).length;
  const minutes = words / wordsPerMinute;
  const milliseconds = Math.min(minutes * 60 * 1000, 8000);
  return Math.max(milliseconds, 1000);
}

async function sendTextViaUazapi(uazapiUrl: string, token: string, phone: string, text: string): Promise<void> {
  const response = await fetch(`${uazapiUrl}/send/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': token
    },
    body: JSON.stringify({
      number: phone,
      text: text
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Buffer Processor] UAZAPI send error:', errorText);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Buffer Processor] Starting buffer processing run...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiUrl = Deno.env.get('UAZAPI_URL') || 'https://zynk2.uazapi.com';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch buffers that are ready to process
    const now = new Date().toISOString();
    const { data: readyBuffers, error: fetchError } = await supabase
      .from('ai_message_buffer')
      .select(`
        *,
        agent:ai_agents(*),
        conversation:conversations(*),
        instance:conversations(instance_id)
      `)
      .eq('status', 'buffering')
      .lte('scheduled_response_at', now)
      .limit(5);

    if (fetchError) {
      console.error('[Buffer Processor] Error fetching buffers:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch buffers', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!readyBuffers || readyBuffers.length === 0) {
      console.log('[Buffer Processor] No buffers ready to process');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No buffers ready' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Buffer Processor] Found ${readyBuffers.length} buffers to process`);
    let processedCount = 0;
    let errorCount = 0;

    for (const buffer of readyBuffers) {
      try {
        // Mark as processing
        await supabase
          .from('ai_message_buffer')
          .update({ status: 'processing' })
          .eq('id', buffer.id);

        // Combine all messages into one context
        const messages = buffer.messages as Array<{ content: string; timestamp: string }>;
        const combinedMessage = messages
          .map(m => m.content)
          .join('\n');

        console.log(`[Buffer Processor] Processing buffer ${buffer.id} with ${messages.length} messages`);

        // Get full conversation and instance data
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', buffer.conversation_id)
          .single();

        if (convError || !conversation) {
          console.error(`[Buffer Processor] Conversation not found for buffer ${buffer.id}:`, convError?.message);
          await supabase
            .from('ai_message_buffer')
            .update({ status: 'failed' })
            .eq('id', buffer.id);
          errorCount++;
          continue;
        }

        // Get instance data separately
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', buffer.instance_id)
          .single();

        if (instanceError || !instance) {
          console.error(`[Buffer Processor] Instance not found for buffer ${buffer.id}:`, instanceError?.message);
          await supabase
            .from('ai_message_buffer')
            .update({ status: 'failed' })
            .eq('id', buffer.id);
          errorCount++;
          continue;
        }

        const agent = buffer.agent;

        if (!agent) {
          console.error(`[Buffer Processor] Agent not found for buffer ${buffer.id}`);
          await supabase
            .from('ai_message_buffer')
            .update({ status: 'failed' })
            .eq('id', buffer.id);
          errorCount++;
          continue;
        }

        // Call AI with combined message
        let assistantResponse = '';
        const sessionId = conversation.id;

        if (agent.use_native_ai) {
          console.log(`[Buffer Processor] Calling native AI for buffer ${buffer.id}`);
          
          const aiChatResponse = await fetch(
            `${supabaseUrl}/functions/v1/ai-agent-chat`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                agentId: agent.id,
                message: combinedMessage,
                sessionId: sessionId,
                source: 'whatsapp-inbox',
                phone: buffer.phone,
                metadata: {
                  buffered_messages: messages.length,
                  first_message_at: buffer.first_message_at,
                  last_message_at: buffer.last_message_at
                }
              })
            }
          );

          if (aiChatResponse.ok) {
            const aiData = await aiChatResponse.json();
            assistantResponse = aiData.message?.content || aiData.response || '';
            console.log(`[Buffer Processor] AI response received (${assistantResponse.length} chars)`);
          } else {
            const errorText = await aiChatResponse.text();
            console.error('[Buffer Processor] AI error:', errorText);
          }
        } else if (agent.webhook_url) {
          // n8n webhook
          const n8nResponse = await fetch(agent.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: combinedMessage,
              sessionId,
              phone: buffer.phone,
              source: 'whatsapp-inbox',
              agentName: agent.name,
              conversationId: conversation.id,
              contactName: conversation.contact_name,
              buffered_messages: messages.length,
              individual_messages: messages
            }),
          });

          if (n8nResponse.ok) {
            const n8nData = await n8nResponse.json();
            assistantResponse = n8nData.response || n8nData.message || n8nData.output || n8nData.text || '';
          }
        }

        if (assistantResponse) {
          // Save AI response to chat
          await supabase
            .from('chat_inbox_messages')
            .insert({
              conversation_id: conversation.id,
              sender_type: 'ai',
              content: assistantResponse,
              metadata: { 
                agent_id: agent.id, 
                agent_name: agent.name,
                buffered_messages: messages.length
              }
            });

          // Update conversation with last message info for realtime UI updates
          const previewText = assistantResponse.substring(0, 100);
          const { error: updateConvError } = await supabase
            .from('conversations')
            .update({
              last_message_at: new Date().toISOString(),
              last_message_preview: previewText
            })
            .eq('id', conversation.id);

          if (updateConvError) {
            console.error(`[Buffer Processor] Error updating conversation preview:`, updateConvError);
          } else {
            console.log(`[Buffer Processor] Conversation preview updated: "${previewText.substring(0, 30)}..."`);
          }

          // Send via WhatsApp
          const formattedPhone = formatPhoneNumber(buffer.phone);
          const token = instance.instance_key;

          // Apply response delay
          const delayMin = agent.response_delay_min ?? 2;
          const delayMax = agent.response_delay_max ?? 5;
          const delay = randomBetween(delayMin * 1000, delayMax * 1000);
          
          console.log(`[Buffer Processor] Waiting ${delay}ms before responding`);
          await sleep(delay);

          // Typing simulation
          if (agent.typing_simulation) {
            await sendTypingIndicator(uazapiUrl, token, formattedPhone);
            const typingTime = calculateTypingTime(assistantResponse);
            await sleep(typingTime);
          }

          // Send message
          await sendTextViaUazapi(uazapiUrl, token, formattedPhone, assistantResponse);
          console.log(`[Buffer Processor] Response sent for buffer ${buffer.id}`);
        }

        // Mark as completed
        await supabase
          .from('ai_message_buffer')
          .update({ status: 'completed' })
          .eq('id', buffer.id);

        processedCount++;

      } catch (bufferError) {
        console.error(`[Buffer Processor] Error processing buffer ${buffer.id}:`, bufferError);
        await supabase
          .from('ai_message_buffer')
          .update({ status: 'failed' })
          .eq('id', buffer.id);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Buffer Processor] Completed in ${duration}ms. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount, 
        errors: errorCount,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Buffer Processor] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
