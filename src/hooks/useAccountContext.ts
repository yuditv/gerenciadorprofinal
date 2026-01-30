import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AccountMemberPermissions = {
  can_send: boolean;
  can_transfer: boolean;
  can_manage_labels_macros: boolean;
};

export function useAccountContext() {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [memberPermissions, setMemberPermissions] = useState<AccountMemberPermissions | null>(null);

  const fetchContext = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setOwnerId(null);
      setIsMember(false);
      setMemberPermissions(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Are we an attendant/member of someone else's account?
      const { data: membership, error: membershipError } = await supabase
        .from("account_members")
        .select("owner_id")
        .eq("member_id", user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;

      const resolvedOwnerId = membership?.owner_id ?? user.id;
      const member = !!membership?.owner_id && membership.owner_id !== user.id;

      setOwnerId(resolvedOwnerId);
      setIsMember(member);

      if (member) {
        const { data: perms, error: permsError } = await supabase
          .from("account_member_permissions")
          .select("can_send, can_transfer, can_manage_labels_macros")
          .eq("member_id", user.id)
          .maybeSingle();

        if (permsError) throw permsError;
        setMemberPermissions(
          perms
            ? {
                can_send: !!perms.can_send,
                can_transfer: !!perms.can_transfer,
                can_manage_labels_macros: !!perms.can_manage_labels_macros,
              }
            : { can_send: true, can_transfer: true, can_manage_labels_macros: false }
        );
      } else {
        setMemberPermissions(null);
      }
    } catch (e) {
      console.error("[useAccountContext] Failed to load account context", e);
      // Safe defaults
      setOwnerId(user?.id ?? null);
      setIsMember(false);
      setMemberPermissions(null);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const permissions = useMemo(() => {
    if (!isMember) {
      return {
        canSend: true,
        canTransfer: true,
        canManageLabelsMacros: true,
      };
    }

    return {
      canSend: !!memberPermissions?.can_send,
      canTransfer: !!memberPermissions?.can_transfer,
      canManageLabelsMacros: !!memberPermissions?.can_manage_labels_macros,
    };
  }, [isMember, memberPermissions]);

  return {
    ownerId,
    isMember,
    permissions,
    isLoading,
    refetch: fetchContext,
  };
}
