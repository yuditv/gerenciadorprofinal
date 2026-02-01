import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

type RequestBody = {
  token?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { token }: RequestBody = await req.json().catch(() => ({}));
    const safeToken = (token ?? "").trim();

    if (!safeToken) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from("customer_chat_links")
      .select("id, owner_id, token, is_active, expires_at, created_at, redeemed_at")
      .eq("token", safeToken)
      .maybeSingle();

    if (linkError) {
      console.error("[customer-chat-link-info] linkError:", linkError);
      return new Response(JSON.stringify({ error: "Failed to fetch link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expired = link.expires_at ? new Date(link.expires_at).getTime() < Date.now() : false;
    if (!link.is_active || expired) {
      return new Response(
        JSON.stringify({
          error: expired ? "Link expired" : "Link inactive",
          is_active: false,
          expired,
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: ownerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", link.owner_id)
      .maybeSingle();

    if (profileError) {
      console.warn("[customer-chat-link-info] profileError (ignored):", profileError);
    }

    return new Response(
      JSON.stringify({
        owner_id: link.owner_id,
        is_active: true,
        expires_at: link.expires_at,
        owner: {
          display_name: ownerProfile?.display_name ?? "Atendimento",
          avatar_url: ownerProfile?.avatar_url ?? null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[customer-chat-link-info] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
