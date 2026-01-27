import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DispatchConfig, DispatchMessage } from './useBulkDispatch';

export interface SavedDispatchConfig {
  id: string;
  name: string;
  instance_ids: string[];
  balancing_mode: string;
  messages: DispatchMessage[];
  randomize_order: boolean;
  min_delay_seconds: number;
  max_delay_seconds: number;
  pause_after_messages: number;
  pause_duration_minutes: number;
  stop_after_messages: number;
  smart_delay: boolean;
  attention_call: boolean;
  auto_archive: boolean;
  ai_personalization: boolean;
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  allowed_days: number[];
  verify_numbers: boolean;
  created_at: string;
  updated_at: string;
}

export function useDispatchConfigs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SavedDispatchConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConfigs = useCallback(async () => {
    if (!user) {
      setConfigs([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('dispatch_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Transform database format to app format
      const transformed = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        instance_ids: item.instance_ids || [],
        balancing_mode: item.balancing_mode || 'automatic',
        messages: (item.messages as any) || [],
        randomize_order: item.randomize_order || false,
        min_delay_seconds: item.min_delay_seconds || 2,
        max_delay_seconds: item.max_delay_seconds || 5,
        pause_after_messages: item.pause_after_messages || 100,
        pause_duration_minutes: item.pause_duration_minutes || 30,
        stop_after_messages: item.stop_after_messages || 0,
        smart_delay: item.smart_delay ?? true,
        attention_call: item.attention_call || false,
        auto_archive: item.auto_archive || false,
        ai_personalization: item.ai_personalization || false,
        business_hours_enabled: item.business_hours_enabled || false,
        business_hours_start: item.business_hours_start || '08:00',
        business_hours_end: item.business_hours_end || '18:00',
        allowed_days: item.allowed_days || [1, 2, 3, 4, 5, 6, 7],
        verify_numbers: item.verify_numbers ?? true,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      
      setConfigs(transformed);
    } catch (error: any) {
      console.error('Error fetching configs:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  // Re-fetch when user becomes available
  useEffect(() => {
    if (user) {
      fetchConfigs();
    }
  }, [user, fetchConfigs]);

  const saveConfig = useCallback(async (
    name: string, 
    config: DispatchConfig
  ): Promise<SavedDispatchConfig | null> => {
    if (!user) return null;

    try {
      const dbConfig = {
        user_id: user.id,
        name,
        instance_ids: config.instanceIds,
        balancing_mode: config.balancingMode,
        messages: config.messages as any,
        randomize_order: config.randomizeOrder,
        min_delay_seconds: config.minDelay,
        max_delay_seconds: config.maxDelay,
        pause_after_messages: config.pauseAfterMessages,
        pause_duration_minutes: config.pauseDurationMinutes,
        stop_after_messages: config.stopAfterMessages,
        smart_delay: config.smartDelay,
        attention_call: false,
        auto_archive: false,
        ai_personalization: false,
        business_hours_enabled: config.businessHoursEnabled,
        business_hours_start: config.businessHoursStart,
        business_hours_end: config.businessHoursEnd,
        allowed_days: config.allowedDays,
        verify_numbers: config.verifyNumbers,
      };

      const { data, error } = await supabase
        .from('dispatch_configs')
        .insert(dbConfig)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Configuração Salva',
        description: `"${name}" foi salva com sucesso`,
      });

      await fetchConfigs();
      return data as any;
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a configuração',
        variant: 'destructive'
      });
      return null;
    }
  }, [user, toast, fetchConfigs]);

  const updateConfig = useCallback(async (
    id: string,
    name: string,
    config: DispatchConfig
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const dbConfig = {
        name,
        instance_ids: config.instanceIds,
        balancing_mode: config.balancingMode,
        messages: config.messages as any,
        randomize_order: config.randomizeOrder,
        min_delay_seconds: config.minDelay,
        max_delay_seconds: config.maxDelay,
        pause_after_messages: config.pauseAfterMessages,
        pause_duration_minutes: config.pauseDurationMinutes,
        stop_after_messages: config.stopAfterMessages,
        smart_delay: config.smartDelay,
        business_hours_enabled: config.businessHoursEnabled,
        business_hours_start: config.businessHoursStart,
        business_hours_end: config.businessHoursEnd,
        allowed_days: config.allowedDays,
        verify_numbers: config.verifyNumbers,
      };

      const { error } = await supabase
        .from('dispatch_configs')
        .update(dbConfig)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Configuração Atualizada',
        description: `"${name}" foi atualizada com sucesso`,
      });

      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('Error updating config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a configuração',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, toast, fetchConfigs]);

  const deleteConfig = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('dispatch_configs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Configuração Removida',
        description: 'A configuração foi removida com sucesso',
      });

      await fetchConfigs();
      return true;
    } catch (error: any) {
      console.error('Error deleting config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a configuração',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, toast, fetchConfigs]);

  const configToDispatchConfig = useCallback((saved: SavedDispatchConfig): DispatchConfig => {
    return {
      instanceIds: saved.instance_ids,
      balancingMode: saved.balancing_mode as any,
      messages: saved.messages.map(msg => ({
        ...msg,
        mediaType: msg.mediaType || 'none',
        mediaUrl: msg.mediaUrl,
        fileName: msg.fileName,
        mimetype: msg.mimetype,
      })),
      randomizeOrder: saved.randomize_order,
      minDelay: saved.min_delay_seconds,
      maxDelay: saved.max_delay_seconds,
      pauseAfterMessages: saved.pause_after_messages,
      pauseDurationMinutes: saved.pause_duration_minutes,
      stopAfterMessages: saved.stop_after_messages,
      smartDelay: saved.smart_delay,
      businessHoursEnabled: saved.business_hours_enabled,
      businessHoursStart: saved.business_hours_start,
      businessHoursEnd: saved.business_hours_end,
      allowedDays: saved.allowed_days,
      verifyNumbers: saved.verify_numbers,
      autoArchive: saved.auto_archive ?? true,
      attentionCall: (saved as any).attention_call ?? false,
      attentionCallDelay: (saved as any).attention_call_delay ?? 2,
    };
  }, []);

  return {
    configs,
    isLoading,
    fetchConfigs,
    saveConfig,
    updateConfig,
    deleteConfig,
    configToDispatchConfig,
  };
}
