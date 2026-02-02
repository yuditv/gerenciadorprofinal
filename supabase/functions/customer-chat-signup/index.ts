import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

type RequestBody = {
  token?: string;
  email?: string;
  password?: string;
  customer_name?: string;
  whatsapp?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { token, email, password, customer_name, whatsapp }: RequestBody = await req
      .json()
      .catch(() => ({}));

    const safeToken = (token ?? "").trim();
    const safeEmail = (email ?? "").trim().toLowerCase();
    const safePassword = (password ?? "").trim();
    const safeName = (customer_name ?? "").trim();
    const safeWhatsapp = (whatsapp ?? "").replace(/\D/g, "");

    if (!safeToken) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!safeWhatsapp || safeWhatsapp.length < 10) {
      return new Response(JSON.stringify({ error: "WhatsApp inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!safePassword || safePassword.length < 6) {
      return new Response(JSON.stringify({ error: "senha inválida" }), {
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
      .select("id, owner_id, is_active, expires_at, customer_user_id")
      .eq("token", safeToken)
      .maybeSingle();

    if (linkError) {
      console.error("[customer-chat-signup] linkError:", linkError);
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

    // Link is single-use per customer
    if (link.customer_user_id) {
      return new Response(JSON.stringify({ error: "Link already redeemed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        full_name: safeName,
        whatsapp: safeWhatsapp,
      },
    });

    if (createError) {
      console.error("[customer-chat-signup] createError:", createError);
      const msg = createError.message || "Failed to create user";
      // Common case: already registered
      const status = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered") ? 409 : 400;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ user_id: created.user?.id ?? null, owner_id: link.owner_id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[customer-chat-signup] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
