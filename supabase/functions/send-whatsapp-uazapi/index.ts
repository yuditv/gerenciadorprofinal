import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  instanceKey?: string;
  instanceName?: string;  // Session name for uazapiGO v2
  phone: string;
  message?: string;
  // Media fields
  mediaType?: 'none' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  fileName?: string;
  caption?: string;
  // Auto archive after sending
  autoArchive?: boolean;
}

/**
 * Format phone number for WhatsApp API - supports international numbers
 * - Brazilian numbers (10-11 digits without country code): adds 55 prefix
 * - International numbers (already have country code): preserved as-is
 * - USA numbers (1 + 10 digits): preserved with country code 1
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If number already has 12+ digits, assume it has country code
  if (cleaned.length >= 12) {
    return cleaned;
  }
  
  // Check for USA/Canada numbers: 1 + 10 digits = 11 digits
  // USA area codes don't start with 0 or 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    if (!areaCode.startsWith('0') && !areaCode.startsWith('1')) {
      // Likely USA number - keep as-is
      return cleaned;
    }
  }
  
  // Check for other international prefixes
  const internationalPrefixes = ['44', '351', '54', '56', '57', '58', '34', '33', '49', '39'];
  for (const prefix of internationalPrefixes) {
    if (cleaned.startsWith(prefix) && cleaned.length >= 10 + prefix.length - 1) {
      // Likely international number - keep as-is
      return cleaned;
    }
  }
  
  // Default: assume Brazilian number, add 55 if not present
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Validate authentication - requires either service role key or valid JWT
 */
async function validateAuth(req: Request): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Check if it's the service role key (for internal edge function calls)
  if (token === supabaseServiceKey) {
    return { valid: true };
  }
  
  // Otherwise validate as a user JWT
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    return { valid: false, error: 'Invalid or expired token' };
  }
  
  return { valid: true, userId: data.claims.sub };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication
  const auth = await validateAuth(req);
  if (!auth.valid) {
    console.error("[send-whatsapp-uazapi] Authentication failed:", auth.error);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: auth.error }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_TOKEN) {
      console.error("Missing UAZAPI configuration");
      return new Response(
        JSON.stringify({ error: "UAZAPI not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const requestData: WhatsAppRequest = await req.json();
    const { phone, message, mediaType, mediaUrl, fileName, caption, autoArchive, instanceKey, instanceName } = requestData;

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Missing required field: phone" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Use instance-specific token if provided, otherwise fallback to default
    const instanceToken = instanceKey || UAZAPI_TOKEN;
    // Session name for uazapiGO v2
    const sessionName = instanceName || '';
    
    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Sending WhatsApp to: ${formattedPhone}, mediaType: ${mediaType || 'text'}, session: ${sessionName}, using instance: ${instanceKey ? 'custom' : 'default'}`);

    // Validate message for text messages
    if ((!mediaType || mediaType === 'none') && !message) {
      return new Response(
        JSON.stringify({ error: "Missing required field: message (for text messages)" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // UAZAPI format:
    // - Endpoint: /sendText, /sendImage, etc.
    // - Header: token (lowercase)
    // - Body: number, text (lowercase)
    console.log(`Sending via UAZAPI format`);
    console.log(`Phone: ${formattedPhone}`);

    // deno-lint-ignore no-explicit-any
    let responseData: any = null;
    let lastError = '';

    // Determine endpoint based on media type
    if (mediaType && mediaType !== 'none' && mediaUrl) {
      // Media message - use UAZAPI v2 unified /send/media endpoint
      // deno-lint-ignore no-explicit-any
      const body: Record<string, any> = { 
        number: formattedPhone,
        type: mediaType, // image, video, audio, document
        file: mediaUrl   // URL to the media file
      };
      
      // Add caption/text if provided
      if (caption || message) {
        body.text = caption || message;
      }
      
      // Add document name for document type
      if (mediaType === 'document' && fileName) {
        body.docName = fileName;
      }
      
      console.log(`Sending ${mediaType} via /send/media`);
      console.log(`URL: ${UAZAPI_URL}/send/media`);
      console.log(`Request body:`, JSON.stringify(body));
      
      const response = await fetch(`${UAZAPI_URL}/send/media`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instanceToken
        },
        body: JSON.stringify(body),
      });
      
      const respText = await response.text();
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${respText}`);
      
      if (response.ok) {
        try {
          responseData = JSON.parse(respText);
        } catch {
          responseData = { raw: respText };
        }
        console.log("✅ Media sent successfully!");
      } else {
        lastError = `${response.status}: ${respText}`;
      }
    } else {
      // Text message - use /send/text with { number, text }
      console.log(`Sending text via /send/text`);
      console.log(`URL: ${UAZAPI_URL}/send/text`);
      
      const response = await fetch(`${UAZAPI_URL}/send/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instanceToken
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message
        }),
      });
      
      const respText = await response.text();
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${respText}`);
      
      if (response.ok) {
        try {
          responseData = JSON.parse(respText);
        } catch {
          responseData = { raw: respText };
        }
        console.log("✅ Message sent successfully!");
      } else {
        lastError = `${response.status}: ${respText}`;
      }
    }

    if (!responseData) {
      console.error("Failed to send. Error:", lastError);
      return new Response(
        JSON.stringify({ error: lastError || "Failed to send message" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Archive chat if autoArchive is enabled
    let archived = false;
    if (autoArchive) {
      try {
        console.log(`[Archive] Attempting to archive chat with: ${formattedPhone}`);
        
        const archiveResponse = await fetch(`${UAZAPI_URL}/chat/archive`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceToken
          },
          body: JSON.stringify({
            number: formattedPhone,
            archive: true
          }),
        });
        
        const archiveData = await archiveResponse.json();
        
        if (!archiveResponse.ok) {
          console.error(`[Archive] Failed with status ${archiveResponse.status}:`, archiveData);
        } else {
          console.log("[Archive] Success:", archiveData);
          archived = true;
        }
      } catch (archiveError) {
        console.error("[Archive] Error:", archiveError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData, archived }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-whatsapp-uazapi:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
