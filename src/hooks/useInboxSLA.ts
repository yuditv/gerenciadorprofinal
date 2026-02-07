import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { toast } from 'sonner';

export interface SLAConfig {
  id: string;
  user_id: string;
  name: string;
  first_response_minutes: number;
  resolution_minutes: number;
  priority_multipliers: Record<string, number>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLAStatus {
  isBreached: boolean;
  isWarning: boolean;
  remainingMinutes: number;
  type: 'first_response' | 'resolution';
}

export function useInboxSLA() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [config, setConfig] = useState<SLAConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = ownerId || user?.id;

  const fetchConfig = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('inbox_sla_config')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setConfig(data as SLAConfig | null);
    } catch (error) {
      console.error('Error fetching SLA config:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (updates: Partial<SLAConfig>) => {
    if (!effectiveUserId) return;
    try {
      const { data: existing } = await supabase
        .from('inbox_sla_config')
        .select('id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('inbox_sla_config')
          .update(updates)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('inbox_sla_config')
          .insert({ user_id: effectiveUserId, ...updates });
      }
      await fetchConfig();
      toast.success('SLA atualizado');
    } catch (error) {
      console.error('Error saving SLA config:', error);
      toast.error('Erro ao salvar SLA');
    }
  };

  const getSLAStatus = useCallback((
    createdAt: string,
    firstReplyAt: string | null,
    priority: string
  ): SLAStatus | null => {
    if (!config || !config.is_active) return null;

    const multiplier = config.priority_multipliers[priority] || 1;
    const now = Date.now();
    const created = new Date(createdAt).getTime();

    if (!firstReplyAt) {
      const slaMinutes = config.first_response_minutes * multiplier;
      const elapsedMinutes = (now - created) / 60000;
      const remaining = slaMinutes - elapsedMinutes;
      return {
        type: 'first_response',
        isBreached: remaining <= 0,
        isWarning: remaining > 0 && remaining <= slaMinutes * 0.25,
        remainingMinutes: Math.round(remaining),
      };
    }

    const resolutionMinutes = config.resolution_minutes * multiplier;
    const elapsedMinutes = (now - created) / 60000;
    const remaining = resolutionMinutes - elapsedMinutes;
    return {
      type: 'resolution',
      isBreached: remaining <= 0,
      isWarning: remaining > 0 && remaining <= resolutionMinutes * 0.25,
      remainingMinutes: Math.round(remaining),
    };
  }, [config]);

  return { config, isLoading, saveConfig, getSLAStatus };
}
