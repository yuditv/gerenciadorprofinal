import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

/**
 * Resolve the provider base URL and token for a given instance.
 * Uses the whatsapp_api_providers table (linked via whatsapp_instances.provider_id).
 * Falls back to default/any active provider if no linked provider.
 */
async function resolveProviderForInstance(
  serviceClient: ReturnType<typeof createClient>,
  instanceId: string
): Promise<{ baseUrl: string; providerType: string } | null> {
  // 1. Check instance's linked provider
  const { data: instance } = await serviceClient
    .from('whatsapp_instances')
    .select('provider_id')
    .eq('id', instanceId)
    .maybeSingle();

  if (instance?.provider_id) {
    const { data: provider } = await serviceClient
      .from('whatsapp_api_providers')
      .select('base_url, provider_type')
      .eq('id', instance.provider_id)
      .eq('is_active', true)
      .maybeSingle();

    if (provider) {
      return {
        baseUrl: (provider.base_url as string).replace(/\/+$/, ''),
        providerType: provider.provider_type as string,
      };
    }
  }

  // 2. Default provider
  const { data: defaultProvider } = await serviceClient
    .from('whatsapp_api_providers')
    .select('base_url, provider_type')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();

  if (defaultProvider) {
    return {
      baseUrl: (defaultProvider.base_url as string).replace(/\/+$/, ''),
      providerType: defaultProvider.provider_type as string,
    };
  }

  // 3. Any active provider
  const { data: anyProvider } = await serviceClient
    .from('whatsapp_api_providers')
    .select('base_url, provider_type')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (anyProvider) {
    return {
      baseUrl: (anyProvider.base_url as string).replace(/\/+$/, ''),
      providerType: anyProvider.provider_type as string,
    };
  }

  return null;
}

/**
 * Build headers for API calls based on provider type
 */
function buildHeaders(providerType: string, token: string): Record<string, string> {
  switch (providerType) {
    case 'evolution':
      return { 'Content-Type': 'application/json', apikey: token };
    case 'waha':
      return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    case 'uazapi':
    case 'custom':
    default:
      return { 'Content-Type': 'application/json', token };
  }
}

/**
 * Build the list-groups request based on provider type
 */
