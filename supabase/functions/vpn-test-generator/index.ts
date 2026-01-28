import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = req.method !== "GET"
      ? await req.json().catch(() => ({}))
      : {};

    const apiKeyRaw = Deno.env.get("SERVEX_API_KEY");
    
    if (!apiKeyRaw) {
      console.error("SERVEX_API_KEY not configured");
      throw new Error("API key not configured");
    }

    // Servex docs: Authorization must be sent as Bearer Token.
    // Accept secret values with or without the "Bearer " prefix.
    const apiKey = apiKeyRaw.trim();
    console.log("🔐 API Key format check:", {
      startsWithBearer: apiKey.toLowerCase().startsWith("bearer "),
      startsWithSx: apiKey.startsWith("sx_"),
      length: apiKey.length
    });

    const authorizationHeader = apiKey.toLowerCase().startsWith("bearer ")
      ? apiKey
      : `Bearer ${apiKey}`;

    console.log("🔑 Authorization header prepared (first 20 chars):", authorizationHeader.substring(0, 20) + "...");

    console.log("Creating VPN test client at servex.ws...");

    const url = "https://servex.ws/api/clients";

    // Params can be provided by the client (modal). Defaults are safe.
    const category_id = Number((requestBody as any)?.category_id ?? 1);
    const duration = Number((requestBody as any)?.duration ?? 60); // minutes (per Servex docs)
    const connection_limit = Number((requestBody as any)?.connection_limit ?? 1);
    const owner_id = (requestBody as any)?.owner_id !== undefined && (requestBody as any)?.owner_id !== null && (requestBody as any)?.owner_id !== ""
      ? Number((requestBody as any)?.owner_id)
      : undefined;

    // Generate random username + identifiers
    // NOTE: Servex constraint: username and password must be <= 20 chars.
    const randomNumber = Math.floor(Math.random() * 1_000_000) + 1;
    const v2rayEnabled = Boolean((requestBody as any)?.v2ray_enabled ?? true);
    const v2rayUuid = v2rayEnabled
      ? String((requestBody as any)?.v2ray_uuid ?? crypto.randomUUID())
      : "";

    const usernameFromBody = typeof (requestBody as any)?.username === "string" ? (requestBody as any).username : "";
    const usernameRaw = usernameFromBody || `teste${randomNumber}`;
    const username = usernameRaw.trim().slice(0, 20);

    // Short password (<= 20) to satisfy Servex validation
    const makePassword = (len = 12) => {
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no ambiguous chars
      return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    };
    const passwordFromBody = typeof (requestBody as any)?.password === "string" ? (requestBody as any).password : "";
    const password = (passwordFromBody || makePassword(12)).trim().slice(0, 20);

    console.log("🧾 Lengths:", {
      usernameLen: username.length,
      passwordLen: password.length,
      v2rayUuidLen: v2rayUuid.length,
    });

    const payload = {
      username,
      password,
      category_id,
      connection_limit,
      duration,
      type: "test",
      ...(v2rayEnabled ? { v2ray_uuid: v2rayUuid } : {}),
      ...(owner_id ? { owner_id } : {}),
    };

    console.log("📤 Sending POST to Servex with payload:", { ...payload, password: "***", v2ray_uuid: "***" });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": authorizationHeader,
        "User-Agent": "LovableSupabaseEdgeFunction/1.0",
      },
      body: JSON.stringify(payload),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Servex API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 300)
      });
      throw new Error(
        `API error: ${response.status} - ${errorText.slice(0, 200)}`
      );
    }

    const data = await response.json();
    console.log("✅ Servex response received successfully:", { hasData: !!data });

    // Ensure the UI always sees the generated credentials even if the API response shape changes
    const normalized = {
      username,
      password,
      v2ray_uuid: v2rayUuid,
      duration: String(duration),
      type: "test",
      category_id: String(category_id),
      connection_limit: String(connection_limit),
      owner_id: String(owner_id),
      servex: data,
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating VPN test:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate test" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
