import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WarmingSession {
  id: string;
  selected_instances: string[];
  balancing_mode: string;
  conversation_speed: string;
  use_ai: boolean;
  templates: string[];
  messages_sent: number;
  daily_limit: number;
}

interface InstanceInfo {
  id: string;
  instance_key: string;
  instance_name: string;
  phone_connected: string;
  instance_token: string;
}

// Get delay based on conversation speed
function getDelay(speed: string): number {
  const delays: Record<string, [number, number]> = {
    slow: [60000, 120000],
    normal: [30000, 80000],
    fast: [10000, 30000],
  };
  const [min, max] = delays[speed] || delays.normal;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Select pair of instances based on balancing mode
function selectInstancePair(
  instances: InstanceInfo[], 
  mode: string, 
  lastIndex: number
): [InstanceInfo, InstanceInfo, number] {
  if (instances.length < 2) {
    throw new Error("Need at least 2 instances");
  }

  let fromIdx: number, toIdx: number;

  switch (mode) {
    case 'round-robin':
      fromIdx = (lastIndex + 1) % instances.length;
      toIdx = (fromIdx + 1) % instances.length;
      break;
    case 'random':
      fromIdx = Math.floor(Math.random() * instances.length);
      do {
        toIdx = Math.floor(Math.random() * instances.length);
      } while (toIdx === fromIdx);
      break;
    case 'auto':
    default:
      // Intelligent: alternate between pairs
      fromIdx = lastIndex % instances.length;
      toIdx = (lastIndex + 1) % instances.length;
      break;
  }

  return [instances[fromIdx], instances[toIdx], fromIdx];
}

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

// Generate AI message
async function generateAIMessage(templates: string[]): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `Você gera mensagens curtas (2-8 palavras) para conversas casuais no WhatsApp brasileiro.
Use linguagem informal, gírias. Exemplos: "e aí, beleza?", "tudo certo?", "opa suave?", "fala aí"` 
          },
          { 
            role: "user", 
            content: templates.length > 0 
              ? `Baseado em: "${templates.slice(0, 3).join(', ')}". Gere UMA mensagem curta e natural.`
              : "Gere UMA mensagem curta e natural para conversa casual."
          },
        ],
        temperature: 0.95,
        max_tokens: 50,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length < 50 ? content : null;
  } catch {
    return null;
  }
}

// Send WhatsApp message via UAZAPI
async function sendWhatsAppMessage(
  instanceToken: string,
  instanceName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
  
  if (!UAZAPI_URL) {
    return { success: false, error: "UAZAPI_URL not configured" };
  }

  try {
    // Format phone number with international support
    const formattedPhone = formatPhoneNumber(phone);

    // UAZAPI format: /send/text with token header and { number, text }
    const response = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instanceToken,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || "Failed to send" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, session_id, user_id } = await req.json();

    // Start a warming session
    if (action === 'start') {
      // Get session info
      const { data: session, error: sessionError } = await supabase
        .from('warming_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get instance details
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_key, instance_name, phone_connected, instance_token')
        .in('id', session.selected_instances)
        .eq('status', 'connected');

      if (instancesError || !instances || instances.length < 2) {
        return new Response(JSON.stringify({ error: "Need at least 2 connected instances" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update session to running
      await supabase
        .from('warming_sessions')
        .update({ 
          status: 'running', 
          started_at: new Date().toISOString() 
        })
        .eq('id', session_id);

      // Execute warming in background
      EdgeRuntime.waitUntil((async () => {
        let lastIndex = 0;
        let messagesSent = session.messages_sent || 0;
        const dailyLimit = session.daily_limit || 50;

        while (messagesSent < dailyLimit) {
          // Check if session is still running
          const { data: currentSession } = await supabase
            .from('warming_sessions')
            .select('status')
            .eq('id', session_id)
            .single();

          if (!currentSession || currentSession.status !== 'running') {
            console.log('Session stopped or paused');
            break;
          }

          // Select instances
          const [fromInstance, toInstance, newIndex] = selectInstancePair(
            instances as InstanceInfo[],
            session.balancing_mode,
            lastIndex
          );
          lastIndex = newIndex;

          // Get message (AI or template)
          let message: string;
          let aiGenerated = false;

          if (session.use_ai) {
            const aiMessage = await generateAIMessage(session.templates);
            if (aiMessage) {
              message = aiMessage;
              aiGenerated = true;
            } else {
              message = session.templates[Math.floor(Math.random() * session.templates.length)] || "Oi!";
            }
          } else {
            message = session.templates[Math.floor(Math.random() * session.templates.length)] || "Oi!";
          }

          // Send message
          const result = await sendWhatsAppMessage(
            fromInstance.instance_token,
            fromInstance.instance_name,
            toInstance.phone_connected,
            message
          );

          // Log the message
          await supabase.from('warming_logs').insert({
            session_id,
            from_instance_id: fromInstance.id,
            to_instance_id: toInstance.id,
            message,
            status: result.success ? 'sent' : 'failed',
            ai_generated: aiGenerated,
            error_message: result.error,
          });

          if (result.success) {
            messagesSent++;
            const progress = Math.min((messagesSent / dailyLimit) * 100, 100);

            await supabase
              .from('warming_sessions')
              .update({ 
                messages_sent: messagesSent,
                progress,
                updated_at: new Date().toISOString()
              })
              .eq('id', session_id);
          }

          // Wait based on speed
          const delay = getDelay(session.conversation_speed);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Mark as completed if limit reached
        if (messagesSent >= dailyLimit) {
          await supabase
            .from('warming_sessions')
            .update({ 
              status: 'completed',
              progress: 100,
              completed_at: new Date().toISOString()
            })
            .eq('id', session_id);
        }
      })());

      return new Response(JSON.stringify({ success: true, message: "Warming started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pause session
    if (action === 'pause') {
      await supabase
        .from('warming_sessions')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', session_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stop session
    if (action === 'stop') {
      await supabase
        .from('warming_sessions')
        .update({ 
          status: 'idle', 
          progress: 0,
          messages_sent: 0,
          updated_at: new Date().toISOString() 
        })
        .eq('id', session_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session status
    if (action === 'status') {
      const { data: session } = await supabase
        .from('warming_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      const { data: logs } = await supabase
        .from('warming_logs')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ session, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Warming worker error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
