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
    const apiKeyRaw = Deno.env.get("SERVEX_API_KEY");
    
    if (!apiKeyRaw) {
      console.error("SERVEX_API_KEY not configured");
      throw new Error("API key not configured");
    }

    // Servex docs: Authorization must be sent as Bearer Token.
    // Accept secret values with or without the "Bearer " prefix.
    const apiKey = apiKeyRaw.trim();
    const authorizationHeader = apiKey.toLowerCase().startsWith("bearer ")
      ? apiKey
      : `Bearer ${apiKey}`;

    console.log("Fetching VPN client/test from servex.ws...");
    
    // New Servex API endpoint provided by user
    const url = "https://servex.ws/api/clients";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": authorizationHeader,
        // Compatibility headers (some gateways still look for these)
        "X-API-Key": apiKey,
        "apikey": apiKey,
        "User-Agent": "LovableSupabaseEdgeFunction/1.0",
      },
    });

    if (!response.ok) {
      console.error("API responded with status:", response.status);
      const errorText = await response.text();
      console.error("Error response:", errorText);
      // Return a short snippet to help diagnose Cloudflare/WAF blocks
      throw new Error(
        `API error: ${response.status} - ${errorText.slice(0, 180)}`
      );
    }

    const data = await response.json();
    console.log("Servex response received successfully");

    return new Response(JSON.stringify(data), {
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
