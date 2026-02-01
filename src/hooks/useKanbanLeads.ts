import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface KanbanLead {
  id: string;
  phone: string;
  lead_name: string | null;
  lead_full_name: string | null;
  lead_email: string | null;
  lead_personal_id: string | null;
  lead_status: string;
  lead_notes: string | null;
  lead_kanban_order: number;
  deal_value: number | null;
  is_ticket_open: boolean | null;
  custom_fields: Record<string, any> | null;
  created_at: string | null;
  updated_at: string | null;
  conversation_id: string | null;
  instance_id: string | null;
  // Virtual fields from joins
  contact_avatar?: string | null;
  last_message_at?: string | null;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  leads: KanbanLead[];
}

export const KANBAN_STATUSES = [
  { id: 'novo', title: 'Novo', color: 'bg-blue-500' },
  { id: 'qualificado', title: 'Qualificado', color: 'bg-purple-500' },
  { id: 'proposta', title: 'Proposta', color: 'bg-amber-500' },
  { id: 'negociacao', title: 'Negociação', color: 'bg-orange-500' },
  { id: 'fechado', title: 'Fechado', color: 'bg-green-500' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-500' },
];

export function useKanbanLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<KanbanLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_lead_data')
        .select(`
          *,
          conversations:conversation_id (
            contact_avatar,
            last_message_at
          )
        `)
        .eq('user_id', user.id)
        .order('lead_kanban_order', { ascending: true });

      if (error) throw error;

      const formattedLeads: KanbanLead[] = (data || []).map((lead: any) => ({
        ...lead,
        lead_status: lead.lead_status || 'novo',
        lead_kanban_order: lead.lead_kanban_order || 0,
        contact_avatar: lead.conversations?.contact_avatar,
        last_message_at: lead.conversations?.last_message_at,
        custom_fields: lead.custom_fields as Record<string, any> | null,
      }));

      setLeads(formattedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const updateLeadStatus = useCallback(async (
    leadId: string,
    newStatus: string,
    newOrder: number
  ) => {
    if (!user) return;

    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { ...lead, lead_status: newStatus, lead_kanban_order: newOrder }
        : lead
    ));

    try {
      const { error } = await supabase
        .from('crm_lead_data')
        .update({
          lead_status: newStatus,
          lead_kanban_order: newOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Erro ao atualizar lead');
      fetchLeads(); // Revert on error
    }
  }, [user, fetchLeads]);

  const updateLeadOrder = useCallback(async (
    leadId: string,
    newOrder: number
  ) => {
    if (!user) return;

    setLeads(prev => prev.map(lead =>
      lead.id === leadId
        ? { ...lead, lead_kanban_order: newOrder }
        : lead
    ));

    try {
      const { error } = await supabase
        .from('crm_lead_data')
        .update({
          lead_kanban_order: newOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead order:', error);
      fetchLeads();
    }
  }, [user, fetchLeads]);

  const createLead = useCallback(async (leadData: Partial<KanbanLead>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('crm_lead_data')
        .insert({
          user_id: user.id,
          phone: leadData.phone || '',
          lead_name: leadData.lead_name,
          lead_full_name: leadData.lead_full_name,
          lead_email: leadData.lead_email,
          lead_personal_id: leadData.lead_personal_id,
          lead_status: leadData.lead_status || 'novo',
          lead_notes: leadData.lead_notes,
          lead_kanban_order: leadData.lead_kanban_order || 0,
          deal_value: leadData.deal_value,
          custom_fields: leadData.custom_fields,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Lead criado com sucesso!');
      fetchLeads();
      return data;
    } catch (error) {
      console.error('Error creating lead:', error);
      toast.error('Erro ao criar lead');
      return null;
    }
  }, [user, fetchLeads]);

  const updateLead = useCallback(async (leadId: string, leadData: Partial<KanbanLead>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_data')
        .update({
          lead_name: leadData.lead_name,
          lead_full_name: leadData.lead_full_name,
          lead_email: leadData.lead_email,
          lead_personal_id: leadData.lead_personal_id,
          lead_notes: leadData.lead_notes,
          deal_value: leadData.deal_value,
          custom_fields: leadData.custom_fields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Lead atualizado!');
      fetchLeads();
      return true;
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Erro ao atualizar lead');
      return false;
    }
  }, [user, fetchLeads]);

  const deleteLead = useCallback(async (leadId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_data')
        .delete()
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;

      setLeads(prev => prev.filter(l => l.id !== leadId));
      toast.success('Lead excluído!');
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao excluir lead');
      return false;
    }
  }, [user]);

  // Filter leads by search term
  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      lead.lead_name?.toLowerCase().includes(term) ||
      lead.lead_full_name?.toLowerCase().includes(term) ||
      lead.lead_email?.toLowerCase().includes(term) ||
      lead.phone?.includes(term)
    );
  });

  // Organize leads into columns
  const columns: KanbanColumn[] = KANBAN_STATUSES.map(status => ({
    ...status,
    leads: filteredLeads
      .filter(lead => lead.lead_status === status.id)
      .sort((a, b) => (a.lead_kanban_order || 0) - (b.lead_kanban_order || 0)),
  }));

  // Calculate totals
  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, lead) => sum + (lead.deal_value || 0), 0);
  const openTickets = leads.filter(l => l.is_ticket_open).length;

  return {
    leads: filteredLeads,
    columns,
    isLoading,
    searchTerm,
    setSearchTerm,
    fetchLeads,
    updateLeadStatus,
    updateLeadOrder,
    createLead,
    updateLead,
    deleteLead,
    stats: {
      totalLeads,
      totalValue,
      openTickets,
    },
  };
}
