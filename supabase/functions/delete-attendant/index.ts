import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  memberId: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const requesterId = userData.user.id;
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin", { _user_id: requesterId });
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = (await req.json()) as Body;
    if (!body?.memberId) {
      return new Response(JSON.stringify({ error: "Missing memberId" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Remove links + permissions + team memberships
    await adminClient.from("inbox_team_members").delete().eq("agent_id", body.memberId);
    await adminClient.from("account_member_permissions").delete().eq("member_id", body.memberId).eq("owner_id", requesterId);
    await adminClient.from("account_members").delete().eq("member_id", body.memberId).eq("owner_id", requesterId);

    // Also remove UI permissions row (optional)
    await adminClient.from("user_permissions").delete().eq("user_id", body.memberId);

    // Optional: fully delete user from auth
    await adminClient.auth.admin.deleteUser(body.memberId).catch(() => {});

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[delete-attendant]", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
