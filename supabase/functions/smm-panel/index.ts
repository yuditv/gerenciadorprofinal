import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const INSTALUXO_BASE_URL = "https://instaluxo.com/api/v2";
const FETCH_TIMEOUT_MS = 15000;

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

function safeSnippet(input: string, maxLen = 400) {
  const clean = input.replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean;
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
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

  const baseUrl = normalizeBaseUrl(INSTALUXO_BASE_URL);

  const form = new URLSearchParams();
  form.set("key", key);
  form.set("action", action);
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null) continue;
    form.set(k, String(v));
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  console.log(`[smm-panel] calling instaluxo action=${action} baseUrl=${baseUrl}`);

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: controller.signal,
    });

    const text = await res.text();
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[smm-panel] instaluxo responded action=${action} status=${res.status} timeMs=${elapsedMs} bodySnippet=${safeSnippet(text)}`,
    );

    if (!res.ok) {
      return {
        error: `Erro do painel SMM (HTTP ${res.status})`,
        details: safeSnippet(text),
      };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        error: `Resposta inválida do painel SMM (HTTP ${res.status})`,
        details: safeSnippet(text),
      };
    }
  } catch (e) {
    const elapsedMs = Date.now() - startedAt;

    if (e instanceof DOMException && e.name === "AbortError") {
      console.error(`[smm-panel] timeout action=${action} timeMs=${elapsedMs}`);
      return { error: "Timeout ao conectar no painel SMM" };
    }

    console.error(`[smm-panel] network error action=${action} timeMs=${elapsedMs}`, e);
    return {
      error: "Falha ao conectar no painel SMM",
      details: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function asServicesPayload(data: unknown) {
  // Painéis SMM costumam retornar:
  // 1) array direto
  // 2) { services: [...] }
  // 3) { data: [...] } (menos comum)
  if (Array.isArray(data)) return { services: data };
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.services)) return { services: d.services };
    if (Array.isArray(d.data)) return { services: d.data };
  }
  return { services: [] as unknown[] };
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

    const raw = await callSmmApi(action, payload);

    // Padroniza erro
    if (raw && typeof raw === "object" && "error" in (raw as Record<string, unknown>)) {
      const r = raw as Record<string, unknown>;
      // 504 para timeout, 502 para falha externa
      const msg = String(r.error ?? "Erro desconhecido");
      const status = msg.toLowerCase().includes("timeout") ? 504 : 502;
      return json({ error: msg, details: r.details }, status);
    }

    // Padroniza resposta para o front
    if (action === "services") {
      const { services } = asServicesPayload(raw);
      return json({ services });
    }

    // balance/status/add: retorna como veio
    return json(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[smm-panel] error:", e);
    return json({ error: message }, status);
  }
});
