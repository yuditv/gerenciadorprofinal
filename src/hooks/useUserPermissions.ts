import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserPermissions {
  can_view_dashboard: boolean;
  can_view_clients: boolean;
  can_manage_clients: boolean;
  can_view_contacts: boolean;
  can_manage_contacts: boolean;
  can_view_whatsapp: boolean;
  can_manage_whatsapp: boolean;
  can_view_dispatches: boolean;
  can_send_dispatches: boolean;
  can_view_campaigns: boolean;
  can_manage_campaigns: boolean;
  can_view_warming: boolean;
  can_manage_warming: boolean;
  can_view_ai_agent: boolean;
  can_view_settings: boolean;
  can_view_reports: boolean;
  can_view_reseller: boolean;
  can_view_inbox: boolean;
  can_manage_inbox: boolean;
}

const defaultPermissions: UserPermissions = {
  can_view_dashboard: true,
  can_view_clients: true,
  can_manage_clients: true,
  can_view_contacts: true,
  can_manage_contacts: true,
  can_view_whatsapp: true,
  can_manage_whatsapp: true,
  can_view_dispatches: true,
  can_send_dispatches: true,
  can_view_campaigns: true,
  can_manage_campaigns: true,
  can_view_warming: true,
  can_manage_warming: true,
  can_view_ai_agent: true,
  can_view_settings: true,
  can_view_reports: true,
  can_view_reseller: false,
  can_view_inbox: true,
  can_manage_inbox: true,
};

export function useUserPermissions() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      // Se o auth ainda está resolvendo, não finalize permissões.
      if (isAuthLoading) return;

      // Usuário deslogado: permissões padrão + não-admin.
      if (!user) {
        setIsAdmin(false);
        setPermissions(defaultPermissions);
        return;
      }

      // Check if admin (server-side via SECURITY DEFINER function)
      const { data: adminStatus, error: adminError } = await supabase.rpc('is_admin', { _user_id: user.id });
      if (adminError) {
        // Fallback to non-admin on error (safe default)
        console.warn('Failed to check admin status:', adminError);
      }

      const isAdminResolved = !!adminStatus && !adminError;
      setIsAdmin(isAdminResolved);

      // Admins have all permissions
      if (isAdminResolved) {
        setPermissions({
          ...defaultPermissions,
          can_view_reseller: true,
          can_view_inbox: true,
          can_manage_inbox: true,
        });
        setIsLoading(false);
        return;
      }

      // Fetch user permissions
      const { data: permData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (permData) {
        setPermissions({
          can_view_dashboard: permData.can_view_dashboard ?? true,
          can_view_clients: permData.can_view_clients ?? true,
          can_manage_clients: permData.can_manage_clients ?? true,
          can_view_contacts: permData.can_view_contacts ?? true,
          can_manage_contacts: permData.can_manage_contacts ?? true,
          can_view_whatsapp: permData.can_view_whatsapp ?? true,
          can_manage_whatsapp: permData.can_manage_whatsapp ?? true,
          can_view_dispatches: permData.can_view_dispatches ?? true,
          can_send_dispatches: permData.can_send_dispatches ?? true,
          can_view_campaigns: permData.can_view_campaigns ?? true,
          can_manage_campaigns: permData.can_manage_campaigns ?? true,
          can_view_warming: permData.can_view_warming ?? true,
          can_manage_warming: permData.can_manage_warming ?? true,
          can_view_ai_agent: permData.can_view_ai_agent ?? true,
          can_view_settings: permData.can_view_settings ?? true,
          can_view_reports: permData.can_view_reports ?? true,
          can_view_reseller: permData.can_view_reseller ?? false,
          can_view_inbox: permData.can_view_inbox ?? true,
          can_manage_inbox: permData.can_manage_inbox ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      // Só conclui loading quando o auth já estiver resolvido.
      if (!isAuthLoading) setIsLoading(false);
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    // Mantém o loading enquanto o AuthProvider não concluiu.
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    fetchPermissions();
  }, [fetchPermissions, isAuthLoading]);

  return {
    permissions,
    isLoading,
    isAdmin,
    refetch: fetchPermissions,
  };
}
