import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { toast } from 'sonner';

export interface ContactReason {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface ConversationReason {
  id: string;
  conversation_id: string;
  reason_id: string;
  created_at: string;
}

export function useContactReasons() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [reasons, setReasons] = useState<ContactReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = ownerId || user?.id;

  const fetchReasons = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('inbox_contact_reasons')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name');

      if (error) throw error;
      setReasons((data || []) as ContactReason[]);
    } catch (error) {
      console.error('Error fetching contact reasons:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchReasons(); }, [fetchReasons]);

  const createReason = async (name: string, color: string, icon?: string) => {
    if (!effectiveUserId) return;
    try {
      const { error } = await supabase
        .from('inbox_contact_reasons')
        .insert({ user_id: effectiveUserId, name, color, icon: icon || 'help-circle' });

      if (error) throw error;
      toast.success('Motivo de contato criado');
      await fetchReasons();
    } catch (error) {
      console.error('Error creating contact reason:', error);
      toast.error('Erro ao criar motivo');
    }
  };

  const deleteReason = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inbox_contact_reasons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Motivo removido');
      await fetchReasons();
    } catch (error) {
      console.error('Error deleting contact reason:', error);
      toast.error('Erro ao remover motivo');
    }
  };

  const assignReason = async (conversationId: string, reasonId: string) => {
    try {
      const { error } = await supabase
        .from('conversation_contact_reasons')
        .insert({ conversation_id: conversationId, reason_id: reasonId });

      if (error && !error.message.includes('duplicate')) throw error;
      toast.success('Motivo atribuído');
    } catch (error) {
      console.error('Error assigning reason:', error);
      toast.error('Erro ao atribuir motivo');
    }
  };

  const removeReason = async (conversationId: string, reasonId: string) => {
    try {
      const { error } = await supabase
        .from('conversation_contact_reasons')
        .delete()
        .match({ conversation_id: conversationId, reason_id: reasonId });

      if (error) throw error;
    } catch (error) {
      console.error('Error removing reason:', error);
    }
  };

  const getConversationReasons = async (conversationId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('conversation_contact_reasons')
        .select('reason_id')
        .eq('conversation_id', conversationId);

      if (error) throw error;
      return (data || []).map(d => d.reason_id);
    } catch {
      return [];
    }
  };

  const getReasonStats = async (): Promise<{ reason_id: string; count: number }[]> => {
    try {
      const { data, error } = await supabase
        .from('conversation_contact_reasons')
        .select('reason_id');

      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach(d => {
        counts[d.reason_id] = (counts[d.reason_id] || 0) + 1;
      });

      return Object.entries(counts).map(([reason_id, count]) => ({ reason_id, count }));
    } catch {
      return [];
    }
  };

  return {
    reasons,
    isLoading,
    createReason,
    deleteReason,
    assignReason,
    removeReason,
    getConversationReasons,
    getReasonStats,
    refetch: fetchReasons,
  };
}
