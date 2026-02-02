import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

type RequestBody = {
  token?: string;
  customer_name?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token, customer_name }: RequestBody = await req.json().catch(() => ({}));
    const safeToken = (token ?? "").trim();
    const safeName = (customer_name ?? "").trim();

    if (!safeToken) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!safeName) {
      return new Response(JSON.stringify({ error: "customer_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (safeName.length > 120) {
      return new Response(JSON.stringify({ error: "customer_name too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from("customer_chat_links")
      .select("id, owner_id, token, is_active, expires_at, customer_user_id")
      .eq("token", safeToken)
      .maybeSingle();

    if (linkError) {
      console.error("[customer-chat-redeem-link] linkError:", linkError);
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
        JSON.stringify({ error: expired ? "Link expired" : "Link inactive" }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If link already redeemed by another user, block.
    if (link.customer_user_id && link.customer_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Link already redeemed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Redeem link (idempotent if same customer)
    const { error: redeemError } = await supabaseAdmin
      .from("customer_chat_links")
      .update({
        customer_user_id: user.id,
        customer_name: safeName,
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    if (redeemError) {
      console.error("[customer-chat-redeem-link] redeemError:", redeemError);
      return new Response(JSON.stringify({ error: "Failed to redeem link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure conversation exists
    const { data: existingConversation, error: existingError } = await supabaseAdmin
      .from("customer_conversations")
      .select("id")
      .eq("owner_id", link.owner_id)
      .eq("customer_user_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("[customer-chat-redeem-link] existingError:", existingError);
      return new Response(JSON.stringify({ error: "Failed to fetch conversation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let conversationId = existingConversation?.id as string | undefined;

    if (!conversationId) {
      // Fetch owner's AI preferences to apply auto-start
      const { data: prefs } = await supabaseAdmin
        .from("ai_agent_preferences")
        .select("customer_chat_agent_id, customer_chat_auto_start")
        .eq("user_id", link.owner_id)
        .maybeSingle();

      const shouldAutoStart = prefs?.customer_chat_auto_start && prefs?.customer_chat_agent_id;

      const { data: createdConversation, error: createError } = await supabaseAdmin
        .from("customer_conversations")
        .insert({
          owner_id: link.owner_id,
          customer_user_id: user.id,
          link_id: link.id,
          ai_enabled: shouldAutoStart,
          active_agent_id: shouldAutoStart ? prefs.customer_chat_agent_id : null,
        })
        .select("id")
        .single();

      if (createError || !createdConversation) {
        console.error("[customer-chat-redeem-link] createError:", createError);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversationId = createdConversation.id;
      console.log(`[customer-chat-redeem-link] Created conversation ${conversationId}, AI auto-start: ${shouldAutoStart}`);
    }

    return new Response(
      JSON.stringify({
        owner_id: link.owner_id,
        conversation_id: conversationId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[customer-chat-redeem-link] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
