// Subscription Expiry Scheduler - Sends WhatsApp notifications for expiring subscriptions
// Supports: 3 days before, 1 day before, and on expiration day
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpiryMessage {
  days3Before: string;
  days1Before: string;
  today: string;
}

const defaultMessages: ExpiryMessage = {
  days3Before: "⚠️ *Atenção!*\n\nOlá {nome}!\n\nSua assinatura do plano *{plano}* expira em *3 dias* ({vencimento}).\n\nRenove agora para continuar aproveitando todos os recursos! 🚀",
  days1Before: "🔔 *Último Aviso!*\n\nOlá {nome}!\n\nSua assinatura do plano *{plano}* expira *AMANHÃ* ({vencimento})!\n\nNão perca o acesso - renove agora! ⏰",
  today: "🚨 *Assinatura Expirando Hoje!*\n\nOlá {nome}!\n\nSua assinatura do plano *{plano}* expira *HOJE* ({vencimento})!\n\nRenove imediatamente para não perder o acesso às funcionalidades! ⚡",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function replaceVariables(template: string, userName: string, planName: string, expiresAt: Date): string {
  return template
    .replace(/{nome}/g, userName || 'Cliente')
    .replace(/{plano}/g, planName || 'Premium')
    .replace(/{vencimento}/g, formatDate(expiresAt));
}

/**
 * Format phone number for WhatsApp API - supports international numbers
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length >= 12) return cleaned;
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    if (!areaCode.startsWith('0') && !areaCode.startsWith('1')) {
      return cleaned;
    }
  }
  
  const internationalPrefixes = ['44', '351', '54', '56', '57', '58', '34', '33', '49', '39'];
  for (const prefix of internationalPrefixes) {
    if (cleaned.startsWith(prefix) && cleaned.length >= 10 + prefix.length - 1) {
      return cleaned;
    }
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

async function sendWhatsAppMessage(phone: string, message: string, instanceKey?: string): Promise<boolean> {
  const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
  const UAZAPI_TOKEN = instanceKey || Deno.env.get("UAZAPI_TOKEN");

  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    console.log("[subscription-expiry] UAZAPI not configured");
    return false;
  }

  // Format phone number with international support
  const formattedPhone = formatPhoneNumber(phone);

  try {
    const response = await fetch(`${UAZAPI_URL}/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message,
      }),
    });

    if (response.ok) {
      console.log(`[subscription-expiry] WhatsApp sent to ${formattedPhone}`);
      return true;
    } else {
      console.error(`[subscription-expiry] Failed to send to ${formattedPhone}:`, await response.text());
      return false;
    }
  } catch (error) {
    console.error(`[subscription-expiry] Error sending to ${formattedPhone}:`, error);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] === Subscription Expiry Scheduler ===`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      processed: 0,
      notificationsSent: 0,
      errors: [] as string[],
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Check for subscriptions expiring in 3 days, 1 day, and today
    const checkDays = [3, 1, 0];

    for (const daysUntilExpiry of checkDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysUntilExpiry);
      
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Find active subscriptions expiring on target date
      const { data: expiringSubscriptions, error: subsError } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          user_id,
          status,
          current_period_end,
          plan:subscription_plans(name)
        `)
        .eq("status", "active")
        .gte("current_period_end", targetDate.toISOString())
        .lt("current_period_end", nextDay.toISOString());

      if (subsError) {
        console.error(`[subscription-expiry] Error fetching subscriptions:`, subsError);
        continue;
      }

      if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
        console.log(`[subscription-expiry] No subscriptions expiring in ${daysUntilExpiry} days`);
        continue;
      }

      console.log(`[subscription-expiry] Found ${expiringSubscriptions.length} subscriptions expiring in ${daysUntilExpiry} days`);

      for (const subscription of expiringSubscriptions) {
        results.processed++;

        try {
          // Check if we already sent this notification today
          const todayStart = new Date(now).toISOString();
          
          const { data: existingNotification } = await supabase
            .from("notification_history")
            .select("id")
            .eq("user_id", subscription.user_id)
            .eq("notification_type", "subscription_expiry")
            .eq("days_until_expiration", daysUntilExpiry)
            .gte("created_at", todayStart)
            .limit(1);

          if (existingNotification && existingNotification.length > 0) {
            console.log(`[subscription-expiry] Already sent ${daysUntilExpiry}-day notification for user ${subscription.user_id}`);
            continue;
          }

          // Get user's profile with WhatsApp
          const { data: profile } = await supabase
            .from("profiles")
            .select("whatsapp, display_name")
            .eq("user_id", subscription.user_id)
            .single();

          if (!profile?.whatsapp) {
            console.log(`[subscription-expiry] User ${subscription.user_id} has no WhatsApp`);
            continue;
          }

          // Get user's WhatsApp instance
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("instance_key")
            .eq("user_id", subscription.user_id)
            .eq("status", "connected")
            .limit(1)
            .single();

          // Select appropriate message
          let messageTemplate: string;
          if (daysUntilExpiry === 3) {
            messageTemplate = defaultMessages.days3Before;
          } else if (daysUntilExpiry === 1) {
            messageTemplate = defaultMessages.days1Before;
          } else {
            messageTemplate = defaultMessages.today;
          }

          const expiresAt = new Date(subscription.current_period_end);
          const planName = (subscription.plan as any)?.name || "Premium";
          const message = replaceVariables(messageTemplate, profile.display_name || "", planName, expiresAt);

          // Send WhatsApp message
          const sent = await sendWhatsAppMessage(profile.whatsapp, message, instance?.instance_key);

          if (sent) {
            results.notificationsSent++;

            // Record in notification history
            await supabase
              .from("notification_history")
              .insert({
                user_id: subscription.user_id,
                notification_type: "subscription_expiry",
                days_until_expiration: daysUntilExpiry,
                subject: `Assinatura expira em ${daysUntilExpiry} dia(s)`,
                status: "sent",
              });
          }
        } catch (error) {
          console.error(`[subscription-expiry] Error processing subscription ${subscription.id}:`, error);
          results.errors.push(`Subscription ${subscription.id}: ${String(error)}`);
        }
      }
    }

    console.log(`[subscription-expiry] Complete:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[subscription-expiry] Function error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
