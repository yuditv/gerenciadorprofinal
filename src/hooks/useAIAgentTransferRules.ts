import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIAgentTransferRule {
  id: string;
  user_id: string;
  source_agent_id: string;
  target_agent_id: string;
  trigger_keywords: string[];
  transfer_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  source_agent?: {
    id: string;
    name: string;
    color: string;
  };
  target_agent?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface CreateTransferRuleData {
  source_agent_id: string;
  target_agent_id: string;
  trigger_keywords: string[];
  transfer_message?: string;
  is_active?: boolean;
}

export interface UpdateTransferRuleData extends Partial<CreateTransferRuleData> {
  id: string;
}

export function useAIAgentTransferRules() {
  const queryClient = useQueryClient();

  // Fetch all transfer rules with agent details
  const { data: rules = [], isLoading: isLoadingRules } = useQuery({
    queryKey: ['ai-agent-transfer-rules'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('ai_agent_transfer_rules')
        .select(`
          *,
          source_agent:ai_agents!ai_agent_transfer_rules_source_agent_id_fkey(id, name, color),
          target_agent:ai_agents!ai_agent_transfer_rules_target_agent_id_fkey(id, name, color)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AIAgentTransferRule[];
    }
  });

  // Create new transfer rule
  const createRule = useMutation({
    mutationFn: async (ruleData: CreateTransferRuleData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('ai_agent_transfer_rules')
        .insert({
          user_id: user.id,
          source_agent_id: ruleData.source_agent_id,
          target_agent_id: ruleData.target_agent_id,
          trigger_keywords: ruleData.trigger_keywords,
          transfer_message: ruleData.transfer_message || null,
          is_active: ruleData.is_active ?? true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-transfer-rules'] });
      toast.success('Regra de transferência criada!');
    },
    onError: (error: Error) => {
      console.error('Error creating transfer rule:', error);
      toast.error(`Erro ao criar regra: ${error.message}`);
    }
  });

  // Update transfer rule
  const updateRule = useMutation({
    mutationFn: async (ruleData: UpdateTransferRuleData) => {
      const { id, ...updates } = ruleData;

      const { data, error } = await supabase
        .from('ai_agent_transfer_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-transfer-rules'] });
      toast.success('Regra atualizada!');
    },
    onError: (error: Error) => {
      console.error('Error updating transfer rule:', error);
      toast.error(`Erro ao atualizar regra: ${error.message}`);
    }
  });

  // Delete transfer rule
  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('ai_agent_transfer_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-transfer-rules'] });
      toast.success('Regra removida!');
    },
    onError: (error: Error) => {
      console.error('Error deleting transfer rule:', error);
      toast.error(`Erro ao remover regra: ${error.message}`);
    }
  });

  // Toggle rule active status
  const toggleRuleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ai_agent_transfer_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-transfer-rules'] });
    },
    onError: (error: Error) => {
      console.error('Error toggling rule:', error);
      toast.error(`Erro ao alterar regra: ${error.message}`);
    }
  });

  return {
    rules,
    isLoadingRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRuleActive
  };
}
