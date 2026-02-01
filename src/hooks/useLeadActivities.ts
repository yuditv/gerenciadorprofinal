import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { LeadActivity } from './useKanbanLeads';

export function useLeadActivities(leadId: string | null) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!user || !leadId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActivities((data || []) as LeadActivity[]);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, leadId]);

  const createActivity = useCallback(async (activityData: Partial<LeadActivity>) => {
    if (!user || !leadId) return null;

    try {
      const { data, error } = await supabase
        .from('crm_lead_activities')
        .insert({
          lead_id: leadId,
          user_id: user.id,
          activity_type: activityData.activity_type || 'note',
          title: activityData.title || '',
          description: activityData.description,
          scheduled_at: activityData.scheduled_at,
          completed_at: activityData.completed_at,
          metadata: activityData.metadata,
        })
        .select()
        .single();

      if (error) throw error;

      setActivities(prev => [data as LeadActivity, ...prev]);
      toast.success('Atividade registrada!');
      return data;
    } catch (error) {
      console.error('Error creating activity:', error);
      toast.error('Erro ao registrar atividade');
      return null;
    }
  }, [user, leadId]);

  const updateActivity = useCallback(async (activityId: string, updates: Partial<LeadActivity>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_activities')
        .update({
          title: updates.title,
          description: updates.description,
          scheduled_at: updates.scheduled_at,
          completed_at: updates.completed_at,
        })
        .eq('id', activityId)
        .eq('user_id', user.id);

      if (error) throw error;

      setActivities(prev => prev.map(a => 
        a.id === activityId ? { ...a, ...updates } : a
      ));
      return true;
    } catch (error) {
      console.error('Error updating activity:', error);
      return false;
    }
  }, [user]);

  const deleteActivity = useCallback(async (activityId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_activities')
        .delete()
        .eq('id', activityId)
        .eq('user_id', user.id);

      if (error) throw error;

      setActivities(prev => prev.filter(a => a.id !== activityId));
      toast.success('Atividade excluída!');
      return true;
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Erro ao excluir atividade');
      return false;
    }
  }, [user]);

  const markAsCompleted = useCallback(async (activityId: string) => {
    return updateActivity(activityId, { completed_at: new Date().toISOString() });
  }, [updateActivity]);

  return {
    activities,
    isLoading,
    fetchActivities,
    createActivity,
    updateActivity,
    deleteActivity,
    markAsCompleted,
  };
}
