import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DistributionConfig {
  id: string;
  user_id: string;
  is_enabled: boolean;
  mode: string;
  max_active_per_agent: number;
  last_assigned_index: number;
  created_at: string;
  updated_at: string;
}

export function useDistributionConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<DistributionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (!user) { setConfig(null); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_distribution_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setConfig(data as DistributionConfig | null);
    } catch (e) {
      console.error('Error fetching distribution config:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (updates: Partial<Pick<DistributionConfig, 'is_enabled' | 'mode' | 'max_active_per_agent'>>) => {
    if (!user) return;

    if (config) {
      const { error } = await supabase
        .from('inbox_distribution_config')
        .update(updates as never)
        .eq('id', config.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('inbox_distribution_config')
        .insert({ user_id: user.id, ...updates } as never);
      if (error) throw error;
    }
    await fetchConfig();
  };

  return { config, isLoading, saveConfig, refetch: fetchConfig };
}
