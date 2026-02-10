import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';

/**
 * Global hook that listens for new inbox messages (chat_inbox_messages)
 * and plays LOUD notification sounds + shows browser notifications,
 * regardless of which page/section the user is on.
 */
export function useGlobalInboxNotifications() {
  const { user } = useAuth();
  const { showNotification, playSound, isEnabled } = useSystemNotifications();
  const lastNotifiedRef = useRef<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial unread count
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('user_id', user.id)
        .gt('unread_count', 0);

      if (data) {
        const total = data.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        setUnreadCount(total);
      }
    };

    fetchUnread();
  }, [user]);

  // Subscribe to new incoming messages globally
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`global-inbox-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_inbox_messages',
        },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            sender_type: string;
            content: string | null;
            media_type: string | null;
            sender_id: string | null;
          };

          // Only notify for incoming messages from contacts
          if (msg.sender_type !== 'contact') return;

          // Skip duplicates
          if (msg.id === lastNotifiedRef.current) return;
          lastNotifiedRef.current = msg.id;

          // Get conversation info for contact name
          let contactName = 'Cliente';
          try {
            const { data: conv } = await supabase
              .from('conversations')
              .select('contact_name, user_id')
              .eq('id', msg.conversation_id)
              .maybeSingle();

            // Only notify if this conversation belongs to the current user
            if (conv && conv.user_id !== user.id) return;
            if (conv?.contact_name) contactName = conv.contact_name;
          } catch {
            // Continue with default name
          }

          // Update unread count
          setUnreadCount(prev => prev + 1);

          // Always play LOUD notification sound for messages
          playSound('urgent');

          // Show browser notification
          showNotification({
            title: `💬 Nova mensagem - ${contactName}`,
            body: msg.content?.slice(0, 100) || '📎 Mensagem de mídia',
            soundType: 'urgent',
            silent: true, // We already played sound above
            tag: `inbox-${msg.conversation_id}`,
            onClick: () => {
              window.focus();
            },
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const conv = payload.new as { user_id: string; unread_count: number };
          if (conv.user_id === user?.id) {
            // Refetch unread count on conversation updates
            supabase
              .from('conversations')
              .select('unread_count')
              .eq('user_id', user.id)
              .gt('unread_count', 0)
              .then(({ data }) => {
                if (data) {
                  const total = data.reduce((acc, c) => acc + (c.unread_count || 0), 0);
                  setUnreadCount(total);
                }
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playSound, showNotification]);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, clearUnread };
}
