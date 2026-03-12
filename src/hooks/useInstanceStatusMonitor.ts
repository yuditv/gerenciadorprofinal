import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const POLL_INTERVAL_MS = 30000; // 30 seconds
const POLL_INTERVAL_FAST_MS = 10000; // 10 seconds when reconnecting

/**
 * Hook to automatically monitor and sync WhatsApp instance status from UAZAPI.
 * Polls the API periodically and updates the database when status changes.
 */
export function useInstanceStatusMonitor(
  instanceIds: string[],
  enabled: boolean = true,
  onStatusChange?: (instanceId: string, newStatus: string) => void
) {
  const { user } = useAuth();
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const lastStatusRef = useRef<Record<string, string>>({});

  const checkInstanceStatus = useCallback(async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'status', instanceId },
      });

      if (error) {
        console.error(`[StatusMonitor] Error checking instance ${instanceId}:`, error);
        return null;
      }

      const newStatus = data?.status?.toLowerCase() || 'disconnected';
      const previousStatus = lastStatusRef.current[instanceId];

      // Only notify if status actually changed
      if (previousStatus && previousStatus !== newStatus) {
        console.log(`[StatusMonitor] Instance ${instanceId} status changed: ${previousStatus} -> ${newStatus}`);
        onStatusChange?.(instanceId, newStatus);
      }

      lastStatusRef.current[instanceId] = newStatus;
      return newStatus;
    } catch (error) {
      console.error(`[StatusMonitor] Exception checking instance ${instanceId}:`, error);
      return null;
    }
  }, [onStatusChange]);

  const pollAllInstances = useCallback(async () => {
    if (!isActiveRef.current || !user || instanceIds.length === 0) return;

    console.log(`[StatusMonitor] Polling ${instanceIds.length} instances...`);

    // Check all instances in parallel
    await Promise.all(
      instanceIds.map(id => checkInstanceStatus(id))
    );

    // Determine next poll interval - use faster polling if any instance is connecting
    const hasConnecting = Object.values(lastStatusRef.current).some(
      s => s === 'connecting' || s === 'pending'
    );
    const nextInterval = hasConnecting ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_MS;

    // Schedule next poll
    if (isActiveRef.current) {
      pollTimeoutRef.current = setTimeout(pollAllInstances, nextInterval);
    }
  }, [user, instanceIds, checkInstanceStatus]);

  // Start/stop monitoring based on enabled state and instanceIds
  useEffect(() => {
    if (!enabled || !user || instanceIds.length === 0) {
      isActiveRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    isActiveRef.current = true;

    // Initial poll after a short delay
    pollTimeoutRef.current = setTimeout(pollAllInstances, 2000);

    return () => {
      isActiveRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [enabled, user, instanceIds, pollAllInstances]);

  // Manual trigger to force a status check
  const forceCheck = useCallback(async () => {
    if (!user || instanceIds.length === 0) return;
    await pollAllInstances();
  }, [user, instanceIds, pollAllInstances]);

  return {
    forceCheck,
    lastStatus: lastStatusRef.current,
  };
}
