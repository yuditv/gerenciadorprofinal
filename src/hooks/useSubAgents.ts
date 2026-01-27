import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// Simplified sub-agent info (not the full AIAgent)
export interface SubAgentInfo {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean | null;
  specialization: string | null;
  agent_type: string | null;
  system_prompt: string | null;
  consultation_context: string | null;
}

export interface SubAgentLink {
  id: string;
  principal_agent_id: string;
  sub_agent_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sub_agent?: SubAgentInfo;
}

export interface CreateSubAgentLinkInput {
  principal_agent_id: string;
  sub_agent_id: string;
  priority?: number;
  is_active?: boolean;
}

export interface UpdateSubAgentLinkInput {
  id: string;
  priority?: number;
  is_active?: boolean;
}

export function useSubAgents(principalAgentId?: string) {
  const queryClient = useQueryClient();

  // Fetch all sub-agent links for a principal agent
  const { 
    data: subAgentLinks = [], 
    isLoading: isLoadingLinks, 
    refetch: refetchLinks 
  } = useQuery({
    queryKey: ['sub-agent-links', principalAgentId],
    queryFn: async () => {
      if (!principalAgentId) return [];

      const { data, error } = await supabase
        .from('ai_sub_agent_links')
        .select(`
          *,
          sub_agent:ai_agents!ai_sub_agent_links_sub_agent_id_fkey(
            id, name, description, color, icon, is_active, specialization, 
            agent_type, system_prompt, consultation_context
          )
        `)
        .eq('principal_agent_id', principalAgentId)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error fetching sub-agent links:', error);
        throw error;
      }

      return data as SubAgentLink[];
    },
    enabled: !!principalAgentId,
  });

  // Fetch all available sub-agents (agents with agent_type = 'sub_agent')
  const { 
    data: availableSubAgents = [], 
    isLoading: isLoadingAvailable 
  } = useQuery({
    queryKey: ['available-sub-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, description, color, icon, is_active, specialization, agent_type, system_prompt, consultation_context')
        .eq('agent_type', 'sub_agent')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching available sub-agents:', error);
        throw error;
      }

      return data as SubAgentInfo[];
    },
  });

  // Create a new sub-agent link
  const createLink = useMutation({
    mutationFn: async (input: CreateSubAgentLinkInput) => {
      const { data, error } = await supabase
        .from('ai_sub_agent_links')
        .insert({
          principal_agent_id: input.principal_agent_id,
          sub_agent_id: input.sub_agent_id,
          priority: input.priority || 1,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating sub-agent link:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-links'] });
      toast.success('Sub-Agente vinculado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Create link error:', error);
      if (error.code === '23505') {
        toast.error('Este Sub-Agente já está vinculado.');
      } else {
        toast.error('Erro ao vincular Sub-Agente.');
      }
    },
  });

  // Update a sub-agent link (priority or active status)
  const updateLink = useMutation({
    mutationFn: async ({ id, ...input }: UpdateSubAgentLinkInput) => {
      const { data, error } = await supabase
        .from('ai_sub_agent_links')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating sub-agent link:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-links'] });
      toast.success('Vínculo atualizado!');
    },
    onError: (error) => {
      console.error('Update link error:', error);
      toast.error('Erro ao atualizar vínculo.');
    },
  });

  // Delete a sub-agent link
  const deleteLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('ai_sub_agent_links')
        .delete()
        .eq('id', linkId);

      if (error) {
        console.error('Error deleting sub-agent link:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-links'] });
      toast.success('Sub-Agente desvinculado!');
    },
    onError: (error) => {
      console.error('Delete link error:', error);
      toast.error('Erro ao desvincular Sub-Agente.');
    },
  });

  // Reorder sub-agents (update priorities)
  const reorderLinks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        priority: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('ai_sub_agent_links')
          .update({ priority: update.priority })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-links'] });
      toast.success('Ordem atualizada!');
    },
    onError: (error) => {
      console.error('Reorder error:', error);
      toast.error('Erro ao reordenar.');
    },
  });

  // Toggle link active status
  const toggleLinkActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('ai_sub_agent_links')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-links'] });
      toast.success(data.is_active ? 'Sub-Agente ativado!' : 'Sub-Agente desativado!');
    },
    onError: (error) => {
      console.error('Toggle error:', error);
      toast.error('Erro ao alterar status.');
    },
  });

  // Get linked sub-agents that are not yet linked to this principal
  const getUnlinkedSubAgents = () => {
    const linkedIds = subAgentLinks.map(link => link.sub_agent_id);
    return availableSubAgents.filter(agent => !linkedIds.includes(agent.id));
  };

  return {
    subAgentLinks,
    isLoadingLinks,
    refetchLinks,
    availableSubAgents,
    isLoadingAvailable,
    getUnlinkedSubAgents,
    createLink,
    updateLink,
    deleteLink,
    reorderLinks,
    toggleLinkActive,
  };
}
