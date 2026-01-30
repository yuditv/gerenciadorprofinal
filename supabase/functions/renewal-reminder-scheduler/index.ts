// Renewal Reminder Scheduler - Creates scheduled messages for expiring clients
// Supports: 1 day before, on the day, and 1 day after expiration
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function asDataUriPng(base64OrDataUri: string | null | undefined) {
  if (!base64OrDataUri) return null;
  if (base64OrDataUri.startsWith("data:image")) return base64OrDataUri;
  return `data:image/png;base64,${base64OrDataUri}`;
}

function planToDurationDays(plan: string | null | undefined): number {
  const p = (plan || "").toLowerCase();
  if (p.includes("seman")) return 7;
  if (p.includes("quin")) return 15;
  if (p.includes("trimes")) return 90;
  if (p.includes("semes")) return 180;
  if (p.includes("anual")) return 365;
  // default mensal
  return 30;
}

interface ReminderMessages {
  before: string;
  today: string;
  after: string;
}

const defaultMessages: ReminderMessages = {
  before: "Olá {nome}! Seu plano {plano} vence AMANHÃ ({vencimento}). Renove agora para não perder o acesso!",
  today: "Olá {nome}! Seu plano {plano} vence HOJE ({vencimento}). Renove agora para continuar com acesso!",
  after: "Olá {nome}! Seu plano {plano} venceu ontem ({vencimento}). Renove para reativar seu acesso!",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function replaceVariables(template: string, client: any): string {
  const expiresAt = new Date(client.expires_at);
  return template
    .replace(/{nome}/g, client.name || '')
    .replace(/{plano}/g, client.plan || '')
    .replace(/{vencimento}/g, formatDate(expiresAt))
    .replace(/{whatsapp}/g, client.whatsapp || '')
    .replace(/{email}/g, client.email || '');
}

serve(async (req: Request): Promise<Response> => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] === Renewal Reminder Scheduler ===`);

  // Handle CORS preflight
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

    // Get all users with WhatsApp reminders enabled, then filter by auto_send_enabled
    // (so we can log how many were skipped)
    const { data: allSettings, error: settingsError } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("whatsapp_reminders_enabled", true);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw settingsError;
    }

    const totalEnabled = allSettings?.length || 0;
    const eligibleSettings = (allSettings || []).filter(
      (s: any) => s.auto_send_enabled === true
    );

    console.log(
      `Found ${totalEnabled} users with WhatsApp reminders enabled; ` +
      `${eligibleSettings.length} eligible with auto_send_enabled=true; ` +
      `${Math.max(0, totalEnabled - eligibleSettings.length)} skipped (auto_send_enabled=false)`
    );

    if (!eligibleSettings || eligibleSettings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message:
            totalEnabled === 0
              ? "No users with reminders enabled"
              : "No eligible users (auto_send_enabled=false)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      usersProcessed: 0,
      remindersCreated: 0,
      errors: [] as string[],
    };

    for (const setting of eligibleSettings) {
      results.usersProcessed++;
      const userId = setting.user_id;
      // ATLAS policy: send ONLY on the expiration day (prevents 2-3 reminders across days)
      // We intentionally ignore user-configured reminder_days here to ensure a single reminder.
      const reminderDays: number[] = [0];
      
      // Parse custom messages or use defaults
      let reminderMessages: ReminderMessages = defaultMessages;
      if (setting.reminder_messages) {
        const parsed = typeof setting.reminder_messages === 'string' 
          ? JSON.parse(setting.reminder_messages) 
          : setting.reminder_messages;
        reminderMessages = {
          before: parsed.before || defaultMessages.before,
          today: parsed.today || defaultMessages.today,
          after: parsed.after || defaultMessages.after,
        };
      }

      try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        for (const days of reminderDays) {
          // Calculate target date based on relative days
          // days > 0: before expiration (expires in X days)
          // days = 0: on expiration day
          // days < 0: after expiration (expired X days ago)
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() + days);
          
          const nextDay = new Date(targetDate);
          nextDay.setDate(nextDay.getDate() + 1);

          // Find clients expiring on this target date
          const { data: expiringClients, error: clientsError } = await supabase
            .from("clients")
            .select("*")
            .eq("user_id", userId)
            .gte("expires_at", targetDate.toISOString())
            .lt("expires_at", nextDay.toISOString());

          if (clientsError) {
            console.error(`Error fetching clients for user ${userId}:`, clientsError);
            continue;
          }

          if (!expiringClients || expiringClients.length === 0) {
            continue;
          }

           const dayLabel = days > 0 ? `${days} day(s) before` : days === 0 ? 'today' : `${Math.abs(days)} day(s) after`;
          console.log(`Found ${expiringClients.length} clients expiring ${dayLabel} for user ${userId}`);

          for (const client of expiringClients) {
            // Check if we already sent a reminder for this client/day combination today
            const todayStart = new Date(now);
            
            const { data: existingNotification } = await supabase
              .from("notification_history")
              .select("id")
              .eq("user_id", userId)
              .eq("client_id", client.id)
              .eq("days_until_expiration", days)
              .gte("created_at", todayStart.toISOString())
              .limit(1);

            if (existingNotification && existingNotification.length > 0) {
              console.log(`Already sent ${days}-day reminder for client ${client.id} today`);
              continue;
            }

             // Select the appropriate message template based on days
             // (With reminderDays=[0], this will always pick the 'today' template)
             let messageTemplate: string;
             if (days > 0) {
               messageTemplate = reminderMessages.before;
             } else if (days === 0) {
               messageTemplate = reminderMessages.today;
             } else {
               messageTemplate = reminderMessages.after;
             }

            // Replace variables in the message
            const messageBase = replaceVariables(messageTemplate, client);

            const price = Number((client as any).price ?? 0);
            const hasPrice = Number.isFinite(price) && price > 0;

            // If no price, keep current behavior (text only)
            if (!hasPrice) {
              console.log(
                `[renewal-reminder-scheduler] Client ${client.id} expiring today but missing price; scheduling text-only reminder`,
              );
              const { error: insertError } = await supabase
                .from("scheduled_messages")
                .insert({
                  user_id: userId,
                  client_id: client.id,
                  message_type: "renewal_reminder",
                  message_content: messageBase,
                  scheduled_at: new Date().toISOString(),
                  status: "pending",
                });

              if (insertError) {
                console.error(`Error creating scheduled message:`, insertError);
                results.errors.push(`Client ${client.id}: ${insertError.message}`);
              } else {
                results.remindersCreated++;
              }
              continue;
            }

            const durationDays = planToDurationDays((client as any).plan);
            const nowIso = new Date().toISOString();

            // Reuse pending, valid PIX if possible
            const { data: existingPix } = await supabase
              .from("client_pix_payments")
              .select("id, external_id, pix_code, pix_qr_code, expires_at, status")
              .eq("user_id", userId)
              .eq("client_id", client.id)
              .eq("status", "pending")
              .gt("expires_at", nowIso)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            let pixCode: string | null = existingPix?.pix_code ?? null;
            let pixQrCode: string | null = existingPix?.pix_qr_code ?? null;
            let pixExpiresAt: string | null = existingPix?.expires_at ?? null;

            if (!existingPix) {
              console.log(
                `[renewal-reminder-scheduler] No reusable pending PIX for client ${client.id}; creating new PIX`,
              );

              // Fetch user's Mercado Pago credentials
              const { data: credentials, error: credError } = await supabase
                .from("user_payment_credentials")
                .select("mercado_pago_access_token_enc")
                .eq("user_id", userId)
                .maybeSingle();

              if (credError) {
                console.error("Error fetching user_payment_credentials:", credError);
                results.errors.push(`User ${userId}: credential fetch error`);
                continue;
              }

              if (!credentials?.mercado_pago_access_token_enc) {
                console.log(
                  `[renewal-reminder-scheduler] User ${userId} missing Mercado Pago credentials; skipping PIX creation`,
                );
                continue;
              }

              const accessToken = credentials.mercado_pago_access_token_enc;
              const expirationDate = new Date(Date.now() + 30 * 60 * 1000);
              const mpPayload = {
                transaction_amount: Number(price.toFixed(2)),
                description: `Renovação - ${(client as any).plan || "Plano"}`,
                payment_method_id: "pix",
                payer: { email: (client as any).email || "cliente@gerenciadorpro.com" },
                date_of_expiration: expirationDate.toISOString(),
                notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
              };

              const { res: mpResponse, parsed: mpData, raw } = await fetchMercadoPago(
                "https://api.mercadopago.com/v1/payments",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "gerenciadorpro/1.0 (supabase-edge)",
                    Authorization: `Bearer ${accessToken}`,
                    "X-Idempotency-Key": `${userId}-renewal-${client.id}-${Date.now()}`,
                  },
                  body: JSON.stringify(mpPayload),
                },
              );

              if (!mpResponse.ok) {
                if (isPolicyAgentBlock(mpData)) {
                  console.error("[renewal-reminder-scheduler] MP blocked by PolicyAgent", mpData);
                  results.errors.push(`Client ${client.id}: PolicyAgent`);
                  continue;
                }
                console.error("[renewal-reminder-scheduler] MP error", mpData ?? raw?.slice?.(0, 500));
                results.errors.push(`Client ${client.id}: MP error`);
                continue;
              }

              const pixData = mpData?.point_of_interaction?.transaction_data;
              pixCode = pixData?.qr_code || null;
              pixQrCode = asDataUriPng(pixData?.qr_code_base64) || null;
              pixExpiresAt = expirationDate.toISOString();

              const { error: pixInsertErr } = await supabase
                .from("client_pix_payments")
                .insert({
                  user_id: userId,
                  client_id: client.id,
                  client_phone: (client as any).whatsapp,
                  plan_name: (client as any).plan || "Plano",
                  amount: Number(price.toFixed(2)),
                  duration_days: durationDays,
                  expected_plan: (client as any).plan || null,
                  expected_plan_label: (client as any).plan || null,
                  external_id: mpData.id?.toString?.() ?? String(mpData.id),
                  pix_code: pixCode,
                  pix_qr_code: pixQrCode,
                  status: "pending",
                  expires_at: pixExpiresAt,
                });

              if (pixInsertErr) {
                console.error("[renewal-reminder-scheduler] Error inserting client_pix_payments", pixInsertErr);
                results.errors.push(`Client ${client.id}: DB insert pix error`);
                continue;
              }
            } else {
              console.log(`[renewal-reminder-scheduler] Reusing pending PIX ${existingPix.id} for client ${client.id}`);
            }

            const pixInfo = `\n\n💳 *PIX para renovação*\n\n📌 Copia e cola:\n${pixCode || "(indisponível)"}\n\n⏳ Válido até: ${pixExpiresAt ? new Date(pixExpiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ""}`;
            const fullMessage = `${messageBase}${pixInfo}`;

            const { error: insertError } = await supabase
              .from("scheduled_messages")
              .insert({
                user_id: userId,
                client_id: client.id,
                message_type: "renewal_reminder_pix",
                message_content: fullMessage,
                scheduled_at: new Date().toISOString(),
                status: "pending",
              });

            if (insertError) {
              console.error(`Error creating scheduled message:`, insertError);
              results.errors.push(`Client ${client.id}: ${insertError.message}`);
              continue;
            }

            // Record in notification history
            const subjectLabel = days > 0 
              ? `Lembrete de renovação - ${days} dia(s) antes`
              : days === 0 
                ? 'Lembrete de renovação - No dia'
                : `Lembrete de renovação - ${Math.abs(days)} dia(s) após`;

            await supabase
              .from("notification_history")
              .insert({
                user_id: userId,
                client_id: client.id,
                notification_type: "whatsapp_reminder",
                days_until_expiration: days,
                subject: subjectLabel,
                status: "pending",
              });

            results.remindersCreated++;
            console.log(`Created reminder for client ${client.name} (${dayLabel})`);
          }
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        results.errors.push(`User ${userId}: ${String(error)}`);
      }
    }

    console.log(`Processing complete:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
