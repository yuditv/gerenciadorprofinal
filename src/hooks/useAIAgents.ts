import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  webhook_url: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean | null;
  is_whatsapp_enabled: boolean | null;
  is_chat_enabled: boolean | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
  // Native AI fields
  use_native_ai: boolean | null;
  system_prompt: string | null;
  ai_model: string | null;
  // Message sending config
  response_delay_min: number | null;
  response_delay_max: number | null;
  split_mode: string | null;
  split_delay_min: number | null;
  split_delay_max: number | null;
  max_lines_per_message: number | null;
  max_chars_per_message: number | null;
  typing_simulation: boolean | null;
  // Memory config
  memory_enabled: boolean | null;
  memory_auto_extract: boolean | null;
  memory_sync_clients: boolean | null;
  memory_generate_summary: boolean | null;
  memory_max_items: number | null;
  // Buffer config
  message_buffer_enabled: boolean | null;
  buffer_wait_seconds: number | null;
  buffer_max_messages: number | null;
  // Anti-hallucination
  anti_hallucination_enabled: boolean | null;
  // Canned responses
  use_canned_responses: boolean | null;
  // Agent type and specialization
  agent_type: string | null;
  specialization: string | null;
  consultation_context: string | null;
  // API credential
  api_credential_id: string | null;
}

export interface AIChatMessage {
  id: string;
  agent_id: string;
  user_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  rating?: 'up' | 'down' | null;
}

export interface WhatsAppAgentRouting {
  id: string;
  instance_id: string;
  agent_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  webhook_url?: string;
  icon?: string;
  color?: string;
  is_active?: boolean;
  is_whatsapp_enabled?: boolean;
  is_chat_enabled?: boolean;
  use_native_ai?: boolean;
  system_prompt?: string;
  ai_model?: string;
  // Message sending config
  response_delay_min?: number;
  response_delay_max?: number;
  split_mode?: string;
  split_delay_min?: number;
  split_delay_max?: number;
  max_lines_per_message?: number;
  max_chars_per_message?: number;
  typing_simulation?: boolean;
  // Memory config
  memory_enabled?: boolean;
  memory_auto_extract?: boolean;
  memory_sync_clients?: boolean;
  memory_generate_summary?: boolean;
  memory_max_items?: number;
  // Buffer config
  message_buffer_enabled?: boolean;
  buffer_wait_seconds?: number;
  buffer_max_messages?: number;
  // Anti-hallucination
  anti_hallucination_enabled?: boolean;
  // Canned responses
  use_canned_responses?: boolean;
  // Agent type and specialization
  agent_type?: string;
  specialization?: string;
  consultation_context?: string;
  // API credential
  api_credential_id?: string | null;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  id: string;
}

