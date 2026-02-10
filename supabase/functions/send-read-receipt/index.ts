import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

function getUazapiBaseUrl(): string {
  const raw = (Deno.env.get('UAZAPI_URL') ?? '').trim();
  const fallback = 'https://zynk2.uazapi.com';
  const candidate = !raw || raw.includes('PLACEHOLDER_VALUE_TO_BE_REPLACED') ? fallback : raw;
  const normalized = candidate.replace(/\/+$/, '');
  try { new URL(normalized); } catch { return fallback; }
  return normalized;
}

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
    const uazapiUrl = getUazapiBaseUrl();
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

    console.log(`[ReadReceipt] Sending read receipt to ${formattedPhone} via ${instance.instance_name}`);

    const requestBody = {
      number: formattedPhone,
    };

    const headers = {
      'Content-Type': 'application/json',
      'token': instance.instance_key,
    };

    // Try primary endpoint
    let res = await fetch(`${uazapiUrl}/message/readMessages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // Fallback if 405
    if (res.status === 405) {
      console.warn('[ReadReceipt] Primary endpoint returned 405, trying fallback');
      res = await fetch(`${uazapiUrl}/send/readMessages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    }

    // Another fallback with chat/readMessages
    if (res.status === 405 || res.status === 404) {
      console.warn('[ReadReceipt] Trying chat/readMessages fallback');
      res = await fetch(`${uazapiUrl}/chat/readMessages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    }

    const responseText = await res.text();
    console.log(`[ReadReceipt] Response (${res.status}):`, responseText);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send read receipt', status: res.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }

    return new Response(
      JSON.stringify({ success: true, phone: formattedPhone, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
