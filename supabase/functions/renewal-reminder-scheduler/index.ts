// Renewal Reminder Scheduler - Creates scheduled messages for expiring clients
// Supports: 1 day before, on the day, and 1 day after expiration
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
            const message = replaceVariables(messageTemplate, client);

            const { error: insertError } = await supabase
              .from("scheduled_messages")
              .insert({
                user_id: userId,
                client_id: client.id,
                message_type: "renewal_reminder",
                message_content: message,
                scheduled_at: new Date().toISOString(), // Send immediately
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
