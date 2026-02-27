import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface InactiveContact {
  id: string;
  name: string;
  phone: string;
  originalPhone?: string;
  email?: string;
  notes?: string;
  reason: string;
  fixedPhone?: string;
  createdAt: string;
  updatedAt: string;
}

interface DbInactiveContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  original_phone: string | null;
  email: string | null;
  notes: string | null;
  reason: string;
  fixed_phone: string | null;
  created_at: string;
  updated_at: string;
}

function mapDb(db: DbInactiveContact): InactiveContact {
  return {
    id: db.id,
    name: db.name,
    phone: db.phone,
    originalPhone: db.original_phone || undefined,
    email: db.email || undefined,
    notes: db.notes || undefined,
    reason: db.reason,
    fixedPhone: db.fixed_phone || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/** Try to fix a phone number to make it valid */
export function tryFixPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Remove leading zeros
  digits = digits.replace(/^0+/, "");

  // Brazilian numbers: if 10-11 digits, add country code 55
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  // If 12 digits starting with 55, it might be missing the 9 digit
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.substring(2, 4);
    const number = digits.substring(4);
    // Mobile numbers in Brazil have 9 digits (starting with 9)
    if (number.length === 8 && parseInt(ddd) >= 11) {
      digits = "55" + ddd + "9" + number;
    }
  }

  // Valid lengths: 12 (landline) or 13 (mobile) for Brazil, or international
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function getReasonLabel(reason: string): string {
  switch (reason) {
    case "no_whatsapp": return "Sem WhatsApp";
    case "invalid_number": return "Número inválido";
    case "blocked": return "Bloqueado";
    case "connection_error": return "Erro de conexão";
    default: return reason;
  }
}

export function useInactiveContacts() {
  const [contacts, setContacts] = useState<InactiveContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!userId) { setContacts([]); return; }
    try {
      setIsLoading(true);
      const { count } = await (supabase as any)
        .from("inactive_contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      setTotalCount(count || 0);

      const { data, error } = await (supabase as any)
        .from("inactive_contacts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setContacts((data || []).map(mapDb));
    } catch (err) {
      console.error("Error fetching inactive contacts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const getInactiveCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    if (totalCount > 0) return totalCount;
    const { count } = await (supabase as any)
      .from("inactive_contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    return count || 0;
  }, [userId, totalCount]);

  /** Move invalid numbers to inactive_contacts instead of deleting */
  const moveToInactive = useCallback(async (
    items: Array<{ name: string; phone: string; email?: string; notes?: string; reason: string }>
  ) => {
    if (!userId || items.length === 0) return;

    const records = items.map(item => {
      const fixedPhone = tryFixPhone(item.phone);
      return {
        user_id: userId,
        name: item.name || "Sem nome",
        phone: item.phone.replace(/\D/g, ""),
        original_phone: item.phone,
        email: item.email || null,
        notes: item.notes || null,
        reason: item.reason,
        fixed_phone: fixedPhone !== item.phone.replace(/\D/g, "") ? fixedPhone : null,
      };
    });

    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        await (supabase as any)
          .from("inactive_contacts")
          .upsert(batch, { onConflict: "user_id,phone" });
      } catch (err) {
        console.error("Error moving to inactive:", err);
      }
    }
  }, [userId]);

  /** Restore a contact back to the active contacts list */
  const restoreContact = useCallback(async (contact: InactiveContact) => {
    if (!userId) return;
    const phoneToUse = contact.fixedPhone || contact.phone;
    try {
      await (supabase as any).from("contacts").upsert({
        user_id: userId,
        name: contact.name,
        phone: phoneToUse,
        email: contact.email || null,
        notes: contact.notes || null,
      }, { onConflict: "user_id,phone" });

      await (supabase as any).from("inactive_contacts").delete().eq("id", contact.id).eq("user_id", userId);
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      setTotalCount(prev => Math.max(0, prev - 1));
      toast.success(`Contato restaurado com número ${phoneToUse}`);
    } catch (err) {
      console.error("Error restoring contact:", err);
      toast.error("Erro ao restaurar contato");
    }
  }, [userId]);

  const deleteContact = useCallback(async (id: string) => {
    if (!userId) return;
    try {
      await (supabase as any).from("inactive_contacts").delete().eq("id", id).eq("user_id", userId);
      setContacts(prev => prev.filter(c => c.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error deleting inactive contact:", err);
      toast.error("Erro ao remover contato");
    }
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    try {
      await (supabase as any).from("inactive_contacts").delete().eq("user_id", userId);
      setContacts([]);
      setTotalCount(0);
      toast.success("Contatos inativos removidos!");
    } catch (err) {
      console.error("Error clearing inactive contacts:", err);
      toast.error("Erro ao limpar contatos inativos");
    }
  }, [userId]);

  /** Restore all contacts that have a fixed phone */
  const restoreAllFixable = useCallback(async () => {
    if (!userId) return;
    const fixable = contacts.filter(c => c.fixedPhone);
    if (fixable.length === 0) {
      toast.info("Nenhum contato com correção disponível");
      return;
    }

    try {
      const records = fixable.map(c => ({
        user_id: userId,
        name: c.name,
        phone: c.fixedPhone!,
        email: c.email || null,
        notes: c.notes || null,
      }));

      await (supabase as any).from("contacts").upsert(records, { onConflict: "user_id,phone" });

      const ids = fixable.map(c => c.id);
      for (let i = 0; i < ids.length; i += 500) {
        await (supabase as any).from("inactive_contacts").delete().in("id", ids.slice(i, i + 500)).eq("user_id", userId);
      }

      setContacts(prev => prev.filter(c => !c.fixedPhone));
      setTotalCount(prev => Math.max(0, prev - fixable.length));
      toast.success(`${fixable.length} contato(s) corrigido(s) e restaurado(s)!`);
    } catch (err) {
      console.error("Error restoring fixable contacts:", err);
      toast.error("Erro ao restaurar contatos");
    }
  }, [userId, contacts]);

  return {
    contacts,
    isLoading,
    totalCount,
    getInactiveCount,
    moveToInactive,
    restoreContact,
    deleteContact,
    clearAll,
    restoreAllFixable,
    refetch: fetchContacts,
  };
}
