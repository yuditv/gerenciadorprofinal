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
  plan: string;
  price: number | null;
  app_name: string | null;
  device: string | null;
  service: string | null;
  email: string | null;
  notes: string | null;
  service_username: string | null;
  service_password: string | null;
  expires_at: string | null;
}

const PLAN_MAP: Record<string, { key: string; days: number; label: string }> = {
  mensal: { key: "monthly", days: 30, label: "Mensal" },
  monthly: { key: "monthly", days: 30, label: "Mensal" },
  trimestral: { key: "quarterly", days: 90, label: "Trimestral" },
  quarterly: { key: "quarterly", days: 90, label: "Trimestral" },
  semestral: { key: "semiannual", days: 180, label: "Semestral" },
  semiannual: { key: "semiannual", days: 180, label: "Semestral" },
  anual: { key: "annual", days: 365, label: "Anual" },
  annual: { key: "annual", days: 365, label: "Anual" },
  "30 dias": { key: "monthly", days: 30, label: "Mensal (30 dias)" },
  "90 dias": { key: "quarterly", days: 90, label: "Trimestral (90 dias)" },
  "180 dias": { key: "semiannual", days: 180, label: "Semestral (180 dias)" },
  "365 dias": { key: "annual", days: 365, label: "Anual (365 dias)" },
};

