import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveProvider } from "../_shared/whatsapp-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 12) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    if (!areaCode.startsWith('0') && !areaCode.startsWith('1')) return cleaned;
  }
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'conversationId is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const providerConfig = await resolveProvider(supabaseUrl, supabaseKey);
    const uazapiUrl = providerConfig?.base_url || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, phone, instance_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp instance
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, instance_key')
      .eq('id', conversation.instance_id)
      .single();

    if (instanceError || !instance?.instance_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp instance not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(conversation.phone);
    const remoteJid = `${formattedPhone}@s.whatsapp.net`;

    console.log(`[ReadReceipt] Sending read receipt for ${remoteJid} via ${instance.instance_name}`);

    const headers = {
      'Content-Type': 'application/json',
      'token': instance.instance_key,
    };

    // Get the last few unread messages from this conversation to mark as read
    const { data: lastMessages } = await supabase
      .from('chat_inbox_messages')
      .select('id, metadata')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'contact')
      .order('created_at', { ascending: false })
      .limit(5);

    // Extract UAZAPI message IDs from metadata
    const messageIds: Array<{ remoteJid: string; fromMe: boolean; id: string }> = [];
    if (lastMessages) {
      for (const msg of lastMessages) {
        const meta = msg.metadata as Record<string, unknown> | null;
        const uazapiId = (meta?.messageId || meta?.message_id || meta?.wa_id || meta?.id) as string | undefined;
        if (uazapiId) {
          messageIds.push({
            remoteJid,
            fromMe: false,
            id: uazapiId,
          });
        }
      }
    }

    let responseText: string;
    let statusCode: number;

    if (messageIds.length > 0) {
      // Method 1: Mark specific messages as read (preferred - sends blue ticks)
      console.log(`[ReadReceipt] Marking ${messageIds.length} specific messages as read`);

      const res = await fetch(`${uazapiUrl}/chat/markMessageAsRead`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ readMessages: messageIds }),
      });
      statusCode = res.status;
      responseText = await res.text();

      // Fallback with POST if PUT returns 405
      if (statusCode === 405) {
        console.warn('[ReadReceipt] PUT returned 405, trying POST');
        const res2 = await fetch(`${uazapiUrl}/chat/markMessageAsRead`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ readMessages: messageIds }),
        });
        statusCode = res2.status;
        responseText = await res2.text();
      }
    } else {
      // Method 2: Fallback - try to mark by phone number
      console.log('[ReadReceipt] No message IDs found, trying by phone number');
      
      // Try multiple endpoint patterns
      const endpoints = [
        { url: `${uazapiUrl}/chat/markMessageAsRead`, method: 'PUT', body: { readMessages: [{ remoteJid, fromMe: false, id: '' }] } },
        { url: `${uazapiUrl}/message/readMessages`, method: 'POST', body: { number: formattedPhone } },
        { url: `${uazapiUrl}/send/readMessages`, method: 'POST', body: { number: formattedPhone } },
        { url: `${uazapiUrl}/chat/read`, method: 'POST', body: { number: formattedPhone } },
      ];

      statusCode = 0;
      responseText = '';

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, {
            method: ep.method,
            headers,
            body: JSON.stringify(ep.body),
          });
          statusCode = res.status;
          responseText = await res.text();
          
          if (res.ok) {
            console.log(`[ReadReceipt] Success with ${ep.url}`);
            break;
          }
          console.warn(`[ReadReceipt] ${ep.url} returned ${res.status}`);
        } catch (e) {
          console.warn(`[ReadReceipt] ${ep.url} failed:`, e);
        }
      }
    }

    console.log(`[ReadReceipt] Response (${statusCode}):`, responseText);

    if (statusCode && statusCode >= 200 && statusCode < 300) {
      let result;
      try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }
      return new Response(
        JSON.stringify({ success: true, phone: formattedPhone, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Failed to send read receipt', status: statusCode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-read-receipt:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
