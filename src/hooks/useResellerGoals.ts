import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ResellerGoal {
  id: string;
  userId: string;
  clientGoal: number;
  revenueGoal: number;
  period: 'monthly' | 'quarterly' | 'annual';
  createdAt: Date;
  updatedAt: Date;
}

interface DbResellerGoal {
  id: string;
  user_id: string;
  client_goal: number;
  revenue_goal: number;
  period: string;
  created_at: string;
  updated_at: string;
}

export function useResellerGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<ResellerGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('reseller_goals' as any)
        .select('*')
        .eq('user_id', user.id)
        .single() as { data: DbResellerGoal | null; error: any };

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setGoals({
          id: data.id,
          userId: data.user_id,
          clientGoal: data.client_goal,
          revenueGoal: data.revenue_goal,
          period: data.period as 'monthly' | 'quarterly' | 'annual',
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        });
      } else {
        setGoals(null);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const saveGoals = async (clientGoal: number, revenueGoal: number, period: 'monthly' | 'quarterly' | 'annual') => {
    if (!user) return null;

    try {
      if (goals) {
        // Update existing goals
        const { error } = await supabase
          .from('reseller_goals' as any)
          .update({
            client_goal: clientGoal,
            revenue_goal: revenueGoal,
            period,
            updated_at: new Date().toISOString(),
          })
          .eq('id', goals.id);

        if (error) throw error;

        setGoals({
          ...goals,
          clientGoal,
          revenueGoal,
          period,
          updatedAt: new Date(),
        });
      } else {
        // Create new goals
        const { data, error } = await supabase
          .from('reseller_goals' as any)
          .insert({
            user_id: user.id,
            client_goal: clientGoal,
            revenue_goal: revenueGoal,
            period,
          })
          .select()
          .single() as { data: DbResellerGoal | null; error: any };

        if (error) throw error;

        if (data) {
          setGoals({
            id: data.id,
            userId: data.user_id,
            clientGoal: data.client_goal,
            revenueGoal: data.revenue_goal,
            period: data.period as 'monthly' | 'quarterly' | 'annual',
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
          });
        }
      }

      toast.success('Metas salvas com sucesso!');
      return true;
    } catch (error) {
      console.error('Error saving goals:', error);
      toast.error('Erro ao salvar metas');
      return null;
    }
  };

  const calculateProgress = (current: number, goal: number): number => {
    if (goal === 0) return 0;
    return Math.min(100, (current / goal) * 100);
  };

  return {
    goals,
    isLoading,
    saveGoals,
    calculateProgress,
    refetch: fetchGoals,
  };
}
