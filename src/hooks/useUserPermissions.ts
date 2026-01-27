import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      const adminStatus = !!roleData;
      setIsAdmin(adminStatus);

      // Admins have all permissions
      if (adminStatus) {
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    isLoading,
    isAdmin,
    refetch: fetchPermissions,
  };
}
