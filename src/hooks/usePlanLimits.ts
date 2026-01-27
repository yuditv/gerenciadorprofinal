import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';

export type PlanType = 'trial' | 'starter' | 'pro' | 'enterprise' | 'expired';

interface PlanLimits {
  dailyDispatches: number;
  whatsappInstances: number;
  aiAgents: number;
  canAccessChipWarming: boolean;
  canAccessAIAgent: boolean;
  canCreateSubAgents: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  trial: {
    dailyDispatches: 10,
    whatsappInstances: 1,
    aiAgents: 1,
    canAccessChipWarming: false,
    canAccessAIAgent: true, // Trial can access AI Agent tab
    canCreateSubAgents: false,
  },
  starter: {
    dailyDispatches: 200,
    whatsappInstances: 1,
    aiAgents: 0,
    canAccessChipWarming: false,
    canAccessAIAgent: false,
    canCreateSubAgents: false,
  },
  pro: {
    dailyDispatches: 500,
    whatsappInstances: 3,
    aiAgents: 2,
    canAccessChipWarming: true,
    canAccessAIAgent: true,
    canCreateSubAgents: false,
  },
  enterprise: {
    dailyDispatches: -1, // unlimited
    whatsappInstances: -1, // unlimited
    aiAgents: -1, // unlimited
    canAccessChipWarming: true,
    canAccessAIAgent: true,
    canCreateSubAgents: true,
  },
  expired: {
    dailyDispatches: 0,
    whatsappInstances: 0,
    aiAgents: 0,
    canAccessChipWarming: false,
    canAccessAIAgent: false,
    canCreateSubAgents: false,
  },
};

export function usePlanLimits() {
  const { user } = useAuth();
  const { subscription, isActive, isOnTrial } = useSubscription();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentDispatchCount, setCurrentDispatchCount] = useState(0);
  const [whatsappInstanceCount, setWhatsappInstanceCount] = useState(0);
  const [aiAgentCount, setAiAgentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        setIsAdmin(!error && !!data);
      } catch {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Determine plan type
  const planType = useMemo((): PlanType => {
    // Admin bypasses all limits
    if (isAdmin) return 'enterprise';
    
    // Check if subscription is expired
    if (!isActive()) return 'expired';
    
    // Check if user is on trial
    if (isOnTrial()) return 'trial';
    
    // Get plan type from subscription
    const planName = subscription?.plan?.plan_type || subscription?.plan?.name?.toLowerCase() || 'starter';
    
    if (planName.includes('enterprise') || planName === 'enterprise') return 'enterprise';
    if (planName.includes('pro') || planName === 'pro') return 'pro';
    
    return 'starter';
  }, [isAdmin, isActive, isOnTrial, subscription]);

  const limits = useMemo(() => PLAN_LIMITS[planType], [planType]);

  // Fetch current usage counts
  const fetchUsageCounts = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all counts in parallel
      const [dispatchResult, instanceResult, agentResult] = await Promise.all([
        supabase
          .from('user_daily_dispatches')
          .select('dispatch_count')
          .eq('user_id', user.id)
          .eq('dispatch_date', today)
          .maybeSingle(),
        supabase
          .from('whatsapp_instances')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('ai_agents')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .neq('agent_type', 'sub_agent'),
      ]);

      setCurrentDispatchCount(dispatchResult.data?.dispatch_count || 0);
      setWhatsappInstanceCount(instanceResult.count || 0);
      setAiAgentCount(agentResult.count || 0);
    } catch (error) {
      console.error('Error fetching usage counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsageCounts();
  }, [fetchUsageCounts]);

  // Check functions
  const canDispatch = useCallback((count: number = 1): boolean => {
    if (isAdmin) return true;
    if (limits.dailyDispatches === -1) return true;
    return currentDispatchCount + count <= limits.dailyDispatches;
  }, [isAdmin, limits.dailyDispatches, currentDispatchCount]);

  const canCreateWhatsAppInstance = useCallback((): boolean => {
    if (isAdmin) return true;
    if (limits.whatsappInstances === -1) return true;
    return whatsappInstanceCount < limits.whatsappInstances;
  }, [isAdmin, limits.whatsappInstances, whatsappInstanceCount]);

  const canCreateAIAgent = useCallback((): boolean => {
    if (isAdmin) return true;
    if (limits.aiAgents === 0) return false;
    if (limits.aiAgents === -1) return true;
    return aiAgentCount < limits.aiAgents;
  }, [isAdmin, limits.aiAgents, aiAgentCount]);

  const canAccessChipWarming = useCallback((): boolean => {
    if (isAdmin) return true;
    return limits.canAccessChipWarming;
  }, [isAdmin, limits.canAccessChipWarming]);

  const canAccessAIAgent = useCallback((): boolean => {
    if (isAdmin) return true;
    return limits.canAccessAIAgent;
  }, [isAdmin, limits.canAccessAIAgent]);

  const canCreateSubAgents = useCallback((): boolean => {
    if (isAdmin) return true;
    return limits.canCreateSubAgents;
  }, [isAdmin, limits.canCreateSubAgents]);

  // Get remaining counts
  const getRemainingDispatches = useCallback((): number => {
    if (limits.dailyDispatches === -1) return Infinity;
    return Math.max(0, limits.dailyDispatches - currentDispatchCount);
  }, [limits.dailyDispatches, currentDispatchCount]);

  const getRemainingWhatsAppInstances = useCallback((): number => {
    if (limits.whatsappInstances === -1) return Infinity;
    return Math.max(0, limits.whatsappInstances - whatsappInstanceCount);
  }, [limits.whatsappInstances, whatsappInstanceCount]);

  const getRemainingAIAgents = useCallback((): number => {
    if (limits.aiAgents === -1) return Infinity;
    return Math.max(0, limits.aiAgents - aiAgentCount);
  }, [limits.aiAgents, aiAgentCount]);

  // Increment dispatch count
  const incrementDispatchCount = useCallback(async (count: number = 1): Promise<boolean> => {
    if (!user) return false;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Try to upsert the dispatch count
      const { error } = await supabase
        .from('user_daily_dispatches')
        .upsert(
          {
            user_id: user.id,
            dispatch_date: today,
            dispatch_count: currentDispatchCount + count,
          },
          {
            onConflict: 'user_id,dispatch_date',
          }
        );

      if (error) throw error;

      setCurrentDispatchCount(prev => prev + count);
      return true;
    } catch (error) {
      console.error('Error incrementing dispatch count:', error);
      return false;
    }
  }, [user, currentDispatchCount]);

  return {
    planType,
    limits,
    isLoading,
    currentDispatchCount,
    whatsappInstanceCount,
    aiAgentCount,
    canDispatch,
    canCreateWhatsAppInstance,
    canCreateAIAgent,
    canAccessChipWarming,
    canAccessAIAgent,
    canCreateSubAgents,
    getRemainingDispatches,
    getRemainingWhatsAppInstances,
    getRemainingAIAgents,
    incrementDispatchCount,
    refetch: fetchUsageCounts,
  };
}
