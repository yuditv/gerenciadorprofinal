import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

function getUazapiBaseUrl(): string {
  const raw = (Deno.env.get('UAZAPI_URL') ?? '').trim();
  const fallback = 'https://zynk2.uazapi.com';
  const candidate = !raw || raw.includes('PLACEHOLDER_VALUE_TO_BE_REPLACED') ? fallback : raw;
  const normalized = candidate.replace(/\/+$/, '');
  try { new URL(normalized); } catch { return fallback; }
  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, instanceId, groupId } = await req.json();
    const uazapiUrl = getUazapiBaseUrl();

    // Get instance key
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: instance, error: instError } = await serviceClient
      .from('whatsapp_instances')
      .select('id, instance_name, instance_key')
      .eq('id', instanceId)
      .single();

    if (instError || !instance?.instance_key) {
      return new Response(JSON.stringify({ error: 'Instância não encontrada ou sem chave' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'token': instance.instance_key,
    };

    if (action === 'list-groups') {
      // Fetch all chats and filter groups
      const res = await fetch(`${uazapiUrl}/chat/fetchAllChats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'group' }),
      });

      if (!res.ok) {
        // Fallback: try alternative endpoint
        const res2 = await fetch(`${uazapiUrl}/group/fetchAllGroups`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        });
        const data = await res2.json();
        return new Response(JSON.stringify({ success: true, groups: Array.isArray(data) ? data : (data?.groups || data?.data || []) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      // Filter only groups from chat list
      const allChats = Array.isArray(data) ? data : (data?.chats || data?.data || []);
      const groups = allChats.filter((c: Record<string, unknown>) => 
        c.isGroup === true || (typeof c.id === 'string' && (c.id as string).includes('@g.us'))
      );

      return new Response(JSON.stringify({ success: true, groups }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-participants') {
      if (!groupId) {
        return new Response(JSON.stringify({ error: 'groupId is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Try primary endpoint
      let res = await fetch(`${uazapiUrl}/group/participants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid: groupId }),
      });

      if (!res.ok || res.status === 405) {
        // Fallback endpoint
        res = await fetch(`${uazapiUrl}/group/info`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ groupJid: groupId }),
        });
      }

      const data = await res.json();
      
      // Extract participants - UAZAPI may return them in different structures
      let participants: Array<Record<string, unknown>> = [];
      if (Array.isArray(data)) {
        participants = data;
      } else if (data?.participants) {
        participants = data.participants;
      } else if (data?.data?.participants) {
        participants = data.data.participants;
      } else if (data?.data) {
        participants = Array.isArray(data.data) ? data.data : [];
      }

      // Normalize participant data
      const normalized = participants.map((p: Record<string, unknown>) => {
        const id = (p.id || p.jid || p.number || '') as string;
        const phone = id.replace('@s.whatsapp.net', '').replace('@c.us', '');
        return {
          phone,
          name: (p.name || p.pushName || p.notify || '') as string,
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin === true,
        };
      }).filter((p: { phone: string }) => p.phone && p.phone.length > 5);

      return new Response(JSON.stringify({ success: true, participants: normalized, groupId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use list-groups or get-participants' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in extract-group-contacts:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
