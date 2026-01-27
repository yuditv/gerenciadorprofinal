import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;

interface CreatePaymentRequest {
  action: "create";
  planId?: string;
  customAmount?: number;
  customDescription?: string;
  conversationId: string;
  clientPhone: string;
  instanceId: string;
}

interface CheckPaymentRequest {
  action: "check";
  paymentId: string;
}

interface ListPaymentsRequest {
  action: "list";
  conversationId: string;
}

type RequestBody = CreatePaymentRequest | CheckPaymentRequest | ListPaymentsRequest;

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

    const body: RequestBody = await req.json();
    const { action } = body;

    console.log(`[generate-client-pix] Action: ${action}, User: ${user.id}`);

    // =========== CREATE PAYMENT ===========
    if (action === "create") {
      const { planId, customAmount, customDescription, conversationId, clientPhone, instanceId } = body as CreatePaymentRequest;

      let amount: number;
      let planName: string;
      let description: string;
      let durationDays: number | null = null;

      // Get amount from plan or custom value
      if (planId) {
        const { data: plan, error: planError } = await supabase
          .from("bot_proxy_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (planError || !plan) {
          return new Response(
            JSON.stringify({ error: "Plano não encontrado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        amount = plan.price;
        planName = plan.name;
        description = `${plan.name} - ${plan.duration_days} dias`;
        durationDays = plan.duration_days;
      } else if (customAmount && customAmount > 0) {
        amount = customAmount;
        planName = "Valor Personalizado";
        description = customDescription || "Pagamento via PIX";
      } else {
        return new Response(
          JSON.stringify({ error: "É necessário informar um plano ou valor personalizado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create payment in Mercado Pago
      const expirationDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      const mpPayload = {
        transaction_amount: amount,
        description: description,
        payment_method_id: "pix",
        payer: {
          email: "cliente@pagamento.com",
        },
        date_of_expiration: expirationDate.toISOString(),
      };

      console.log("[generate-client-pix] Creating MP payment:", JSON.stringify(mpPayload));

      const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
          "X-Idempotency-Key": `${user.id}-${conversationId}-${Date.now()}`,
        },
        body: JSON.stringify(mpPayload),
      });

      const mpData = await mpResponse.json();
      
      if (!mpResponse.ok) {
        console.error("[generate-client-pix] MP Error:", JSON.stringify(mpData));
        throw new Error(mpData.message || "Erro ao criar pagamento no Mercado Pago");
      }

      console.log("[generate-client-pix] MP Payment created:", mpData.id);

      // Extract PIX data
      const pixData = mpData.point_of_interaction?.transaction_data;
      const pixCode = pixData?.qr_code || null;
      const pixQrCode = pixData?.qr_code_base64 
        ? `data:image/png;base64,${pixData.qr_code_base64}` 
        : null;

      // Save payment to database
      const { data: payment, error: paymentError } = await supabase
        .from("client_pix_payments")
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          instance_id: instanceId,
          client_phone: clientPhone,
          plan_id: planId || null,
          plan_name: planName,
          description: description,
          amount: amount,
          duration_days: durationDays,
          status: "pending",
          external_id: mpData.id.toString(),
          pix_code: pixCode,
          pix_qr_code: pixQrCode,
          expires_at: expirationDate.toISOString(),
        })
        .select()
        .single();

      if (paymentError) {
        console.error("[generate-client-pix] DB Error:", paymentError);
        throw paymentError;
      }

      console.log("[generate-client-pix] Payment saved:", payment.id);

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

    // =========== CHECK PAYMENT STATUS ===========
    } else if (action === "check") {
      const { paymentId } = body as CheckPaymentRequest;

      // Get payment from database
      const { data: payment, error: paymentError } = await supabase
        .from("client_pix_payments")
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

      // If already paid, return directly
      if (payment.status === "paid") {
        return new Response(
          JSON.stringify({ success: true, payment }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check status in Mercado Pago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${payment.external_id}`,
        {
          headers: {
            "Authorization": `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
          },
        }
      );

      const mpData = await mpResponse.json();
      console.log("[generate-client-pix] MP Status:", mpData.status);

      let newStatus = payment.status;
      
      if (mpData.status === "approved") {
        newStatus = "paid";
      } else if (mpData.status === "cancelled" || mpData.status === "rejected") {
        newStatus = "failed";
      } else if (new Date(payment.expires_at) < new Date()) {
        newStatus = "expired";
      }

      // Update payment status
      const { data: updatedPayment } = await supabase
        .from("client_pix_payments")
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

    // =========== LIST PAYMENTS ===========
    } else if (action === "list") {
      const { conversationId } = body as ListPaymentsRequest;

      const { data: payments, error: listError } = await supabase
        .from("client_pix_payments")
        .select("*")
        .eq("user_id", user.id)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (listError) {
        throw listError;
      }

      return new Response(
        JSON.stringify({ success: true, payments }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[generate-client-pix] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
