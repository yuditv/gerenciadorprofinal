import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getUazapiBaseUrl(): string {
  const raw = (Deno.env.get('UAZAPI_URL') ?? '').trim();
  const fallback = 'https://zynk2.uazapi.com';
  const candidate = !raw || raw.includes('PLACEHOLDER_VALUE_TO_BE_REPLACED') ? fallback : raw;

  // Normalize trailing slashes
  const normalized = candidate.replace(/\/+$/, '');

  // Validate URL early to prevent runtime fetch errors
  try {
    // eslint-disable-next-line no-new
    new URL(normalized);
  } catch {
    return fallback;
  }

  return normalized;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { conversationId, limit = 50, offset = 0, force = false } = await req.json();
    
    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[fetch-messages] Fetching messages for conversation: ${conversationId}, limit: ${limit}, offset: ${offset}, force: ${force}`);

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[fetch-messages] Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get instance key separately
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_key')
      .eq('id', conversation.instance_id)
      .single();

    if (instanceError || !instance?.instance_key) {
      console.error('[fetch-messages] Instance not found:', instanceError);
      // Return 200 to avoid treating this as a runtime failure in clients.
      // This is an expected state when the user hasn't connected WhatsApp yet.
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INSTANCE_NOT_CONFIGURED',
          error: 'WhatsApp instance not configured',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const instanceKey = instance.instance_key;

    // Format phone to WhatsApp JID
    const phone = conversation.phone.replace(/[^\d]/g, '');
    const chatId = `${phone}@s.whatsapp.net`;

    console.log(`[fetch-messages] Fetching from UAZAPI for chatId: ${chatId}`);

    // Call UAZAPI to fetch messages
    const UAZAPI_URL = getUazapiBaseUrl();
    console.log(`[fetch-messages] Using UAZAPI base URL: ${UAZAPI_URL}`);

    // Helper function for fetch with timeout (no retries to save resources)
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 25000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[fetch-messages] Request timeout after ${timeoutMs}ms, aborting...`);
        controller.abort();
      }, timeoutMs);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
        if (isAbortError) {
          throw new Error(`Request timed out after ${timeoutMs}ms - UAZAPI server may be slow`);
        }
        throw err;
      }
    };

    const uazapiResponse = await fetchWithTimeout(`${UAZAPI_URL}/message/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceKey
      },
      body: JSON.stringify({
        chatid: chatId,
        limit: Math.min(limit, 100), // Reduced cap to save resources
        offset: offset
      })
    });

    if (!uazapiResponse.ok) {
      const errorText = await uazapiResponse.text();
      console.error('[fetch-messages] UAZAPI error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch from UAZAPI', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const uazapiData = await uazapiResponse.json();
    console.log(`[fetch-messages] UAZAPI returned ${uazapiData.messages?.length || 0} messages`);

    // Get existing message IDs to avoid duplicates
    const { data: existingMessages } = await supabase
      .from('chat_inbox_messages')
      .select('metadata')
      .eq('conversation_id', conversationId);

    const existingMessageIds = new Set(
      existingMessages?.map((m: { metadata?: { message_id?: string } }) => m.metadata?.message_id).filter(Boolean) || []
    );

    let newMessagesCount = 0;
    const messagesToInsert: Array<{
      conversation_id: string;
      sender_type: string;
      content: string | null;
      media_url: string | null;
      media_type: string | null;
      is_private: boolean;
      is_read: boolean;
      metadata: Record<string, unknown>;
      created_at: string;
    }> = [];

    // Process messages from UAZAPI
    for (const msg of (uazapiData.messages || [])) {
      const messageId = msg.key?.id || msg.id;
      
      // Skip if already exists
      if (existingMessageIds.has(messageId)) {
        continue;
      }

      // Determine sender type
      const isFromMe = msg.key?.fromMe || msg.fromMe || false;
      const senderType = isFromMe ? 'agent' : 'contact';

      // Extract message content
      let content: string | null = null;
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (msg.message?.conversation) {
        content = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        content = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        content = msg.message.imageMessage.caption || null;
        mediaType = 'image';
        mediaUrl = msg.message.imageMessage.url || null;
      } else if (msg.message?.videoMessage) {
        content = msg.message.videoMessage.caption || null;
        mediaType = 'video';
        mediaUrl = msg.message.videoMessage.url || null;
      } else if (msg.message?.audioMessage) {
        mediaType = 'audio';
        mediaUrl = msg.message.audioMessage.url || null;
      } else if (msg.message?.documentMessage) {
        content = msg.message.documentMessage.fileName || 'Documento';
        mediaType = 'document';
        mediaUrl = msg.message.documentMessage.url || null;
      }

      // Skip empty messages
      if (!content && !mediaUrl) {
        continue;
      }

      // Parse timestamp
      const timestamp = msg.messageTimestamp 
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      messagesToInsert.push({
        conversation_id: conversationId,
        sender_type: senderType,
        content,
        media_url: mediaUrl,
        media_type: mediaType,
        is_private: false,
        is_read: isFromMe,
        metadata: {
          message_id: messageId,
          synced_at: new Date().toISOString(),
          source: 'uazapi_sync'
        },
        created_at: timestamp
      });

      newMessagesCount++;
    }

    // Insert new messages
    if (messagesToInsert.length > 0) {
      // Sort by created_at to maintain order
      messagesToInsert.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const { error: insertError } = await supabase
        .from('chat_inbox_messages')
        .insert(messagesToInsert);

      if (insertError) {
        console.error('[fetch-messages] Insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save messages', details: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update conversation last_message_at
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          last_message_at: messagesToInsert[messagesToInsert.length - 1].created_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('[fetch-messages] Update conversation error:', updateError);
      }
    }

    console.log(`[fetch-messages] Successfully synced ${newMessagesCount} new messages`);

    return new Response(JSON.stringify({ 
      success: true, 
      newMessages: newMessagesCount,
      totalFetched: uazapiData.messages?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[fetch-messages] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
