import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AgentStatus {
  id: string;
  user_id: string;
  status: 'online' | 'busy' | 'offline';
  auto_offline: boolean;
  last_seen_at: string;
  // Joined
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useAgentStatus() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [myStatus, setMyStatus] = useState<AgentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('agent_status')
        .select('*')
        .order('status');

      if (error) throw error;
      
      const agentsData = (data || []).map(a => ({
        ...a,
        status: a.status as 'online' | 'busy' | 'offline'
      }));
      setAgents(agentsData);
      
      if (user) {
        const myAgent = agentsData.find(a => a.user_id === user.id);
        setMyStatus(myAgent || null);
      }
    } catch (error) {
      console.error('Error fetching agent status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateStatus = async (status: 'online' | 'busy' | 'offline') => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from('agent_status')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('agent_status')
          .update({ 
            status, 
            last_seen_at: new Date().toISOString() 
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('agent_status')
          .insert({ 
            user_id: user.id, 
            status,
            last_seen_at: new Date().toISOString()
          });
      }

      await fetchAgents();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Set online when component mounts
  useEffect(() => {
    if (user) {
      updateStatus('online');
    }

    // Set offline on unmount/page close
    const handleBeforeUnload = () => {
      if (user) {
        navigator.sendBeacon(
          `https://tlanmmbgyyxuqvezudir.supabase.co/rest/v1/agent_status?user_id=eq.${user.id}`,
          JSON.stringify({ status: 'offline' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('agent-status-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_status' },
        () => {
          fetchAgents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgents]);

  const onlineAgents = agents.filter(a => a.status === 'online');
  const busyAgents = agents.filter(a => a.status === 'busy');
  const offlineAgents = agents.filter(a => a.status === 'offline');

  return {
    agents,
    myStatus,
    isLoading,
    updateStatus,
    onlineAgents,
    busyAgents,
    offlineAgents,
    refetch: fetchAgents
  };
}
