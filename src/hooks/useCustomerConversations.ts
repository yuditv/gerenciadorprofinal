import { useCallback, useEffect, useMemo, useState } from "react";
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
};

export type CustomerConversationView = CustomerConversation & {
  customer_name: string | null;
};

export function useCustomerConversations(ownerId: string | null) {
  const [conversations, setConversations] = useState<CustomerConversationView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          "id, owner_id, customer_user_id, link_id, created_at, updated_at, last_message_at, unread_owner_count, unread_customer_count"
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
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId, refetch]);

  const unreadTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread_owner_count || 0), 0),
    [conversations]
  );

  return { conversations, unreadTotal, isLoading, refetch };
}
