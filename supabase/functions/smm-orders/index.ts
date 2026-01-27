import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const INSTALUXO_BASE_URL = "https://instaluxo.com/api/v2";
const FETCH_TIMEOUT_MS = 15000;

type Action =
  | "create"
  | "status"
  | "status_multi"
  | "refill"
  | "refill_status"
  | "cancel";

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

function getEnv(name: string) {
  const v = (Deno.env.get(name) ?? "").trim();
  if (!v) throw new Error(`Missing ${name} secret`);
  return v;
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

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
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

function getServiceRoleClient() {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRole);
}

function getInstaluxoApiKey() {
  return getEnv("INSTALUXO_SMM_API_KEY");
}

async function callSmmApi(action: string, payload: Record<string, unknown> = {}) {
  const key = getInstaluxoApiKey();
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

  console.log(`[smm-orders] calling instaluxo action=${action}`);

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: controller.signal,
    });

    const text = await res.text();
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[smm-orders] instaluxo responded action=${action} status=${res.status} timeMs=${elapsedMs} bodySnippet=${safeSnippet(text)}`,
    );

    if (!res.ok) {
      return { error: `Erro do painel SMM (HTTP ${res.status})`, details: safeSnippet(text) };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { error: `Resposta inválida do painel SMM (HTTP ${res.status})`, details: safeSnippet(text) };
    }
  } catch (e) {
    const elapsedMs = Date.now() - startedAt;
    if (e instanceof DOMException && e.name === "AbortError") {
      console.error(`[smm-orders] timeout action=${action} timeMs=${elapsedMs}`);
      return { error: "Timeout ao conectar no painel SMM" };
    }
    console.error(`[smm-orders] network error action=${action} timeMs=${elapsedMs}`, e);
    return {
      error: "Falha ao conectar no painel SMM",
      details: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timeout);
  }
}

type InstaluxoService = {
  service: number;
  name: string;
  type?: string;
  category?: string;
  rate?: string;
  min?: string;
  max?: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
};

function parseNumber(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/,/g, "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function computeFinalPrice(providerCost: number, markupPercent: number) {
  const rawFinal = providerCost * (1 + markupPercent / 100);
  const finalPrice = Math.ceil(rawFinal * 100) / 100;
  const profit = Number((finalPrice - providerCost).toFixed(2));
  return { finalPrice, profit };
}

async function fetchServiceById(serviceId: number): Promise<InstaluxoService | null> {
  const raw = await callSmmApi("services");
  if (raw && typeof raw === "object" && "error" in raw) return null;

  const services: InstaluxoService[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.services)
      ? raw.services
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

  return services.find((s) => Number(s.service) === serviceId) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireUserId(req);
    const body = (await req.json()) as RequestBody;
    const action = body?.action;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;

    if (!action) return json({ error: "Invalid action" }, 400);

    const admin = getServiceRoleClient();

    if (action === "create") {
      const serviceId = Number(payload.service_id ?? payload.serviceId ?? payload.service);
      const link = String(payload.link ?? "").trim();
      const quantityRaw = payload.quantity;
      const quantity = quantityRaw === undefined || quantityRaw === null ? 0 : Number(quantityRaw);
      const comments = payload.comments;
      const runs = payload.runs;
      const interval = payload.interval;

      if (!serviceId || !Number.isFinite(serviceId)) return json({ error: "service_id is required" }, 400);
      if (!link) return json({ error: "link is required" }, 400);
      if (quantity < 0 || !Number.isFinite(quantity)) return json({ error: "quantity invalid" }, 400);

      const service = await fetchServiceById(serviceId);
      if (!service) return json({ error: "Serviço não encontrado" }, 400);

      const rate = parseNumber(service.rate);
      if (rate == null || rate <= 0) {
        return json({ error: "Serviço sem rate válido" }, 400);
      }

      // Heurística: se quantity > 0, rate é por 1000. Se não, assume pacote (preço fixo).
      const providerCost = quantity > 0 ? (rate * quantity) / 1000 : rate;

      const { data: pricing, error: pricingError } = await admin
        .from("pricing_settings")
        .select("markup_percent")
        .eq("id", 1)
        .maybeSingle();
      if (pricingError) throw pricingError;

      const markupPercent = Number(pricing?.markup_percent ?? 0);
      const { finalPrice, profit } = computeFinalPrice(providerCost, markupPercent);

      const orderId = crypto.randomUUID();

      // Cria pedido como pending (auditável)
      const meta = {
        comments: typeof comments === "string" ? comments : undefined,
        runs: runs === undefined ? undefined : Number(runs),
        interval: interval === undefined ? undefined : Number(interval),
        service_type: service.type,
        service_category: service.category,
      };

      const insertPayload: Record<string, unknown> = {
        id: orderId,
        user_id: userId,
        status: "pending",
        service_id: serviceId,
        service_name: service.name,
        link,
        quantity: quantity > 0 ? quantity : 0,
        provider_rate_per_1000: rate,
        provider_cost_brl: Number(providerCost.toFixed(2)),
        markup_percent: Number(markupPercent.toFixed(2)),
        price_brl: Number(finalPrice.toFixed(2)),
        profit_brl: Number(profit.toFixed(2)),
        credits_spent: Number(finalPrice.toFixed(2)),
        meta,
      };

      const { error: insertErr } = await admin.from("smm_orders").insert(insertPayload);
      if (insertErr) throw insertErr;

      // Debita créditos (atomic)
      const { error: debitErr } = await admin.rpc("wallet_debit", {
        p_user_id: userId,
        p_amount: finalPrice,
        p_reference_type: "smm_order",
        p_reference_id: orderId,
      });
      if (debitErr) {
        await admin
          .from("smm_orders")
          .update({ status: "failed", error_message: debitErr.message })
          .eq("id", orderId)
          .eq("user_id", userId);
        return json({ error: debitErr.message }, 400);
      }

      const apiPayload: Record<string, unknown> = { service: serviceId, link };
      if (quantity > 0) apiPayload.quantity = quantity;
      if (typeof comments === "string" && comments.trim()) apiPayload.comments = comments;
      if (runs !== undefined && runs !== null) apiPayload.runs = Number(runs);
      if (interval !== undefined && interval !== null) apiPayload.interval = Number(interval);

      const apiRes = await callSmmApi("add", apiPayload);

      if (apiRes && typeof apiRes === "object" && "error" in apiRes) {
        // Estorna
        await admin.rpc("wallet_credit", {
          p_user_id: userId,
          p_amount: finalPrice,
          p_reference_type: "smm_order",
          p_reference_id: orderId,
          p_tx_type: "refund",
        });

        await admin
          .from("smm_orders")
          .update({ status: "refunded", error_message: String((apiRes as any).error ?? "Erro"), })
          .eq("id", orderId)
          .eq("user_id", userId);

        return json({ error: (apiRes as any).error, details: (apiRes as any).details }, 502);
      }

      const providerOrderId = apiRes?.order ? String(apiRes.order) : null;

      await admin
        .from("smm_orders")
        .update({ status: "submitted", provider_order_id: providerOrderId })
        .eq("id", orderId)
        .eq("user_id", userId);

      return json({ id: orderId, provider_order_id: providerOrderId });
    }

    if (action === "status") {
      const orderId = String(payload.id ?? payload.order_id ?? payload.orderId ?? "").trim();
      if (!orderId) return json({ error: "id is required" }, 400);

      const { data: order, error } = await admin
        .from("smm_orders")
        .select("id, user_id, provider_order_id")
        .eq("id", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!order?.provider_order_id) return json({ error: "Pedido sem provider_order_id" }, 400);

      const apiRes = await callSmmApi("status", { order: order.provider_order_id });
      if (apiRes && typeof apiRes === "object" && "error" in apiRes) {
        return json(apiRes, 502);
      }

      const providerStatus = String(apiRes?.status ?? "").trim() || null;
      const providerCharge = parseNumber(apiRes?.charge);
      const providerRemains = apiRes?.remains == null ? null : Number(apiRes.remains);
      const providerStartCount = apiRes?.start_count == null ? null : Number(apiRes.start_count);
      const providerCurrency = apiRes?.currency ? String(apiRes.currency) : null;

      // lucro real apenas se currency parecer BRL
      let profitRealBrl: number | null = null;
      if (providerCurrency && providerCurrency.toUpperCase() === "BRL" && providerCharge != null) {
        const { data: full } = await admin
          .from("smm_orders")
          .select("price_brl")
          .eq("id", orderId)
          .eq("user_id", userId)
          .maybeSingle();
        if (full?.price_brl != null) {
          profitRealBrl = Number((Number(full.price_brl) - providerCharge).toFixed(2));
        }
      }

      await admin
        .from("smm_orders")
        .update({
          provider_status: providerStatus,
          provider_charge: providerCharge,
          provider_remains: providerRemains,
          provider_start_count: providerStartCount,
          provider_currency: providerCurrency,
          last_synced_at: new Date().toISOString(),
          profit_real_brl: profitRealBrl,
        })
        .eq("id", orderId)
        .eq("user_id", userId);

      return json({
        id: orderId,
        provider_order_id: order.provider_order_id,
        provider_status: providerStatus,
        provider_charge: providerCharge,
        provider_currency: providerCurrency,
        provider_remains: providerRemains,
        provider_start_count: providerStartCount,
      });
    }

    if (action === "status_multi") {
      const ids = Array.isArray(payload.provider_order_ids)
        ? payload.provider_order_ids
        : Array.isArray(payload.orders)
          ? payload.orders
          : null;
      if (!ids) return json({ error: "provider_order_ids is required" }, 400);
      const orderIds = (ids as unknown[]).map((x) => String(x)).filter(Boolean);
      if (!orderIds.length) return json({ error: "provider_order_ids is required" }, 400);

      const apiRes = await callSmmApi("status", { orders: orderIds.join(",") });
      if (apiRes && typeof apiRes === "object" && "error" in apiRes) {
        return json(apiRes, 502);
      }
      return json({ data: apiRes });
    }

    if (action === "refill") {
      const orderId = String(payload.id ?? "").trim();
      if (!orderId) return json({ error: "id is required" }, 400);

      const { data: order, error } = await admin
        .from("smm_orders")
        .select("id, provider_order_id")
        .eq("id", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!order?.provider_order_id) return json({ error: "Pedido sem provider_order_id" }, 400);

      const apiRes = await callSmmApi("refill", { order: order.provider_order_id });
      if (apiRes && typeof apiRes === "object" && "error" in apiRes) {
        return json(apiRes, 502);
      }

      const refillId = apiRes?.refill ? String(apiRes.refill) : null;
      await admin
        .from("smm_orders")
        .update({
          provider_refill_id: refillId,
          provider_refill_status: refillId ? "requested" : null,
          requested_refill_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("user_id", userId);

      return json({ id: orderId, provider_refill_id: refillId });
    }

    if (action === "refill_status") {
      const refillId = String(payload.refill_id ?? payload.refillId ?? payload.refill ?? "").trim();
      if (!refillId) return json({ error: "refill_id is required" }, 400);

      const apiRes = await callSmmApi("refill_status", { refill: refillId });
      if (apiRes && typeof apiRes === "object" && "error" in apiRes) {
        return json(apiRes, 502);
      }

      const status = apiRes?.status ? String(apiRes.status) : null;
      // Atualiza pedidos do usuário que tenham esse refill id
      await admin
        .from("smm_orders")
        .update({ provider_refill_status: status, last_synced_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider_refill_id", refillId);

      return json({ provider_refill_id: refillId, provider_refill_status: status });
    }

    if (action === "cancel") {
      const ids = Array.isArray(payload.ids) ? payload.ids : null;
      if (!ids) return json({ error: "ids is required" }, 400);
      const orderIds = (ids as unknown[]).map((x) => String(x)).filter(Boolean);
      if (!orderIds.length) return json({ error: "ids is required" }, 400);

      const { data: orders, error } = await admin
        .from("smm_orders")
        .select("id, provider_order_id")
        .eq("user_id", userId)
        .in("id", orderIds);
      if (error) throw error;

      const providerIds = (orders ?? [])
        .map((o: any) => String(o.provider_order_id ?? ""))
        .filter(Boolean);
      if (!providerIds.length) return json({ error: "Nenhum provider_order_id para cancelar" }, 400);

      const apiRes = await callSmmApi("cancel", { orders: providerIds.join(",") });
      if (apiRes && typeof apiRes === "object" && "error" in apiRes) {
        return json(apiRes, 502);
      }

      await admin
        .from("smm_orders")
        .update({ cancelled_at: new Date().toISOString(), provider_status: "canceled" })
        .eq("user_id", userId)
        .in("id", orderIds);

      return json({ ok: true, data: apiRes });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[smm-orders] error:", e);
    return json({ error: message }, status);
  }
});
