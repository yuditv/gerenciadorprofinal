import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function mapDurationToPlanType(days: number): string {
  if (days <= 7) return "monthly";
  if (days <= 15) return "monthly";
  if (days <= 31) return "monthly";
  if (days <= 93) return "quarterly";
  if (days <= 186) return "semiannual";
  return "annual";
}

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

    if (!profile?.whatsapp) return;

    const userName = profile.display_name || "Cliente";
    const formattedAmount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
    const formattedDate = periodEnd.toLocaleDateString("pt-BR");

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

    if (!UAZAPI_URL || !UAZAPI_TOKEN) return;

    let phone = profile.whatsapp.replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;

    await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
      body: JSON.stringify({ number: phone, text: message }),
    });

    console.log("[infinitepay-webhook] WhatsApp notification sent");
  } catch (error) {
    console.error("[infinitepay-webhook] Error sending WhatsApp notification:", error);
  }
}

async function sendClientPaymentConfirmation(supabase: any, payment: any, clientName: string, expiresAt: Date) {
  try {
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_key")
      .eq("user_id", payment.user_id)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!instance?.instance_key) return;

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    if (!UAZAPI_URL) return;

    const formattedAmount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.amount);
    const formattedDate = expiresAt.toLocaleDateString("pt-BR");

    const message = `✅ *Pagamento Confirmado!*\n\n📋 *Plano:* ${payment.plan_name}\n💰 *Valor:* ${formattedAmount}\n📅 *Válido até:* ${formattedDate}\n\nVocê foi cadastrado no nosso sistema!\n\nObrigado pela compra! 🎉`;

    let phone = payment.client_phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;

    const response = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instance.instance_key },
      body: JSON.stringify({ number: phone, text: message }),
    });

    if (response.ok && payment.conversation_id) {
      await supabase.from("chat_inbox_messages").insert({
        conversation_id: payment.conversation_id,
        content: message,
        sender_type: "agent",
        sender_id: payment.user_id,
        metadata: { payment_confirmation: true, payment_id: payment.id },
      });
    }
  } catch (error) {
    console.error("[infinitepay-webhook] Error sending client confirmation:", error);
  }
}

