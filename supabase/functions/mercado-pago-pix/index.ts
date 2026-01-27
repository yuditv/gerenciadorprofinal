import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, planId, amount, description, paymentId } = body;

    console.log(`[mercado-pago-pix] Action: ${action}, User: ${user.id}`);

    if (action === "create") {
      // Buscar ou criar subscription do usuário
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
            trial_ends_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (subError) throw subError;
        subscription = newSub;
      }

      // Criar pagamento no Mercado Pago
      const expirationDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
      
      const mpPayload = {
        transaction_amount: amount,
        description: description || `Assinatura GerenciadorPro`,
        payment_method_id: "pix",
        payer: {
          email: user.email || "cliente@gerenciadorpro.com",
        },
        date_of_expiration: expirationDate.toISOString(),
      };

      console.log("[mercado-pago-pix] Creating payment:", JSON.stringify(mpPayload));

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
          "X-Idempotency-Key": `${user.id}-${planId}-${Date.now()}`,
        },
        body: JSON.stringify(mpPayload),
      });

      const mpData = await mpResponse.json();
      
      if (!mpResponse.ok) {
        console.error("[mercado-pago-pix] MP Error:", JSON.stringify(mpData));
        throw new Error(mpData.message || "Erro ao criar pagamento no Mercado Pago");
      }

      console.log("[mercado-pago-pix] MP Payment created:", mpData.id);

      // Extrair dados do PIX
      const pixData = mpData.point_of_interaction?.transaction_data;
      const pixCode = pixData?.qr_code || null;
      const pixQrCode = pixData?.qr_code_base64 
        ? `data:image/png;base64,${pixData.qr_code_base64}` 
        : null;

      // Salvar pagamento no banco
      const { data: payment, error: paymentError } = await supabase
        .from("subscription_payments")
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          plan_id: planId,
          amount: amount,
          status: "pending",
          payment_method: "pix",
          external_id: mpData.id.toString(),
          pix_code: pixCode,
          pix_qr_code: pixQrCode,
          expires_at: expirationDate.toISOString(),
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      console.log("[mercado-pago-pix] Payment saved:", payment.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          payment: {
            ...payment,
            pix_code: pixCode,
            pix_qr_code: pixQrCode,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "check") {
      // Buscar pagamento no banco
      const { data: payment, error: paymentError } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("user_id", user.id)
        .single();

      if (paymentError || !payment) {
        return new Response(
          JSON.stringify({ error: "Pagamento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se já está pago, retorna direto
      if (payment.status === "paid") {
        return new Response(
          JSON.stringify({ success: true, payment }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar status no Mercado Pago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${payment.external_id}`,
        {
          headers: {
            "Authorization": `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
          },
        }
      );

      const mpData = await mpResponse.json();
      console.log("[mercado-pago-pix] MP Status:", mpData.status);

      let newStatus = payment.status;
      
      if (mpData.status === "approved") {
        newStatus = "paid";
        
        // Atualizar subscription
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

        console.log("[mercado-pago-pix] Subscription activated");

      } else if (mpData.status === "cancelled" || mpData.status === "rejected") {
        newStatus = "failed";
      } else if (new Date(payment.expires_at) < new Date()) {
        newStatus = "expired";
      }

      // Atualizar status do pagamento
      const { data: updatedPayment } = await supabase
        .from("subscription_payments")
        .update({ 
          status: newStatus,
          paid_at: newStatus === "paid" ? new Date().toISOString() : null
        })
        .eq("id", paymentId)
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, payment: updatedPayment }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[mercado-pago-pix] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
