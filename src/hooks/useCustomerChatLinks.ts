import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomerChatLink = {
  id: string;
  owner_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  redeemed_at: string | null;
  customer_user_id: string | null;
  customer_name: string | null;
};

export function useCustomerChatLinks(ownerId: string | null) {
  const [links, setLinks] = useState<CustomerChatLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const refetch = useCallback(async () => {
    if (!ownerId) {
      setLinks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_chat_links")
        .select(
          "id, owner_id, token, is_active, expires_at, created_at, redeemed_at, customer_user_id, customer_name"
        )
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLinks((data as CustomerChatLink[]) ?? []);
    } catch (e) {
      console.error("[useCustomerChatLinks] refetch failed", e);
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createLink = useCallback(
    async (customSlug?: string) => {
      if (!ownerId) return null;
      setIsMutating(true);
      try {
        const token = customSlug?.trim() || crypto.randomUUID();
        const { data, error } = await supabase
          .from("customer_chat_links")
          .insert({ owner_id: ownerId, token, is_active: true })
          .select(
            "id, owner_id, token, is_active, expires_at, created_at, redeemed_at, customer_user_id, customer_name"
          )
          .single();
        if (error) throw error;
        await refetch();
        return data as CustomerChatLink;
      } catch (e) {
        console.error("[useCustomerChatLinks] createLink failed", e);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [ownerId, refetch]
  );

  const setLinkActive = useCallback(
    async (id: string, is_active: boolean) => {
      setIsMutating(true);
      try {
        const { error } = await supabase.from("customer_chat_links").update({ is_active }).eq("id", id);
        if (error) throw error;
        await refetch();
        return true;
      } catch (e) {
        console.error("[useCustomerChatLinks] setLinkActive failed", e);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch]
  );

  const deactivateLink = useCallback(
    async (id: string) => {
      return setLinkActive(id, false);
    },
    [setLinkActive]
  );

  const deleteLink = useCallback(
    async (id: string) => {
      setIsMutating(true);
      try {
        const { error } = await supabase.from("customer_chat_links").delete().eq("id", id);
        if (error) throw error;
        await refetch();
        return true;
      } catch (e) {
        console.error("[useCustomerChatLinks] deleteLink failed", e);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch]
  );

  const inviteBaseUrl = useMemo(() => {
    try {
      return window.location.origin;
    } catch {
      return "";
    }
  }, []);

  const getInviteUrl = useCallback(
    (token: string) => {
      if (!inviteBaseUrl) return `/c/${token}`;
      return `${inviteBaseUrl}/c/${token}`;
    },
    [inviteBaseUrl]
  );

  return {
    links,
    isLoading,
    isMutating,
    refetch,
    createLink,
    setLinkActive,
    deactivateLink,
    deleteLink,
    getInviteUrl,
  };
}
