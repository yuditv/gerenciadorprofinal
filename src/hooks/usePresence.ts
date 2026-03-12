import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PresenceType = 'composing' | 'recording' | 'paused';

export function usePresence(conversationId: string | null) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentRef = useRef<{ type: PresenceType; time: number } | null>(null);
  const isActiveRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isActiveRef.current = false;
  }, []);

  // Send presence update with debounce
  const sendPresence = useCallback(
    async (presence: PresenceType) => {
      if (!conversationId) return;

      // Skip if same presence was sent in last 5 seconds (UAZAPI auto-renews)
      const now = Date.now();
      if (
        lastSentRef.current &&
        lastSentRef.current.type === presence &&
        now - lastSentRef.current.time < 5000
      ) {
        return;
      }

      // Clear existing auto-cancel timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      try {
        lastSentRef.current = { type: presence, time: now };
        isActiveRef.current = presence !== 'paused';

        const { data, error } = await supabase.functions.invoke('send-presence', {
          body: { 
            conversationId, 
            presence, 
            delay: 30000 // 30 seconds
          }
        });

        // Silently ignore errors - presence is a non-critical feature
        if (error || data?.success === false) {
          console.warn('Presence update skipped:', error?.message || data?.error);
          return;
        }

        // Auto-cancel after 30 seconds of inactivity
        if (presence !== 'paused') {
          timeoutRef.current = setTimeout(() => {
            if (isActiveRef.current) {
              sendPresence('paused');
            }
          }, 30000);
        }
      } catch (error) {
        // Silently ignore - presence is non-critical
        console.warn('Presence update failed:', error);
      }
    },
    [conversationId]
  );

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      cleanup();
      // Send paused on cleanup if we were active
      if (isActiveRef.current && conversationId) {
        supabase.functions.invoke('send-presence', {
          body: { conversationId, presence: 'paused', delay: 0 }
        }).catch(() => {});
      }
    };
  }, [conversationId, cleanup]);

  return { sendPresence };
}