function normalizePlan(raw: string | null): { key: string; days: number; label: string } {
  if (!raw) return { key: "monthly", days: 30, label: "Mensal" };
  const lower = raw.trim().toLowerCase();
  return PLAN_MAP[lower] ?? { key: "monthly", days: 30, label: "Mensal" };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function extractClientWithAI(message: string): Promise<ExtractedClient | null> {
  const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  if (!LOVABLE_API_KEY) {
    console.error("[auto-add-client] LOVABLE_API_KEY not configured");
    return null;
  }

  const system = `Você é um extrator de dados de clientes para um sistema de gerenciamento de serviços (IPTV, VPN, streaming, etc).
Extraia as informações do cliente da mensagem e retorne SOMENTE JSON válido (sem markdown).

Regras:
- name: nome completo do cliente (OBRIGATÓRIO)
- whatsapp: número do WhatsApp do cliente, apenas dígitos com DDD (OBRIGATÓRIO)
- plan: "mensal", "trimestral", "semestral" ou "anual" (default: "mensal"). Se o usuário mencionar dias (ex: "30 dias"), converta para o plano correspondente.
- price: valor em BRL como número (ex: 49.90)
- app_name: nome do aplicativo (ex: "XCIPTV", "SmartOne", "DuplecastTV", "PlayTV", etc.)
- device: tipo do dispositivo (ex: "TV Samsung", "Celular", "Fire Stick", "TV Box", etc.)
- service: o tipo/nome do serviço mencionado (ex: "IPTV", "VPN", "P2P", etc). Se não for mencionado, use "IPTV" como padrão.
- email: email do cliente se mencionado
- notes: observações adicionais que não se encaixam nos outros campos
- service_username: login/usuário de acesso ao serviço do cliente (IMPORTANTE: extrair se mencionado)
- service_password: senha de acesso ao serviço do cliente (IMPORTANTE: extrair se mencionada)
- expires_at: NÃO preencha este campo a menos que o usuário mencione uma data de vencimento ESPECÍFICA (formato YYYY-MM-DD). O sistema calcula automaticamente baseado no plano.

IMPORTANTE: O campo service_username e service_password são as credenciais de acesso ao serviço do cliente (login e senha do IPTV/VPN), NÃO confunda com dados pessoais.

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

    console.log(`[auto-add-client] Processing message from user ${userId}: "${message.substring(0, 150)}..."`);

    // Extract client data using AI
    const extracted = await extractClientWithAI(message);

    if (!extracted || !extracted.name || !extracted.whatsapp) {
      console.log("[auto-add-client] Could not extract required fields (name, whatsapp)");
      
      // Send error notification back
      if (instanceId && senderPhone) {
        await sendWhatsAppNotification(supabase, instanceId, senderPhone, conversationId,
          "❌ *Erro ao adicionar cliente*\n\nNão foi possível extrair o *nome* e *WhatsApp* da mensagem.\n\nEnvie no formato:\n#cliente Nome, WhatsApp 91999999999, plano mensal, R$49.90, serviço IPTV, app XCIPTV, dispositivo TV Samsung, usuário: login123, senha: abc456"
        );
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Não foi possível extrair nome e WhatsApp da mensagem" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize plan and calculate expiration based on days
    const planInfo = normalizePlan(extracted.plan);
    const now = new Date();
    
    // Calculate expiration: use explicit date if provided, otherwise add days based on plan
    let expiresAt: Date;
    if (extracted.expires_at && /^\d{4}-\d{2}-\d{2}$/.test(extracted.expires_at)) {
      expiresAt = new Date(extracted.expires_at + "T23:59:59.000Z");
    } else {
      // Plano mensal = 30 dias, trimestral = 90 dias, etc.
      expiresAt = addDays(now, planInfo.days);
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
      
      if (instanceId && senderPhone) {
        await sendWhatsAppNotification(supabase, instanceId, senderPhone, conversationId,
          `⚠️ *Cliente já existe!*\n\n👤 *${existing.name}*\n📱 ${clientPhone}\n\nEsse número já está cadastrado no sistema.`
        );
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: `Cliente já existe: ${existing.name}`,
        existingClientId: existing.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine service name (use whatever the user said, default IPTV)
    const serviceName = extracted.service || "IPTV";

    // Insert client
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: extracted.name,
        whatsapp: clientPhone,
        email: extracted.email || "",
        service: serviceName,
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
      
      if (instanceId && senderPhone) {
        await sendWhatsAppNotification(supabase, instanceId, senderPhone, conversationId,
          `❌ *Erro ao adicionar cliente*\n\nOcorreu um erro no banco de dados: ${insertError.message}`
        );
      }
      
      return new Response(JSON.stringify({ error: "Erro ao inserir cliente", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-add-client] ✅ Client added: ${newClient.name} (${newClient.id})`);

    // Build comprehensive confirmation message
    const cadastroDate = formatDateBR(now);
    const expDate = formatDateBR(expiresAt);
    
    let confirmMsg = `✅ *Cliente adicionado com sucesso!*\n\n`;
    confirmMsg += `👤 *Nome:* ${extracted.name}\n`;
    confirmMsg += `📱 *WhatsApp:* ${clientPhone}\n`;
    confirmMsg += `🔧 *Serviço:* ${serviceName}\n`;
    confirmMsg += `📦 *Plano:* ${planInfo.label}\n`;
    if (extracted.price) confirmMsg += `💰 *Valor:* R$ ${extracted.price.toFixed(2)}\n`;
    if (extracted.app_name) confirmMsg += `📺 *App:* ${extracted.app_name}\n`;
    if (extracted.device) confirmMsg += `📱 *Dispositivo:* ${extracted.device}\n`;
    if (extracted.service_username) confirmMsg += `👤 *Usuário:* ${extracted.service_username}\n`;
    if (extracted.service_password) confirmMsg += `🔑 *Senha:* ${extracted.service_password}\n`;
    confirmMsg += `\n📅 *Data de cadastro:* ${cadastroDate}\n`;
    confirmMsg += `📅 *Vencimento:* ${expDate} (${planInfo.days} dias)\n`;
    if (extracted.notes) confirmMsg += `\n📝 *Obs:* ${extracted.notes}`;

    // Send confirmation via WhatsApp
    if (instanceId && senderPhone) {
      await sendWhatsAppNotification(supabase, instanceId, senderPhone, conversationId, confirmMsg, newClient.id);
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

// Helper to send WhatsApp notification and save in inbox
async function sendWhatsAppNotification(
  supabase: any,
  instanceId: string,
  phone: string,
  conversationId: string | null,
  message: string,
  clientId?: string
): Promise<void> {
  try {
    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_key, provider_id, whatsapp_providers(api_url)")
      .eq("id", instanceId)
      .single();

    if (!inst?.instance_key) {
      console.log("[auto-add-client] No instance key found, skipping notification");
      return;
    }

    const providerUrl = (inst as any)?.whatsapp_providers?.api_url || Deno.env.get("UAZAPI_URL") || "";

    await fetch(`${providerUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: inst.instance_key,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    console.log("[auto-add-client] WhatsApp notification sent");

    // Save in inbox
    if (conversationId) {
      await supabase.from("chat_inbox_messages").insert({
        conversation_id: conversationId,
        sender_type: "agent",
        content: message,
        metadata: {
          auto_add_client: true,
          client_id: clientId || null,
          source: "auto-add-client",
        },
      });

      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 100),
        })
        .eq("id", conversationId);
    }
  } catch (e) {
    console.error("[auto-add-client] Error sending notification:", e);
  }
}
