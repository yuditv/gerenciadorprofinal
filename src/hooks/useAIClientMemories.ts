import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface AIClientMemory {
  id: string;
  user_id: string;
  agent_id: string | null;
  phone: string;
  client_name: string | null;
  nickname: string | null;
  device: string | null;
  app_name: string | null;
  plan_name: string | null;
  plan_price: number | null;
  purchase_date: string | null;
  expiration_date: string | null;
  custom_memories: CustomMemory[];
  ai_summary: string | null;
  is_vip: boolean;
  sentiment: string;
  last_interaction_at: string;
  total_interactions: number;
  created_at: string;
  updated_at: string;
}

export interface CustomMemory {
  key: string;
  value: string;
  extracted_at?: string;
}

// Helper function to safely parse custom_memories from JSON
function parseCustomMemories(data: Json | null): CustomMemory[] {
  if (!data) return [];
  if (!Array.isArray(data)) return [];
  
  return data.map(item => {
    if (typeof item === 'object' && item !== null && 'key' in item && 'value' in item) {
      return {
        key: String((item as Record<string, unknown>).key),
        value: String((item as Record<string, unknown>).value),
        extracted_at: (item as Record<string, unknown>).extracted_at ? String((item as Record<string, unknown>).extracted_at) : undefined,
      };
    }
    return { key: '', value: '' };
  }).filter(m => m.key !== '');
}

// Helper to transform DB row to AIClientMemory
function transformMemory(row: Record<string, unknown>): AIClientMemory {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    agent_id: row.agent_id ? String(row.agent_id) : null,
    phone: String(row.phone),
    client_name: row.client_name ? String(row.client_name) : null,
    nickname: row.nickname ? String(row.nickname) : null,
    device: row.device ? String(row.device) : null,
    app_name: row.app_name ? String(row.app_name) : null,
    plan_name: row.plan_name ? String(row.plan_name) : null,
    plan_price: row.plan_price ? Number(row.plan_price) : null,
    purchase_date: row.purchase_date ? String(row.purchase_date) : null,
    expiration_date: row.expiration_date ? String(row.expiration_date) : null,
    custom_memories: parseCustomMemories(row.custom_memories as Json),
    ai_summary: row.ai_summary ? String(row.ai_summary) : null,
    is_vip: Boolean(row.is_vip),
    sentiment: String(row.sentiment || 'neutral'),
    last_interaction_at: String(row.last_interaction_at),
    total_interactions: Number(row.total_interactions || 1),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function useAIClientMemories(agentId?: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all memories for a specific agent
  const { data: memories = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-client-memories', agentId],
    queryFn: async () => {
      let query = supabase
        .from('ai_client_memories')
        .select('*')
        .order('last_interaction_at', { ascending: false });
      
      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []).map(row => transformMemory(row as unknown as Record<string, unknown>));
    },
    enabled: true,
  });

  // Fetch memory for a specific phone
  const getMemoryByPhone = async (phone: string, specificAgentId?: string): Promise<AIClientMemory | null> => {
    let query = supabase
      .from('ai_client_memories')
      .select('*')
      .eq('phone', phone);
    
    if (specificAgentId) {
      query = query.eq('agent_id', specificAgentId);
    }

    const { data, error } = await query.maybeSingle();
    
    if (error) {
      console.error('Error fetching memory:', error);
      return null;
    }
    
    if (data) {
      return transformMemory(data as unknown as Record<string, unknown>);
    }
    
    return null;
  };

  // Create or update memory
  const upsertMemory = useMutation({
    mutationFn: async (memory: Partial<AIClientMemory> & { phone: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { custom_memories, ...rest } = memory;

      const { data, error } = await supabase
        .from('ai_client_memories')
        .upsert({
          ...rest,
          custom_memories: custom_memories as unknown as Json,
          user_id: userData.user.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,agent_id,phone'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-client-memories'] });
      toast({
        title: 'Memória salva',
        description: 'As informações do cliente foram atualizadas.',
      });
    },
    onError: (error) => {
      console.error('Error saving memory:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as memórias do cliente.',
        variant: 'destructive',
      });
    },
  });

  // Add custom memory
  const addCustomMemory = useMutation({
    mutationFn: async ({ 
      phone, 
      agentId: memAgentId, 
      key, 
      value 
    }: { 
      phone: string; 
      agentId?: string; 
      key: string; 
      value: string;
    }) => {
      const existingMemory = await getMemoryByPhone(phone, memAgentId);
      
      const newMemory: CustomMemory = {
        key,
        value,
        extracted_at: new Date().toISOString(),
      };

      const customMemories = existingMemory?.custom_memories || [];
      
      // Check if key already exists and update it
      const existingIndex = customMemories.findIndex(m => m.key === key);
      if (existingIndex >= 0) {
        customMemories[existingIndex] = newMemory;
      } else {
        customMemories.push(newMemory);
      }

      return upsertMemory.mutateAsync({
        phone,
        agent_id: memAgentId || null,
        custom_memories: customMemories,
      });
    },
  });

  // Delete memory
  const deleteMemory = useMutation({
    mutationFn: async (memoryId: string) => {
      const { error } = await supabase
        .from('ai_client_memories')
        .delete()
        .eq('id', memoryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-client-memories'] });
      toast({
        title: 'Memória excluída',
        description: 'As memórias do cliente foram removidas.',
      });
    },
    onError: (error) => {
      console.error('Error deleting memory:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir as memórias.',
        variant: 'destructive',
      });
    },
  });

  // Clear all custom memories for a phone
  const clearCustomMemories = useMutation({
    mutationFn: async ({ phone, agentId: memAgentId }: { phone: string; agentId?: string }) => {
      const existingMemory = await getMemoryByPhone(phone, memAgentId);
      
      if (existingMemory) {
        return upsertMemory.mutateAsync({
          ...existingMemory,
          custom_memories: [],
          ai_summary: null,
        });
      }
    },
  });

  return {
    memories,
    isLoading,
    refetch,
    getMemoryByPhone,
    upsertMemory,
    addCustomMemory,
    deleteMemory,
    clearCustomMemories,
  };
}

// Hook to fetch memory for a specific phone number
export function useAIClientMemoryByPhone(phone: string | null, agentId?: string | null) {
  return useQuery({
    queryKey: ['ai-client-memory', phone, agentId],
    queryFn: async () => {
      if (!phone) return null;

      let query = supabase
        .from('ai_client_memories')
        .select('*')
        .eq('phone', phone);
      
      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error('Error fetching memory by phone:', error);
        return null;
      }
      
      if (data) {
        return transformMemory(data as unknown as Record<string, unknown>);
      }
      
      return null;
    },
    enabled: !!phone,
  });
}
