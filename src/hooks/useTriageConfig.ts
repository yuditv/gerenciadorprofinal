import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { toast } from 'sonner';

export interface TriageDepartment {
  name: string;
  description: string;
  label_id: string | null;
}

export interface TriageConfig {
  id: string;
  user_id: string;
  is_enabled: boolean;
  welcome_message: string;
  collect_name: boolean;
  collect_reason: boolean;
  departments: TriageDepartment[];
  fallback_message: string;
  created_at: string;
  updated_at: string;
}

export function useTriageConfig() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [config, setConfig] = useState<TriageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = ownerId || user?.id;

  const fetchConfig = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('inbox_triage_config')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig({
          ...data,
          departments: (typeof data.departments === 'string' ? JSON.parse(data.departments) : data.departments) as TriageDepartment[],
        } as TriageConfig);
      }
    } catch (error) {
      console.error('Error fetching triage config:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (updates: Partial<Omit<TriageConfig, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!effectiveUserId) return;
    try {
      const { data: existing } = await supabase
        .from('inbox_triage_config')
        .select('id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      const payload = {
        ...updates,
        departments: updates.departments ? JSON.stringify(updates.departments) : undefined,
      };

      if (existing) {
        await supabase
          .from('inbox_triage_config')
          .update(payload)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('inbox_triage_config')
          .insert({ user_id: effectiveUserId, ...payload });
      }
      await fetchConfig();
      toast.success('Triagem atualizada');
    } catch (error) {
      console.error('Error saving triage config:', error);
      toast.error('Erro ao salvar triagem');
    }
  };

  return { config, isLoading, saveConfig, refetch: fetchConfig };
}
