import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PlanType, planLabels, planPrices } from '@/types/client';
import { toast } from '@/hooks/use-toast';

export interface PlanSetting {
  id?: string;
  planKey: PlanType;
  planName: string;
  planPrice: number;
}

interface DbPlanSetting {
  id: string;
  user_id: string;
  plan_key: string;
  plan_name: string;
  plan_price: number;
  created_at: string;
  updated_at: string;
}

const defaultSettings: PlanSetting[] = [
  { planKey: 'monthly', planName: planLabels.monthly, planPrice: planPrices.monthly },
  { planKey: 'quarterly', planName: planLabels.quarterly, planPrice: planPrices.quarterly },
  { planKey: 'semiannual', planName: planLabels.semiannual, planPrice: planPrices.semiannual },
  { planKey: 'annual', planName: planLabels.annual, planPrice: planPrices.annual },
];

export function usePlanSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlanSetting[]>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('plan_settings')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const dbSettings = data as DbPlanSetting[];
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const dbSetting = dbSettings.find(s => s.plan_key === defaultSetting.planKey);
          if (dbSetting) {
            return {
              id: dbSetting.id,
              planKey: dbSetting.plan_key as PlanType,
              planName: dbSetting.plan_name,
              planPrice: Number(dbSetting.plan_price),
            };
          }
          return defaultSetting;
        });
        setSettings(mergedSettings);
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching plan settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newSettings: PlanSetting[]) => {
    if (!user) return;

    try {
      for (const setting of newSettings) {
        const existingSetting = settings.find(s => s.planKey === setting.planKey && s.id);
        
        if (existingSetting?.id) {
          const { error } = await supabase
            .from('plan_settings')
            .update({
              plan_name: setting.planName,
              plan_price: setting.planPrice,
            })
            .eq('id', existingSetting.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('plan_settings')
            .insert({
              user_id: user.id,
              plan_key: setting.planKey,
              plan_name: setting.planName,
              plan_price: setting.planPrice,
            });

          if (error) throw error;
        }
      }

      toast({
        title: 'Configurações salvas',
        description: 'As configurações dos planos foram atualizadas com sucesso.',
      });

      await fetchSettings();
    } catch (error) {
      console.error('Error saving plan settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    }
  };

  const getPlanName = (planKey: PlanType): string => {
    const setting = settings.find(s => s.planKey === planKey);
    return setting?.planName || planLabels[planKey];
  };

  const getPlanPrice = (planKey: PlanType): number => {
    const setting = settings.find(s => s.planKey === planKey);
    return setting?.planPrice || planPrices[planKey];
  };

  return {
    settings,
    isLoading,
    saveSettings,
    getPlanName,
    getPlanPrice,
  };
}
