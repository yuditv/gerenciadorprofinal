import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/components/NotificationCenter';
import { Client, getExpirationStatus, getDaysUntilExpiration } from '@/types/client';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';

interface UseNotificationsOptions {
  clients?: Client[];
  instances?: WhatsAppInstance[];
  enabled?: boolean;
}

export function useNotifications({ clients = [], instances = [], enabled = true }: UseNotificationsOptions) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [pendingMessages, setPendingMessages] = useState(0);

  // Generate notifications from clients and instances
  const generateNotifications = useCallback(() => {
    if (!enabled) return;

    const newNotifications: Notification[] = [];

    // Expiring clients notifications
    clients.forEach(client => {
      const status = getExpirationStatus(client.expiresAt);
      const days = getDaysUntilExpiration(client.expiresAt);

      if (status === 'expiring') {
        newNotifications.push({
          id: `expiring-${client.id}`,
          type: 'expiring',
          title: `${client.name} expira em ${days} dia${days > 1 ? 's' : ''}`,
          description: `O plano do cliente está próximo do vencimento. Considere entrar em contato.`,
          timestamp: new Date(),
          read: false,
          data: { clientId: client.id },
        });
      } else if (status === 'expired') {
        newNotifications.push({
          id: `expired-${client.id}`,
          type: 'expired',
          title: `${client.name} expirou`,
          description: `O plano deste cliente já expirou há ${Math.abs(days)} dia${Math.abs(days) > 1 ? 's' : ''}.`,
          timestamp: new Date(),
          read: false,
          data: { clientId: client.id },
        });
      }
    });

    // Instance offline notifications
    instances.forEach(instance => {
      if (instance.status !== 'connected' && instance.instance_key) {
        newNotifications.push({
          id: `offline-${instance.id}`,
          type: 'instance_offline',
          title: `WhatsApp ${instance.instance_name} offline`,
          description: 'A instância está desconectada. Verifique a conexão.',
          timestamp: new Date(),
          read: false,
          data: { instanceId: instance.id },
        });
      }
    });

    // Merge with existing notifications (preserve read state)
    setNotifications(prev => {
      const existingMap = new Map(prev.map(n => [n.id, n]));
      
      return newNotifications.map(n => ({
        ...n,
        read: existingMap.get(n.id)?.read ?? false,
      }));
    });
  }, [clients, instances, enabled]);

  // Fetch unread conversations count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('unread_count', 0);

      if (!error && count !== null) {
        setUnreadConversations(count);
      }

      // Set pending messages to 0 for now (simplified)
      setPendingMessages(0);
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  }, [user]);

  // Initial load and refresh
  useEffect(() => {
    generateNotifications();
    fetchUnreadCount();
  }, [generateNotifications, fetchUnreadCount]);

  // Real-time subscription for conversations
  useEffect(() => {
    if (!user || !enabled) return;

    const channel = supabase
      .channel('notification-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_inbox_messages' },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, enabled, fetchUnreadCount]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const refresh = useCallback(() => {
    generateNotifications();
    fetchUnreadCount();
  }, [generateNotifications, fetchUnreadCount]);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    unreadConversations,
    pendingMessages,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh,
  };
}
