import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MacroAction {
  type: string;
  params?: Record<string, unknown>;
}

export interface InboxMacro {
  id: string;
  user_id: string;
  name: string;
  actions: MacroAction[];
  visibility: "personal" | "global";
  created_at: string;
  updated_at: string;
}

export function useInboxMacros() {
  const { user } = useAuth();
  const [macros, setMacros] = useState<InboxMacro[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMacros = useCallback(async () => {
    if (!user) {
      setMacros([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_macros')
        .select('*')
        .or(`user_id.eq.${user.id},visibility.eq.global`)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Parse actions from JSON
      const parsedMacros = (data || []).map(m => ({
        ...m,
        actions: Array.isArray(m.actions) ? (m.actions as unknown as MacroAction[]) : [],
        visibility: m.visibility as "personal" | "global",
      }));
      
      setMacros(parsedMacros as InboxMacro[]);
    } catch (error) {
      console.error('Error fetching inbox macros:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMacros();
  }, [fetchMacros]);

  const createMacro = async (data: {
    name: string;
    actions: MacroAction[];
    visibility?: "personal" | "global";
  }) => {
    if (!user) throw new Error('User not authenticated');

    const { data: newMacro, error } = await supabase
      .from('inbox_macros')
      .insert({
        user_id: user.id,
        name: data.name,
        actions: JSON.parse(JSON.stringify(data.actions)),
        visibility: data.visibility || "personal",
      } as never)
      .select()
      .single();

    if (error) throw error;
    
    const parsedMacro = {
      ...newMacro,
      actions: Array.isArray(newMacro.actions) ? (newMacro.actions as unknown as MacroAction[]) : [],
      visibility: newMacro.visibility as "personal" | "global",
    } as InboxMacro;
    
    setMacros(prev => [...prev, parsedMacro].sort((a, b) => 
      a.name.localeCompare(b.name)
    ));
    
    return newMacro;
  };

  const updateMacro = async (id: string, data: {
    name?: string;
    actions?: MacroAction[];
    visibility?: "personal" | "global";
  }) => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.actions !== undefined) updateData.actions = JSON.parse(JSON.stringify(data.actions));
    
    const { data: updated, error } = await supabase
      .from('inbox_macros')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    const parsedMacro = {
      ...updated,
      actions: Array.isArray(updated.actions) ? (updated.actions as unknown as MacroAction[]) : [],
      visibility: updated.visibility as "personal" | "global",
    } as InboxMacro;
    
    setMacros(prev => prev.map(m => m.id === id ? parsedMacro : m));
    return updated;
  };

  const deleteMacro = async (id: string) => {
    const { error } = await supabase
      .from('inbox_macros')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setMacros(prev => prev.filter(m => m.id !== id));
  };

  return {
    macros,
    isLoading,
    createMacro,
    updateMacro,
    deleteMacro,
    refetch: fetchMacros,
  };
}
