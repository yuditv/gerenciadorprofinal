import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referral_code } = await req.json();
    
    if (!referral_code) {
      return new Response(JSON.stringify({ error: 'referral_code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the client with this referral code
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id, name')
      .eq('referral_code', referral_code)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'Invalid referral code' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Track the click
    const userAgent = req.headers.get('user-agent') || '';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    await supabase.from('referral_clicks').insert({
      referral_code,
      client_id: client.id,
      user_id: client.user_id,
      ip_address: ip,
      user_agent: userAgent,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      client_name: client.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
