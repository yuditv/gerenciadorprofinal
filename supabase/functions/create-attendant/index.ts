import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  email: string;
  password: string;
  name?: string | null;
  permissions?: {
    can_send?: boolean;
    can_transfer?: boolean;
    can_manage_labels_macros?: boolean;
  };
  teamIds?: string[];
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
    if (!body?.email || !body?.password) {
      return new Response(JSON.stringify({ error: "Missing email/password" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
      user_metadata: { member_of: requesterId },
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const memberId = created.user.id;
    const teamIds = Array.isArray(body.teamIds) ? body.teamIds : [];

    // Link attendant to owner account
    const { error: linkErr } = await adminClient.from("account_members").insert({
      owner_id: requesterId,
      member_id: memberId,
      member_email: body.email.trim(),
      member_name: body.name ?? null,
    });
    if (linkErr) {
      // best-effort cleanup
      await adminClient.auth.admin.deleteUser(memberId).catch(() => {});
      return new Response(JSON.stringify({ error: linkErr.message }), { status: 400, headers: corsHeaders });
    }

    // Inbox permissions
    const perms = body.permissions || {};
    const { error: permsErr } = await adminClient.from("account_member_permissions").insert({
      owner_id: requesterId,
      member_id: memberId,
      can_send: perms.can_send ?? true,
      can_transfer: perms.can_transfer ?? true,
      can_manage_labels_macros: perms.can_manage_labels_macros ?? false,
    });
    if (permsErr) {
      await adminClient.auth.admin.deleteUser(memberId).catch(() => {});
      return new Response(JSON.stringify({ error: permsErr.message }), { status: 400, headers: corsHeaders });
    }

    // Global UI permissions (hide everything except Inbox)
    const { error: uiPermErr } = await adminClient.from("user_permissions").upsert(
      {
        user_id: memberId,
        can_view_dashboard: false,
        can_view_clients: false,
        can_manage_clients: false,
        can_view_contacts: false,
        can_manage_contacts: false,
        can_view_whatsapp: false,
        can_manage_whatsapp: false,
        can_view_dispatches: false,
        can_send_dispatches: false,
        can_view_campaigns: false,
        can_manage_campaigns: false,
        can_view_warming: false,
        can_manage_warming: false,
        can_view_ai_agent: false,
        can_view_settings: false,
        can_view_reports: false,
        can_view_reseller: false,
        can_view_inbox: true,
        can_manage_inbox: !!perms.can_manage_labels_macros,
      },
      { onConflict: "user_id" },
    );
    if (uiPermErr) {
      return new Response(JSON.stringify({ error: uiPermErr.message }), { status: 400, headers: corsHeaders });
    }

    // Team membership (optional)
    if (teamIds.length > 0) {
      const rows = teamIds.map((teamId) => ({ team_id: teamId, agent_id: memberId }));
      const { error: teamErr } = await adminClient.from("inbox_team_members").insert(rows);
      if (teamErr) {
        // Not fatal; membership can be adjusted later
        console.log("[create-attendant] team insert warning:", teamErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, memberId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-attendant]", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
