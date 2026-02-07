import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BlacklistEntry {
  id: string;
  user_id: string;
  phone: string;
  reason: string | null;
  source: string;
  created_at: string;
}

export function useGlobalBlacklist() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) { setEntries([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_blacklist')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEntries((data || []) as BlacklistEntry[]);
    } catch (e) {
      console.error('Error fetching blacklist:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addToBlacklist = async (phone: string, reason?: string, source = 'manual') => {
    if (!user) return;
    const normalized = phone.replace(/\D/g, '');
    const { error } = await supabase
      .from('global_blacklist')
      .upsert({ user_id: user.id, phone: normalized, reason: reason || null, source } as never, {
        onConflict: 'user_id,phone',
      });
    if (error) throw error;
    await fetchEntries();
  };

  const addBulk = async (phones: string[], reason?: string, source = 'manual') => {
    if (!user || phones.length === 0) return;
    const rows = phones.map(p => ({
      user_id: user.id,
      phone: p.replace(/\D/g, ''),
      reason: reason || null,
      source,
    }));
    const { error } = await supabase
      .from('global_blacklist')
      .upsert(rows as never[], { onConflict: 'user_id,phone' });
    if (error) throw error;
    await fetchEntries();
  };

  const removeFromBlacklist = async (id: string) => {
    const { error } = await supabase.from('global_blacklist').delete().eq('id', id);
    if (error) throw error;
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const isBlacklisted = useCallback((phone: string) => {
    const normalized = phone.replace(/\D/g, '');
    return entries.some(e => e.phone === normalized || normalized.endsWith(e.phone) || e.phone.endsWith(normalized));
  }, [entries]);

  return { entries, isLoading, addToBlacklist, addBulk, removeFromBlacklist, isBlacklisted, refetch: fetchEntries };
}
