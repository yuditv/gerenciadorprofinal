import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  profile: {
    display_name: string | null;
    whatsapp: string | null;
    avatar_url: string | null;
  } | null;
  role: 'admin' | 'moderator' | 'user';
  is_blocked: boolean;
  blocked_at: string | null;
  block_reason: string | null;
  permissions: UserPermissions | null;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const checkAdminStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      const adminStatus = !!data;
      setIsAdmin(adminStatus);
      return adminStatus;
    } catch {
      setIsAdmin(false);
      return false;
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=list`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      setUsers(result.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao carregar usuários',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const updateUserRole = useCallback(async (userId: string, role: 'admin' | 'moderator' | 'user') => {
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=update-role`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId, role }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update role');
      }

      toast({
        title: 'Sucesso',
        description: 'Role do usuário atualizada',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar role',
        variant: 'destructive',
      });
    }
  }, [fetchUsers, toast]);

  const blockUser = useCallback(async (userId: string, reason?: string) => {
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=block-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId, reason }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to block user');
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário bloqueado',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao bloquear usuário',
        variant: 'destructive',
      });
    }
  }, [fetchUsers, toast]);

  const unblockUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=unblock-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to unblock user');
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário desbloqueado',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao desbloquear usuário',
        variant: 'destructive',
      });
    }
  }, [fetchUsers, toast]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=delete-user`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário excluído',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao excluir usuário',
        variant: 'destructive',
      });
    }
  }, [fetchUsers, toast]);

  const updatePermissions = useCallback(async (userId: string, permissions: Partial<UserPermissions>) => {
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=update-permissions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId, permissions }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update permissions');
      }

      toast({
        title: 'Sucesso',
        description: 'Permissões atualizadas',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar permissões',
        variant: 'destructive',
      });
    }
  }, [fetchUsers, toast]);

  const createUser = useCallback(async (userData: {
    email: string;
    password: string;
    whatsapp?: string;
    displayName?: string;
  }) => {
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify(userData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário criado com sucesso!',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao criar usuário',
        variant: 'destructive',
      });
      throw error;
    }
  }, [fetchUsers, toast]);

  return {
    users,
    isLoading,
    isAdmin,
    checkAdminStatus,
    fetchUsers,
    updateUserRole,
    blockUser,
    unblockUser,
    deleteUser,
    updatePermissions,
    createUser,
  };
}
