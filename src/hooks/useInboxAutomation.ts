import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AutomationAction {
  type: string;
  params?: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  event_type: string;
  conditions: Record<string, unknown>;
  actions: AutomationAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useInboxAutomation() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!user) {
      setRules([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_automation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Parse JSON fields
      const parsedRules = (data || []).map(r => ({
        ...r,
        conditions: (typeof r.conditions === 'object' && r.conditions !== null ? r.conditions : {}) as Record<string, unknown>,
        actions: Array.isArray(r.actions) ? (r.actions as unknown as AutomationAction[]) : [],
      }));
      
      setRules(parsedRules as AutomationRule[]);
    } catch (error) {
      console.error('Error fetching automation rules:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (data: {
    name: string;
    description?: string;
    event_type: string;
    conditions?: Record<string, unknown>;
    actions: AutomationAction[];
    is_active?: boolean;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const { data: newRule, error } = await supabase
      .from('inbox_automation_rules')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description || null,
        event_type: data.event_type,
        conditions: JSON.parse(JSON.stringify(data.conditions || {})),
        actions: JSON.parse(JSON.stringify(data.actions)),
        is_active: data.is_active ?? true,
      } as never)
      .select()
      .single();

    if (error) throw error;
    
    const parsedRule = {
      ...newRule,
      conditions: (typeof newRule.conditions === 'object' ? newRule.conditions : {}) as Record<string, unknown>,
      actions: Array.isArray(newRule.actions) ? (newRule.actions as unknown as AutomationAction[]) : [],
    } as AutomationRule;
    
    setRules(prev => [...prev, parsedRule].sort((a, b) => 
      a.name.localeCompare(b.name)
    ));
    
    return newRule;
  };

  const updateRule = async (id: string, data: {
    name?: string;
    description?: string;
    event_type?: string;
    conditions?: Record<string, unknown>;
    actions?: AutomationAction[];
    is_active?: boolean;
  }) => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.event_type !== undefined) updateData.event_type = data.event_type;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.conditions !== undefined) updateData.conditions = JSON.parse(JSON.stringify(data.conditions));
    if (data.actions !== undefined) updateData.actions = JSON.parse(JSON.stringify(data.actions));
    
    const { data: updated, error } = await supabase
      .from('inbox_automation_rules')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    const parsedRule = {
      ...updated,
      conditions: (typeof updated.conditions === 'object' ? updated.conditions : {}) as Record<string, unknown>,
      actions: Array.isArray(updated.actions) ? (updated.actions as unknown as AutomationAction[]) : [],
    } as AutomationRule;
    
    setRules(prev => prev.map(r => r.id === id ? parsedRule : r));
    return updated;
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from('inbox_automation_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from('inbox_automation_rules')
      .update({ is_active })
      .eq('id', id);

    if (error) throw error;
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active } : r));
  };

  return {
    rules,
    isLoading,
    createRule,
    updateRule,
    deleteRule,
    toggleActive,
    refetch: fetchRules,
  };
}
