import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MaintenanceStats {
  memoriesCount: number;
  chatMessagesCount: number;
  buffersCount: number;
  oldDataCount: number;
}

export function useAIMaintenance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    refetch: refreshStats,
  } = useQuery({
    queryKey: ['ai-maintenance-stats'],
    queryFn: async (): Promise<MaintenanceStats> => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      // Fetch all counts in parallel
      const [memoriesRes, chatRes, buffersRes, oldMemoriesRes, oldChatRes] = await Promise.all([
        supabase.from('ai_client_memories').select('id', { count: 'exact', head: true }),
        supabase.from('ai_chat_messages').select('id', { count: 'exact', head: true }),
        supabase.from('ai_message_buffer').select('id', { count: 'exact', head: true }),
        supabase.from('ai_client_memories').select('id', { count: 'exact', head: true }).lt('updated_at', thirtyDaysAgoISO),
        supabase.from('ai_chat_messages').select('id', { count: 'exact', head: true }).lt('created_at', thirtyDaysAgoISO),
      ]);

      return {
        memoriesCount: memoriesRes.count || 0,
        chatMessagesCount: chatRes.count || 0,
        buffersCount: buffersRes.count || 0,
        oldDataCount: (oldMemoriesRes.count || 0) + (oldChatRes.count || 0),
      };
    },
  });

  // Clear memories
  const clearMemories = useMutation({
    mutationFn: async ({ oldOnly, daysOld }: { oldOnly: boolean; daysOld: number }) => {
      console.log('[Maintenance] Clearing memories:', { oldOnly, daysOld });
      
      // Get authenticated user - CRITICAL for RLS to work
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const userId = userData.user.id;
      
      let result;
      
      if (oldOnly) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        result = await supabase
          .from('ai_client_memories')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .lt('updated_at', cutoffDate.toISOString());
      } else {
        // Delete ALL memories for this user - use neq to ensure we're deleting something
        result = await supabase
          .from('ai_client_memories')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .not('id', 'is', null); // This ensures we match all rows for this user
      }
      
      const { error, count } = result;
      console.log('[Maintenance] Deleted memories:', count, 'error:', error);
      if (error) throw error;
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['ai-maintenance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ai-client-memories'] });
      toast({
        title: 'Memórias limpas',
        description: `${count || 0} memórias de clientes foram removidas.`,
      });
    },
    onError: (error) => {
      console.error('Error clearing memories:', error);
      toast({
        title: 'Erro ao limpar memórias',
        description: 'Não foi possível remover as memórias.',
        variant: 'destructive',
      });
    },
  });

  // Clear chat history
  const clearChatHistory = useMutation({
    mutationFn: async ({ oldOnly, daysOld }: { oldOnly: boolean; daysOld: number }) => {
      console.log('[Maintenance] Clearing chat history:', { oldOnly, daysOld });
      
      // Get authenticated user - CRITICAL for RLS to work
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const userId = userData.user.id;
      
      let result;
      
      if (oldOnly) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        result = await supabase
          .from('ai_chat_messages')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .lt('created_at', cutoffDate.toISOString());
      } else {
        result = await supabase
          .from('ai_chat_messages')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .not('id', 'is', null);
      }
      
      const { error, count } = result;
      console.log('[Maintenance] Deleted chat messages:', count, 'error:', error);
      if (error) throw error;
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['ai-maintenance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ai-chat-messages'] });
      toast({
        title: 'Histórico limpo',
        description: `${count || 0} mensagens de chat foram removidas.`,
      });
    },
    onError: (error) => {
      console.error('Error clearing chat history:', error);
      toast({
        title: 'Erro ao limpar histórico',
        description: 'Não foi possível remover o histórico de chat.',
        variant: 'destructive',
      });
    },
  });

  // Clear message buffers
  const clearMessageBuffers = useMutation({
    mutationFn: async () => {
      console.log('[Maintenance] Clearing message buffers');
      
      // Get authenticated user - CRITICAL for RLS to work
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const userId = userData.user.id;
      
      const { error, count } = await supabase
        .from('ai_message_buffer')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .not('id', 'is', null);
      
      console.log('[Maintenance] Deleted buffers:', count, 'error:', error);
      if (error) throw error;
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['ai-maintenance-stats'] });
      toast({
        title: 'Buffers limpos',
        description: `${count || 0} buffers de mensagens foram removidos.`,
      });
    },
    onError: (error) => {
      console.error('Error clearing buffers:', error);
      toast({
        title: 'Erro ao limpar buffers',
        description: 'Não foi possível remover os buffers.',
        variant: 'destructive',
      });
    },
  });

  // Clear all data
  const clearAllData = useMutation({
    mutationFn: async ({ oldOnly, daysOld }: { oldOnly: boolean; daysOld: number }) => {
      console.log('[Maintenance] Clearing all data:', { oldOnly, daysOld });
      
      // Get authenticated user - CRITICAL for RLS to work
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const userId = userData.user.id;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffISO = cutoffDate.toISOString();

      let memoriesRes, chatRes, buffersRes;

      if (oldOnly) {
        // Delete old data only
        [memoriesRes, chatRes, buffersRes] = await Promise.all([
          supabase.from('ai_client_memories').delete({ count: 'exact' }).eq('user_id', userId).lt('updated_at', cutoffISO),
          supabase.from('ai_chat_messages').delete({ count: 'exact' }).eq('user_id', userId).lt('created_at', cutoffISO),
          supabase.from('ai_message_buffer').delete({ count: 'exact' }).eq('user_id', userId).lt('created_at', cutoffISO),
        ]);
      } else {
        // Delete ALL data for this user
        [memoriesRes, chatRes, buffersRes] = await Promise.all([
          supabase.from('ai_client_memories').delete({ count: 'exact' }).eq('user_id', userId).not('id', 'is', null),
          supabase.from('ai_chat_messages').delete({ count: 'exact' }).eq('user_id', userId).not('id', 'is', null),
          supabase.from('ai_message_buffer').delete({ count: 'exact' }).eq('user_id', userId).not('id', 'is', null),
        ]);
      }

      console.log('[Maintenance] Deleted data:', {
        memories: memoriesRes.count,
        chat: chatRes.count,
        buffers: buffersRes.count,
        errors: {
          memories: memoriesRes.error,
          chat: chatRes.error,
          buffers: buffersRes.error,
        }
      });

      const errors = [memoriesRes, chatRes, buffersRes].filter(r => r.error);
      if (errors.length > 0) {
        console.error('[Maintenance] Errors:', errors.map(e => e.error));
        throw new Error('Alguns dados não puderam ser removidos');
      }
      
      return {
        memories: memoriesRes.count || 0,
        chat: chatRes.count || 0,
        buffers: buffersRes.count || 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-maintenance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ai-client-memories'] });
      queryClient.invalidateQueries({ queryKey: ['ai-chat-messages'] });
      const total = (data?.memories || 0) + (data?.chat || 0) + (data?.buffers || 0);
      toast({
        title: 'Reset completo',
        description: `${total} registros da IA foram removidos.`,
      });
    },
    onError: (error) => {
      console.error('Error clearing all data:', error);
      toast({
        title: 'Erro no reset',
        description: 'Não foi possível remover todos os dados.',
        variant: 'destructive',
      });
    },
  });

  // Reload agent configurations (invalidate cache)
  const reloadAgentConfigs = useMutation({
    mutationFn: async () => {
      // This forces a re-fetch of all agent configurations
      await queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-agent'] });
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-agent-routing'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-sub-agent-links'] });
      await queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      
      // Small delay to simulate reload
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      toast({
        title: 'Configurações recarregadas',
        description: 'Os prompts e configurações dos agentes serão aplicados na próxima mensagem.',
      });
    },
  });

  return {
    stats,
    isLoadingStats,
    refreshStats,
    clearMemories,
    clearChatHistory,
    clearMessageBuffers,
    clearAllData,
    reloadAgentConfigs,
    isClearingMemories: clearMemories.isPending,
    isClearingChat: clearChatHistory.isPending,
    isClearingBuffers: clearMessageBuffers.isPending,
    isClearingAll: clearAllData.isPending,
    isReloading: reloadAgentConfigs.isPending,
  };
}
