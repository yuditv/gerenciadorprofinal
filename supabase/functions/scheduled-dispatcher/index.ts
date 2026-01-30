// Scheduled Dispatcher Edge Function - Processes pending scheduled messages
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request): Promise<Response> => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] === Scheduled Dispatcher Function ===`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const uazapiUrl = Deno.env.get("UAZAPI_URL") || "https://zynk2.uazapi.com";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Use service role to access all pending messages
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending messages that should be sent now
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select(`
        *,
        clients (
          id,
          name,
          whatsapp,
          email,
          plan,
          expires_at
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50); // Process max 50 at a time

    if (fetchError) {
      console.error("Error fetching pending messages:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingMessages?.length || 0} pending messages to process`);

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending messages" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Group messages by user to get their WhatsApp instances
    const userIds = [...new Set(pendingMessages.map(m => m.user_id))];
    
    // Fetch connected instances for each user
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .in("user_id", userIds)
      .eq("status", "connected");

    interface InstanceRecord {
      id: string;
      user_id: string;
      instance_key: string | null;
      instance_name: string;
      status: string;
    }

    const instancesByUser: Record<string, InstanceRecord> = {};
    if (instances) {
      for (const instance of instances as InstanceRecord[]) {
        if (!instancesByUser[instance.user_id]) {
          instancesByUser[instance.user_id] = instance;
        }
      }
    }

    // Process each message
    for (const message of pendingMessages) {
      results.processed++;

      try {
        const client = message.clients;
        if (!client) {
          console.log(`Client not found for message ${message.id}`);
          await supabase
            .from("scheduled_messages")
            .update({ status: "failed" })
            .eq("id", message.id);
          results.failed++;
          continue;
        }

        const instance = instancesByUser[message.user_id];
        if (!instance || !instance.instance_key) {
          console.log(`No connected instance for user ${message.user_id}`);
          await supabase
            .from("scheduled_messages")
            .update({ status: "failed" })
            .eq("id", message.id);
          results.failed++;
          results.errors.push(`No instance for message ${message.id}`);
          continue;
        }

        // Format phone number
        let phone = client.whatsapp.replace(/[^\d]/g, '');
        if (!phone.startsWith('55') && phone.length <= 11) {
          phone = '55' + phone;
        }

        // Replace variables in message content
        let content = message.message_content;
        content = content.replace(/\{nome\}/gi, client.name || '');
        content = content.replace(/\{name\}/gi, client.name || '');
        content = content.replace(/\{plano\}/gi, client.plan || '');
        content = content.replace(/\{plan\}/gi, client.plan || '');
        
        if (client.expires_at) {
          const expiresDate = new Date(client.expires_at);
          content = content.replace(/\{vencimento\}/gi, expiresDate.toLocaleDateString('pt-BR'));
          content = content.replace(/\{expiration\}/gi, expiresDate.toLocaleDateString('pt-BR'));
        }

        const isPixRenewal = (message.message_type || '') === 'renewal_reminder_pix';

        let textOk = false;
        let mediaOk = false;
        let mediaError: string | null = null;

        console.log(`Sending message to ${phone} (type=${message.message_type}): ${content.substring(0, 80)}...`);

        // 1) Always send text first
        const sendTextResponse = await fetch(`${uazapiUrl}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instance.instance_key,
          },
          body: JSON.stringify({
            number: phone,
            text: content,
          }),
        });

        const sendTextRaw = await sendTextResponse.text();
        let sendTextData: any = null;
        try {
          sendTextData = sendTextRaw ? JSON.parse(sendTextRaw) : null;
        } catch {
          sendTextData = { raw: sendTextRaw };
        }
        console.log(`Send(text) response for ${phone}:`, JSON.stringify(sendTextData));
        textOk = sendTextResponse.ok && !sendTextData?.error;

        // 2) If PIX renewal, send QR image after text
        if (isPixRenewal) {
          const nowIso = new Date().toISOString();
          const clientId = (message as any).client_id || client.id;

          const { data: pixPayment } = await supabase
            .from('client_pix_payments')
            .select('pix_qr_code, expires_at')
            .eq('user_id', message.user_id)
            .eq('client_id', clientId)
            .eq('status', 'pending')
            .gt('expires_at', nowIso)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const qr = (pixPayment as any)?.pix_qr_code as string | null | undefined;
          if (qr) {
            const sendMediaResponse = await fetch(`${uazapiUrl}/send/media`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                token: instance.instance_key,
              },
              body: JSON.stringify({
                number: phone,
                type: 'image',
                file: qr,
              }),
            });

            const sendMediaRaw = await sendMediaResponse.text();
            let sendMediaData: any = null;
            try {
              sendMediaData = sendMediaRaw ? JSON.parse(sendMediaRaw) : null;
            } catch {
              sendMediaData = { raw: sendMediaRaw };
            }
            console.log(`Send(media) response for ${phone}:`, JSON.stringify(sendMediaData));
            mediaOk = sendMediaResponse.ok && !sendMediaData?.error;
            if (!mediaOk) {
              mediaError = sendMediaData?.error || sendMediaData?.message || sendMediaRaw || 'unknown media error';
            }
          } else {
            mediaError = 'missing pix_qr_code';
          }
        }

        const atLeastOneOk = textOk || mediaOk;

        if (atLeastOneOk) {
          await supabase
            .from("scheduled_messages")
            .update({ status: "sent" })
            .eq("id", message.id);
          results.sent++;

          // Log to notification history
          await supabase
            .from("notification_history")
            .insert({
              user_id: message.user_id,
              client_id: client.id,
              notification_type: message.message_type || "whatsapp",
              subject: isPixRenewal
                ? `Renovação PIX enviada${mediaError ? ` (QR: ${mediaError})` : ''}`
                : `Mensagem agendada enviada`,
              status: "sent",
            });
        } else {
          throw new Error(
            `Failed to send: textOk=${String(textOk)} mediaOk=${String(mediaOk)} mediaError=${mediaError ?? ''}`,
          );
        }

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed" })
          .eq("id", message.id);
        
        results.failed++;
        results.errors.push(`Message ${message.id}: ${String(error)}`);
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
