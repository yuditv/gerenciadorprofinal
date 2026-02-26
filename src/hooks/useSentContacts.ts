import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface SentContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  originalContactId?: string;
  sentAt: string;
  dispatchHistoryId?: string;
  createdAt: string;
}

interface DbSentContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  original_contact_id: string | null;
  sent_at: string;
  dispatch_history_id: string | null;
  created_at: string;
}

function mapDbToSentContact(db: DbSentContact): SentContact {
  return {
    id: db.id,
    name: db.name,
    phone: db.phone,
    email: db.email || undefined,
    notes: db.notes || undefined,
    originalContactId: db.original_contact_id || undefined,
    sentAt: db.sent_at,
    dispatchHistoryId: db.dispatch_history_id || undefined,
    createdAt: db.created_at,
  };
}

export function useSentContacts() {
  const [sentContacts, setSentContacts] = useState<SentContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
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

  // Fetch sent contacts
  const fetchSentContacts = useCallback(async () => {
    if (!userId) {
      setSentContacts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const allContacts: DbSentContact[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await (supabase as any)
          .from("sent_contacts")
          .select("*")
          .eq("user_id", userId)
          .order("sent_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allContacts.push(...data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      setSentContacts(allContacts.map(mapDbToSentContact));
    } catch (error) {
      console.error("Error fetching sent contacts:", error);
      toast.error("Erro ao carregar contatos enviados");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSentContacts();
  }, [fetchSentContacts]);

  // Get all sent phone numbers for filtering
  const getSentPhoneNumbers = useCallback(async (): Promise<Set<string>> => {
    if (!userId) return new Set();

    try {
      const { data, error } = await (supabase as any)
        .from("sent_contacts")
        .select("phone")
        .eq("user_id", userId);

      if (error) throw error;
      return new Set((data || []).map((c: { phone: string }) => c.phone.replace(/\D/g, '')));
    } catch (error) {
      console.error("Error fetching sent phone numbers:", error);
      return new Set(sentContacts.map((c) => c.phone.replace(/\D/g, '')));
    }
  }, [userId, sentContacts]);

  // Move contacts to sent contacts table
  const moveContactsToSent = async (
    contactsToMove: Array<{
      id: string;
      name: string;
      phone: string;
      email?: string;
      notes?: string;
    }>,
    dispatchHistoryId?: string
  ) => {
    if (!userId || contactsToMove.length === 0) return;

    try {
      const sentRecords = contactsToMove.map(c => ({
        user_id: userId,
        name: c.name,
        phone: c.phone.replace(/\D/g, ''),
        email: c.email || null,
        notes: c.notes || null,
        original_contact_id: c.id,
        dispatch_history_id: dispatchHistoryId || null,
        sent_at: new Date().toISOString(),
      }));

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < sentRecords.length; i += batchSize) {
        const batch = sentRecords.slice(i, i + batchSize);
        const { error } = await (supabase as any).from("sent_contacts").insert(batch);
        if (error) {
          console.error("Error inserting sent contacts batch:", error);
        }
      }

      // Delete from original contacts table
      for (let i = 0; i < contactsToMove.length; i += batchSize) {
        const batch = contactsToMove.slice(i, i + batchSize);
        const ids = batch.map(c => c.id);
        const { error } = await (supabase as any)
          .from("contacts")
          .delete()
          .in("id", ids)
          .eq("user_id", userId);
        
        if (error) {
          console.error("Error deleting contacts batch:", error);
        }
      }

      await fetchSentContacts();
    } catch (error) {
      console.error("Error moving contacts to sent:", error);
      toast.error("Erro ao mover contatos para enviados");
    }
  };

  // Restore a sent contact back to contacts
  const restoreContact = async (sentContactId: string) => {
    if (!userId) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const contact = sentContacts.find(c => c.id === sentContactId);
      if (!contact) return;

      // Add back to contacts
      const { error: insertError } = await (supabase as any)
        .from("contacts")
        .insert({
          user_id: userId,
          name: contact.name,
          phone: contact.phone,
          email: contact.email || null,
          notes: contact.notes || null,
        });

      if (insertError) throw insertError;

      // Remove from sent_contacts
      const { error: deleteError } = await (supabase as any)
        .from("sent_contacts")
        .delete()
        .eq("id", sentContactId)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      setSentContacts(prev => prev.filter(c => c.id !== sentContactId));
      toast.success("Contato restaurado com sucesso!");
    } catch (error) {
      console.error("Error restoring contact:", error);
      toast.error("Erro ao restaurar contato");
    }
  };

  // Restore all sent contacts
  const restoreAllContacts = async () => {
    if (!userId || sentContacts.length === 0) {
      toast.error("Nenhum contato para restaurar");
      return;
    }

    try {
      const batchSize = 500;
      
      // Upsert back to contacts to avoid duplicates
      for (let i = 0; i < sentContacts.length; i += batchSize) {
        const batch = sentContacts.slice(i, i + batchSize).map(c => ({
          user_id: userId,
          name: c.name,
          phone: c.phone,
          email: c.email || null,
          notes: c.notes || null,
        }));
        
        const { error } = await (supabase as any)
          .from("contacts")
          .upsert(batch, { onConflict: "user_id,phone" });
        if (error) console.error("Error restoring batch:", error);
      }

      // Delete all from sent_contacts
      const { error: deleteError } = await (supabase as any)
        .from("sent_contacts")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      const count = sentContacts.length;
      setSentContacts([]);
      toast.success(`${count} contato(s) restaurado(s) para Meus Contatos!`);
    } catch (error) {
      console.error("Error restoring all contacts:", error);
      toast.error("Erro ao restaurar contatos");
    }
  };

  // Clear all sent contacts
  const clearAllSentContacts = async () => {
    if (!userId) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("sent_contacts")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      setSentContacts([]);
      toast.success("Todos os contatos enviados foram removidos!");
    } catch (error) {
      console.error("Error clearing sent contacts:", error);
      toast.error("Erro ao limpar contatos enviados");
    }
  };

  // Get count
  const getSentContactCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    
    const { count, error } = await (supabase as any)
      .from("sent_contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    
    if (error) {
      console.error("Error counting sent contacts:", error);
      return sentContacts.length;
    }
    
    return count || 0;
  }, [userId, sentContacts.length]);

  return {
    sentContacts,
    isLoading,
    userId,
    moveContactsToSent,
    restoreContact,
    restoreAllContacts,
    clearAllSentContacts,
    getSentPhoneNumbers,
    getSentContactCount,
    refetch: fetchSentContacts,
  };
}
