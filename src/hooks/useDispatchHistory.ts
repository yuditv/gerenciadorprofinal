import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DispatchHistory {
  id: string;
  dispatch_type: string;
  target_type: string;
  total_recipients: number;
  success_count: number;
  failed_count: number;
  message_content: string | null;
  client_filter: string | null;
  created_at: string;
}

export interface DispatchStats {
  totalDispatches: number;
  totalMessages: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number;
}

export function useDispatchHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<DispatchHistory[]>([]);
  const [stats, setStats] = useState<DispatchStats>({
    totalDispatches: 0,
    totalMessages: 0,
    totalSuccess: 0,
    totalFailed: 0,
    successRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    try {
      // Use type assertion for table that may not be in generated types yet
      const { data, error } = await supabase
        .from('bulk_dispatch_history' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        // Table might not exist yet - just return empty
        console.log('bulk_dispatch_history table not available:', error.message);
        setHistory([]);
        setStats({
          totalDispatches: 0,
          totalMessages: 0,
          totalSuccess: 0,
          totalFailed: 0,
          successRate: 0,
        });
        return;
      }
      
      const historyData = (data as unknown as DispatchHistory[]) || [];
      setHistory(historyData);

      // Calculate stats
      const totalDispatches = historyData.length;
      const totalMessages = historyData.reduce((acc, d) => acc + (d.total_recipients || 0), 0);
      const totalSuccess = historyData.reduce((acc, d) => acc + (d.success_count || 0), 0);
      const totalFailed = historyData.reduce((acc, d) => acc + (d.failed_count || 0), 0);
      const successRate = totalMessages > 0 ? (totalSuccess / totalMessages) * 100 : 0;

      setStats({
        totalDispatches,
        totalMessages,
        totalSuccess,
        totalFailed,
        successRate,
      });
    } catch (error: any) {
      console.error('Error fetching dispatch history:', error);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const saveDispatch = async (
    dispatchType: string,
    targetType: string,
    totalRecipients: number,
    successCount: number,
    failedCount: number,
    messageContent: string,
    clientFilter?: string
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('bulk_dispatch_history' as any)
        .insert({
          user_id: user.id,
          dispatch_type: dispatchType,
          target_type: targetType,
          total_recipients: totalRecipients,
          success_count: successCount,
          failed_count: failedCount,
          message_content: messageContent,
          client_filter: clientFilter || null,
        });

      if (error) throw error;
      await fetchHistory();
      return true;
    } catch (error: any) {
      console.error('Error saving dispatch history:', error);
      return false;
    }
  };

  return {
    history,
    stats,
    isLoading,
    saveDispatch,
    refetch: fetchHistory,
  };
}
