import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Access denied. Admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET - List all users
    if (req.method === 'GET' && action === 'list') {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        throw listError;
      }

      // Get profiles and roles for all users
      const userIds = authUsers.users.map(u => u.id);
      
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .in('user_id', userIds);

      // Get blocked users
      const { data: blockedUsers } = await supabaseAdmin
        .from('blocked_users')
        .select('user_id, blocked_at, reason')
        .is('unblocked_at', null);

      // Get user permissions
      const { data: permissions } = await supabaseAdmin
        .from('user_permissions')
        .select('*')
        .in('user_id', userIds);

      const enrichedUsers = authUsers.users.map(u => {
        const blockedInfo = blockedUsers?.find(b => b.user_id === u.id);
        const userPermissions = permissions?.find(p => p.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          profile: profiles?.find(p => p.user_id === u.id) || null,
          role: roles?.find(r => r.user_id === u.id)?.role || 'user',
          is_blocked: !!blockedInfo,
          blocked_at: blockedInfo?.blocked_at || null,
          block_reason: blockedInfo?.reason || null,
          permissions: userPermissions || null,
        };
      });

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Update user role
    if (req.method === 'POST' && action === 'update-role') {
      const { userId, role } = await req.json();

      if (!userId || !role) {
        return new Response(JSON.stringify({ error: 'Missing userId or role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent self-demotion
      if (userId === user.id && role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Cannot remove your own admin role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete existing roles first, then insert new role
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting existing role:', deleteError);
        throw deleteError;
      }

      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (insertError) {
        console.error('Error inserting new role:', insertError);
        throw insertError;
      }

      console.log('Role updated successfully:', { userId, role });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Delete user
    if (req.method === 'DELETE' && action === 'delete-user') {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent self-deletion
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Block user
    if (req.method === 'POST' && action === 'block-user') {
      const { userId, reason } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent self-blocking
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot block yourself' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if already blocked
      const { data: existingBlock } = await supabaseAdmin
        .from('blocked_users')
        .select('id')
        .eq('user_id', userId)
        .is('unblocked_at', null)
        .single();

      if (existingBlock) {
        return new Response(JSON.stringify({ error: 'User is already blocked' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: blockError } = await supabaseAdmin
        .from('blocked_users')
        .insert({
          user_id: userId,
          blocked_by: user.id,
          reason: reason || null,
        });

      if (blockError) {
        throw blockError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Unblock user
    if (req.method === 'POST' && action === 'unblock-user') {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: unblockError } = await supabaseAdmin
        .from('blocked_users')
        .update({ unblocked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('unblocked_at', null);

      if (unblockError) {
        throw unblockError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Update user permissions
    if (req.method === 'POST' && action === 'update-permissions') {
      const { userId, permissions } = await req.json();

      if (!userId || !permissions) {
        return new Response(JSON.stringify({ error: 'Missing userId or permissions' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: upsertError } = await supabaseAdmin
        .from('user_permissions')
        .upsert({
          user_id: userId,
          ...permissions,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) {
        throw upsertError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Create new user
    if (req.method === 'POST' && action === 'create-user') {
      const { email, password, whatsapp, displayName } = await req.json();

      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create user in Auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { whatsapp },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newUserId = newUser.user.id;

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: newUserId,
          display_name: displayName || null,
          whatsapp: whatsapp || null,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }

      // Set default role as 'user'
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: 'user',
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
      }

      // Create default permissions
      const { error: permError } = await supabaseAdmin
        .from('user_permissions')
        .insert({
          user_id: newUserId,
        });

      if (permError) {
        console.error('Error creating permissions:', permError);
      }

      console.log('User created successfully:', newUserId);

      return new Response(JSON.stringify({ success: true, userId: newUserId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error = err as Error;
    console.error('Admin users error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});