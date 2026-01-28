import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Option = { id: number; name: string };

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function pickString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function pickNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(pickString(v));
  return Number.isFinite(n) ? n : null;
}

function normalizeOptions(input: unknown): Option[] {
  const arr = asArray(input) ?? asArray((input as any)?.data) ?? asArray((input as any)?.results) ?? asArray((input as any)?.items);
  if (!arr) return [];

  const options: Option[] = [];
  for (const item of arr) {
    const id = pickNumber((item as any)?.id ?? (item as any)?.category_id ?? (item as any)?.owner_id);
    const name =
      pickString((item as any)?.name) ||
      pickString((item as any)?.title) ||
      pickString((item as any)?.username) ||
      pickString((item as any)?.email) ||
      pickString((item as any)?.label) ||
      (id !== null ? `#${id}` : "");
    if (id !== null && id > 0) options.push({ id, name: name || `#${id}` });
  }

  // Remove duplicates by id
  const map = new Map<number, Option>();
  for (const o of options) map.set(o.id, o);
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    // Always consume body; already consumed by text()
    let parsed: unknown = null;
    if (text && contentType.toLowerCase().includes("application/json")) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      data: parsed,
      rawTextSnippet: text ? text.slice(0, 200) : "",
    };
  } catch (e) {
    return { ok: false, status: 0, statusText: e instanceof Error ? e.message : String(e), data: null };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKeyRaw = Deno.env.get("SERVEX_API_KEY");
    if (!apiKeyRaw) {
      console.error("SERVEX_API_KEY not configured");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = apiKeyRaw.trim();
    const authorizationHeader = apiKey.toLowerCase().startsWith("bearer ") ? apiKey : `Bearer ${apiKey}`;

    const base = "https://servex.ws";

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorizationHeader,
      "User-Agent": "LovableSupabaseEdgeFunction/1.0",
    };

    // Probing endpoints because provider docs vary.
    const probes = {
      categories: [
        "/api/categories",
        "/api/category",
        "/api/clients/categories",
        "/api/client-categories",
      ],
      owners: [
        "/api/owners",
        "/api/users",
        "/api/admins",
        "/api/resellers",
      ],
    } as const;

    const tried: Array<{
      kind: "categories" | "owners";
      path: string;
      ok: boolean;
      status: number;
      statusText?: string;
      rawTextSnippet?: string;
    }> = [];

    let categories: Option[] = [];
    for (const path of probes.categories) {
      const url = `${base}${path}`;
      const r = await fetchJsonWithTimeout(url, headers);
      tried.push({ kind: "categories", path, ok: r.ok, status: r.status, statusText: r.statusText, rawTextSnippet: (r as any).rawTextSnippet });
      if (r.ok) {
        const normalized = normalizeOptions(r.data);
        if (normalized.length) {
          categories = normalized;
          break;
        }
      }
    }

    let owners: Option[] = [];
    for (const path of probes.owners) {
      const url = `${base}${path}`;
      const r = await fetchJsonWithTimeout(url, headers);
      tried.push({ kind: "owners", path, ok: r.ok, status: r.status, statusText: r.statusText, rawTextSnippet: (r as any).rawTextSnippet });
      if (r.ok) {
        const normalized = normalizeOptions(r.data);
        if (normalized.length) {
          owners = normalized;
          break;
        }
      }
    }

    console.log("servex-metadata result", {
      categoriesCount: categories.length,
      ownersCount: owners.length,
      triedCount: tried.length,
    });

    return new Response(
      JSON.stringify({ categories, owners, tried }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error fetching Servex metadata:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch metadata",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
