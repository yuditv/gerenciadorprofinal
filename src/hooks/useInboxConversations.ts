import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Conversation {
  id: string;
  instance_id: string;
  user_id: string;
  phone: string;
  contact_name: string | null;
  contact_avatar: string | null;
  country_code: string | null;
  status: 'open' | 'pending' | 'resolved' | 'snoozed';
  assigned_to: string | null;
  ai_enabled: boolean;
  ai_paused_at: string | null;
  active_agent_id: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  unread_count: number;
  last_message_at: string;
  last_message_preview: string | null;
  first_reply_at: string | null;
  resolved_at: string | null;
  snoozed_until: string | null;
  ticket_number: string | null;
  summary: string | null;
  closed_at: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined data
  instance?: {
    id: string;
    instance_name: string;
    status: string;
  };
  labels?: {
    id: string;
    label: {
      id: string;
      name: string;
      color: string;
    };
  }[];
  active_agent?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

export interface InboxLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description: string | null;
  whatsapp_label_id: string | null;
  instance_id: string | null;
  created_at: string;
}

export interface ConversationFilter {
  status?: 'open' | 'pending' | 'resolved' | 'snoozed' | 'all';
  instanceId?: string;
  labelId?: string;
  assignedTo?: string | 'unassigned' | 'me' | 'all';
  search?: string;
}

