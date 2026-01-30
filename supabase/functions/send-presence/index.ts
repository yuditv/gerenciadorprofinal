import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js adds extra headers (e.g. x-supabase-client-platform) that must be allowed for CORS preflight.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

/**
 * Format phone number for WhatsApp API - supports international numbers
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // If number already has 12+ digits, assume it has country code
  if (cleaned.length >= 12) {
    return cleaned;
  }
  
  // Check for USA/Canada numbers: 1 + 10 digits = 11 digits
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    if (!areaCode.startsWith('0') && !areaCode.startsWith('1')) {
      return cleaned; // USA number
    }
  }
  
  // Check for other international prefixes
  const internationalPrefixes = ['44', '351', '54', '56', '57', '58', '34', '33', '49', '39'];
  for (const prefix of internationalPrefixes) {
    if (cleaned.startsWith(prefix) && cleaned.length >= 10 + prefix.length - 1) {
      return cleaned;
    }
  }
  
  // Default: Brazilian number
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Handle CORS preflight
  // (kept for backward compatibility)

  try {
    const { conversationId, presence, delay = 30000 } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!presence || !['composing', 'recording', 'paused'].includes(presence)) {
      return new Response(
        JSON.stringify({ error: 'presence must be composing, recording, or paused' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Fallback to the default UAZAPI base URL if env is missing.
    const uazapiUrl = Deno.env.get('UAZAPI_URL') || 'https://zynk2.uazapi.com';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, phone, instance_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Error fetching conversation:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp instance
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, instance_key')
      .eq('id', conversation.instance_id)
      .single();

    if (instanceError || !instance || !instance.instance_key) {
      console.error('Error fetching instance:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Capture values so TS can safely narrow and closures don't lose the refinement.
    const instanceKey = instance.instance_key;
    const instanceName = instance.instance_name;

    // Prepare UAZAPI request
    // UAZAPI has had multiple presence endpoints across versions.
    // We'll try the preferred one first and fall back if the API returns 405.
    const preferredPresenceUrl = `${uazapiUrl}/send/presence`;
    const fallbackPresenceUrl = `${uazapiUrl}/message/presence`;

    // Format phone number with international support
    const formattedPhone = formatPhoneNumber(conversation.phone);

    console.log(`[Presence] Sending ${presence} to ${formattedPhone} via ${instanceName}`);

    const requestBody = {
      number: formattedPhone,
      presence: presence,
      delay: delay,
    };

    async function postPresence(url: string) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instanceKey,
        },
        body: JSON.stringify(requestBody),
      });
      const text = await res.text();
      return { res, text };
    }

    // Send presence update to UAZAPI (with fallback)
    let { res: uazapiResponse, text: responseText } = await postPresence(preferredPresenceUrl);

    // Some UAZAPI deployments return 405 for the newer endpoint.
    if (uazapiResponse.status === 405) {
      console.warn('[Presence] Preferred endpoint returned 405, retrying fallback endpoint');
      ({ res: uazapiResponse, text: responseText } = await postPresence(fallbackPresenceUrl));
    }

    console.log(`[Presence] Response (${uazapiResponse.status}):`, responseText);

    // IMPORTANT: For functional errors, return 200 with success:false so the browser client
    // doesn't throw a fatal exception (prevents blank screen).
    if (!uazapiResponse.ok) {
      console.error('[Presence] UAZAPI error:', responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send presence update',
          status: uazapiResponse.status,
          details: responseText,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: true,
        presence,
        phone: formattedPhone,
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-presence:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
