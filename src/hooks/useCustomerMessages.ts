import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomerMessage = {
  id: string;
  conversation_id: string;
  owner_id: string;
  customer_user_id: string;
  sender_type: "owner" | "customer";
  content: string;
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
          "id, conversation_id, owner_id, customer_user_id, sender_type, content, created_at, is_read_by_owner, is_read_by_customer"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data as CustomerMessage[]) ?? []);
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
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`customer-messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as CustomerMessage;
          
          // Only notify for messages from the other party
          const isFromOther = msg.sender_type !== viewer;
          
          if (isFromOther && initialLoadDone.current) {
            // Trigger callback for notification handling
            callbacks?.onNewMessage?.(msg);
            
            // Add with animation flag
            setMessages((prev) => [...prev, { ...msg, isNew: true }]);
            
            // Remove animation flag after animation completes
            setTimeout(() => {
              setMessages((prev) => 
                prev.map((m) => m.id === msg.id ? { ...m, isNew: false } : m)
              );
            }, 1000);
          } else {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewer, callbacks]);

  // Mark as read when conversation opens / changes
  useEffect(() => {
    if (!conversationId) return;
    markRead();
  }, [conversationId, markRead]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return false;
      if (!meta?.owner_id || !meta?.customer_user_id) return false;
      const text = content.trim();
      if (!text) return false;
      setIsSending(true);
      try {
        const sender_type = viewer;
        const { error } = await supabase.from("customer_messages").insert({
          conversation_id: conversationId,
          owner_id: meta.owner_id,
          customer_user_id: meta.customer_user_id,
          sender_type,
          content: text,
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