export function useInboxConversations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [labels, setLabels] = useState<InboxLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ConversationFilter>({
    status: 'open',
    assignedTo: 'all'
  });

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          instance:whatsapp_instances!conversations_instance_id_fkey(
            id,
            instance_name,
            status
          ),
          labels:conversation_labels(
            id,
            label:inbox_labels(
              id,
              name,
              color
            )
          ),
          active_agent:ai_agents!conversations_active_agent_id_fkey(
            id,
            name,
            color,
            icon
          )
        `)
        .order('last_message_at', { ascending: false });

      // Apply filters
      if (filter.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      } else if (filter.status === 'all') {
        // Exclude resolved (Compra Finalizada) from "Todas" view
        query = query.neq('status', 'resolved');
      }

      if (filter.instanceId) {
        query = query.eq('instance_id', filter.instanceId);
      }

      if (filter.assignedTo === 'me') {
        query = query.eq('assigned_to', user.id);
      } else if (filter.assignedTo === 'unassigned') {
        query = query.is('assigned_to', null);
      }

      if (filter.search) {
        query = query.or(`phone.ilike.%${filter.search}%,contact_name.ilike.%${filter.search}%`);
      }

      // Filter by label
      if (filter.labelId) {
        const { data: labeledConversations } = await supabase
          .from('conversation_labels')
          .select('conversation_id')
          .eq('label_id', filter.labelId);
        
        const conversationIds = (labeledConversations || []).map(lc => lc.conversation_id);
        
        if (conversationIds.length > 0) {
          query = query.in('id', conversationIds);
        } else {
          setConversations([]);
          return;
        }
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching conversations:', error);
        throw error;
      }

      const mappedData = (data || []).map(conv => ({
        ...conv,
        status: conv.status as 'open' | 'pending' | 'resolved' | 'snoozed',
        priority: conv.priority as 'low' | 'medium' | 'high' | 'urgent',
        instance: Array.isArray(conv.instance) ? conv.instance[0] ?? undefined : conv.instance ?? undefined,
      }));

      setConversations(mappedData as Conversation[]);

      // Fetch resolved count separately (since resolved is excluded from "all")
      const { count: rCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');
      setResolvedCount(rCount || 0);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [user, filter]);

  const fetchLabels = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('inbox_labels')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setLabels(data || []);
    } catch (error) {
      console.error('Error fetching labels:', error);
    }
  }, [user]);

  const createLabel = async (name: string, color: string, description?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('inbox_labels')
        .insert({ user_id: user.id, name, color, description })
        .select()
        .single();

      if (error) throw error;
      
      await fetchLabels();
      toast({ title: 'Etiqueta criada com sucesso' });
      return data;
    } catch (error: unknown) {
      console.error('Error creating label:', error);
      toast({ 
        title: 'Erro ao criar etiqueta', 
        variant: 'destructive' 
      });
      return null;
    }
  };

  const deleteLabel = async (labelId: string) => {
    try {
      const { error } = await supabase
        .from('inbox_labels')
        .delete()
        .eq('id', labelId);

      if (error) throw error;
      
      await fetchLabels();
      toast({ title: 'Etiqueta removida' });
    } catch (error) {
      console.error('Error deleting label:', error);
      toast({ title: 'Erro ao remover etiqueta', variant: 'destructive' });
    }
  };

  const assignLabel = async (conversationId: string, labelId: string) => {
    try {
      // Get the conversation to find instance_id and phone
      const conversation = conversations.find(c => c.id === conversationId);
      const label = labels.find(l => l.id === labelId);

      const { error } = await supabase
        .from('conversation_labels')
        .insert({ conversation_id: conversationId, label_id: labelId });

      if (error && error.code !== '23505') throw error; // Ignore duplicate
      
      // Sync with WhatsApp if label is linked
      if (conversation && label?.whatsapp_label_id) {
        try {
          await supabase.functions.invoke('whatsapp-instances', {
            body: { 
              action: 'assign_chat_labels', 
              instanceId: conversation.instance_id,
              phone: conversation.phone,
              addLabelIds: [label.whatsapp_label_id]
            }
          });
        } catch (e) {
          console.warn('Could not sync label to WhatsApp:', e);
        }
      }
      
      await fetchConversations();
    } catch (error) {
      console.error('Error assigning label:', error);
    }
  };

  const removeLabel = async (conversationId: string, labelId: string) => {
    try {
      // Get the conversation to find instance_id and phone
      const conversation = conversations.find(c => c.id === conversationId);
      const label = labels.find(l => l.id === labelId);

      const { error } = await supabase
        .from('conversation_labels')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('label_id', labelId);

      if (error) throw error;

      // Sync with WhatsApp if label is linked
      if (conversation && label?.whatsapp_label_id) {
        try {
          await supabase.functions.invoke('whatsapp-instances', {
            body: { 
              action: 'assign_chat_labels', 
              instanceId: conversation.instance_id,
              phone: conversation.phone,
              removeLabelIds: [label.whatsapp_label_id]
            }
          });
        } catch (e) {
          console.warn('Could not sync label removal to WhatsApp:', e);
        }
      }

      await fetchConversations();
    } catch (error) {
      console.error('Error removing label:', error);
    }
  };

  const updateConversation = async (conversationId: string, updates: Partial<Conversation>) => {
    try {
      const { error } = await supabase
        .from('conversations')
        // Supabase generated types represent jsonb as Json; our app uses Record<string, unknown>
        // for convenience in the UI.
        .update(updates as any)
        .eq('id', conversationId);

      if (error) throw error;
      await fetchConversations();
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  };

  const assignToMe = async (conversationId: string) => {
    if (!user) return;
    await updateConversation(conversationId, { assigned_to: user.id });
    toast({ title: 'Conversa atribuída a você' });
  };

  const resolveConversation = async (conversationId: string) => {
    await updateConversation(conversationId, { 
      status: 'resolved',
      resolved_at: new Date().toISOString()
    });
    toast({ title: 'Compra Finalizada' });
  };

  const reopenConversation = async (conversationId: string) => {
    await updateConversation(conversationId, { 
      status: 'open',
      resolved_at: null
    });
    toast({ title: 'Conversa reaberta' });
  };

  const toggleAI = async (conversationId: string, enabled: boolean, agentId?: string | null) => {
    // When disabling AI, clear ai_paused_at so the UI doesn't show
    // an amber "paused" indicator – the user explicitly turned it off.
    const updates: Partial<Conversation> & { active_agent_id?: string | null } = {
      ai_enabled: enabled,
      ai_paused_at: null,
    };
    
    // Clear human assignment when AI is explicitly enabled
    if (enabled) {
      updates.assigned_to = null;
      // Set the chosen agent if provided
      if (agentId !== undefined) {
        updates.active_agent_id = agentId;
      }
    }

    // Optimistically update local state so UI reflects immediately
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? {
              ...c,
              ai_enabled: enabled,
              ai_paused_at: updates.ai_paused_at ?? null,
              ...(enabled ? { assigned_to: null } : {}),
              ...(agentId !== undefined ? { active_agent_id: agentId ?? null } : {}),
              // Clear active_agent reference when disabling
              ...(!enabled ? { active_agent: null } : {}),
            }
          : c
      )
    );
    
    await updateConversation(conversationId, updates as Partial<Conversation>);
    toast({ title: enabled ? 'IA ativada' : 'IA desativada' });
  };

  const snoozeConversation = async (conversationId: string, until: Date) => {
    await updateConversation(conversationId, { 
      status: 'snoozed',
      snoozed_until: until.toISOString()
    });
    toast({ title: 'Conversa adiada' });
  };

  const setPriority = async (conversationId: string, priority: 'low' | 'medium' | 'high' | 'urgent') => {
    await updateConversation(conversationId, { priority });
    toast({ title: 'Prioridade atualizada' });
  };

  const markAsRead = async (conversationId: string) => {
    // IMPORTANT: fetch unread WhatsApp message IDs BEFORE flipping is_read=true,
    // otherwise the backend can't find which messages to mark read in WhatsApp.
    let whatsappIds: string[] = [];
    try {
      const { data: unreadMsgs, error: unreadErr } = await supabase
        .from('chat_inbox_messages')
        .select('metadata')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (unreadErr) throw unreadErr;

      whatsappIds = (unreadMsgs || [])
        .map((m: any) => m?.metadata?.whatsapp_id || m?.metadata?.whatsapp_message_id)
        .filter(Boolean)
        .map((v: any) => String(v));
    } catch (e) {
      console.warn('[Inbox] could not prefetch WhatsApp IDs for mark_read:', e);
    }

    // Best-effort: mark as read on WhatsApp first
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: {
          action: 'mark_read',
          conversationId,
          // Passing explicit IDs prevents the backend from depending on is_read=false
          // (which we will flip locally right after).
          messageIds: whatsappIds,
        },
      });
      if (error) throw error;
      if (data?.success === false) {
        console.warn('[Inbox] mark_read failed:', data?.error, data?.details);
      }
    } catch (e) {
      console.warn('[Inbox] mark_read invoke error:', e);
    }

    // Now mark locally
    await updateConversation(conversationId, { unread_count: 0 });

    await supabase
      .from('chat_inbox_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false);
  };

  const saveContactToWhatsApp = async (conversationId: string, customName?: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'save_contact', conversationId, name: customName }
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao salvar contato');
      
      toast({ title: 'Contato salvo na agenda!' });
      await fetchConversations();
      return true;
    } catch (error: unknown) {
      console.error('Error saving contact:', error);
      toast({ 
        title: 'Erro ao salvar contato', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
      return false;
    }
  };

  const renameContact = async (conversationId: string, newName: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: { action: 'rename_contact', conversationId, name: newName }
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao renomear');
      
      toast({ title: 'Nome atualizado' });
      await fetchConversations();
      return true;
    } catch (error: unknown) {
      console.error('Error renaming contact:', error);
      toast({ 
        title: 'Erro ao renomear', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
      return false;
    }
  };

  const deleteConversation = async (conversationId: string, deleteFromWhatsApp: boolean = false): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instances', {
        body: {
          action: 'delete-chat',
          instanceId: conversationId,
          deleteFromWhatsApp
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao deletar');

      // Remove from local state immediately
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      toast({ title: 'Conversa deletada com sucesso' });
      return true;
    } catch (error: unknown) {
      console.error('Error deleting conversation:', error);
      toast({ 
        title: 'Erro ao deletar conversa', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
      return false;
    }
  };

  // Initial fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchConversations(), fetchLabels()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations, fetchLabels]);

  // Real-time subscription
  // Throttled refetch for real-time events - prevents cascade re-fetches
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const throttledRefetch = useCallback(() => {
    if (refetchTimerRef.current) return; // Already scheduled
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      fetchConversations();
    }, 1500); // Batch real-time events within 1.5s window
  }, [fetchConversations]);

  // Cleanup throttle timer
  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  // Real-time subscription using throttled refetch
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          throttledRefetch();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_inbox_messages' },
        () => {
          throttledRefetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, throttledRefetch]);

  // Memoized metrics to prevent unnecessary downstream re-renders
  const metrics = useMemo(() => ({
    total: conversations.filter(c => c.status !== 'resolved').length,
    open: conversations.filter(c => c.status === 'open').length,
    pending: conversations.filter(c => c.status === 'pending').length,
    resolved: resolvedCount,
    unassigned: conversations.filter(c => !c.assigned_to && c.status === 'open').length,
    unread: conversations.filter(c => c.unread_count > 0).length,
    mine: conversations.filter(c => c.assigned_to === user?.id).length
  }), [conversations, resolvedCount, user?.id]);

  return {
    conversations,
    labels,
    isLoading,
    filter,
    setFilter,
    metrics,
    refetch: fetchConversations,
    createLabel,
    deleteLabel,
    assignLabel,
    removeLabel,
    updateConversation,
    assignToMe,
    resolveConversation,
    reopenConversation,
    toggleAI,
    markAsRead,
    snoozeConversation,
    setPriority,
    deleteConversation,
    saveContactToWhatsApp,
    renameContact
  };
}
