import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatDetailsRequest {
  instanceId: string;
  phone: string;
  preview?: boolean;
}

interface ChatDetailsResponse {
  // Informações básicas
  id?: string;
  wa_fastid?: string;
  wa_chatid?: string;
  owner?: string;
  name?: string;
  phone?: string;
  
  // Dados do WhatsApp
  wa_name?: string;
  wa_contactName?: string;
  wa_archived?: boolean;
  wa_isBlocked?: boolean;
  image?: string;
  imagePreview?: string;
  wa_ephermalExpiration?: number;
  wa_isGroup?: boolean;
  wa_isGroup_admin?: boolean;
  wa_isGroup_announce?: boolean;
  wa_isGroup_community?: boolean;
  wa_isGroup_member?: boolean;
  wa_isPinned?: boolean;
  wa_label?: string[];
  wa_lastMessageTextVote?: string;
  wa_lastMessageType?: string;
  wa_lastMsgTimestamp?: number;
  wa_lastMessageSender?: string;
  wa_muteEndTime?: number;
  wa_unreadCount?: number;
  common_groups?: string;
  
  // Dados de Lead/CRM
  lead_name?: string;
  lead_fullName?: string;
  lead_email?: string;
  lead_personalId?: string;
  lead_status?: string;
  lead_tags?: string[];
  lead_notes?: string;
  lead_isTicketOpen?: boolean;
  lead_assignedAttendant_id?: string;
  lead_kanbanOrder?: number;
  lead_field01?: string;
  lead_field02?: string;
  lead_field03?: string;
  lead_field04?: string;
  lead_field05?: string;
  lead_field06?: string;
  lead_field07?: string;
  lead_field08?: string;
  lead_field09?: string;
  lead_field10?: string;
  lead_field11?: string;
  lead_field12?: string;
  lead_field13?: string;
  lead_field14?: string;
  lead_field15?: string;
  lead_field16?: string;
  lead_field17?: string;
  lead_field18?: string;
  lead_field19?: string;
  lead_field20?: string;
  
  // Chatbot
  chatbot_agentResetMemoryAt?: number;
  chatbot_lastTrigger_id?: string;
  chatbot_lastTriggerAt?: number;
  chatbot_disableUntil?: number;
  chatbot_summary?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "https://zynk2.uazapi.com";
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { instanceId, phone, preview = false }: ChatDetailsRequest = await req.json();

    if (!instanceId || !phone) {
      return new Response(
        JSON.stringify({ error: "instanceId and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("instance_key")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      console.error("Instance not found:", instanceError);
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use global UAZAPI token
    const token = UAZAPI_TOKEN;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "No authentication token available" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number - remove all non-digits
    const formattedPhone = phone.replace(/\D/g, "");

    console.log(`Fetching chat details for ${formattedPhone} from instance ${instance.instance_key}`);

    // Call UAZAPI /chat/details endpoint
    const response = await fetch(`${UAZAPI_URL}/chat/details`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify({
        number: formattedPhone,
        preview: preview,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`UAZAPI error ${response.status}:`, errorText);
      
      // Try with instance key in URL (alternative format)
      const altResponse = await fetch(`${UAZAPI_URL}/instance/${instance.instance_key}/chat/details`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "token": token,
        },
        body: JSON.stringify({
          number: formattedPhone,
          preview: preview,
        }),
      });

      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        console.error(`UAZAPI alt error ${altResponse.status}:`, altErrorText);
        return new Response(
          JSON.stringify({ 
            error: "Failed to fetch chat details",
            status: response.status,
            details: errorText
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const altData: ChatDetailsResponse = await altResponse.json();
      return new Response(
        JSON.stringify(altData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: ChatDetailsResponse = await response.json();

    console.log("Chat details fetched successfully:", data.name || data.wa_name || formattedPhone);

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error fetching chat details:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