export function useAIAgents() {
  const queryClient = useQueryClient();

  // Fetch all agents (respects RLS - admins see all, users see active only)
  const { data: agents = [], isLoading: isLoadingAgents, refetch: refetchAgents } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching agents:', error);
        throw error;
      }

      return data as AIAgent[];
    },
  });

  // Fetch chat messages for a specific agent/session - returns a stable hook
  const useChatMessages = (agentId: string | null, sessionId?: string) => {
    return useQuery({
      queryKey: ['ai-chat-messages', agentId, sessionId],
      queryFn: async () => {
        if (!agentId) return [];
        
        let query = supabase
          .from('ai_chat_messages')
          .select('*')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: true });

        if (sessionId) {
          query = query.eq('session_id', sessionId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching chat messages:', error);
          throw error;
        }

        return data as AIChatMessage[];
      },
      enabled: !!agentId,
    });
  };

  // Create a new agent (admin only)
  const createAgent = useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('ai_agents')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating agent:', error);
        throw error;
      }

      return data as AIAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente criado com sucesso!');
    },
    onError: (error) => {
      console.error('Create agent error:', error);
      toast.error('Erro ao criar agente. Verifique suas permissões.');
    },
  });

  // Update an agent (admin only)
  const updateAgent = useMutation({
    mutationFn: async ({ id, ...input }: UpdateAgentInput) => {
      const { data, error } = await supabase
        .from('ai_agents')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating agent:', error);
        throw error;
      }

      return data as AIAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Update agent error:', error);
      toast.error('Erro ao atualizar agente.');
    },
  });

  // Delete an agent (admin only)
  const deleteAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agentId);

      if (error) {
        console.error('Error deleting agent:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente removido com sucesso!');
    },
    onError: (error) => {
      console.error('Delete agent error:', error);
      toast.error('Erro ao remover agente.');
    },
  });

  // Toggle agent active status
  const toggleAgentActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('ai_agents')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error toggling agent:', error);
        throw error;
      }

      return data as AIAgent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success(data.is_active ? 'Agente ativado!' : 'Agente desativado!');
    },
    onError: (error) => {
      console.error('Toggle agent error:', error);
      toast.error('Erro ao alterar status do agente.');
    },
  });

  // Send message to agent
  const sendMessage = useMutation({
    mutationFn: async ({ 
      agentId, 
      message, 
      sessionId,
      source = 'web',
      metadata = {}
    }: { 
      agentId: string; 
      message: string; 
      sessionId?: string;
      source?: 'web' | 'whatsapp';
      metadata?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-agent-chat', {
        body: { agentId, message, sessionId, source, metadata },
      });

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['ai-chat-messages', variables.agentId] 
      });
    },
    onError: (error) => {
      console.error('Send message error:', error);
      toast.error('Erro ao enviar mensagem.');
    },
  });

  // Clear chat history for a session
  const clearChatHistory = useMutation({
    mutationFn: async ({ agentId, sessionId }: { agentId: string; sessionId: string }) => {
      const { error } = await supabase
        .from('ai_chat_messages')
        .delete()
        .eq('agent_id', agentId)
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error clearing chat:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['ai-chat-messages', variables.agentId] 
      });
      toast.success('Histórico limpo!');
    },
    onError: (error) => {
      console.error('Clear chat error:', error);
      toast.error('Erro ao limpar histórico.');
    },
  });

  // Rate a message (thumbs up/down)
  const rateMessage = useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: string; rating: 'up' | 'down' | null }) => {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .update({ rating })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        console.error('Error rating message:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['ai-chat-messages', data.agent_id] 
      });
      if (data.rating === 'up') {
        toast.success('Obrigado pelo feedback positivo!');
      } else if (data.rating === 'down') {
        toast.success('Obrigado pelo feedback. Vamos melhorar!');
      }
    },
    onError: (error) => {
      console.error('Rate message error:', error);
      toast.error('Erro ao registrar avaliação.');
    },
  });

  // Fetch agent routings (for admin)
  const { data: agentRoutings = [], isLoading: isLoadingRoutings, refetch: refetchRoutings } = useQuery({
    queryKey: ['whatsapp-agent-routings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_agent_routing')
        .select(`
          *,
          instance:whatsapp_instances(id, instance_name, status),
          agent:ai_agents(id, name, color)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching routings:', error);
        throw error;
      }

      return data;
    },
  });

  // Create or update agent routing
  const upsertRouting = useMutation({
    mutationFn: async ({ instanceId, agentId, isActive = true }: { instanceId: string; agentId: string; isActive?: boolean }) => {
      const { data, error } = await supabase
        .from('whatsapp_agent_routing')
        .upsert({
          instance_id: instanceId,
          agent_id: agentId,
          is_active: isActive,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'instance_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting routing:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-agent-routings'] });
      toast.success('Roteamento configurado com sucesso!');
    },
    onError: (error) => {
      console.error('Upsert routing error:', error);
      toast.error('Erro ao configurar roteamento.');
    },
  });

  // Delete routing
  const deleteRouting = useMutation({
    mutationFn: async (routingId: string) => {
      const { error } = await supabase
        .from('whatsapp_agent_routing')
        .delete()
        .eq('id', routingId);

      if (error) {
        console.error('Error deleting routing:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-agent-routings'] });
      toast.success('Roteamento removido!');
    },
    onError: (error) => {
      console.error('Delete routing error:', error);
      toast.error('Erro ao remover roteamento.');
    },
  });

  return {
    agents,
    isLoadingAgents,
    refetchAgents,
    useChatMessages,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentActive,
    sendMessage,
    clearChatHistory,
    rateMessage,
    agentRoutings,
    isLoadingRoutings,
    refetchRoutings,
    upsertRouting,
    deleteRouting,
  };
}
