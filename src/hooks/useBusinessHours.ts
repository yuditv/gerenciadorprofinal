import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { toast } from 'sonner';

export interface DaySchedule {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
}

export interface BusinessHoursConfig {
  id: string;
  user_id: string;
  is_enabled: boolean;
  timezone: string;
  auto_reply_message: string;
  schedule: DaySchedule[];
  created_at: string;
  updated_at: string;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function useBusinessHours() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [config, setConfig] = useState<BusinessHoursConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = ownerId || user?.id;

  const fetchConfig = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('inbox_business_hours')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig({
          ...data,
          schedule: (typeof data.schedule === 'string' ? JSON.parse(data.schedule) : data.schedule) as DaySchedule[],
        } as BusinessHoursConfig);
      }
    } catch (error) {
      console.error('Error fetching business hours:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (updates: Partial<Omit<BusinessHoursConfig, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!effectiveUserId) return;
    try {
      const { data: existing } = await supabase
        .from('inbox_business_hours')
        .select('id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      const payload = {
        ...updates,
        schedule: updates.schedule ? JSON.stringify(updates.schedule) : undefined,
      };

      if (existing) {
        await supabase
          .from('inbox_business_hours')
          .update(payload)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('inbox_business_hours')
          .insert({ user_id: effectiveUserId, ...payload });
      }
      await fetchConfig();
      toast.success('Horário comercial atualizado');
    } catch (error) {
      console.error('Error saving business hours:', error);
      toast.error('Erro ao salvar horário');
    }
  };

  const isWithinBusinessHours = useCallback((): boolean => {
    if (!config || !config.is_enabled) return true;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const daySchedule = config.schedule.find(s => s.day === dayOfWeek);

    if (!daySchedule || !daySchedule.enabled) return false;

    const [startH, startM] = daySchedule.start.split(':').map(Number);
    const [endH, endM] = daySchedule.end.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }, [config]);

  const getAutoReplyMessage = useCallback((): string | null => {
    if (!config || !config.is_enabled || isWithinBusinessHours()) return null;

    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Find next open day
    for (let i = 1; i <= 7; i++) {
      const nextDay = (dayOfWeek + i) % 7;
      const schedule = config.schedule.find(s => s.day === nextDay);
      if (schedule?.enabled) {
        return config.auto_reply_message
          .replace('{start}', schedule.start)
          .replace('{end}', schedule.end)
          .replace('{dia}', DAY_NAMES[nextDay]);
      }
    }

    return config.auto_reply_message;
  }, [config, isWithinBusinessHours]);

  return { config, isLoading, saveConfig, isWithinBusinessHours, getAutoReplyMessage, DAY_NAMES };
}