async function listGroups(baseUrl: string, providerType: string, headers: Record<string, string>, instanceName?: string) {
  switch (providerType) {
    case 'evolution': {
      const res = await fetch(`${baseUrl}/group/fetchAllGroups/${instanceName || 'default'}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json();
      console.log('[extract-group-contacts] Evolution response type:', typeof data, 'isArray:', Array.isArray(data));
      return Array.isArray(data) ? data : (data?.groups || data?.data || []);
    }
    case 'waha': {
      const res = await fetch(`${baseUrl}/api/${instanceName || 'default'}/chats`, {
        method: 'GET',
        headers,
      });
      const data = await res.json();
      const all = Array.isArray(data) ? data : (data?.chats || data?.data || []);
      return all.filter((c: Record<string, unknown>) =>
        c.isGroup === true || (typeof c.id === 'string' && (c.id as string).includes('@g.us'))
      );
    }
    case 'uazapi':
    case 'custom':
    default: {
      // UAZAPI uses GET for listing endpoints
      const endpoints = [
        { url: `${baseUrl}/group/fetchAllGroups`, method: 'GET' },
        { url: `${baseUrl}/group/fetchAllGroups`, method: 'POST' },
        { url: `${baseUrl}/chat/fetchAllChats`, method: 'GET' },
        { url: `${baseUrl}/chat/fetchAllChats`, method: 'POST' },
      ];

      for (const ep of endpoints) {
        console.log(`[extract-group-contacts] Trying ${ep.method} ${ep.url}`);
        try {
          const fetchOpts: RequestInit = { method: ep.method, headers };
          if (ep.method === 'POST') {
            fetchOpts.body = JSON.stringify(ep.url.includes('fetchAllChats') ? { type: 'group' } : {});
          }
          const res = await fetch(ep.url, fetchOpts);
          const rawText = await res.text();
          console.log(`[extract-group-contacts] Response: status=${res.status}, length=${rawText.length}, preview=${rawText.substring(0, 500)}`);

          if (!res.ok || !rawText || rawText.length < 3) continue;

          const data = JSON.parse(rawText);

          // Handle various response formats
          let groups: Record<string, unknown>[] = [];
          if (Array.isArray(data)) {
            groups = data;
          } else if (data?.groups && Array.isArray(data.groups)) {
            groups = data.groups;
          } else if (data?.data && Array.isArray(data.data)) {
            groups = data.data;
          } else if (typeof data === 'object' && data !== null) {
            // Try extracting first array value
            const values = Object.values(data);
            const firstArray = values.find(v => Array.isArray(v));
            if (firstArray) {
              groups = firstArray as Record<string, unknown>[];
            }
          }

          // If fetchAllChats, filter only groups
          if (ep.url.includes('fetchAllChats') && groups.length > 0) {
            groups = groups.filter((c) =>
              c.isGroup === true || (typeof c.id === 'string' && (c.id as string).includes('@g.us'))
            );
          }

          if (groups.length > 0) {
            console.log(`[extract-group-contacts] Found ${groups.length} groups via ${ep.method} ${ep.url}`);
            return groups;
          }
        } catch (e) {
          console.log(`[extract-group-contacts] ${ep.method} ${ep.url} failed:`, e);
        }
      }

      console.log('[extract-group-contacts] All UAZAPI endpoints exhausted, 0 groups found');
      return [];
    }
  }
}

/**
 * Fetch participants for a group based on provider type
 */
async function getParticipants(baseUrl: string, providerType: string, headers: Record<string, string>, groupId: string, instanceName?: string) {
  let data: unknown;

  switch (providerType) {
    case 'evolution': {
      const res = await fetch(`${baseUrl}/group/participants/${instanceName || 'default'}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid: groupId }),
      });
      data = await res.json();
      break;
    }
    case 'waha': {
      const res = await fetch(`${baseUrl}/api/${instanceName || 'default'}/groups/${groupId}/participants`, {
        method: 'GET',
        headers,
      });
      data = await res.json();
      break;
    }
    case 'uazapi':
    case 'custom':
    default: {
      let res = await fetch(`${baseUrl}/group/participants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid: groupId }),
      });

      if (!res.ok || res.status === 405) {
        res = await fetch(`${baseUrl}/group/info`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ groupJid: groupId }),
        });
      }
      data = await res.json();
      break;
    }
  }

  // Extract participants from various response structures
  const d = data as Record<string, unknown>;
  let participants: Array<Record<string, unknown>> = [];
  if (Array.isArray(data)) {
    participants = data as Array<Record<string, unknown>>;
  } else if (d?.participants) {
    participants = d.participants as Array<Record<string, unknown>>;
  } else if ((d?.data as Record<string, unknown>)?.participants) {
    participants = (d.data as Record<string, unknown>).participants as Array<Record<string, unknown>>;
  } else if (d?.data) {
    participants = Array.isArray(d.data) ? d.data as Array<Record<string, unknown>> : [];
  }

  // Normalize
  return participants.map((p) => {
    const id = (p.id || p.jid || p.number || '') as string;
    const phone = id.replace('@s.whatsapp.net', '').replace('@c.us', '');
    return {
      phone,
      name: (p.name || p.pushName || p.notify || '') as string,
      isAdmin: p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin === true,
    };
  }).filter((p) => p.phone && p.phone.length > 5);
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

    if (!instanceId) {
      return new Response(JSON.stringify({ error: 'instanceId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get instance key and name
    const { data: instance, error: instError } = await serviceClient
      .from('whatsapp_instances')
      .select('id, instance_name, instance_key')
      .eq('id', instanceId)
      .single();

    if (instError || !instance?.instance_key) {
      console.error('[extract-group-contacts] Instance not found:', instError);
      return new Response(JSON.stringify({ success: false, error: 'Instância não encontrada ou sem chave' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve provider from database
    const provider = await resolveProviderForInstance(serviceClient, instanceId);
    if (!provider) {
      console.error('[extract-group-contacts] No provider found for instance:', instanceId);
      return new Response(JSON.stringify({ success: false, error: 'Nenhum provedor WhatsApp configurado. Configure um provedor no painel.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[extract-group-contacts] Provider: ${provider.providerType} URL: ${provider.baseUrl} Action: ${action}`);

    const headers = buildHeaders(provider.providerType, instance.instance_key);

    if (action === 'list-groups') {
      const groups = await listGroups(provider.baseUrl, provider.providerType, headers, instance.instance_name);
      console.log(`[extract-group-contacts] Found ${groups.length} groups`);
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

      const participants = await getParticipants(provider.baseUrl, provider.providerType, headers, groupId, instance.instance_name);
      console.log(`[extract-group-contacts] Extracted ${participants.length} participants from ${groupId}`);
      return new Response(JSON.stringify({ success: true, participants, groupId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use list-groups or get-participants' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[extract-group-contacts] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
