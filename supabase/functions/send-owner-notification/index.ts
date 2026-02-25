import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveProvider } from "../_shared/whatsapp-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationEventType = 
  | 'ai_uncertainty'
  | 'payment_proof'
  | 'new_contact'
  | 'complaint'
  | 'vip_message'
  | 'long_wait'
  | 'human_handoff';

interface NotificationPayload {
  userId: string;
  eventType: NotificationEventType;
  contactName?: string;
  contactPhone: string;
  summary: string;
  conversationId?: string;
  urgency?: 'low' | 'medium' | 'high';
  instanceId?: string;
}

interface NotificationSettings {
  notification_phone: string | null;
  notification_instance_id: string | null;
  notify_via_whatsapp: boolean;
  notify_on_ai_uncertainty: boolean;
  notify_on_payment_proof: boolean;
  notify_on_new_contact: boolean;
  notify_on_complaint: boolean;
  notify_on_vip_message: boolean;
  notify_on_long_wait: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_interval_minutes: number;
}

const EVENT_EMOJIS: Record<NotificationEventType, string> = {
  'ai_uncertainty': '🤔',
  'payment_proof': '💰',
  'new_contact': '👋',
  'complaint': '⚠️',
  'vip_message': '⭐',
  'long_wait': '⏰',
  'human_handoff': '🤖➡️👤',
};

const EVENT_TITLES: Record<NotificationEventType, string> = {
  'ai_uncertainty': 'IA precisa de ajuda',
  'payment_proof': 'Comprovante recebido',
  'new_contact': 'Novo cliente',
  'complaint': 'Possível reclamação',
  'vip_message': 'Cliente VIP',
  'long_wait': 'Cliente aguardando',
  'human_handoff': 'Cliente quer falar com humano',
};

function isInQuietHours(settings: NotificationSettings): boolean {
  if (!settings.quiet_hours_enabled) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  const [startHour, startMinute] = (settings.quiet_hours_start || '22:00').split(':').map(Number);
  const [endHour, endMinute] = (settings.quiet_hours_end || '08:00').split(':').map(Number);
  
  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;
  
  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTimeMinutes > endTimeMinutes) {
    return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;
  }
  
  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 12) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return cleaned;
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

/**
 * Validate authentication - requires service role key (internal function only)
 */
function validateServiceAuth(req: Request): { valid: boolean; error?: string } {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Only allow service role key (internal edge function calls only)
  if (token === supabaseServiceKey) {
    return { valid: true };
  }
  
  return { valid: false, error: 'Invalid service key - this is an internal function' };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication - internal function only
  const auth = validateServiceAuth(req);
  if (!auth.valid) {
    console.error('[send-owner-notification] Authentication failed:', auth.error);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: auth.error }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const providerConfig = await resolveProvider(supabaseUrl, supabaseServiceKey);
    const uazapiUrl = providerConfig?.base_url || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    console.log('[send-owner-notification] Received payload:', payload);

    if (!payload.userId || !payload.eventType || !payload.contactPhone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, eventType, contactPhone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch owner notification settings
    const { data: settings, error: settingsError } = await supabase
      .from('owner_notification_settings')
      .select('*')
      .eq('user_id', payload.userId)
      .maybeSingle();

    if (settingsError) {
      console.error('[send-owner-notification] Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notification settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings || !settings.notify_via_whatsapp || !settings.notification_phone) {
      console.log('[send-owner-notification] Notifications disabled or no phone configured');
      return new Response(
        JSON.stringify({ skipped: true, reason: 'notifications_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this event type is enabled
    const eventEnabledMap: Record<NotificationEventType, keyof NotificationSettings> = {
      'ai_uncertainty': 'notify_on_ai_uncertainty',
      'payment_proof': 'notify_on_payment_proof',
      'new_contact': 'notify_on_new_contact',
      'complaint': 'notify_on_complaint',
      'vip_message': 'notify_on_vip_message',
      'long_wait': 'notify_on_long_wait',
      'human_handoff': 'notify_on_ai_uncertainty', // Human handoff always follows AI uncertainty setting
    };

    const enabledField = eventEnabledMap[payload.eventType];
    // human_handoff is always sent regardless of settings (critical security event)
    if (payload.eventType !== 'human_handoff' && !settings[enabledField]) {
      console.log(`[send-owner-notification] Event type ${payload.eventType} is disabled`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'event_type_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check quiet hours
    if (isInQuietHours(settings)) {
      console.log('[send-owner-notification] Quiet hours active, skipping notification');
      return new Response(
        JSON.stringify({ skipped: true, reason: 'quiet_hours' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check minimum interval (anti-spam)
    const minIntervalMs = (settings.min_interval_minutes || 5) * 60 * 1000;
    const { data: recentLogs } = await supabase
      .from('owner_notification_log')
      .select('created_at')
      .eq('user_id', payload.userId)
      .eq('contact_phone', payload.contactPhone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      const lastNotification = new Date(recentLogs[0].created_at).getTime();
      if (Date.now() - lastNotification < minIntervalMs) {
        console.log(`[send-owner-notification] Too soon since last notification for this contact`);
        return new Response(
          JSON.stringify({ skipped: true, reason: 'min_interval' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get instance key for sending
    let instanceKey: string | null = null;
    const instanceIdToUse = settings.notification_instance_id || payload.instanceId;

    if (instanceIdToUse) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_key')
        .eq('id', instanceIdToUse)
        .single();

      instanceKey = instance?.instance_key || null;
    }

    // Fallback: get first connected instance for this user
    if (!instanceKey) {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_key')
        .eq('user_id', payload.userId)
        .eq('phone_connected', true)
        .limit(1);

      instanceKey = instances?.[0]?.instance_key || null;
    }

    if (!instanceKey) {
      console.error('[send-owner-notification] No WhatsApp instance available');
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance available to send notification' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notification message
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const urgencyIndicator = payload.urgency === 'high' ? '🚨 *URGENTE*\n\n' : '';
    
    const notificationMessage = `${EVENT_EMOJIS[payload.eventType]} *${EVENT_TITLES[payload.eventType]}*
${urgencyIndicator}
👤 *${payload.contactName || 'Cliente'}*
📱 ${payload.contactPhone}

${payload.summary}

---
⏰ ${timeStr}`;

    // Send via UAZAPI
    const formattedPhone = formatPhoneNumber(settings.notification_phone);
    console.log(`[send-owner-notification] Sending to ${formattedPhone}`);

    const sendResponse = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceKey
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: notificationMessage
      })
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('[send-owner-notification] UAZAPI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the notification
    await supabase
      .from('owner_notification_log')
      .insert({
        user_id: payload.userId,
        event_type: payload.eventType,
        contact_phone: payload.contactPhone,
        contact_name: payload.contactName,
        summary: payload.summary,
        urgency: payload.urgency || 'medium',
        conversation_id: payload.conversationId,
        sent_at: now.toISOString()
      });

    console.log('[send-owner-notification] Notification sent successfully');

    return new Response(
      JSON.stringify({ success: true, sentTo: formattedPhone }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-owner-notification] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
