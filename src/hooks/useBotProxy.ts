import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface BotProxyConfig {
  id: string;
  user_id: string;
  bot_phone: string;
  trigger_label_id: string | null;
  instance_id: string | null;
  is_active: boolean;
  owner_payment_info: string | null;
  payment_keywords: string[] | null;
  block_bot_payment: boolean;
  use_mercado_pago: boolean;
  mercado_pago_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotProxySession {
  id: string;
  config_id: string;
  client_conversation_id: string | null;
  bot_conversation_id: string | null;
  client_phone: string;
  is_active: boolean;
  created_at: string;
  last_activity_at: string;
}

export interface BotProxyPlan {
  id: string;
  config_id: string;
  option_number: number;
  name: string;
  duration_days: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotProxyReplacement {
  id: string;
  config_id: string;
  search_text: string;
  replace_text: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useBotProxy() {
  const { user } = useAuth();
  const [config, setConfig] = useState<BotProxyConfig | null>(null);
  const [sessions, setSessions] = useState<BotProxySession[]>([]);
  const [replacements, setReplacements] = useState<BotProxyReplacement[]>([]);
  const [plans, setPlans] = useState<BotProxyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('bot_proxy_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Error fetching bot proxy config:', error);
    }
  }, [user?.id]);

  const fetchSessions = useCallback(async () => {
    if (!user?.id || !config?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('bot_proxy_sessions')
        .select('*')
        .eq('config_id', config.id)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching bot proxy sessions:', error);
    }
  }, [user?.id, config?.id]);

  const fetchReplacements = useCallback(async () => {
    if (!config?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('bot_proxy_replacements')
        .select('*')
        .eq('config_id', config.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setReplacements(data || []);
    } catch (error) {
      console.error('Error fetching bot proxy replacements:', error);
    }
  }, [config?.id]);

  const fetchPlans = useCallback(async () => {
    if (!config?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('bot_proxy_plans')
        .select('*')
        .eq('config_id', config.id)
        .order('option_number', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching bot proxy plans:', error);
    }
  }, [config?.id]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchConfig();
      setIsLoading(false);
    };
    load();
  }, [fetchConfig]);

  useEffect(() => {
    if (config?.id) {
      fetchSessions();
      fetchReplacements();
      fetchPlans();
    }
  }, [config?.id, fetchSessions, fetchReplacements, fetchPlans]);

  const saveConfig = async (data: {
    bot_phone: string;
    trigger_label_id: string | null;
    instance_id: string | null;
    is_active: boolean;
    owner_payment_info?: string | null;
    block_bot_payment?: boolean;
    use_mercado_pago?: boolean;
    mercado_pago_plan_id?: string | null;
  }) => {
    if (!user?.id) return null;

    setIsSaving(true);
    try {
      // Format phone number
      const formattedPhone = data.bot_phone.replace(/\D/g, '');

      if (config?.id) {
        // Update existing config
        const { data: updated, error } = await supabase
          .from('bot_proxy_config')
          .update({
            bot_phone: formattedPhone,
            trigger_label_id: data.trigger_label_id,
            instance_id: data.instance_id,
            is_active: data.is_active,
            owner_payment_info: data.owner_payment_info ?? null,
            block_bot_payment: data.block_bot_payment ?? false,
            use_mercado_pago: data.use_mercado_pago ?? false,
            mercado_pago_plan_id: data.mercado_pago_plan_id ?? null,
          })
          .eq('id', config.id)
          .select()
          .single();

        if (error) throw error;
        setConfig(updated);
        toast.success('Configuração atualizada!');
        return updated;
      } else {
        // Create new config
        const { data: created, error } = await supabase
          .from('bot_proxy_config')
          .insert({
            user_id: user.id,
            bot_phone: formattedPhone,
            trigger_label_id: data.trigger_label_id,
            instance_id: data.instance_id,
            is_active: data.is_active,
            owner_payment_info: data.owner_payment_info ?? null,
            block_bot_payment: data.block_bot_payment ?? false,
            use_mercado_pago: data.use_mercado_pago ?? false,
            mercado_pago_plan_id: data.mercado_pago_plan_id ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(created);
        toast.success('Configuração criada!');
        return created;
      }
    } catch (error: any) {
      console.error('Error saving bot proxy config:', error);
      toast.error('Erro ao salvar configuração');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    if (!config?.id) return;

    try {
      const { error } = await supabase
        .from('bot_proxy_config')
        .update({ is_active: active })
        .eq('id', config.id);

      if (error) throw error;
      setConfig(prev => prev ? { ...prev, is_active: active } : null);
      toast.success(active ? 'Ponte ativada!' : 'Ponte desativada!');
    } catch (error) {
      console.error('Error toggling bot proxy:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('bot_proxy_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Sessão encerrada!');
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Erro ao encerrar sessão');
    }
  };

  // Replacement CRUD functions
  const addReplacement = async (searchText: string, replaceText: string) => {
    if (!config?.id) {
      toast.error('Configure a ponte de bot primeiro');
      return null;
    }

    try {
      const maxOrder = replacements.length > 0 
        ? Math.max(...replacements.map(r => r.display_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('bot_proxy_replacements')
        .insert({
          config_id: config.id,
          search_text: searchText,
          replace_text: replaceText,
          display_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;
      setReplacements(prev => [...prev, data]);
      toast.success('Regra adicionada!');
      return data;
    } catch (error) {
      console.error('Error adding replacement:', error);
      toast.error('Erro ao adicionar regra');
      return null;
    }
  };

  const updateReplacement = async (id: string, searchText: string, replaceText: string) => {
    try {
      const { data, error } = await supabase
        .from('bot_proxy_replacements')
        .update({ search_text: searchText, replace_text: replaceText })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setReplacements(prev => prev.map(r => r.id === id ? data : r));
      toast.success('Regra atualizada!');
      return data;
    } catch (error) {
      console.error('Error updating replacement:', error);
      toast.error('Erro ao atualizar regra');
      return null;
    }
  };

  const deleteReplacement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bot_proxy_replacements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setReplacements(prev => prev.filter(r => r.id !== id));
      toast.success('Regra removida!');
    } catch (error) {
      console.error('Error deleting replacement:', error);
      toast.error('Erro ao remover regra');
    }
  };

  const toggleReplacement = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('bot_proxy_replacements')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      setReplacements(prev => prev.map(r => r.id === id ? { ...r, is_active: isActive } : r));
    } catch (error) {
      console.error('Error toggling replacement:', error);
      toast.error('Erro ao alterar status');
    }
  };

  // Plan CRUD functions
  const savePlan = async (optionNumber: number, name: string, durationDays: number, price: number) => {
    if (!config?.id) {
      toast.error('Configure a ponte de bot primeiro');
      return null;
    }

    try {
      // Check if plan already exists for this option
      const existingPlan = plans.find(p => p.option_number === optionNumber);
      
      if (existingPlan) {
        // Update existing
        const { data, error } = await supabase
          .from('bot_proxy_plans')
          .update({ name, duration_days: durationDays, price })
          .eq('id', existingPlan.id)
          .select()
          .single();

        if (error) throw error;
        setPlans(prev => prev.map(p => p.id === existingPlan.id ? data : p));
        toast.success(`Plano ${optionNumber} atualizado!`);
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('bot_proxy_plans')
          .insert({
            config_id: config.id,
            option_number: optionNumber,
            name,
            duration_days: durationDays,
            price
          })
          .select()
          .single();

        if (error) throw error;
        setPlans(prev => [...prev, data].sort((a, b) => a.option_number - b.option_number));
        toast.success(`Plano ${optionNumber} criado!`);
        return data;
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao salvar plano');
      return null;
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bot_proxy_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== id));
      toast.success('Plano removido!');
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao remover plano');
    }
  };

  const getActiveSessionsCount = () => sessions.length;

  return {
    config,
    sessions,
    replacements,
    plans,
    isLoading,
    isSaving,
    saveConfig,
    toggleActive,
    endSession,
    addReplacement,
    updateReplacement,
    deleteReplacement,
    toggleReplacement,
    savePlan,
    deletePlan,
    getActiveSessionsCount,
    refetch: fetchConfig,
    refetchSessions: fetchSessions,
    refetchReplacements: fetchReplacements,
    refetchPlans: fetchPlans,
  };
}
