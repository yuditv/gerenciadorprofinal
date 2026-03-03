import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ReferralClickSummary {
  client_id: string;
  referral_code: string;
  click_count: number;
}

export function useReferralClicks() {
  const { user } = useAuth();
  const [clicksByClient, setClicksByClient] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchClicks = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('referral_clicks')
        .select('client_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row.client_id) {
          counts[row.client_id] = (counts[row.client_id] || 0) + 1;
        }
      });

      setClicksByClient(counts);
    } catch (error) {
      console.error('Error fetching referral clicks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClicks();
  }, [fetchClicks]);

  const getClickCount = useCallback((clientId: string) => {
    return clicksByClient[clientId] || 0;
  }, [clicksByClient]);

  return { clicksByClient, getClickCount, isLoading, refetch: fetchClicks };
}
