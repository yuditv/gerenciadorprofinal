import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomerConversation = {
  id: string;
  owner_id: string;
  customer_user_id: string;
  link_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  unread_owner_count: number;
  unread_customer_count: number;
  ai_enabled: boolean;
  active_agent_id: string | null;
};

export type CustomerConversationView = CustomerConversation & {
  customer_name: string | null;
};

type NotificationCallbacks = {
  onNewMessage?: (conversationId: string, customerName: string, content: string | null, mediaType: string | null, fileName: string | null) => void;
};

export function useCustomerConversations(ownerId: string | null, callbacks?: NotificationCallbacks) {
  const [conversations, setConversations] = useState<CustomerConversationView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedConversationId, setLastUpdatedConversationId] = useState<string | null>(null);
  const callbacksRef = useRef(callbacks);
  const processedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const refetch = useCallback(async () => {
    if (!ownerId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: convs, error: convError } = await supabase
        .from("customer_conversations")
        .select(
          "id, owner_id, customer_user_id, link_id, created_at, updated_at, last_message_at, unread_owner_count, unread_customer_count, ai_enabled, active_agent_id"
        )
        .eq("owner_id", ownerId)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (convError) throw convError;

      const base = (convs as CustomerConversation[]) ?? [];

      // Fetch customer names from links (name is stored on customer_chat_links)
      const { data: names, error: namesError } = await supabase
        .from("customer_chat_links")
        .select("customer_user_id, customer_name")
        .eq("owner_id", ownerId)
        .not("customer_user_id", "is", null);

      if (namesError) throw namesError;

      const byCustomerId = new Map<string, string>();
      (names ?? []).forEach((r) => {
        if (r.customer_user_id) byCustomerId.set(r.customer_user_id, r.customer_name ?? "Cliente");
      });

      setConversations(
        base.map((c) => ({
          ...c,
          customer_name: byCustomerId.get(c.customer_user_id) ?? "Cliente",
        }))
      );
    } catch (e) {
      console.error("[useCustomerConversations] refetch failed", e);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!ownerId) return;
    
    const channel = supabase
      .channel(`customer-conversations-${ownerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_messages",
          filter: `owner_id=eq.${ownerId}`,
        },
        (payload) => {
          const msg = payload.new as { 
            id: string; 
            conversation_id: string; 
            sender_type: string; 
            content: string | null;
            media_type: string | null;
            file_name: string | null;
          };
          
          console.log('[useCustomerConversations] New message received:', msg);
          
          // Skip if already processed
          if (processedMessagesRef.current.has(msg.id)) {
            return;
          }
          processedMessagesRef.current.add(msg.id);
          
          // Limit the size of processed messages set
          if (processedMessagesRef.current.size > 100) {
            const arr = Array.from(processedMessagesRef.current);
            processedMessagesRef.current = new Set(arr.slice(-50));
          }
          
          // Only notify for messages from customers
          if (msg.sender_type === 'customer') {
            setLastUpdatedConversationId(msg.conversation_id);
            
            // Find conversation to get customer name
            const conv = conversations.find(c => c.id === msg.conversation_id);
            const customerName = conv?.customer_name ?? 'Cliente';
            
            console.log('[useCustomerConversations] Triggering notification for:', customerName);
            callbacksRef.current?.onNewMessage?.(
              msg.conversation_id, 
              customerName, 
              msg.content,
              msg.media_type,
              msg.file_name
            );
            
            // Clear highlight after animation
            setTimeout(() => {
              setLastUpdatedConversationId(null);
            }, 3000);
          }
          
          refetch();
        }
      )
      .subscribe((status, err) => {
        console.log('[useCustomerConversations] Channel status:', status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId, refetch, conversations]);

  const unreadTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread_owner_count || 0), 0),
    [conversations]
  );

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!ownerId) return false;
    try {
      // First delete all messages in the conversation - use owner_id to bypass RLS
      const { error: messagesError } = await supabase
        .from("customer_messages")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("owner_id", ownerId);

      if (messagesError) {
        console.error("[useCustomerConversations] delete messages failed", messagesError);
        throw messagesError;
      }

      // Then delete the conversation itself - use owner_id to bypass RLS
      const { error: convError } = await supabase
        .from("customer_conversations")
        .delete()
        .eq("id", conversationId)
        .eq("owner_id", ownerId);

      if (convError) {
        console.error("[useCustomerConversations] delete conversation failed", convError);
        throw convError;
      }

      await refetch();
      return true;
    } catch (e) {
      console.error("[useCustomerConversations] deleteConversation failed", e);
      return false;
    }
  }, [refetch, ownerId]);

  const toggleAI = useCallback(async (conversationId: string, enabled: boolean, agentId?: string | null) => {
    try {
      const updateData: Record<string, unknown> = { ai_enabled: enabled };
      if (agentId !== undefined) {
        updateData.active_agent_id = agentId;
      }
      
      const { error } = await supabase
        .from("customer_conversations")
        .update(updateData)
        .eq("id", conversationId);

      if (error) throw error;
      await refetch();
      return true;
    } catch (e) {
      console.error("[useCustomerConversations] toggleAI failed", e);
      return false;
    }
  }, [refetch]);

  const setActiveAgent = useCallback(async (conversationId: string, agentId: string | null) => {
    try {
      const { error } = await supabase
        .from("customer_conversations")
        .update({ active_agent_id: agentId })
        .eq("id", conversationId);

      if (error) throw error;
      await refetch();
      return true;
    } catch (e) {
      console.error("[useCustomerConversations] setActiveAgent failed", e);
      return false;
    }
  }, [refetch]);

  return { 
    conversations, 
    unreadTotal, 
    isLoading, 
    refetch, 
    deleteConversation, 
    toggleAI, 
    setActiveAgent,
    lastUpdatedConversationId 
  };
}
