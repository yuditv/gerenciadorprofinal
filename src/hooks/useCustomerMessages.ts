import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomerMessage = {
  id: string;
  conversation_id: string;
  owner_id: string;
  customer_user_id: string;
  sender_type: "owner" | "customer";
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  file_name: string | null;
  created_at: string;
  is_read_by_owner: boolean;
  is_read_by_customer: boolean;
  isNew?: boolean; // Flag for animation
};

type Viewer = "owner" | "customer";

type ConversationMeta = {
  owner_id: string;
  customer_user_id: string;
} | null;

type NotificationCallbacks = {
  onNewMessage?: (message: CustomerMessage) => void;
};

const BASE_POLL_INTERVAL = 3000;
const MAX_POLL_INTERVAL = 30000;

export function useCustomerMessages(
  conversationId: string | null, 
  viewer: Viewer, 
  meta: ConversationMeta,
  callbacks?: NotificationCallbacks
) {
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const initialLoadDone = useRef(false);
  const lastSyncTimestamp = useRef<string | null>(null);
  const pollIntervalRef = useRef(BASE_POLL_INTERVAL);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Helper to add message with deduplication
  const addMessageWithDedup = useCallback((msg: CustomerMessage, isFromOther: boolean) => {
    setMessages((prev) => {
      // Deduplication: skip if already exists
      if (prev.some((m) => m.id === msg.id)) {
        return prev;
      }
      
      const newMsg = isFromOther && initialLoadDone.current 
        ? { ...msg, isNew: true } 
        : msg;
      
      const updated = [...prev, newMsg].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      return updated;
    });

    // Update last sync timestamp
    if (!lastSyncTimestamp.current || new Date(msg.created_at) > new Date(lastSyncTimestamp.current)) {
      lastSyncTimestamp.current = msg.created_at;
    }

    // Trigger notification callback for messages from others
    if (isFromOther && initialLoadDone.current) {
      console.log('[useCustomerMessages] New message from other party, triggering notification');
      callbacksRef.current?.onNewMessage?.(msg);
      
      // Remove animation flag after animation completes
      setTimeout(() => {
        setMessages((prev) => 
          prev.map((m) => m.id === msg.id ? { ...m, isNew: false } : m)
        );
      }, 1000);
    }
  }, []);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_messages")
        .select(
          "id, conversation_id, owner_id, customer_user_id, sender_type, content, media_url, media_type, file_name, created_at, is_read_by_owner, is_read_by_customer"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const msgs = (data as CustomerMessage[]) ?? [];
      setMessages(msgs);
      
      // Set last sync timestamp from the most recent message
      if (msgs.length > 0) {
        lastSyncTimestamp.current = msgs[msgs.length - 1].created_at;
      }
      
      initialLoadDone.current = true;
    } catch (e) {
      console.error("[useCustomerMessages] refetch failed", e);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    try {
      if (viewer === "owner") {
        await supabase
          .from("customer_messages")
          .update({ is_read_by_owner: true })
          .eq("conversation_id", conversationId)
          .eq("sender_type", "customer")
          .eq("is_read_by_owner", false);
      } else {
        await supabase
          .from("customer_messages")
          .update({ is_read_by_customer: true })
          .eq("conversation_id", conversationId)
          .eq("sender_type", "owner")
          .eq("is_read_by_customer", false);
      }
    } catch (e) {
      console.warn("[useCustomerMessages] markRead failed (ignored)", e);
    }
  }, [conversationId, viewer]);

  useEffect(() => {
    initialLoadDone.current = false;
    lastSyncTimestamp.current = null;
    pollIntervalRef.current = BASE_POLL_INTERVAL;
    refetch();
  }, [refetch]);

  // Real-time subscription with fallback polling
  useEffect(() => {
    if (!conversationId) return;

    // Polling function as fallback
    const poll = async () => {
      if (!conversationId || !lastSyncTimestamp.current) return;
      
      try {
        const { data, error } = await supabase
          .from("customer_messages")
          .select(
            "id, conversation_id, owner_id, customer_user_id, sender_type, content, media_url, media_type, file_name, created_at, is_read_by_owner, is_read_by_customer"
          )
          .eq("conversation_id", conversationId)
          .gt("created_at", lastSyncTimestamp.current)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("[useCustomerMessages] poll error", error);
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, MAX_POLL_INTERVAL);
        } else if (data && data.length > 0) {
          console.log(`[useCustomerMessages] Poll found ${data.length} new messages`);
          data.forEach((msg) => {
            const isFromOther = (msg as CustomerMessage).sender_type !== viewer;
            addMessageWithDedup(msg as CustomerMessage, isFromOther);
          });
          pollIntervalRef.current = BASE_POLL_INTERVAL; // Reset on new messages
        } else {
          // Backoff when no changes
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, MAX_POLL_INTERVAL);
        }
      } catch (e) {
        console.error("[useCustomerMessages] poll exception", e);
        pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, MAX_POLL_INTERVAL);
      }

      // Schedule next poll
      pollTimeoutRef.current = setTimeout(poll, pollIntervalRef.current);
    };

    // Real-time subscription
    const channel = supabase
      .channel(`customer-messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          console.log('[useCustomerMessages] Real-time INSERT received:', payload.new);
          const msg = payload.new as CustomerMessage;
          const isFromOther = msg.sender_type !== viewer;
          addMessageWithDedup(msg, isFromOther);
          pollIntervalRef.current = BASE_POLL_INTERVAL; // Reset poll interval on real-time event
        }
      )
      .subscribe((status, err) => {
        console.log('[useCustomerMessages] Channel status:', status, err);
        if (status === 'SUBSCRIBED') {
          // Start polling as backup after successful subscription
          pollTimeoutRef.current = setTimeout(poll, pollIntervalRef.current);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useCustomerMessages] Realtime channel error, relying on polling');
          // Start polling immediately on error
          pollTimeoutRef.current = setTimeout(poll, BASE_POLL_INTERVAL);
        }
      });

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewer, addMessageWithDedup]);

  // Mark as read when conversation opens / changes
  useEffect(() => {
    if (!conversationId) return;
    markRead();
  }, [conversationId, markRead]);

  const sendMessage = useCallback(
    async (content: string, mediaFile?: File) => {
      if (!conversationId) return false;
      if (!meta?.owner_id || !meta?.customer_user_id) return false;
      const text = content.trim();
      // Require either content or media
      if (!text && !mediaFile) return false;
      setIsSending(true);
      try {
        let media_url: string | null = null;
        let media_type: string | null = null;
        let file_name: string | null = null;

        // Upload media if provided
        if (mediaFile) {
          // Get current user for the upload path (RLS requires user_id as first folder)
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData.user?.id;
          if (!userId) throw new Error('User not authenticated');
          
          const ext = mediaFile.name.split('.').pop() || 'bin';
          const filePath = `${userId}/customer-chat/${conversationId}/${Date.now()}.${ext}`;
          
          console.log('[useCustomerMessages] Uploading file to:', filePath);
          
          const { error: uploadError } = await supabase.storage
            .from('dispatch-media')
            .upload(filePath, mediaFile);
          
          if (uploadError) {
            console.error('[useCustomerMessages] Upload error:', uploadError);
            throw uploadError;
          }
          
          const { data: urlData } = supabase.storage
            .from('dispatch-media')
            .getPublicUrl(filePath);
          
          media_url = urlData.publicUrl;
          media_type = mediaFile.type.split('/')[0] || 'document'; // image, video, audio, document
          file_name = mediaFile.name;
          
          console.log('[useCustomerMessages] Upload successful:', media_url);
        }

        const sender_type = viewer;
        const { error } = await supabase.from("customer_messages").insert({
          conversation_id: conversationId,
          owner_id: meta.owner_id,
          customer_user_id: meta.customer_user_id,
          sender_type,
          content: text || null,
          media_url,
          media_type,
          file_name,
        });
        if (error) throw error;
        return true;
      } catch (e) {
        console.error("[useCustomerMessages] sendMessage failed", e);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, viewer, meta?.owner_id, meta?.customer_user_id]
  );

  return {
    messages,
    isLoading,
    isSending,
    refetch,
    sendMessage,
    markRead,
  };
}