async function processClientPixPayment(supabase: any, payment: any) {
  try {
    console.log("[infinitepay-webhook] Processing client PIX payment:", payment.id);

    const paidAtIso = new Date().toISOString();
    await supabase.from("client_pix_payments").update({ status: "paid", paid_at: paidAtIso }).eq("id", payment.id);

    if (payment.client_id) {
      if (payment.renewal_applied_at) return;

      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select("id, name, whatsapp, expires_at, plan")
        .eq("id", payment.client_id)
        .eq("user_id", payment.user_id)
        .maybeSingle();

      if (clientErr || !client) {
        await supabase.from("client_pix_payments").update({ renewal_error: "Cliente não encontrado" }).eq("id", payment.id);
        return;
      }

      const durationDays = Number(payment.duration_days || 30);
      const now = new Date();
      const currentExpiry = client.expires_at ? new Date(client.expires_at) : null;
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
      const newExpiresAt = new Date(base);
      newExpiresAt.setDate(newExpiresAt.getDate() + durationDays);

      const { error: updErr } = await supabase.from("clients").update({ expires_at: newExpiresAt.toISOString() }).eq("id", client.id);

      if (updErr) {
        await supabase.from("client_pix_payments").update({ renewal_error: updErr.message }).eq("id", payment.id);
        return;
      }

      await supabase.from("renewal_history").insert({
        user_id: payment.user_id,
        client_id: client.id,
        plan: client.plan,
        previous_expires_at: client.expires_at,
        new_expires_at: newExpiresAt.toISOString(),
      });

      await supabase.from("client_pix_payments").update({ renewal_applied_at: paidAtIso, renewal_error: null }).eq("id", payment.id);

      // Notify owner
      try {
        const supabaseInternal = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
        });

        const formattedAmount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(payment.amount || 0));
        const formattedDate = newExpiresAt.toLocaleDateString("pt-BR");
        await supabaseInternal.functions.invoke("send-owner-notification", {
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
      } catch (e) {
        console.error("[infinitepay-webhook] Error invoking send-owner-notification:", e);
      }

      console.log(`[infinitepay-webhook] Renewal applied for client ${client.id}`);
      return;
    }

    // Legacy: auto-register client
    const { data: memory } = await supabase
      .from("ai_client_memories")
      .select("client_name, app_name, device, plan_name")
      .eq("phone", payment.client_phone)
      .eq("user_id", payment.user_id)
      .maybeSingle();

    let contactName = null;
    if (payment.conversation_id) {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("contact_name")
        .eq("id", payment.conversation_id)
        .maybeSingle();
      contactName = conversation?.contact_name;
    }

    const clientName = memory?.client_name || contactName || `Cliente ${payment.client_phone.slice(-4)}`;
    const service = memory?.app_name ? "IPTV" : "VPN";
    const planType = mapDurationToPlanType(payment.duration_days || 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (payment.duration_days || 30));

    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", payment.user_id)
      .eq("whatsapp", payment.client_phone)
      .maybeSingle();

    if (existingClient) {
      await supabase
        .from("clients")
        .update({
          name: clientName,
          service,
          plan: planType,
          price: payment.amount,
          app_name: memory?.app_name || null,
          device: memory?.device || null,
          expires_at: expiresAt.toISOString(),
          notes: `Renovado via PIX em ${new Date().toLocaleDateString("pt-BR")} - ${payment.plan_name}`,
        })
        .eq("id", existingClient.id);
    } else {
      await supabase.from("clients").insert({
        user_id: payment.user_id,
        name: clientName,
        whatsapp: payment.client_phone,
        email: `${payment.client_phone}@cliente.local`,
        service,
        plan: planType,
        price: payment.amount,
        app_name: memory?.app_name || null,
        device: memory?.device || null,
        expires_at: expiresAt.toISOString(),
        notes: `Cadastrado via PIX em ${new Date().toLocaleDateString("pt-BR")} - ${payment.plan_name}`,
      });
    }

    // Add "COMPRA FINALIZADA" label
    if (payment.conversation_id) {
      let { data: label } = await supabase
        .from("inbox_labels")
        .select("id")
        .eq("user_id", payment.user_id)
        .ilike("name", "COMPRA FINALIZADA")
        .maybeSingle();

      if (!label) {
        const { data: newLabel } = await supabase
          .from("inbox_labels")
          .insert({ user_id: payment.user_id, name: "COMPRA FINALIZADA", color: "#10b981", description: "Clientes que finalizaram a compra via PIX" })
          .select("id")
          .single();
        label = newLabel;
      }

      if (label) {
        const { data: existingLabel } = await supabase
          .from("conversation_labels")
          .select("id")
          .eq("conversation_id", payment.conversation_id)
          .eq("label_id", label.id)
          .maybeSingle();

        if (!existingLabel) {
          await supabase.from("conversation_labels").insert({ conversation_id: payment.conversation_id, label_id: label.id });
        }
      }
    }

    await sendClientPaymentConfirmation(supabase, payment, clientName, expiresAt);
    console.log("[infinitepay-webhook] Client PIX payment processed successfully");
  } catch (error) {
    console.error("[infinitepay-webhook] Error processing client PIX payment:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    console.log("[infinitepay-webhook] Received:", JSON.stringify(body));

    // InfinitePay sends: { invoice_slug, amount, paid_amount, capture_method, transaction_nsu, order_nsu, receipt_url, items }
    const orderNsu = body.order_nsu;
    const invoiceSlug = body.invoice_slug;

    if (!orderNsu && !invoiceSlug) {
      console.log("[infinitepay-webhook] No order_nsu or invoice_slug in payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find payment by external_id (order_nsu) or infinitepay_slug
    const { data: subscriptionPayment } = await supabase
      .from("subscription_payments")
      .select("*, subscription:user_subscriptions(*)")
      .or(`external_id.eq.${orderNsu},infinitepay_slug.eq.${invoiceSlug}`)
      .maybeSingle();

    const { data: clientPayment } = await supabase
      .from("client_pix_payments")
      .select("*")
      .or(`external_id.eq.${orderNsu},infinitepay_slug.eq.${invoiceSlug}`)
      .maybeSingle();

    const { data: walletTopup } = await supabase
      .from("wallet_topups")
      .select("*")
      .or(`external_id.eq.${orderNsu},infinitepay_slug.eq.${invoiceSlug}`)
      .maybeSingle();

    // Process subscription payment
    if (subscriptionPayment && subscriptionPayment.status !== "paid") {
      console.log("[infinitepay-webhook] Processing subscription payment");

      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("duration_months, name")
        .eq("id", subscriptionPayment.plan_id)
        .single();

      const durationMonths = plan?.duration_months || 1;
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

      await supabase
        .from("subscription_payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", subscriptionPayment.id);

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

      console.log("[infinitepay-webhook] Subscription activated");

      await sendPaymentConfirmationWhatsApp(
        supabase,
        subscriptionPayment.subscription?.user_id || subscriptionPayment.user_id,
        plan?.name || "Premium",
        (body.paid_amount || body.amount || 0) / 100, // cents to BRL
        periodEnd
      );

      return new Response(JSON.stringify({ received: true, type: "subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process client PIX payment
    if (clientPayment && (clientPayment.status !== "paid" || !clientPayment.renewal_applied_at)) {
      console.log("[infinitepay-webhook] Processing client PIX payment");
      await processClientPixPayment(supabase, clientPayment);
      return new Response(JSON.stringify({ received: true, type: "client_pix" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process wallet topup
    if (walletTopup && walletTopup.status !== "paid") {
      console.log("[infinitepay-webhook] Processing wallet topup:", walletTopup.id);

      await supabase.from("wallet_topups").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", walletTopup.id);

      const { data: existingWallet } = await supabase
        .from("user_wallets")
        .select("credits")
        .eq("user_id", walletTopup.user_id)
        .maybeSingle();

      const current = Number(existingWallet?.credits ?? 0);
      const nextCredits = Number((current + Number(walletTopup.credits)).toFixed(2));

      await supabase.from("user_wallets").upsert({ user_id: walletTopup.user_id, credits: nextCredits }, { onConflict: "user_id" });

      await supabase.from("wallet_transactions").insert({
        user_id: walletTopup.user_id,
        type: "topup",
        credits: Number(walletTopup.credits),
        amount_brl: Number(walletTopup.amount_brl),
        reference_type: "wallet_topup",
        reference_id: walletTopup.id,
      });

      return new Response(JSON.stringify({ received: true, type: "wallet_topup" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[infinitepay-webhook] Payment not found or already processed");
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[infinitepay-webhook] Error:", error);
    // Always return 200 so InfinitePay doesn't retry
    return new Response(JSON.stringify({ received: true, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
