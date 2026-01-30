import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type MpErrorShape = {
  message?: string;
  blocked_by?: string;
  status?: number;
  code?: string;
};

async function fetchMercadoPago(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const raw = await res.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return { res, raw, parsed };
  } finally {
    clearTimeout(timeout);
  }
}

function isPolicyAgentBlock(payload: any): payload is MpErrorShape {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as any).blocked_by === "PolicyAgent" &&
      (payload as any).code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
  );
}

// Map duration days to plan type
function mapDurationToPlanType(days: number): string {
  if (days <= 7) return 'monthly'; // Semanal mapped to monthly
  if (days <= 15) return 'monthly'; // Quinzenal mapped to monthly  
  if (days <= 31) return 'monthly';
  if (days <= 93) return 'quarterly';
  if (days <= 186) return 'semiannual';
  return 'annual';
}

// Send WhatsApp notification to user (for subscription payments)
async function sendPaymentConfirmationWhatsApp(
  supabase: any,
  userId: string,
  planName: string,
  amount: number,
  periodEnd: Date
) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp, display_name")
      .eq("user_id", userId)
      .single();

    if (!profile?.whatsapp) {
      console.log("[mercado-pago-webhook] User has no WhatsApp configured");
      return;
    }

    const userName = profile.display_name || "Cliente";
    const formattedAmount = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(amount);
    const formattedDate = periodEnd.toLocaleDateString('pt-BR');

    const message = `✅ *Pagamento Confirmado!*\n\nOlá ${userName}!\n\nSeu pagamento de ${formattedAmount} para o plano *${planName}* foi confirmado com sucesso!\n\n📅 Válido até: ${formattedDate}\n\nObrigado por renovar conosco! 🚀`;

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_key")
      .eq("user_id", userId)
      .eq("status", "connected")
      .limit(1)
      .single();

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = instance?.instance_key || Deno.env.get("UAZAPI_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_TOKEN) {
      console.log("[mercado-pago-webhook] UAZAPI not configured, skipping WhatsApp notification");
      return;
    }

    let phone = profile.whatsapp.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    const response = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (response.ok) {
      console.log("[mercado-pago-webhook] WhatsApp notification sent successfully");
    } else {
      console.error("[mercado-pago-webhook] Failed to send WhatsApp:", await response.text());
    }
  } catch (error) {
    console.error("[mercado-pago-webhook] Error sending WhatsApp notification:", error);
  }
}

