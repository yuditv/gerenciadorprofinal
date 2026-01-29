import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

async function upsertContactFromChat(supabase: any, userId: string, phone: string, name: string | null) {
  const cleanPhone = normalizePhone(phone);
  const cleanName = name?.trim() ? name.trim() : null;
  if (!cleanPhone || !cleanName) return;

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("user_id", userId)
    .eq("phone", cleanPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    if (existing.name !== cleanName) {
      await supabase
        .from("contacts")
        .update({ name: cleanName, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("user_id", userId);
    }
  } else {
    await supabase.from("contacts").insert({
      user_id: userId,
      phone: cleanPhone,
      name: cleanName,
    });
  }
}

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

    const userId = claims.claims.sub as string;

    const { instanceId, filters } = await req.json();
    
    if (!instanceId) {
      return new Response(JSON.stringify({ error: 'instanceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-chats] Starting batch sync for instance: ${instanceId}`);

    // Get instance key
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_key, id')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

    if (instanceError || !instance?.instance_key) {
      console.error('[sync-chats] Instance not found:', instanceError);
      return new Response(JSON.stringify({ error: 'WhatsApp instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const UAZAPI_URL = Deno.env.get('UAZAPI_URL');
    if (!UAZAPI_URL) {
      return new Response(JSON.stringify({ error: 'UAZAPI_URL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build filters for UAZAPI /chat/find
    const uazapiFilters: Record<string, unknown> = {
      operator: 'AND',
      sort: '-wa_lastMsgTimestamp',
      limit: filters?.limit || 50,
      offset: 0,
    };

    if (!filters?.includeGroups) {
      uazapiFilters.wa_isGroup = false;
    }

    console.log('[sync-chats] Calling UAZAPI /chat/find with filters:', uazapiFilters);

    // Call UAZAPI to fetch chats
    const uazapiResponse = await fetch(`${UAZAPI_URL}/chat/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instance.instance_key
      },
      body: JSON.stringify(uazapiFilters)
    });

    if (!uazapiResponse.ok) {
      const errorText = await uazapiResponse.text();
      console.error('[sync-chats] UAZAPI error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch chats from UAZAPI', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const uazapiData = await uazapiResponse.json();
    const chats = uazapiData.chats || [];
    
    console.log(`[sync-chats] UAZAPI returned ${chats.length} chats`);

    let syncedChats = 0;
    let newConversations = 0;

    // Process each chat
    for (const chat of chats) {
      const phone = chat.chatid?.replace('@s.whatsapp.net', '') || chat.phone;
      if (!phone) continue;

      const candidateName = chat.lead_name || chat.wa_name || null;

      // Check if conversation exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id, last_message_at, contact_name')
        .eq('instance_id', instanceId)
        .eq('phone', normalizePhone(phone))
        .single();

      // If onlyNew filter is set, skip if no new messages
      if (filters?.onlyNew && existingConv) {
        const lastMsgTimestamp = chat.wa_lastMsgTimestamp 
          ? new Date(chat.wa_lastMsgTimestamp * 1000) 
          : null;
        const existingLastMsg = existingConv.last_message_at 
          ? new Date(existingConv.last_message_at) 
          : null;

        if (lastMsgTimestamp && existingLastMsg && lastMsgTimestamp <= existingLastMsg) {
          continue; // No new messages, skip
        }
      }

      // Create or update conversation
      if (!existingConv) {
        const { error: insertError } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            instance_id: instanceId,
            phone: normalizePhone(phone),
            contact_name: candidateName,
            contact_avatar: chat.wa_profilePic || null,
            status: 'open',
            last_message_at: chat.wa_lastMsgTimestamp 
              ? new Date(chat.wa_lastMsgTimestamp * 1000).toISOString()
              : new Date().toISOString()
          });

        if (!insertError) {
          newConversations++;
        }
      } else {
        // Update existing conversation with latest info
        await supabase
          .from('conversations')
          .update({
            contact_name: candidateName || existingConv.contact_name,
            contact_avatar: chat.wa_profilePic || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConv.id);
      }

      // Keep CRM contacts in sync with external chats
      await upsertContactFromChat(supabase, userId, phone, candidateName);

      syncedChats++;
    }

    console.log(`[sync-chats] Synced ${syncedChats} chats, created ${newConversations} new conversations`);

    return new Response(JSON.stringify({ 
      success: true, 
      syncedChats,
      newConversations,
      totalFromApi: chats.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-chats] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
