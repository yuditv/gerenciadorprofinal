import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePhoneNumberFromString } from "https://esm.sh/libphonenumber-js@1.11.7";
import { resolveProvider } from "../_shared/whatsapp-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

interface SendMessageRequest {
  conversationId: string;
  content: string;
  isPrivate?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  overrideInstanceId?: string;
}

function getMediaType(mimeType: string): string {
  // Accept both real MIME types (image/png) and our simplified tags (image|video|audio|document)
  const raw = (mimeType ?? '').toString().trim().toLowerCase();
  if (raw === 'image' || raw.startsWith('image/')) return 'image';
  if (raw === 'video' || raw.startsWith('video/')) return 'video';
  if (raw === 'audio' || raw.startsWith('audio/')) return 'audio';
  if (raw === 'document') return 'document';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Format phone number for WhatsApp API - supports international numbers
 * - Brazilian numbers (10-11 digits without country code): adds 55 prefix
 * - International numbers (already have country code): preserved as-is
 * - USA numbers (1 + 10 digits): preserved with country code 1
 */
function formatPhoneNumber(phone: string, defaultCountry: string = 'BR'): string {
  const raw = (phone ?? '').toString().trim();
  if (!raw) throw new Error('Phone is required');

  const parsed =
    parsePhoneNumberFromString(raw) ??
    parsePhoneNumberFromString(raw, defaultCountry as any);

  if (!parsed || !parsed.isValid()) {
    throw new Error('Invalid phone number');
  }

  // UAZAPI expects digits only (E.164 without the leading '+')
  return parsed.number.replace('+', '');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Resolve provider from DB
    const provider = await resolveProvider(supabaseUrl, supabaseServiceKey);
    const uazapiUrl = provider?.base_url || "";
    console.log(`[Send Inbox] Provider: ${provider?.provider_type || 'none'}, URL: ${uazapiUrl}`);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SendMessageRequest = await req.json();
    const { conversationId, content, isPrivate = false, mediaUrl, mediaType, fileName, overrideInstanceId } = body;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Either content or media is required
    if (!content && !mediaUrl) {
      return new Response(
        JSON.stringify({ error: 'content or mediaUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Send Inbox] User ${user.id} sending message to conversation ${conversationId}`);

    // Get conversation first
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[Send Inbox] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get instance separately (no JOIN needed)
    // If admin provided an override instance, use that instead
    const effectiveInstanceId = overrideInstanceId || conversation.instance_id;
    let instance = null;
    if (effectiveInstanceId) {
      const { data: instanceData, error: instanceError } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('*')
        .eq('id', effectiveInstanceId)
        .single();
      
      if (instanceError) {
        console.error('[Send Inbox] Error fetching instance:', instanceError);
      } else {
        instance = instanceData;
      }
    }

    // Save message to database
    const { data: savedMessage, error: msgError } = await supabaseAdmin
      .from('chat_inbox_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'agent',
        sender_id: user.id,
        content,
        media_url: mediaUrl,
        media_type: mediaType,
        is_private: isPrivate,
        metadata: { sent_by: user.email }
      })
      .select()
      .single();

    if (msgError) {
      console.error('[Send Inbox] Error saving message:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to save message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fire-and-forget: update structured client memory from this message
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const msgText = [content, fileName ? `Arquivo: ${fileName}` : null].filter(Boolean).join('\n');
      fetch(`${supabaseUrl}/functions/v1/memory-extractor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          userId: conversation.user_id,
          agentId: null,
          phone: conversation.phone,
          contactName: conversation.contact_name,
          message: msgText,
        })
      });
    } catch (e) {
      // best-effort
      console.log('[Send Inbox] memory-extractor invoke error (ignored):', e);
    }

    // Update conversation - pause AI when human responds
    const updateData: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      last_message_preview: content.substring(0, 100),
      ai_enabled: false, // Disable AI when human responds
      ai_paused_at: new Date().toISOString(), // Track when AI was paused for auto-resume
    };

    // Set first_reply_at if this is the first agent reply
    if (!conversation.first_reply_at) {
      updateData.first_reply_at = new Date().toISOString();
    }

    // Auto-assign to current user if not assigned
    if (!conversation.assigned_to) {
      updateData.assigned_to = user.id;
    }

    await supabaseAdmin
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);

    // If not private, send via WhatsApp
    if (!isPrivate && instance) {
      const phone = conversation.phone;
      const instanceToken = instance.instance_key;
      // Use instance_key only - no env var fallback
      const uazapiTokenToUse = instanceToken || provider?.api_token || "";

      console.log(`[Send Inbox] Sending to WhatsApp: ${phone} via instance ${instance.instance_name}`);

      try {
        // UAZAPI format: 
        // - Endpoint: /sendText (for text), /sendImage (for media)
        // - Header: token (lowercase)
        // - Body: number, text (lowercase)
        
        let sendSuccess = false;
        let lastError = '';

        // Format phone number with international support
        const formattedPhone = formatPhoneNumber(phone, (conversation.country_code as string | null) ?? 'BR');

        // Determine if sending media or text
        if (mediaUrl && mediaType) {
          // Media message - use UAZAPI v2 unified /send/media endpoint
          const mediaTypeString = getMediaType(mediaType);
          
          // deno-lint-ignore no-explicit-any
          const requestBody: Record<string, any> = {
            number: formattedPhone,
            type: mediaTypeString,
            file: mediaUrl
          };
          
          // Add caption/text if provided
          if (content && content.trim()) {
            requestBody.text = content;
          }
          
          // Add document name for document type
          if (mediaTypeString === 'document' && fileName) {
            requestBody.docName = fileName;
          }
          
          console.log(`[Send Inbox] Sending ${mediaTypeString} via /send/media`);
          console.log(`[Send Inbox] URL: ${uazapiUrl}/send/media`);
          console.log(`[Send Inbox] Request body:`, JSON.stringify(requestBody));
          
          const sendResponse = await fetch(`${uazapiUrl}/send/media`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
               'token': uazapiTokenToUse
            },
            body: JSON.stringify(requestBody)
          });
          
          const responseText = await sendResponse.text();
          console.log(`[Send Inbox] Status: ${sendResponse.status}`);
          console.log(`[Send Inbox] Response: ${responseText}`);
          
          if (sendResponse.ok) {
            console.log(`[Send Inbox] ✅ ${mediaTypeString} sent successfully!`);
            sendSuccess = true;
            
            // Parse response to get WhatsApp message ID for status tracking
            try {
              const responseData = JSON.parse(responseText);
              const whatsappId = responseData.id || responseData.messageId || responseData.key?.id;
              
              if (whatsappId) {
                await supabaseAdmin
                  .from('chat_inbox_messages')
                  .update({
                    metadata: {
                      ...savedMessage.metadata,
                      whatsapp_id: whatsappId,
                      status: 'sent'
                    }
                  })
                  .eq('id', savedMessage.id);
                
                console.log(`[Send Inbox] Saved WhatsApp ID: ${whatsappId}`);
              }
            } catch (e) {
              console.log('[Send Inbox] Could not parse WhatsApp ID from response:', e);
            }
          } else {
            lastError = `${sendResponse.status}: ${responseText}`;
          }
        } else {
          // Text message - use UAZAPI format /send/text with { number, text }
          console.log(`[Send Inbox] Sending via /send/text`);
          console.log(`[Send Inbox] URL: ${uazapiUrl}/send/text`);
          console.log(`[Send Inbox] Phone: ${formattedPhone}`);
          
          const sendResponse = await fetch(`${uazapiUrl}/send/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
               'token': uazapiTokenToUse
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: content
            })
          });
          
          const responseText = await sendResponse.text();
          console.log(`[Send Inbox] Status: ${sendResponse.status}`);
          console.log(`[Send Inbox] Response: ${responseText}`);
          
        if (sendResponse.ok) {
          console.log('[Send Inbox] ✅ Message sent successfully!');
          sendSuccess = true;
          
          // Parse response to get WhatsApp message ID for status tracking
          try {
            const responseData = JSON.parse(responseText);
            const whatsappId = responseData.id || responseData.messageId || responseData.key?.id;
            
            if (whatsappId) {
              await supabaseAdmin
                .from('chat_inbox_messages')
                .update({
                  metadata: {
                    ...savedMessage.metadata,
                    whatsapp_id: whatsappId,
                    status: 'sent'
                  }
                })
                .eq('id', savedMessage.id);
              
              console.log(`[Send Inbox] Saved WhatsApp ID: ${whatsappId}`);
            }
          } catch (e) {
            console.log('[Send Inbox] Could not parse WhatsApp ID from response:', e);
          }
        } else {
          lastError = `${sendResponse.status}: ${responseText}`;
        }
      }

      if (!sendSuccess) {
        console.error('[Send Inbox] Failed to send. Error:', lastError);
        
        // Update message with error status
        await supabaseAdmin
          .from('chat_inbox_messages')
          .update({ 
            metadata: { 
              ...savedMessage.metadata, 
              send_error: lastError,
              status: 'failed'
            } 
          })
          .eq('id', savedMessage.id);
      }
    } catch (sendError) {
      console.error('[Send Inbox] Error sending to WhatsApp:', sendError);
    }
  } else if (!isPrivate && !instance) {
    console.warn('[Send Inbox] No instance found for conversation, message saved but not sent to WhatsApp');
  }

  return new Response(
    JSON.stringify({
      success: true,
      messageId: savedMessage.id
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );

  } catch (error: unknown) {
    console.error('[Send Inbox] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
