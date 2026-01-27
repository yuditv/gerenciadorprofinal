import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface WarmingSession {
  id: string;
  user_id: string;
  name: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'scheduled';
  selected_instances: string[];
  balancing_mode: 'auto' | 'round-robin' | 'random';
  conversation_speed: 'slow' | 'normal' | 'fast';
  daily_limit: number;
  use_ai: boolean;
  templates: string[];
  messages_sent: number;
  messages_received: number;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  scheduled_start_time: string | null;
  schedule_enabled: boolean;
  schedule_recurrence: 'none' | 'daily' | 'weekly' | null;
  schedule_days: number[] | null; // 0=Sun, 1=Mon, etc.
  created_at: string;
  updated_at: string;
}

export interface WarmingLog {
  id: string;
  session_id: string;
  from_instance_id: string;
  to_instance_id: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  ai_generated: boolean;
  error_message: string | null;
  created_at: string;
}

export function useWarmingSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WarmingSession[]>([]);
  const [currentSession, setCurrentSession] = useState<WarmingSession | null>(null);
  const [logs, setLogs] = useState<WarmingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch sessions using raw query to avoid type issues with new tables
  const fetchSessions = useCallback(async () => {
    if (!user) return;
    
    try {
      // Using any to bypass type checking for new tables not in generated types
      const { data, error } = await (supabase as any)
        .from('warming_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSessions((data || []) as WarmingSession[]);
      
      // Set current session if there's an active one
      const activeSession = (data as WarmingSession[] | null)?.find(
        s => s.status === 'running' || s.status === 'paused'
      );
      if (activeSession) {
        setCurrentSession(activeSession);
      }
    } catch (error) {
      console.error('Error fetching warming sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch logs for a session
  const fetchLogs = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('warming_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data || []) as WarmingLog[]);
    } catch (error) {
      console.error('Error fetching warming logs:', error);
    }
  }, []);

  // Create or update session
  const saveSession = useCallback(async (sessionData: Partial<WarmingSession>) => {
    if (!user) return null;

    try {
      if (currentSession?.id) {
        // Update existing session
        const { data, error } = await (supabase as any)
          .from('warming_sessions')
          .update({
            ...sessionData,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSession.id)
          .select()
          .single();

        if (error) throw error;
        setCurrentSession(data as WarmingSession);
        return data as WarmingSession;
      } else {
        // Create new session
        const { data, error } = await (supabase as any)
          .from('warming_sessions')
          .insert({
            user_id: user.id,
            ...sessionData
          })
          .select()
          .single();

        if (error) throw error;
        const typedData = data as WarmingSession;
        setCurrentSession(typedData);
        setSessions(prev => [typedData, ...prev]);
        return typedData;
      }
    } catch (error) {
      console.error('Error saving warming session:', error);
      toast.error('Erro ao salvar sessão de aquecimento');
      return null;
    }
  }, [user, currentSession]);

  // Start warming
  const startWarming = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('warming-worker', {
        body: { action: 'start', session_id: sessionId, user_id: user?.id }
      });

      if (error) throw error;
      
      toast.success('Aquecimento iniciado!');
      await fetchSessions();
      return data;
    } catch (error) {
      console.error('Error starting warming:', error);
      toast.error('Erro ao iniciar aquecimento');
      return null;
    }
  }, [user, fetchSessions]);

  // Pause warming
  const pauseWarming = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('warming-worker', {
        body: { action: 'pause', session_id: sessionId }
      });

      if (error) throw error;
      
      toast.info('Aquecimento pausado');
      await fetchSessions();
    } catch (error) {
      console.error('Error pausing warming:', error);
      toast.error('Erro ao pausar aquecimento');
    }
  }, [fetchSessions]);

  // Stop warming
  const stopWarming = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('warming-worker', {
        body: { action: 'stop', session_id: sessionId }
      });

      if (error) throw error;
      
      toast.info('Aquecimento finalizado');
      await fetchSessions();
    } catch (error) {
      console.error('Error stopping warming:', error);
      toast.error('Erro ao parar aquecimento');
    }
  }, [fetchSessions]);

  // Get real-time status
  const getStatus = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('warming-worker', {
        body: { action: 'status', session_id: sessionId }
      });

      if (error) throw error;
      
      if (data?.session) {
        setCurrentSession(data.session as WarmingSession);
      }
      if (data?.logs) {
        setLogs(data.logs as WarmingLog[]);
      }
      
      return data;
    } catch (error) {
      console.error('Error getting status:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Real-time subscription for warming logs
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'running') return;

    // Subscribe to real-time log inserts
    const channel = supabase
      .channel(`warming-logs-${currentSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'warming_logs',
          filter: `session_id=eq.${currentSession.id}`,
        },
        (payload) => {
          const newLog = payload.new as WarmingLog;
          
          // Add to logs state
          setLogs(prev => [newLog, ...prev.slice(0, 49)]);
          
          // Show notification
          if (newLog.status === 'sent') {
            toast.success(
              `📤 Mensagem enviada${newLog.ai_generated ? ' (IA)' : ''}: "${newLog.message.substring(0, 30)}..."`,
              { duration: 3000 }
            );
          } else if (newLog.status === 'failed') {
            toast.error(
              `❌ Falha no envio: ${newLog.error_message || 'Erro desconhecido'}`,
              { duration: 4000 }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession]);

  // Real-time subscription for session updates
  useEffect(() => {
    if (!currentSession) return;

    const channel = supabase
      .channel(`warming-session-${currentSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'warming_sessions',
          filter: `id=eq.${currentSession.id}`,
        },
        (payload) => {
          const updatedSession = payload.new as WarmingSession;
          setCurrentSession(updatedSession);
          
          // Notify on status changes
          if (updatedSession.status === 'completed') {
            toast.success('🎉 Aquecimento concluído!', { duration: 5000 });
          } else if (updatedSession.status === 'error') {
            toast.error('⚠️ Erro no aquecimento', { duration: 5000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession]);

  // Poll for status updates when session is running (fallback)
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'running') return;

    const interval = setInterval(() => {
      getStatus(currentSession.id);
    }, 10000); // Increased to 10s since we have realtime now

    return () => clearInterval(interval);
  }, [currentSession, getStatus]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      // Delete logs first
      await (supabase as any).from('warming_logs').delete().eq('session_id', sessionId);
      // Then delete session
      const { error } = await (supabase as any).from('warming_sessions').delete().eq('id', sessionId);
      
      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      
      toast.success('Sessão excluída');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Erro ao excluir sessão');
    }
  }, [currentSession]);

  return {
    sessions,
    currentSession,
    logs,
    isLoading,
    saveSession,
    startWarming,
    pauseWarming,
    stopWarming,
    getStatus,
    fetchLogs,
    setCurrentSession,
    fetchSessions,
    deleteSession
  };
}
