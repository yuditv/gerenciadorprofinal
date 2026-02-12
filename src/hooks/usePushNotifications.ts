import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (user && isSupported) {
      checkSubscription();
    }
  }, [user, isSupported]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [isSupported]);

  const showLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [permission]);

  const scheduleExpirationCheck = useCallback(async () => {
    if (!user || permission !== 'granted') return;

    // Check for expiring clients and show notifications
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, expires_at, plan')
        .eq('user_id', user.id);

      if (!clients) return;

      const now = new Date();
      const expiringToday: string[] = [];
      const expiringIn3Days: string[] = [];
      const expiringIn7Days: string[] = [];

      clients.forEach((client) => {
        const expiresAt = new Date(client.expires_at);
        const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil === 0) {
          expiringToday.push(client.name);
        } else if (daysUntil === 3) {
          expiringIn3Days.push(client.name);
        } else if (daysUntil === 7) {
          expiringIn7Days.push(client.name);
        }
      });

      // Show notifications for each category
      if (expiringToday.length > 0) {
        showLocalNotification('⚠️ Planos vencem HOJE!', {
          body: `${expiringToday.length} cliente(s): ${expiringToday.slice(0, 3).join(', ')}${expiringToday.length > 3 ? '...' : ''}`,
          tag: 'expiring-today',
          requireInteraction: true,
        });
      }

      if (expiringIn3Days.length > 0) {
        showLocalNotification('📅 Planos vencem em 3 dias', {
          body: `${expiringIn3Days.length} cliente(s): ${expiringIn3Days.slice(0, 3).join(', ')}${expiringIn3Days.length > 3 ? '...' : ''}`,
          tag: 'expiring-3days',
        });
      }

      if (expiringIn7Days.length > 0) {
        showLocalNotification('📆 Planos vencem em 7 dias', {
          body: `${expiringIn7Days.length} cliente(s): ${expiringIn7Days.slice(0, 3).join(', ')}${expiringIn7Days.length > 3 ? '...' : ''}`,
          tag: 'expiring-7days',
        });
      }

      return { expiringToday, expiringIn3Days, expiringIn7Days };
    } catch (error) {
      console.error('Error checking expirations:', error);
    }
  }, [user, permission, showLocalNotification]);

  return {
    permission,
    isSupported,
    isSubscribed,
    requestPermission,
    showLocalNotification,
    scheduleExpirationCheck,
  };
}