// Process client PIX payment.
// If payment has client_id: renewal flow (extend expires_at idempotently + owner notification).
// Otherwise: legacy flow (register/update client + label).
async function processClientPixPayment(
  supabase: any,
  payment: any,
  mpData: any,
) {
  try {
    console.log("[mercado-pago-webhook] Processing client PIX payment:", payment.id);

    const paidAtIso = new Date().toISOString();

    // Always mark paid (idempotent)
    await supabase
      .from("client_pix_payments")
      .update({ status: "paid", paid_at: paidAtIso })
      .eq("id", payment.id);

    // Renewal flow
    if (payment.client_id) {
      // If already applied, skip
      if (payment.renewal_applied_at) {
        console.log(
          `[mercado-pago-webhook] Renewal already applied for payment ${payment.id} at ${payment.renewal_applied_at}`,
        );
        return;
      }

      // Fetch client
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select("id, name, whatsapp, expires_at, plan")
        .eq("id", payment.client_id)
        .eq("user_id", payment.user_id)
        .maybeSingle();

      if (clientErr || !client) {
        const msg = `Cliente não encontrado para client_id=${payment.client_id}`;
        console.error("[mercado-pago-webhook]", msg, clientErr);
        await supabase
          .from("client_pix_payments")
          .update({ renewal_error: msg })
          .eq("id", payment.id);
        return;
      }

      const durationDays = Number(payment.duration_days || 30);
      const now = new Date();
      const currentExpiry = client.expires_at ? new Date(client.expires_at) : null;
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
      const newExpiresAt = new Date(base);
      newExpiresAt.setDate(newExpiresAt.getDate() + durationDays);

      // Update client expiry
      const { error: updErr } = await supabase
        .from("clients")
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq("id", client.id);

      if (updErr) {
        const msg = `Falha ao atualizar expires_at: ${updErr.message}`;
        console.error("[mercado-pago-webhook]", msg);
        await supabase
          .from("client_pix_payments")
          .update({ renewal_error: msg })
          .eq("id", payment.id);
        return;
      }

      // renewal_history is optional; if missing, don't block
      const { error: rhErr } = await supabase.from("renewal_history").insert({
        user_id: payment.user_id,
        client_id: client.id,
        plan: client.plan,
        previous_expires_at: client.expires_at,
        new_expires_at: newExpiresAt.toISOString(),
      });
      if (rhErr) {
        console.log("[mercado-pago-webhook] renewal_history insert skipped/failed:", rhErr.message);
      }

      await supabase
        .from("client_pix_payments")
        .update({ renewal_applied_at: paidAtIso, renewal_error: null })
        .eq("id", payment.id);

      // Notify owner (internal function; requires service role bearer)
      try {
        const supabaseInternal = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
        });

        const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          Number(mpData?.transaction_amount ?? payment.amount ?? 0),
        );
        const formattedDate = newExpiresAt.toLocaleDateString('pt-BR');
        const { error: notifyErr } = await supabaseInternal.functions.invoke("send-owner-notification", {
          body: {
            userId: payment.user_id,
            eventType: "payment_proof",
            contactName: client.name,
            contactPhone: client.whatsapp,
            conversationId: payment.conversation_id || undefined,
            instanceId: payment.instance_id || undefined,
            urgency: "medium",
            summary: `PIX aprovado (${formattedAmount}) — Renovado até ${formattedDate}`,
          },
        });
        if (notifyErr) {
          console.error("[mercado-pago-webhook] send-owner-notification returned error:", notifyErr);
        }
      } catch (e) {
        console.error("[mercado-pago-webhook] Error invoking send-owner-notification:", e);
      }

      console.log(
        `[mercado-pago-webhook] Renewal applied for client ${client.id}: ${client.expires_at} -> ${newExpiresAt.toISOString()}`,
      );
      return;
    }

    // Get AI memory for client details
    const { data: memory } = await supabase
      .from("ai_client_memories")
      .select("client_name, app_name, device, plan_name")
      .eq("phone", payment.client_phone)
      .eq("user_id", payment.user_id)
      .maybeSingle();

    // Get conversation for contact name
    let contactName = null;
    if (payment.conversation_id) {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("contact_name")
        .eq("id", payment.conversation_id)
        .maybeSingle();
      contactName = conversation?.contact_name;
    }

    // Determine client name
    const clientName = memory?.client_name || 
                       contactName || 
                       `Cliente ${payment.client_phone.slice(-4)}`;

    // Determine service type
    const service = memory?.app_name ? 'IPTV' : 'VPN';

    // Map duration to plan type
    const planType = mapDurationToPlanType(payment.duration_days || 30);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (payment.duration_days || 30));

    // Check if client already exists
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", payment.user_id)
      .eq("whatsapp", payment.client_phone)
      .maybeSingle();

    if (existingClient) {
      // Update existing client
      console.log("[mercado-pago-webhook] Updating existing client:", existingClient.id);
      await supabase
        .from("clients")
        .update({
          name: clientName,
          service: service,
          plan: planType,
          price: payment.amount,
          app_name: memory?.app_name || null,
          device: memory?.device || null,
          expires_at: expiresAt.toISOString(),
          notes: `Renovado via PIX em ${new Date().toLocaleDateString('pt-BR')} - ${payment.plan_name}`,
        })
        .eq("id", existingClient.id);
    } else {
      // Create new client
      console.log("[mercado-pago-webhook] Creating new client for:", clientName);
      await supabase
        .from("clients")
        .insert({
          user_id: payment.user_id,
          name: clientName,
          whatsapp: payment.client_phone,
          email: `${payment.client_phone}@cliente.local`, // Placeholder email
          service: service,
          plan: planType,
          price: payment.amount,
          app_name: memory?.app_name || null,
          device: memory?.device || null,
          expires_at: expiresAt.toISOString(),
          notes: `Cadastrado via PIX em ${new Date().toLocaleDateString('pt-BR')} - ${payment.plan_name}`,
        });
    }

    // Add "COMPRA FINALIZADA" label
    if (payment.conversation_id) {
      // Find or create the label
      let { data: label } = await supabase
        .from("inbox_labels")
        .select("id")
        .eq("user_id", payment.user_id)
        .ilike("name", "COMPRA FINALIZADA")
        .maybeSingle();

      if (!label) {
        console.log("[mercado-pago-webhook] Creating 'COMPRA FINALIZADA' label");
        const { data: newLabel } = await supabase
          .from("inbox_labels")
          .insert({
            user_id: payment.user_id,
            name: "COMPRA FINALIZADA",
            color: "#10b981", // Green
            description: "Clientes que finalizaram a compra via PIX"
          })
          .select("id")
          .single();
        label = newLabel;
      }

      if (label) {
        // Check if label already exists on conversation
        const { data: existingLabel } = await supabase
          .from("conversation_labels")
          .select("id")
          .eq("conversation_id", payment.conversation_id)
          .eq("label_id", label.id)
          .maybeSingle();

        if (!existingLabel) {
          console.log("[mercado-pago-webhook] Adding label to conversation");
          await supabase
            .from("conversation_labels")
            .insert({
              conversation_id: payment.conversation_id,
              label_id: label.id
            });
        }
      }
    }

    // Send confirmation WhatsApp to client
    await sendClientPaymentConfirmation(
      supabase,
      payment,
      clientName,
      expiresAt
    );

    console.log("[mercado-pago-webhook] Client PIX payment processed successfully");

  } catch (error) {
    console.error("[mercado-pago-webhook] Error processing client PIX payment:", error);
  }
}

