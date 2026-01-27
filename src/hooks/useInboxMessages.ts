import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'contact' | 'agent' | 'ai' | 'system';
  sender_id: string | null;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  is_private: boolean;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useInboxMessages(conversationId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSyncingRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  
  // Keep refs in sync with state
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as { data: ChatMessage[] | null; error: unknown };

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const sendMessage = async (content: string, isPrivate = false, mediaUrl?: string, mediaType?: string, fileName?: string, retryId?: string) => {
    if (!conversationId || (!content.trim() && !mediaUrl)) return false;

    // If retrying, remove the failed message first
    if (retryId) {
      setMessages(prev => prev.filter(m => m.id !== retryId));
    }

    // Create optimistic message with 'sending' status
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_type: 'agent',
      sender_id: user?.id || null,
      content: content.trim() || null,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      is_private: isPrivate,
      is_read: false,
      metadata: { status: 'sending', sent_by: user?.email || 'Atendente' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/send-inbox-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            conversationId,
            content,
            isPrivate,
            mediaUrl,
            mediaType,
            fileName
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Update optimistic message with 'sent' status
      setMessages(prev => 
        prev.map(m => m.id === optimisticId 
          ? { ...m, metadata: { ...m.metadata, status: 'sent' } }
          : m
        )
      );

      // Real message will replace via realtime subscription
      return true;
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      
      // Update optimistic message to show failure with original content for retry
      setMessages(prev => 
        prev.map(m => m.id === optimisticId 
          ? { 
              ...m, 
              metadata: { 
                ...m.metadata, 
                status: 'failed', 
                send_error: true,
                original_content: content,
                original_is_private: isPrivate,
                original_media_url: mediaUrl,
                original_media_type: mediaType,
                original_file_name: fileName
              } 
            }
          : m
        )
      );
      
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const retryMessage = async (messageId: string) => {
    const failedMessage = messages.find(m => m.id === messageId);
    if (!failedMessage) return false;

    const metadata = failedMessage.metadata;
    const content = (metadata.original_content as string) || failedMessage.content || '';
    const isPrivate = (metadata.original_is_private as boolean) || failedMessage.is_private;
    const mediaUrl = (metadata.original_media_url as string) || failedMessage.media_url || undefined;
    const mediaType = (metadata.original_media_type as string) || failedMessage.media_type || undefined;
    const fileName = (metadata.original_file_name as string) || undefined;

    return sendMessage(content, isPrivate, mediaUrl, mediaType, fileName, messageId);
  };

  // Fetch messages when conversation changes
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!conversationId) return;

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_inbox_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
      (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages(prev => {
            // Avoid duplicates by ID
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            
            // Replace optimistic message (temp-*) with real one
            // Match by sender_type='agent', same content/media, recent timestamp
            const optimisticIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') && 
              m.sender_type === 'agent' &&
              newMessage.sender_type === 'agent' &&
              // Match by content OR media_url (for media-only messages)
              ((m.content && m.content === newMessage.content) || 
               (m.media_url && m.media_url === newMessage.media_url)) &&
              // Only match if created within last 10 seconds
              (Date.now() - new Date(m.created_at).getTime()) < 10000
            );
            
            if (optimisticIndex !== -1) {
              // Replace optimistic with real message
              const updated = [...prev];
              updated[optimisticIndex] = newMessage;
              return updated;
            }
            
            // Not a duplicate, add normally
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_inbox_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          setMessages(prev => 
            prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId]);

  const syncMessages = useCallback(async (options?: { limit?: number; silent?: boolean; force?: boolean }) => {
    const { limit = 50, silent = false, force = false } = options || {};
    const currentConversationId = conversationIdRef.current;
    if (!currentConversationId || isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    setIsSyncing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/fetch-messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ conversationId: currentConversationId, limit, force })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync messages');
      }

      // Expected state: user hasn't connected WhatsApp instance yet.
      if (result?.success === false && result?.code === 'INSTANCE_NOT_CONFIGURED') {
        return;
      }

      if (result.newMessages > 0) {
        // Reload from database
        const { data, error } = await supabase
          .from('chat_inbox_messages')
          .select('*')
          .eq('conversation_id', currentConversationId)
          .order('created_at', { ascending: true });
        
        if (!error && data) {
          setMessages(data as ChatMessage[]);
        }
        
        if (!silent) {
          toast({
            title: 'Mensagens sincronizadas',
            description: `${result.newMessages} nova(s) mensagem(ns) encontrada(s)`,
          });
        }
      } else if (!silent) {
        toast({
          title: 'Sincronização concluída',
          description: 'Nenhuma mensagem nova encontrada',
        });
      }
    } catch (error: unknown) {
      console.error('Error syncing messages:', error);
      if (!silent) {
        toast({
          title: 'Erro ao sincronizar',
          description: error instanceof Error ? error.message : 'Tente novamente',
          variant: 'destructive'
        });
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [toast]);

  // Auto-polling every 30 seconds when conversation is open
  useEffect(() => {
    if (!conversationId) return;

    // Initial sync when conversation opens (after 2 seconds)
    const initialTimeout = setTimeout(() => {
      syncMessages({ silent: true });
    }, 2000);

    // Set up polling interval
    const pollInterval = setInterval(() => {
      syncMessages({ silent: true });
    }, 30000); // 30 seconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(pollInterval);
    };
  }, [conversationId, syncMessages]);

  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMessage = async (messageId: string, deleteForEveryone: boolean = false): Promise<boolean> => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return false;

    setIsDeleting(true);

    try {
      // Get conversation to find instance_id
      const { data: conversation } = await supabase
        .from('conversations')
        .select('instance_id')
        .eq('id', conversationId)
        .single();

      const whatsappId = (message.metadata?.whatsapp_id || message.metadata?.whatsapp_message_id) as string | undefined;
      
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        'https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/whatsapp-instances',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            action: 'delete_message',
            messageId,
            instanceId: conversation?.instance_id,
            whatsappId,
            deleteForEveryone
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao apagar mensagem');
      }

      // Update local state
      if (deleteForEveryone) {
        // Show "message deleted" placeholder
        setMessages(prev =>
          prev.map(m => m.id === messageId
            ? { 
                ...m, 
                content: '🚫 Mensagem apagada', 
                media_url: null,
                metadata: { ...m.metadata, deleted: true, deleted_for_everyone: true } 
              }
            : m
          )
        );
      } else {
        // Remove from local view only
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }

      toast({
        title: 'Mensagem apagada',
        description: deleteForEveryone ? 'Apagada para todos' : 'Apagada para você',
      });

      return true;
    } catch (error: unknown) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Erro ao apagar',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    messages,
    isLoading,
    isSending,
    isSyncing,
    isDeleting,
    sendMessage,
    retryMessage,
    deleteMessage,
    syncMessages,
    refetch: fetchMessages
  };
}
