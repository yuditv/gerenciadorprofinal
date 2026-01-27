import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UAZAPI Service
class UazapiService {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = Deno.env.get("UAZAPI_URL") || "";
    this.token = Deno.env.get("UAZAPI_TOKEN") || "";
  }

  async sendText(instanceKey: string, instanceName: string, phone: string, message: string) {
    // UAZAPI format: /send/text with token header and { number, text }
    const response = await fetch(`${this.baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instanceKey,
      },
      body: JSON.stringify({
        number: this.formatPhone(phone),
        text: message,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `UAZAPI Error: ${response.status}`);
    }

    return data;
  }

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("55")) {
      cleaned = "55" + cleaned;
    }
    return cleaned;
  }
}

const uazapi = new UazapiService();

// Helper: Check if within business hours
function isWithinBusinessHours(startTime: string, endTime: string): boolean {
  const now = new Date();
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// Helper: Get random delay
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Replace message variables
function replaceVariables(template: string, contact: any): string {
  let message = template;
  message = message.replace(/\{\{nome\}\}/g, contact.name || "");
  
  // Replace custom variables from JSONB
  if (contact.variables) {
    Object.entries(contact.variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    });
  }
  
  return message;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[0];

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = req.method !== "GET" ? await req.json() : {};

    switch (action) {
      case "create": {
        // Validate instance exists and belongs to user
        const { data: instance, error: instError } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("id", body.instance_id)
          .single();

        if (instError || !instance) {
          return new Response(
            JSON.stringify({ error: "Instance not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create campaign
        const { data: campaign, error } = await supabase
          .from("campaigns")
          .insert({
            user_id: user.id,
            instance_id: body.instance_id,
            name: body.name,
            message_template: body.message_template,
            min_delay_seconds: body.min_delay_seconds || 5,
            max_delay_seconds: body.max_delay_seconds || 12,
            pause_after_messages: body.pause_after_messages || 50,
            pause_duration_seconds: body.pause_duration_seconds || 300,
          })
          .select()
          .single();

        if (error) throw error;

        // Log creation
        await supabase.from("campaign_logs").insert({
          campaign_id: campaign.id,
          event_type: "created",
          message: "Campanha criada",
        });

        return new Response(
          JSON.stringify({ success: true, campaign }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "add-contacts": {
        const campaignId = pathParts[1];

        // Verify campaign ownership
        const { data: campaign, error: campError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();

        if (campError || !campaign) {
          return new Response(
            JSON.stringify({ error: "Campaign not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Add contacts
        const contacts = body.contacts.map((c: any) => ({
          campaign_id: campaignId,
          phone: c.phone,
          name: c.name || null,
          variables: c.variables || {},
        }));

        const { error: insertError } = await supabase
          .from("campaign_contacts")
          .insert(contacts);

        if (insertError) throw insertError;

        // Update total contacts count
        const { count } = await supabase
          .from("campaign_contacts")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId);

        await supabase
          .from("campaigns")
          .update({ total_contacts: count || 0 })
          .eq("id", campaignId);

        return new Response(
          JSON.stringify({ success: true, added: contacts.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "start": {
        const campaignId = pathParts[1];

        // Get campaign with instance
        const { data: campaign, error: campError } = await supabase
          .from("campaigns")
          .select("*, instance:whatsapp_instances(*)")
          .eq("id", campaignId)
          .single();

        if (campError || !campaign) {
          return new Response(
            JSON.stringify({ error: "Campaign not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (campaign.status === "running") {
          return new Response(
            JSON.stringify({ error: "Campaign already running" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const instance = campaign.instance;

        // Check business hours
        if (!isWithinBusinessHours(instance.business_hours_start, instance.business_hours_end)) {
          return new Response(
            JSON.stringify({ error: "Fora do horário comercial" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update campaign status
        await supabase
          .from("campaigns")
          .update({ 
            status: "running", 
            started_at: new Date().toISOString() 
          })
          .eq("id", campaignId);

        // Log start
        await supabase.from("campaign_logs").insert({
          campaign_id: campaignId,
          event_type: "started",
          message: "Campanha iniciada",
        });

        // Start background processing (fire and forget)
        processCampaign(supabase, campaign, instance).catch(err => {
          console.error("Background campaign error:", err);
        });

        return new Response(
          JSON.stringify({ success: true, message: "Campanha iniciada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "pause": {
        const campaignId = pathParts[1];

        await supabase
          .from("campaigns")
          .update({ status: "paused" })
          .eq("id", campaignId);

        await supabase.from("campaign_logs").insert({
          campaign_id: campaignId,
          event_type: "paused",
          message: "Campanha pausada",
        });

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "resume": {
        const campaignId = pathParts[1];

        const { data: campaign } = await supabase
          .from("campaigns")
          .select("*, instance:whatsapp_instances(*)")
          .eq("id", campaignId)
          .single();

        if (!campaign) {
          return new Response(
            JSON.stringify({ error: "Campaign not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from("campaigns")
          .update({ status: "running" })
          .eq("id", campaignId);

        await supabase.from("campaign_logs").insert({
          campaign_id: campaignId,
          event_type: "resumed",
          message: "Campanha retomada",
        });

        // Start background processing (fire and forget)
        processCampaign(supabase, campaign, campaign.instance).catch(err => {
          console.error("Background campaign error:", err);
        });

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "stats": {
        const campaignId = pathParts[1];

        const { data: campaign } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();

        if (!campaign) {
          return new Response(
            JSON.stringify({ error: "Campaign not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: logs } = await supabase
          .from("campaign_logs")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false })
          .limit(50);

        return new Response(
          JSON.stringify({ success: true, campaign, logs }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("Error in campaigns:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

// Background task to process campaign
async function processCampaign(supabase: any, campaign: any, instance: any) {
  let sentInBatch = 0;
  
  console.log(`Starting campaign ${campaign.id}`);

  while (true) {
    // Check if campaign is still running
    const { data: currentCampaign } = await supabase
      .from("campaigns")
      .select("status")
      .eq("id", campaign.id)
      .single();

    if (currentCampaign?.status !== "running") {
      console.log(`Campaign ${campaign.id} is no longer running`);
      break;
    }

    // Check business hours
    if (!isWithinBusinessHours(instance.business_hours_start, instance.business_hours_end)) {
      console.log("Outside business hours, pausing");
      await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaign.id);
      
      await supabase.from("campaign_logs").insert({
        campaign_id: campaign.id,
        event_type: "auto_paused",
        message: "Pausado automaticamente - fora do horário comercial",
      });
      break;
    }

    // Check daily limit
    const { data: instanceData } = await supabase
      .from("whatsapp_instances")
      .select("messages_sent_today, daily_limit, last_reset_date")
      .eq("id", instance.id)
      .single();

    // Reset daily counter if needed
    const today = new Date().toISOString().split("T")[0];
    if (instanceData.last_reset_date !== today) {
      await supabase
        .from("whatsapp_instances")
        .update({ messages_sent_today: 0, last_reset_date: today })
        .eq("id", instance.id);
      instanceData.messages_sent_today = 0;
    }

    if (instanceData.messages_sent_today >= instanceData.daily_limit) {
      console.log("Daily limit reached");
      await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaign.id);
      
      await supabase.from("campaign_logs").insert({
        campaign_id: campaign.id,
        event_type: "daily_limit",
        message: "Limite diário atingido",
      });
      break;
    }

    // Get next pending contact
    const { data: contacts } = await supabase
      .from("campaign_contacts")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "pending")
      .limit(1);

    if (!contacts || contacts.length === 0) {
      console.log("No more contacts");
      await supabase
        .from("campaigns")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString(),
          progress: 100 
        })
        .eq("id", campaign.id);
      
      await supabase.from("campaign_logs").insert({
        campaign_id: campaign.id,
        event_type: "completed",
        message: "Campanha concluída",
      });
      break;
    }

    const contact = contacts[0];
    const message = replaceVariables(campaign.message_template, contact);

    try {
      await uazapi.sendText(instance.instance_key, instance.instance_name, contact.phone, message);

      // Update contact status
      await supabase
        .from("campaign_contacts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", contact.id);

      // Update counters
      const { data: campData } = await supabase
        .from("campaigns")
        .select("sent_count, total_contacts")
        .eq("id", campaign.id)
        .single();

      const newSentCount = (campData.sent_count || 0) + 1;
      const progress = (newSentCount / campData.total_contacts) * 100;

      await supabase
        .from("campaigns")
        .update({ sent_count: newSentCount, progress })
        .eq("id", campaign.id);

      await supabase
        .from("whatsapp_instances")
        .update({ messages_sent_today: instanceData.messages_sent_today + 1 })
        .eq("id", instance.id);

      await supabase.from("campaign_logs").insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        event_type: "sent",
        message: `Enviado para ${contact.phone}`,
      });

      sentInBatch++;

    } catch (error: any) {
      console.error(`Error sending to ${contact.phone}:`, error);

      await supabase
        .from("campaign_contacts")
        .update({ status: "failed", error_message: error.message })
        .eq("id", contact.id);

      const { data: campData } = await supabase
        .from("campaigns")
        .select("failed_count")
        .eq("id", campaign.id)
        .single();

      await supabase
        .from("campaigns")
        .update({ failed_count: (campData.failed_count || 0) + 1 })
        .eq("id", campaign.id);

      await supabase.from("campaign_logs").insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        event_type: "error",
        message: `Erro ao enviar para ${contact.phone}: ${error.message}`,
      });
    }

    // Check if need to pause after N messages
    if (sentInBatch >= campaign.pause_after_messages) {
      console.log(`Pausing after ${sentInBatch} messages`);
      
      await supabase.from("campaign_logs").insert({
        campaign_id: campaign.id,
        event_type: "batch_pause",
        message: `Pausa automática após ${sentInBatch} mensagens`,
      });

      await new Promise(resolve => setTimeout(resolve, campaign.pause_duration_seconds * 1000));
      sentInBatch = 0;
    }

    // Random delay between messages
    const delay = getRandomDelay(campaign.min_delay_seconds, campaign.max_delay_seconds);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }
}

serve(handler);