import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveProvider } from "../_shared/whatsapp-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function invokeMemoryExtractor(payload: {
  userId: string;
  phone: string;
  contactName?: string | null;
  agentId?: string | null;
  message: string;
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/memory-extractor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log('[Buffer Processor] memory-extractor invoke error (ignored):', e);
  }
}

// WhatsApp/UAZAPI may truncate very long messages; also, the desired UX is “humanized”
// by sending in smaller bursts (sentence-by-sentence).
const AUTO_SPLIT_THRESHOLD_CHARS = 420;
const AUTO_SPLIT_MAX_CHARS_PER_MESSAGE = 380;

type SplitMode = 'none' | 'paragraph' | 'lines' | 'sentences' | 'chars';

interface MessageSendConfig {
  response_delay_min: number;
  response_delay_max: number;
  max_lines_per_message: number;
  split_mode: SplitMode;
  split_delay_min: number;
  split_delay_max: number;
  max_chars_per_message: number;
  typing_simulation: boolean;
}

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

function splitMessage(text: string, config: MessageSendConfig): string[] {
  if (!text || text.trim().length === 0) return [];

  if (config.split_mode === 'none' && config.max_lines_per_message === 0 && config.max_chars_per_message === 0) {
    return [text];
  }

  let parts: string[] = [];

  switch (config.split_mode) {
    case 'paragraph':
      parts = text.split(/\n\n+/).filter(p => p.trim());
      break;
    case 'lines':
      parts = text.split(/\n/).filter(p => p.trim());
      break;
    case 'sentences': {
      // Split by sentence-ending punctuation
      const sentenceMatches = text.match(/[^.!?]+[.!?]+[\s]*/g);
      if (sentenceMatches && sentenceMatches.length > 0) {
        parts = sentenceMatches.map(s => s.trim()).filter(Boolean);
      } else {
        parts = [text];
      }
      break;
    }
    case 'chars':
      if (config.max_chars_per_message > 0) {
        parts = chunkByChars(text, config.max_chars_per_message);
      } else {
        parts = [text];
      }
      break;
    default:
      parts = [text];
  }

  // Apply character limit if set and mode is not 'chars'
  if (config.split_mode !== 'chars' && config.max_chars_per_message > 0) {
    parts = parts.flatMap(p => chunkByChars(p, config.max_chars_per_message));
  }

  // Apply line limit if set
  if (config.max_lines_per_message > 0) {
    parts = parts.flatMap(p => chunkByLines(p, config.max_lines_per_message));
  }

  return parts.filter(p => p.trim());
}

function chunkByChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    let breakPoint = maxChars;
    const lastSpace = remaining.lastIndexOf(' ', maxChars);
    const lastNewline = remaining.lastIndexOf('\n', maxChars);

    if (lastSpace > maxChars * 0.5 || lastNewline > maxChars * 0.5) {
      breakPoint = Math.max(lastSpace, lastNewline);
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

function chunkByLines(text: string, maxLines: number): string[] {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return [text];

  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const chunk = lines.slice(i, i + maxLines).join('\n');
    if (chunk.trim()) chunks.push(chunk);
  }

  return chunks;
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
  // Simulate typing at ~30-50 chars per second, with some randomness.
  const baseTime = (message.length / 40) * 1000;
  return Math.min(Math.max(baseTime, 500), 3000); // Between 0.5s and 3s
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

async function sendAIResponseWithConfig(
  uazapiUrl: string,
  token: string,
  phone: string,
  fullResponse: string,
  config: MessageSendConfig
): Promise<void> {
  const hasExplicitSplitConfig =
    config.split_mode !== 'none' ||
    config.max_lines_per_message > 0 ||
    config.max_chars_per_message > 0;

  const effectiveConfig: MessageSendConfig = (!hasExplicitSplitConfig && fullResponse.length > AUTO_SPLIT_THRESHOLD_CHARS)
    ? {
        ...config,
        split_mode: 'sentences',
        max_chars_per_message: AUTO_SPLIT_MAX_CHARS_PER_MESSAGE,
        response_delay_min: Math.min(config.response_delay_min, 2),
        response_delay_max: Math.min(config.response_delay_max, 4),
        split_delay_min: Math.min(config.split_delay_min, 1),
        split_delay_max: Math.max(Math.min(config.split_delay_max, 3), 1),
        typing_simulation: true,
      }
    : config;

  console.log('[Buffer Processor] Sending AI response with config:', {
    split_mode: effectiveConfig.split_mode,
    response_delay: `${effectiveConfig.response_delay_min}-${effectiveConfig.response_delay_max}s`,
    typing: effectiveConfig.typing_simulation,
    auto_split: !hasExplicitSplitConfig && fullResponse.length > AUTO_SPLIT_THRESHOLD_CHARS,
  });

  // Initial delay
  if (effectiveConfig.response_delay_max > 0) {
    const delaySeconds = randomBetween(effectiveConfig.response_delay_min, effectiveConfig.response_delay_max);
    await sleep(delaySeconds * 1000);
  }

  const parts = splitMessage(fullResponse, effectiveConfig);
  console.log(`[Buffer Processor] Message split into ${parts.length} parts`);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (effectiveConfig.typing_simulation) {
      await sendTypingIndicator(uazapiUrl, token, phone);
      const typingTime = calculateTypingTime(part);
      await sleep(typingTime);
    }

    await sendTextViaUazapi(uazapiUrl, token, phone, part);
    console.log(`[Buffer Processor] Sent part ${i + 1}/${parts.length}`);

    if (i < parts.length - 1 && effectiveConfig.split_delay_max > 0) {
      const splitDelay = randomBetween(effectiveConfig.split_delay_min, effectiveConfig.split_delay_max);
      await sleep(splitDelay * 1000);
    }
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
    const providerConfig = await resolveProvider(supabaseUrl, supabaseServiceKey);
    const uazapiUrl = providerConfig?.base_url || "";

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
        // Mark as processing (idempotency / avoid double-send when multiple runs overlap)
        const { data: claimed } = await supabase
          .from('ai_message_buffer')
          .update({ status: 'processing' })
          .eq('id', buffer.id)
          .eq('status', 'buffering')
          .select('id')
          .maybeSingle();

        if (!claimed?.id) {
          console.log(`[Buffer Processor] Buffer ${buffer.id} already claimed/processed, skipping`);
          continue;
        }

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

          // Fire-and-forget: update structured client memory from AI response
          invokeMemoryExtractor({
            userId: conversation.user_id,
            agentId: agent.id,
            phone: buffer.phone,
            contactName: conversation.contact_name,
            message: assistantResponse,
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

          // Send via WhatsApp (humanized splitting)
          const formattedPhone = formatPhoneNumber(buffer.phone);
          const token = instance.instance_key;

          const sendConfig: MessageSendConfig = {
            response_delay_min: agent.response_delay_min ?? 2,
            response_delay_max: agent.response_delay_max ?? 5,
            max_lines_per_message: agent.max_lines_per_message ?? 0,
            split_mode: (agent.split_mode ?? 'none') as SplitMode,
            split_delay_min: agent.split_delay_min ?? 1,
            split_delay_max: agent.split_delay_max ?? 3,
            max_chars_per_message: agent.max_chars_per_message ?? 0,
            typing_simulation: agent.typing_simulation ?? true,
          };

          await sendAIResponseWithConfig(uazapiUrl, token, formattedPhone, assistantResponse, sendConfig);
          console.log(`[Buffer Processor] Response sent (possibly split) for buffer ${buffer.id}`);
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
