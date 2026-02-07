// Generate PIX for client using USER'S InfinitePay handle
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INFINITEPAY_API = "https://api.infinitepay.io/invoices/public/checkout";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      client_id,
      client_phone,
      plan_name,
      expected_plan,
      expected_plan_label,
      amount,
      duration_days,
      description,
      conversation_id,
      instance_id,
    } = await req.json();

    if (!client_phone || !plan_name || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-client-pix-v2] User ${user.id} generating checkout for ${client_phone}, R$${amount}`);

    // Fetch user's InfinitePay handle (fallback to system secret)
    const { data: credentials } = await supabase
      .from("user_payment_credentials")
      .select("infinitepay_handle")
      .eq("user_id", user.id)
      .maybeSingle();

    const userHandle = credentials?.infinitepay_handle || Deno.env.get("INFINITEPAY_HANDLE") || "";

    if (!userHandle) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Você precisa configurar seu Handle InfinitePay em Configurações > Credenciais"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const handle = userHandle;
    const orderNsu = crypto.randomUUID();
    const priceInCents = Math.round(Number(amount) * 100);

    const checkoutPayload = {
      handle,
      items: [
        {
          quantity: 1,
          price: priceInCents,
          description: description || `Pagamento - ${plan_name}`,
        },
      ],
      order_nsu: orderNsu,
      webhook_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`,
      customer: {
        phone_number: client_phone,
      },
    };

    console.log("[generate-client-pix-v2] Creating InfinitePay checkout...");

    const ipResponse = await fetch(`${INFINITEPAY_API}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    });

    const ipData = await ipResponse.json();

    if (!ipResponse.ok) {
      console.error("[generate-client-pix-v2] InfinitePay error:", JSON.stringify(ipData));
      return new Response(
        JSON.stringify({
          success: false,
          error: ipData?.message || "Erro ao gerar checkout InfinitePay"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkoutUrl = ipData.url || ipData.checkout_url || ipData.link;
    const infinitepaySlug = ipData.slug || ipData.invoice_slug || orderNsu;

    console.log(`[generate-client-pix-v2] Checkout created: ${checkoutUrl}`);

    // Store in client_pix_payments
    const { data: payment, error: paymentError } = await supabase
      .from("client_pix_payments")
      .insert({
        user_id: user.id,
        client_id: client_id || null,
        client_phone,
        plan_name,
        amount: Number(amount),
        duration_days: duration_days || null,
        description: description || null,
        conversation_id: conversation_id || null,
        instance_id: instance_id || null,
        expected_plan: expected_plan || null,
        expected_plan_label: expected_plan_label || null,
        external_id: orderNsu,
        checkout_url: checkoutUrl,
        infinitepay_slug: infinitepaySlug,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error("[generate-client-pix-v2] Error storing payment:", paymentError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar pagamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          id: payment.id,
          checkout_url: checkoutUrl,
          amount: Number(amount),
          expires_at: payment.expires_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-client-pix-v2] Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
