import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSystemNotifications } from '@/hooks/useSystemNotifications';

interface CustomerChatNotificationState {
  unreadCount: number;
  hasNewMessage: boolean;
  lastMessageTime: Date | null;
}

export function useGlobalCustomerChatNotifications() {
  const { user } = useAuth();
  const { showNotification, playSound, permission, requestPermission } = useSystemNotifications();
  const [state, setState] = useState<CustomerChatNotificationState>({
    unreadCount: 0,
    hasNewMessage: false,
    lastMessageTime: null,
  });
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const hasInteractedRef = useRef(false);

  // Fetch initial unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('customer_conversations')
        .select('unread_owner_count')
        .eq('owner_id', user.id);

      if (error) {
        console.error('[GlobalCustomerChat] Error fetching unread count:', error);
        return;
      }

      const total = (data || []).reduce((acc, conv) => acc + (conv.unread_owner_count || 0), 0);
      setState(prev => ({ ...prev, unreadCount: total }));
    } catch (e) {
      console.error('[GlobalCustomerChat] Error:', e);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Real-time subscription for new customer messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`global-customer-chat-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_messages',
          filter: `owner_id=eq.${user.id}`,
        },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            sender_type: string;
            content: string | null;
            media_type: string | null;
            file_name: string | null;
            owner_id: string;
          };

          // Only notify for messages from customers
          if (msg.sender_type !== 'customer') return;

          // Skip if already processed
          if (processedMessagesRef.current.has(msg.id)) return;
          processedMessagesRef.current.add(msg.id);

          // Limit set size
          if (processedMessagesRef.current.size > 100) {
            const arr = Array.from(processedMessagesRef.current);
            processedMessagesRef.current = new Set(arr.slice(-50));
          }

          console.log('[GlobalCustomerChat] New customer message received:', msg.id);

          // Update state
          setState(prev => ({
            unreadCount: prev.unreadCount + 1,
            hasNewMessage: true,
            lastMessageTime: new Date(),
          }));

          // Clear new message indicator after a few seconds
          setTimeout(() => {
            setState(prev => ({ ...prev, hasNewMessage: false }));
          }, 5000);

          // Get customer name from conversation
          let customerName = 'Cliente';
          try {
            const { data: convData } = await supabase
              .from('customer_conversations')
              .select('customer_user_id')
              .eq('id', msg.conversation_id)
              .maybeSingle();

            if (convData?.customer_user_id) {
              const { data: linkData } = await supabase
                .from('customer_chat_links')
                .select('customer_name')
                .eq('customer_user_id', convData.customer_user_id)
                .maybeSingle();

              if (linkData?.customer_name) {
                customerName = linkData.customer_name;
              }
            }
          } catch (e) {
            console.error('[GlobalCustomerChat] Error fetching customer name:', e);
          }

          // Prepare notification body
          const bodyText = msg.content
            ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
            : msg.media_type
            ? `📎 ${msg.file_name || 'Mídia'}`
            : 'Nova mensagem';

          // Play sound
          playSound('message');

          // Show browser notification (always try, even if page is visible)
          showNotification({
            title: `💬 Chat - ${customerName}`,
            body: bodyText,
            soundType: 'message',
            silent: true, // We already played sound
            tag: `customer-chat-${msg.conversation_id}`,
            onClick: () => {
              // Focus window and navigate to atendimento
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
          table: 'customer_conversations',
          filter: `owner_id=eq.${user.id}`,
        },
        () => {
          // Refetch unread count when conversations are updated
          fetchUnreadCount();
        }
      )
      .subscribe((status) => {
        console.log('[GlobalCustomerChat] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playSound, showNotification, fetchUnreadCount]);

  // Request permission on first interaction
  const ensurePermission = useCallback(() => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
      if (permission === 'default') {
        requestPermission();
      }
    }
  }, [permission, requestPermission]);

  // Track first click to request permission
  useEffect(() => {
    const handleClick = () => ensurePermission();
    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [ensurePermission]);

  const clearUnread = useCallback(() => {
    setState(prev => ({ ...prev, unreadCount: 0, hasNewMessage: false }));
  }, []);

  return {
    unreadCount: state.unreadCount,
    hasNewMessage: state.hasNewMessage,
    lastMessageTime: state.lastMessageTime,
    refetch: fetchUnreadCount,
    clearUnread,
    permission,
    requestPermission,
  };
}
