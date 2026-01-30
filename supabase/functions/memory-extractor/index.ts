import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type Sentiment = "positive" | "neutral" | "negative";

type ExtractedMemory = {
  client_name: string | null;
  nickname: string | null;
  device: string | null;
  tv: string | null;
  app_name: string | null;
  plan_name: string | null;
  plan_period: string | null;
  plan_price_brl: number | null;
  purchase_date: string | null; // YYYY-MM-DD
  expiration_date: string | null; // YYYY-MM-DD
  sentiment: Sentiment | null;
  custom_memories: Array<{ key: string; value: string }>;
};

function safeString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9,\.]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function safeDateYYYYMMDD(v: unknown): string | null {
  const s = safeString(v);
  if (!s) return null;
  // Accept YYYY-MM-DD only
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function normalizeSentiment(v: unknown): Sentiment | null {
  const s = safeString(v);
  if (!s) return null;
  if (s === "positive" || s === "neutral" || s === "negative") return s;
  return null;
}

function mergeCustomMemories(
  existing: Array<{ key: string; value: string }> | null | undefined,
  incoming: Array<{ key: string; value: string }> | null | undefined,
) {
  const map = new Map<string, string>();
  (existing ?? []).forEach((m) => {
    const k = safeString(m?.key);
    const v = safeString(m?.value);
    if (k && v) map.set(k, v);
  });
  (incoming ?? []).forEach((m) => {
    const k = safeString(m?.key);
    const v = safeString(m?.value);
    if (k && v) map.set(k, v);
  });
  return Array.from(map.entries()).map(([key, value]) => ({ key, value, extracted_at: new Date().toISOString() }));
}

async function extractWithGateway(input: {
  message: string;
  contactName?: string | null;
  phone: string;
  existingMemory?: Record<string, unknown> | null;
}): Promise<ExtractedMemory | null> {
  const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  if (!LOVABLE_API_KEY) return null;

  const system = `Você é um extrator de informações para CRM.
Extraia APENAS dados estruturados do texto. NÃO inclua o texto original.
Retorne SOMENTE JSON válido (sem markdown), no formato exato abaixo.

Regras:
- Se não tiver certeza, use null.
- Datas sempre em YYYY-MM-DD.
- Preço em BRL como número (ex: 49.9).
- plan_period: texto curto (ex: "mensal", "trimestral", "semestral", "anual", "30 dias", "90 dias").
- custom_memories: pares {key,value} para coisas importantes fora dos campos principais (ex: "tv", "modelo_tv", "problema", "login"), sem dados sensíveis.

Formato:
{
  "client_name": string|null,
  "nickname": string|null,
  "device": string|null,
  "tv": string|null,
  "app_name": string|null,
  "plan_name": string|null,
  "plan_period": string|null,
  "plan_price_brl": number|null,
  "purchase_date": string|null,
  "expiration_date": string|null,
  "sentiment": "positive"|"neutral"|"negative"|null,
  "custom_memories": [{"key": string, "value": string}]
}`;

  const user = `Contato: ${input.phone}${input.contactName ? ` (${input.contactName})` : ""}

Memória existente (resumo JSON): ${JSON.stringify(input.existingMemory ?? {}, null, 0)}

Mensagem:
${input.message}`;

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
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("[memory-extractor] Gateway error:", resp.status, t);
    return null;
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return null;

  try {
    return JSON.parse(content) as ExtractedMemory;
  } catch (e) {
    console.error("[memory-extractor] Failed to parse model JSON:", e, content);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Allow either:
    // 1) service role calling (Bearer = service key)
    // 2) authenticated user JWT (validated via supabase auth)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabaseUser.auth.getUser();
    const callerUserId = userData?.user?.id ?? null;
    const isServiceCall = bearer && bearer === supabaseServiceKey;

    if (!callerUserId && !isServiceCall) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const userId: string | null = safeString(body.userId) ?? callerUserId;
    const phone = safeString(body.phone);
    const agentId = safeString(body.agentId);
    const message = safeString(body.message);
    const contactName = safeString(body.contactName);

    if (!userId || !phone || !message) {
      return new Response(JSON.stringify({ error: "userId, phone and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing memory (agent-scoped when agentId is provided)
    const { data: existing } = await supabaseAdmin
      .from("ai_client_memories")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .eq("agent_id", agentId ? agentId : null)
      .maybeSingle();

    const extracted = await extractWithGateway({
      message,
      contactName,
      phone,
      existingMemory: existing ?? null,
    });

    const now = new Date().toISOString();
    const nextInteractions = Number((existing as any)?.total_interactions ?? 0) + 1;

    // Build merged update (only overwrite with new non-null values)
    const merged = {
      client_name: safeString(extracted?.client_name) ?? ((existing as any)?.client_name ?? null),
      nickname: safeString(extracted?.nickname) ?? ((existing as any)?.nickname ?? null),
      device: safeString(extracted?.device) ?? ((existing as any)?.device ?? null),
      app_name: safeString(extracted?.app_name) ?? ((existing as any)?.app_name ?? null),
      plan_name: safeString(extracted?.plan_name) ?? ((existing as any)?.plan_name ?? null),
      plan_price: safeNumber(extracted?.plan_price_brl) ?? ((existing as any)?.plan_price ?? null),
      purchase_date: safeDateYYYYMMDD(extracted?.purchase_date) ?? ((existing as any)?.purchase_date ?? null),
      expiration_date: safeDateYYYYMMDD(extracted?.expiration_date) ?? ((existing as any)?.expiration_date ?? null),
      sentiment: normalizeSentiment(extracted?.sentiment) ?? ((existing as any)?.sentiment ?? "neutral"),
      // custom_memories is jsonb array
      custom_memories: mergeCustomMemories(
        (existing as any)?.custom_memories as Array<{ key: string; value: string }> | null | undefined,
        extracted?.custom_memories,
      ),
    };

    // Also store TV / plan_period as custom memories (since table has no direct columns)
    const tv = safeString(extracted?.tv);
    const planPeriod = safeString(extracted?.plan_period);
    if (tv) {
      merged.custom_memories = mergeCustomMemories(merged.custom_memories as any, [{ key: "tv", value: tv }]);
    }
    if (planPeriod) {
      merged.custom_memories = mergeCustomMemories(merged.custom_memories as any, [{ key: "periodo_plano", value: planPeriod }]);
    }

    const { error: upsertError } = await supabaseAdmin
      .from("ai_client_memories")
      .upsert(
        {
          id: (existing as any)?.id,
          user_id: userId,
          agent_id: agentId ? agentId : null,
          phone,
          client_name: merged.client_name,
          nickname: merged.nickname,
          device: merged.device,
          app_name: merged.app_name,
          plan_name: merged.plan_name,
          plan_price: merged.plan_price,
          purchase_date: merged.purchase_date,
          expiration_date: merged.expiration_date,
          custom_memories: merged.custom_memories as any,
          ai_summary: (existing as any)?.ai_summary ?? null,
          is_vip: Boolean((existing as any)?.is_vip ?? false),
          sentiment: merged.sentiment,
          last_interaction_at: now,
          total_interactions: nextInteractions,
          updated_at: now,
          created_at: (existing as any)?.created_at ?? now,
        },
        { onConflict: "user_id,agent_id,phone" },
      );

    if (upsertError) {
      console.error("[memory-extractor] Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save memory" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[memory-extractor] Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
