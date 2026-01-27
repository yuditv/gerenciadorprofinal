import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("SERVEX_API_KEY");
    
    if (!apiKey) {
      console.error("SERVEX_API_KEY not configured");
      throw new Error("API key not configured");
    }

    console.log("Fetching VPN test from servex.ws...");
    
    const response = await fetch(
      "https://servex.ws/test/3c5cfe65-2403-45f6-86d8-d3b820e6a8c9",
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-API-Key": apiKey,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!response.ok) {
      console.error("API responded with status:", response.status);
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("VPN test generated successfully");

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
