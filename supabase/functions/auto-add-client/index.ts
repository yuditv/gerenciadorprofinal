import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

interface ExtractedClient {
  name: string;
  whatsapp: string;
  plan: string; // monthly, quarterly, semiannual, annual
  price: number | null;
  app_name: string | null;
  device: string | null;
  service: string | null; // IPTV or VPN
  email: string | null;
  notes: string | null;
  service_username: string | null;
  service_password: string | null;
  expires_at: string | null; // YYYY-MM-DD
}

const PLAN_MAP: Record<string, { key: string; months: number }> = {
  mensal: { key: "monthly", months: 1 },
  monthly: { key: "monthly", months: 1 },
  trimestral: { key: "quarterly", months: 3 },
  quarterly: { key: "quarterly", months: 3 },
  semestral: { key: "semiannual", months: 6 },
  semiannual: { key: "semiannual", months: 6 },
  anual: { key: "annual", months: 12 },
  annual: { key: "annual", months: 12 },
  "30 dias": { key: "monthly", months: 1 },
  "90 dias": { key: "quarterly", months: 3 },
  "180 dias": { key: "semiannual", months: 6 },
  "365 dias": { key: "annual", months: 12 },
};

function normalizePlan(raw: string | null): { key: string; months: number } {
  if (!raw) return { key: "monthly", months: 1 };
  const lower = raw.trim().toLowerCase();
  return PLAN_MAP[lower] ?? { key: "monthly", months: 1 };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function extractClientWithAI(message: string): Promise<ExtractedClient | null> {
  const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  if (!LOVABLE_API_KEY) {
    console.error("[auto-add-client] LOVABLE_API_KEY not configured");
    return null;
  }

  const system = `Você é um extrator de dados de clientes para um sistema de gerenciamento IPTV/VPN.
Extraia as informações do cliente da mensagem e retorne SOMENTE JSON válido (sem markdown).

Regras:
- name: nome completo do cliente (OBRIGATÓRIO)
- whatsapp: número do WhatsApp do cliente, apenas dígitos com DDD (OBRIGATÓRIO)
- plan: "mensal", "trimestral", "semestral" ou "anual" (default: "mensal")
- price: valor em BRL como número (ex: 49.90)
- app_name: nome do aplicativo (ex: "XCIPTV", "SmartOne", "DuplecastTV", etc.)
- device: tipo do dispositivo (ex: "TV Samsung", "Celular", "Fire Stick", etc.)
- service: "IPTV" ou "VPN" (default: "IPTV")
- email: email do cliente se mencionado
- notes: observações adicionais
- service_username: login/usuário do serviço se mencionado
- service_password: senha do serviço se mencionada
- expires_at: data de vencimento se mencionada (formato YYYY-MM-DD)

Formato:
{
  "name": string,
  "whatsapp": string,
  "plan": string,
  "price": number|null,
  "app_name": string|null,
  "device": string|null,
  "service": string|null,
  "email": string|null,
  "notes": string|null,
  "service_username": string|null,
  "service_password": string|null,
  "expires_at": string|null
}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("[auto-add-client] Gateway error:", resp.status, t);
    return null;
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return null;

  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as ExtractedClient;
  } catch (e) {
    console.error("[auto-add-client] Failed to parse AI JSON:", e, content);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { userId, message, instanceId, conversationId, phone: senderPhone } = body;

    if (!userId || !message) {
      return new Response(JSON.stringify({ error: "userId and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-add-client] Processing message from user ${userId}: "${message.substring(0, 100)}..."`);

    // Extract client data using AI
    const extracted = await extractClientWithAI(message);

    if (!extracted || !extracted.name || !extracted.whatsapp) {
      console.log("[auto-add-client] Could not extract required fields (name, whatsapp)");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Não foi possível extrair nome e WhatsApp da mensagem" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize plan
    const planInfo = normalizePlan(extracted.plan);

    // Calculate expiration date
    const now = new Date();
    let expiresAt: Date;
    if (extracted.expires_at && /^\d{4}-\d{2}-\d{2}$/.test(extracted.expires_at)) {
      expiresAt = new Date(extracted.expires_at + "T23:59:59.000Z");
    } else {
      expiresAt = addMonths(now, planInfo.months);
    }

    // Normalize phone (digits only)
    let clientPhone = (extracted.whatsapp || "").replace(/\D/g, "");
    if (clientPhone.length <= 11 && !clientPhone.startsWith("55")) {
      clientPhone = "55" + clientPhone;
    }

    // Check for duplicate by phone
    const { data: existing } = await supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", userId)
      .eq("whatsapp", clientPhone)
      .maybeSingle();

    if (existing) {
      console.log(`[auto-add-client] Client already exists: ${existing.name} (${existing.id})`);
      return new Response(JSON.stringify({
        success: false,
        error: `Cliente já existe: ${existing.name}`,
        existingClientId: existing.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert client
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: extracted.name,
        whatsapp: clientPhone,
        email: extracted.email || "",
        service: extracted.service || "IPTV",
        plan: planInfo.key,
        price: extracted.price,
        app_name: extracted.app_name,
        device: extracted.device,
        notes: extracted.notes,
        service_username: extracted.service_username,
        service_password: extracted.service_password,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[auto-add-client] Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao inserir cliente", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-add-client] ✅ Client added: ${newClient.name} (${newClient.id})`);

    // Send confirmation back via WhatsApp (to the same conversation)
    if (instanceId && senderPhone) {
      try {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_key")
          .eq("id", instanceId)
          .single();

        if (inst?.instance_key) {
          const { data: provider } = await supabase
            .from("whatsapp_instances")
            .select("provider_id, whatsapp_providers(api_url, api_token)")
            .eq("id", instanceId)
            .single();

          const providerUrl = (provider as any)?.whatsapp_providers?.api_url || Deno.env.get("UAZAPI_URL") || "";
          const providerToken = inst.instance_key;

          const planLabels: Record<string, string> = {
            monthly: "Mensal",
            quarterly: "Trimestral",
            semiannual: "Semestral",
            annual: "Anual",
          };

          const expDate = expiresAt.toLocaleDateString("pt-BR");
          const confirmMsg = `✅ *Cliente adicionado com sucesso!*\n\n` +
            `👤 *Nome:* ${extracted.name}\n` +
            `📱 *WhatsApp:* ${clientPhone}\n` +
            `📦 *Plano:* ${planLabels[planInfo.key] || planInfo.key}\n` +
            (extracted.price ? `💰 *Valor:* R$ ${extracted.price.toFixed(2)}\n` : "") +
            (extracted.app_name ? `📺 *App:* ${extracted.app_name}\n` : "") +
            (extracted.device ? `📱 *Dispositivo:* ${extracted.device}\n` : "") +
            `📅 *Vencimento:* ${expDate}`;

          await fetch(`${providerUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              token: providerToken,
            },
            body: JSON.stringify({
              number: senderPhone,
              text: confirmMsg,
            }),
          });

          // Save confirmation in inbox
          if (conversationId) {
            await supabase.from("chat_inbox_messages").insert({
              conversation_id: conversationId,
              sender_type: "agent",
              content: confirmMsg,
              metadata: {
                auto_add_client: true,
                client_id: newClient.id,
                source: "auto-add-client",
              },
            });
          }
        }
      } catch (e) {
        console.error("[auto-add-client] Error sending confirmation:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      client: newClient,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[auto-add-client] Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
