import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";

const INFINITEPAY_API = "https://api.infinitepay.io/invoices/public/checkout";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Token inválido" }, 401);

    const body = await req.json();
    const { action } = body;

    console.log(`[infinitepay-checkout] Action: ${action}, User: ${user.id}`);

    if (action === "create") {
      const { planId, amount, description } = body;

      if (!amount || amount <= 0) return json({ error: "Valor inválido" }, 400);

      // Get or create subscription
      let { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!subscription) {
        const { data: newSub, error: subError } = await supabase
          .from("user_subscriptions")
          .insert({
            user_id: user.id,
            status: "trial",
            trial_ends_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();
        if (subError) throw subError;
        subscription = newSub;
      }

      const handle = INFINITEPAY_HANDLE;
      if (!handle) {
        return json({ error: "InfinitePay não configurado (handle ausente)" }, 500);
      }

      const orderNsu = crypto.randomUUID();
      const priceInCents = Math.round(amount * 100);

      const checkoutPayload = {
        handle,
        items: [
          {
            quantity: 1,
            price: priceInCents,
            description: description || `Assinatura GerenciadorPro`,
          },
        ],
        order_nsu: orderNsu,
        redirect_url: `${SUPABASE_URL.replace('.supabase.co', '')}/payment-success`,
        webhook_url: `${SUPABASE_URL}/functions/v1/infinitepay-webhook`,
        customer: {
          name: user.user_metadata?.display_name || user.email || "Cliente",
          email: user.email || "cliente@gerenciadorpro.com",
        },
      };

      console.log("[infinitepay-checkout] Creating checkout:", JSON.stringify(checkoutPayload));

      const ipResponse = await fetch(`${INFINITEPAY_API}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });

      const ipData = await ipResponse.json();

      if (!ipResponse.ok) {
        console.error("[infinitepay-checkout] InfinitePay error:", JSON.stringify(ipData));
        throw new Error(ipData?.message || "Erro ao criar checkout InfinitePay");
      }

      const checkoutUrl = ipData.url || ipData.checkout_url || ipData.link;
      const infinitepaySlug = ipData.slug || ipData.invoice_slug || orderNsu;

      console.log("[infinitepay-checkout] Checkout created:", checkoutUrl);

      // Save payment
      const expirationDate = new Date(Date.now() + 30 * 60 * 1000);
      const { data: payment, error: paymentError } = await supabase
        .from("subscription_payments")
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          plan_id: planId || null,
          amount,
          status: "pending",
          payment_method: "pix",
          external_id: orderNsu,
          checkout_url: checkoutUrl,
          infinitepay_slug: infinitepaySlug,
          expires_at: expirationDate.toISOString(),
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      console.log("[infinitepay-checkout] Payment saved:", payment.id);

      return json({
        success: true,
        payment: {
          ...payment,
          checkout_url: checkoutUrl,
        },
      });
    } else if (action === "check") {
      const { paymentId } = body;

      const { data: payment, error: paymentError } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("user_id", user.id)
        .single();

      if (paymentError || !payment) {
        return json({ error: "Pagamento não encontrado" }, 404);
      }

      if (payment.status === "paid") {
        return json({ success: true, payment });
      }

      // Check with InfinitePay
      const handle = INFINITEPAY_HANDLE;
      if (!handle) return json({ error: "InfinitePay não configurado" }, 500);

      const checkPayload = {
        handle,
        order_nsu: payment.external_id,
        slug: payment.infinitepay_slug || payment.external_id,
      };

      console.log("[infinitepay-checkout] Checking payment:", JSON.stringify(checkPayload));

      const checkResponse = await fetch(`${INFINITEPAY_API}/payment_check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkPayload),
      });

      const checkData = await checkResponse.json();
      console.log("[infinitepay-checkout] Check response:", JSON.stringify(checkData));

      let newStatus = payment.status;

      if (checkData.paid === true || checkData.success === true) {
        newStatus = "paid";

        // Activate subscription
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("duration_months")
          .eq("id", payment.plan_id)
          .single();

        const durationMonths = plan?.duration_months || 1;
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

        await supabase
          .from("user_subscriptions")
          .update({
            status: "active",
            plan_id: payment.plan_id,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            trial_ends_at: null,
          })
          .eq("id", payment.subscription_id);

        console.log("[infinitepay-checkout] Subscription activated");
      } else if (new Date(payment.expires_at) < new Date()) {
        newStatus = "expired";
      }

      const { data: updatedPayment } = await supabase
        .from("subscription_payments")
        .update({
          status: newStatus,
          paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", paymentId)
        .select()
        .single();

      return json({ success: true, payment: updatedPayment });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[infinitepay-checkout] Error:", error);
    return json({ error: errorMessage }, 500);
  }
});
