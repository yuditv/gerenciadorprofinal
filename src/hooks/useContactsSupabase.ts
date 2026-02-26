import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Note: The contacts table needs to be created in Supabase
// This uses type assertions since the table may not be in the generated types yet

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface DbContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapDbToContact(db: DbContact): Contact {
  return {
    id: db.id,
    name: db.name,
    phone: db.phone,
    email: db.email || undefined,
    notes: db.notes || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export interface ImportProgress {
  current: number;
  total: number;
  isImporting: boolean;
}

export function useContactsSupabase() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isConfigured] = useState(true);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    isImporting: false,
  });
  
  // Pagination state for lazy loading
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 100,
    hasMore: true,
    totalCount: 0,
  });
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

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

  // Fetch a single page of contacts
  const fetchContactsPage = useCallback(async (page: number, pageSize: number, reset = false) => {
    if (!userId) return { data: [], hasMore: false };

    const { data, error } = await (supabase as any)
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    
    const mappedData = (data || []).map(mapDbToContact);
    const hasMore = data?.length === pageSize;
    
    return { data: mappedData, hasMore };
  }, [userId]);

  // Initial load - just get the first page (lazy loading)
  const fetchContacts = useCallback(async () => {
    if (!userId) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Get total count first
      const { count, error: countError } = await (supabase as any)
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      
      if (countError) throw countError;
      
      // Fetch first page only
      const { data, hasMore } = await fetchContactsPage(0, pagination.pageSize, true);
      
      setContacts(data);
      setPagination(prev => ({
        ...prev,
        page: 0,
        hasMore,
        totalCount: count || 0,
      }));
      setHasInitialLoad(true);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Erro ao carregar contatos do banco de dados");
    } finally {
      setIsLoading(false);
    }
  }, [userId, fetchContactsPage, pagination.pageSize]);

  // Load more contacts (pagination)
  const loadMoreContacts = useCallback(async () => {
    if (!userId || isLoading || !pagination.hasMore) return;

    try {
      setIsLoading(true);
      const nextPage = pagination.page + 1;
      const { data, hasMore } = await fetchContactsPage(nextPage, pagination.pageSize);
      
      setContacts(prev => [...prev, ...data]);
      setPagination(prev => ({
        ...prev,
        page: nextPage,
        hasMore,
      }));
    } catch (error) {
      console.error("Error loading more contacts:", error);
      toast.error("Erro ao carregar mais contatos");
    } finally {
      setIsLoading(false);
    }
  }, [userId, isLoading, pagination.page, pagination.pageSize, pagination.hasMore, fetchContactsPage]);

  // Search contacts on the server (for large datasets)
  const searchContactsRemote = useCallback(async (query: string, limit = 100): Promise<Contact[]> => {
    if (!userId || !query.trim()) return [];

    try {
      const { data, error } = await (supabase as any)
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapDbToContact);
    } catch (error) {
      console.error("Error searching contacts:", error);
      return [];
    }
  }, [userId]);

  // Don't auto-load on mount - wait for explicit call
  // This prevents the freeze when navigating to pages with this hook

  // Get total count
  const getContactCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    
    // Return cached count if available
    if (pagination.totalCount > 0) return pagination.totalCount;
    
    const { count, error } = await (supabase as any)
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    
    if (error) {
      console.error("Error counting contacts:", error);
      return contacts.length;
    }
    
    return count || 0;
  }, [userId, contacts.length, pagination.totalCount]);

  const addContact = async (data: Omit<Contact, "id" | "createdAt" | "updatedAt">) => {
    if (!userId) {
      toast.error("Você precisa estar logado para adicionar contatos");
      return null;
    }

    try {
      // If phone already exists, update it (external contacts must be preserved)
      const { data: existing } = await (supabase as any)
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .eq("phone", data.phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { data: updated, error: upErr } = await (supabase as any)
          .from("contacts")
          .update({
            name: data.name,
            email: data.email || null,
            notes: data.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId)
          .select()
          .single();
        if (upErr) throw upErr;

        // Reflect the name everywhere (Inbox)
        await (supabase as any)
          .from("conversations")
          .update({ contact_name: data.name, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("phone", data.phone);

        const updatedContact = mapDbToContact(updated as unknown as DbContact);
        setContacts((prev) => prev.map((c) => (c.id === updatedContact.id ? updatedContact : c)));
        toast.success("Contato atualizado com sucesso!");
        return updatedContact;
      }

      const { data: newData, error } = await (supabase as any)
        .from("contacts")
        .insert({
          user_id: userId,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Reflect the name everywhere (Inbox)
      await (supabase as any)
        .from("conversations")
        .update({ contact_name: data.name, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("phone", data.phone);

      const newContact = mapDbToContact(newData as unknown as DbContact);
      setContacts((prev) => [newContact, ...prev]);
      toast.success("Contato adicionado com sucesso!");
      return newContact;
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Erro ao adicionar contato");
      return null;
    }
  };

  const updateContact = async (id: string, data: Partial<Omit<Contact, "id" | "createdAt" | "updatedAt">>) => {
    if (!userId) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;

      const { error } = await (supabase as any)
        .from("contacts")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      // If name/phone changed, reflect in conversations (Inbox)
      if (data.name !== undefined || data.phone !== undefined) {
        const contactInState = contacts.find((c) => c.id === id);
        const phone = data.phone ?? contactInState?.phone;
        const name = data.name ?? contactInState?.name;
        if (phone && name) {
          await (supabase as any)
            .from("conversations")
            .update({ contact_name: name, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("phone", phone);
        }
      }

      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === id
            ? { ...contact, ...data, updatedAt: new Date().toISOString() }
            : contact
        )
      );
      toast.success("Contato atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Erro ao atualizar contato");
    }
  };

  const deleteContact = async (id: string) => {
    if (!userId) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("contacts")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      setContacts((prev) => prev.filter((contact) => contact.id !== id));
      toast.success("Contato removido com sucesso!");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Erro ao remover contato");
    }
  };

  const searchContacts = (query: string) => {
    if (!query.trim()) return contacts;
    const lower = query.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(lower) ||
        contact.phone.includes(query) ||
        contact.email?.toLowerCase().includes(lower)
    );
  };

  const importContacts = async (
    importedContacts: Array<Omit<Contact, "id" | "createdAt" | "updatedAt">>
  ) => {
    if (!userId) {
      toast.error("Você precisa estar logado para importar contatos");
      return;
    }

    // Deduplicate by phone - keep last occurrence (latest data wins)
    const deduped = new Map<string, typeof importedContacts[0]>();
    for (const c of importedContacts) {
      const phone = c.phone?.replace(/\D/g, '') || '';
      if (phone.length >= 10) {
        deduped.set(phone, { ...c, phone });
      }
    }

    const normalized = Array.from(deduped.values()).map((c) => ({
      user_id: userId,
      name: c.name || "Sem nome",
      phone: c.phone,
      email: c.email || null,
      notes: c.notes || null,
    }));

    if (normalized.length === 0) {
      toast.error("Nenhum contato válido encontrado");
      return;
    }

    // Set initial progress
    setImportProgress({
      current: 0,
      total: normalized.length,
      isImporting: true,
    });

    // Fetch existing phones in chunks (PostgREST has URL size limits for .in())
    const phones = normalized.map((c) => c.phone);
    const lookupChunkSize = 500;
    const existingPhones = new Set<string>();
    
    for (let i = 0; i < phones.length; i += lookupChunkSize) {
      const chunk = phones.slice(i, i + lookupChunkSize);
      try {
        const { data } = await (supabase as any)
          .from("contacts")
          .select("phone")
          .eq("user_id", userId)
          .in("phone", chunk);
        if (data) {
          for (const row of data) {
            existingPhones.add(row.phone);
          }
        }
      } catch (err) {
        console.warn("Lookup chunk failed, treating as new:", err);
      }
    }

    const toUpdate = normalized.filter((c) => existingPhones.has(c.phone));
    const toInsert = normalized.filter((c) => !existingPhones.has(c.phone));

    const insertBatchSize = 200;
    const updateBatchSize = 50;
    let totalProcessed = 0;
    let failedCount = 0;

    // Helper: retry a batch operation up to 3 times
    const withRetry = async (fn: () => Promise<void>, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await fn();
          return true;
        } catch (err) {
          if (attempt === retries) {
            console.error("Batch failed after retries:", err);
            return false;
          }
          await new Promise(r => setTimeout(r, 200 * attempt));
        }
      }
      return false;
    };

    // 1) Update existing contacts in sequential batches
    for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
      const batch = toUpdate.slice(i, i + updateBatchSize);
      
      const success = await withRetry(async () => {
        // Update each contact individually (no bulk update in Supabase by phone)
        for (const c of batch) {
          const { error } = await (supabase as any)
            .from("contacts")
            .update({
              name: c.name,
              email: c.email,
              notes: c.notes,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("phone", c.phone);
          if (error) throw error;
        }
      });

      if (success) {
        totalProcessed += batch.length;
      } else {
        failedCount += batch.length;
      }

      setImportProgress({
        current: totalProcessed + failedCount,
        total: normalized.length,
        isImporting: true,
      });

      // Yield to UI and avoid rate limiting
      await new Promise(r => setTimeout(r, 30));
    }

    // 2) Insert new contacts in batches
    for (let i = 0; i < toInsert.length; i += insertBatchSize) {
      const batch = toInsert.slice(i, i + insertBatchSize);

      const success = await withRetry(async () => {
        const { error } = await (supabase as any).from("contacts").insert(batch);
        if (error) throw error;
      });

      if (!success) {
        // Try smaller sub-batches
        const subSize = 50;
        for (let j = 0; j < batch.length; j += subSize) {
          const subBatch = batch.slice(j, j + subSize);
          const subSuccess = await withRetry(async () => {
            const { error } = await (supabase as any).from("contacts").insert(subBatch);
            if (error) throw error;
          });
          if (subSuccess) {
            totalProcessed += subBatch.length;
          } else {
            // Try individual inserts as last resort
            for (const contact of subBatch) {
              try {
                const { error } = await (supabase as any).from("contacts").insert(contact);
                if (error) throw error;
                totalProcessed++;
              } catch {
                failedCount++;
              }
            }
          }
        }
      } else {
        totalProcessed += batch.length;
      }

      setImportProgress({
        current: totalProcessed + failedCount,
        total: normalized.length,
        isImporting: true,
      });

      await new Promise(r => setTimeout(r, 30));
    }

    // Reset progress
    setImportProgress({
      current: totalProcessed,
      total: normalized.length,
      isImporting: false,
    });

    await fetchContacts();
    
    if (failedCount > 0) {
      toast.warning(`Importação concluída: ${totalProcessed.toLocaleString()} importados, ${failedCount.toLocaleString()} falharam`);
    } else {
      toast.success(`${totalProcessed.toLocaleString()} contato(s) importado(s) com sucesso!`);
    }
  };

  const clearAllContacts = async () => {
    if (!userId) {
      toast.error("Você precisa estar logado");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("contacts")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      setContacts([]);
      toast.success("Todos os contatos foram removidos!");
    } catch (error) {
      console.error("Error clearing contacts:", error);
      toast.error("Erro ao limpar contatos");
    }
  };

  const getAllPhoneNumbers = useCallback(async (): Promise<string[]> => {
    if (!userId) return [];

    try {
      const { data, error } = await (supabase as any)
        .from("contacts")
        .select("phone")
        .eq("user_id", userId);

      if (error) throw error;
      return (data || []).map((c: { phone: string }) => c.phone);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      return contacts.map((c) => c.phone);
    }
  }, [userId, contacts]);

  return {
    contacts,
    isLoading,
    userId,
    isConfigured,
    importProgress,
    pagination,
    hasInitialLoad,
    addContact,
    updateContact,
    deleteContact,
    searchContacts,
    searchContactsRemote,
    importContacts,
    clearAllContacts,
    getContactCount,
    getAllPhoneNumbers,
    loadMoreContacts,
    refetch: fetchContacts,
  };
}