// Send WhatsApp confirmation to client
async function sendClientPaymentConfirmation(
  supabase: any,
  payment: any,
  clientName: string,
  expiresAt: Date
) {
  try {
    // Get user's WhatsApp instance
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_key")
      .eq("user_id", payment.user_id)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!instance?.instance_key) {
      console.log("[mercado-pago-webhook] No connected instance for user");
      return;
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    if (!UAZAPI_URL) {
      console.log("[mercado-pago-webhook] UAZAPI_URL not configured");
      return;
    }

    const formattedAmount = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(payment.amount);
    const formattedDate = expiresAt.toLocaleDateString('pt-BR');

    const message = `✅ *Pagamento Confirmado!*

📋 *Plano:* ${payment.plan_name}
💰 *Valor:* ${formattedAmount}
📅 *Válido até:* ${formattedDate}

Você foi cadastrado no nosso sistema!

Obrigado pela compra! 🎉`;

    // Format phone
    let phone = payment.client_phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    const response = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instance.instance_key,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (response.ok) {
      console.log("[mercado-pago-webhook] Client confirmation sent successfully");
      
      // Save message to inbox
      if (payment.conversation_id) {
        await supabase
          .from("chat_inbox_messages")
          .insert({
            conversation_id: payment.conversation_id,
            content: message,
            sender_type: 'agent',
            sender_id: payment.user_id,
            metadata: {
              payment_confirmation: true,
              payment_id: payment.id
            }
          });
      }
    } else {
      console.error("[mercado-pago-webhook] Failed to send client confirmation:", await response.text());
    }
  } catch (error) {
    console.error("[mercado-pago-webhook] Error sending client confirmation:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // SECURITY: Validate the request comes from Mercado Pago
    // Mercado Pago sends webhooks with specific headers and structure
    // We validate by checking:
    // 1. Request has expected structure (type, action, data.id)
    // 2. Payment exists in Mercado Pago API (confirms authenticity)
    
    const body = await req.json();
    
    console.log("[mercado-pago-webhook] Received:", JSON.stringify(body));

    // Basic structure validation
    if (!body || typeof body !== 'object') {
      console.log("[mercado-pago-webhook] Invalid request structure");
      return new Response(
        JSON.stringify({ received: true, error: 'Invalid request structure' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify notification type - only process payment.updated events
    if (body.type !== "payment" || body.action !== "payment.updated") {
      console.log("[mercado-pago-webhook] Ignoring notification type:", body.type, body.action);
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalPaymentId = body.data?.id;
    if (!externalPaymentId) {
      console.log("[mercado-pago-webhook] No payment ID in notification");
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which access token to use by checking our DB first.
    const globalMpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "";

    const { data: subscriptionPayment } = await supabase
      .from("subscription_payments")
      .select("*, subscription:user_subscriptions(*)")
      .eq("external_id", externalPaymentId.toString())
      .maybeSingle();

    const { data: clientPayment } = await supabase
      .from("client_pix_payments")
      .select("*")
      .eq("external_id", externalPaymentId.toString())
      .maybeSingle();

    const { data: walletTopup } = await supabase
      .from("wallet_topups")
      .select("*")
      .eq("external_id", externalPaymentId.toString())
      .maybeSingle();

    let mpAccessToken = globalMpToken;
    if (clientPayment) {
      const { data: creds } = await supabase
        .from("user_payment_credentials")
        .select("mercado_pago_access_token_enc")
        .eq("user_id", clientPayment.user_id)
        .maybeSingle();

      if (!creds?.mercado_pago_access_token_enc) {
        console.error(
          `[mercado-pago-webhook] Missing Mercado Pago credentials for user ${clientPayment.user_id} (client_pix_payments)`,
        );
        return new Response(
          JSON.stringify({ received: true, error: "Missing user Mercado Pago credentials" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      mpAccessToken = creds.mercado_pago_access_token_enc;
    }

    if (!mpAccessToken) {
      console.error("[mercado-pago-webhook] No Mercado Pago token available");
      return new Response(
        JSON.stringify({ received: true, error: "Mercado Pago not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate payment exists in Mercado Pago using the correct token
    const { res: mpResponse, parsed: mpData, raw } = await fetchMercadoPago(
      `https://api.mercadopago.com/v1/payments/${externalPaymentId}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "gerenciadorpro/1.0 (supabase-edge)",
          Authorization: `Bearer ${mpAccessToken}`,
        },
      },
    );

    if (!mpResponse.ok) {
      const status = mpResponse.status;
      console.error(`[mercado-pago-webhook] Payment validation failed: status ${status}`);
      if (isPolicyAgentBlock(mpData)) {
        console.error("[mercado-pago-webhook] MP blocked by PolicyAgent", mpData);
        return new Response(
          JSON.stringify({ received: true, error: "PolicyAgent" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("[mercado-pago-webhook] MP error", mpData ?? raw?.slice?.(0, 500));
      return new Response(
        JSON.stringify({ received: true, error: "Payment validation failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[mercado-pago-webhook] MP Status:", mpData?.status);

    if (mpData.status !== "approved") {
      console.log("[mercado-pago-webhook] Payment not approved, ignoring");
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscriptionPayment && subscriptionPayment.status !== "paid") {
      console.log("[mercado-pago-webhook] Processing subscription payment");
      
      // Get plan duration
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("duration_months, name")
        .eq("id", subscriptionPayment.plan_id)
        .single();

      const durationMonths = plan?.duration_months || 1;
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

      // Update payment
      await supabase
        .from("subscription_payments")
        .update({ 
          status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", subscriptionPayment.id);

      // Update subscription
      await supabase
        .from("user_subscriptions")
        .update({
          status: "active",
          plan_id: subscriptionPayment.plan_id,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: null,
        })
        .eq("id", subscriptionPayment.subscription_id);

      console.log("[mercado-pago-webhook] Subscription activated successfully");

      // Send WhatsApp notification to user
      await sendPaymentConfirmationWhatsApp(
        supabase,
        subscriptionPayment.subscription.user_id,
        plan?.name || "Premium",
        mpData.transaction_amount || subscriptionPayment.amount,
        periodEnd
      );

      return new Response(
        JSON.stringify({ received: true, type: "subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (clientPayment && (clientPayment.status !== "paid" || !clientPayment.renewal_applied_at)) {
      console.log("[mercado-pago-webhook] Processing client PIX payment");
      
      await processClientPixPayment(supabase, clientPayment, mpData);

      return new Response(
        JSON.stringify({ received: true, type: "client_pix" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (walletTopup && walletTopup.status !== "paid") {
      console.log("[mercado-pago-webhook] Processing wallet topup:", walletTopup.id);

      // Mark paid
      await supabase
        .from("wallet_topups")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", walletTopup.id);

      // Upsert wallet balance
      const { data: existingWallet } = await supabase
        .from("user_wallets")
        .select("credits")
        .eq("user_id", walletTopup.user_id)
        .maybeSingle();

      const current = Number(existingWallet?.credits ?? 0);
      const nextCredits = Number((current + Number(walletTopup.credits)).toFixed(2));

      await supabase
        .from("user_wallets")
        .upsert({ user_id: walletTopup.user_id, credits: nextCredits }, { onConflict: "user_id" });

      // Ledger
      await supabase.from("wallet_transactions").insert({
        user_id: walletTopup.user_id,
        type: "topup",
        credits: Number(walletTopup.credits),
        amount_brl: Number(walletTopup.amount_brl),
        reference_type: "wallet_topup",
        reference_id: walletTopup.id,
      });

      return new Response(
        JSON.stringify({ received: true, type: "wallet_topup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[mercado-pago-webhook] Payment not found or already processed:", externalPaymentId);
    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[mercado-pago-webhook] Error:", error);
    // Always return 200 so Mercado Pago doesn't retry
    return new Response(
      JSON.stringify({ received: true, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

