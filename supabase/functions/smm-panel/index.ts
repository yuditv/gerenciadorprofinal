import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const INSTALUXO_BASE_URL = "https://instaluxo.com/api/v2";

type Action = "balance" | "services" | "add" | "status";

type RequestBody = {
  action: Action;
  payload?: Record<string, unknown>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getApiKey(): string {
  const key = (Deno.env.get("INSTALUXO_SMM_API_KEY") ?? "").trim();
  if (!key) throw new Error("Missing INSTALUXO_SMM_API_KEY secret");
  return key;
}

async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("Unauthorized");
  }
  return data.claims.sub;
}

async function callSmmApi(action: Action, payload: Record<string, unknown> = {}) {
  const key = getApiKey();

  const form = new URLSearchParams();
  form.set("key", key);
  form.set("action", action);
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null) continue;
    form.set(k, String(v));
  }

  const res = await fetch(INSTALUXO_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Invalid API response (${res.status})`, raw: text };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireUserId(req);
    console.log(`[smm-panel] request from user=${userId}`);

    const body = (await req.json()) as RequestBody;
    const action = body?.action;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;

    if (!action || !["balance", "services", "add", "status"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    // Minimal validation for v1
    if (action === "add") {
      const service = Number(payload.service);
      const link = String(payload.link ?? "").trim();
      const quantity = Number(payload.quantity);
      if (!service || !Number.isFinite(service)) return json({ error: "service is required" }, 400);
      if (!link) return json({ error: "link is required" }, 400);
      if (!quantity || !Number.isFinite(quantity) || quantity <= 0) return json({ error: "quantity is required" }, 400);
    }

    const data = await callSmmApi(action, payload);
    return json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[smm-panel] error:", e);
    return json({ error: message }, status);
  }
});
