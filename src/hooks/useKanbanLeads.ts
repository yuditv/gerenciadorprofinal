import { useState, useCallback, useEffect, useMemo } from 'react';
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
  // New fields
  lead_source: string | null;
  priority: string | null;
  follow_up_date: string | null;
  expected_close_date: string | null;
  company_name: string | null;
  company_industry: string | null;
  company_size: string | null;
  assigned_to: string | null;
  lost_reason: string | null;
  won_reason: string | null;
  products_interested: string[] | null;
  temperature: string | null;
  // Virtual fields from joins
  contact_avatar?: string | null;
  last_message_at?: string | null;
  tags?: LeadTag[];
}

export interface LeadTag {
  id: string;
  name: string;
  color: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface LeadAttachment {
  id: string;
  lead_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  leads: KanbanLead[];
}

export interface KanbanFilters {
  status: string[];
  priority: string[];
  source: string[];
  temperature: string[];
  hasFollowUp: boolean | null;
  dateRange: { from: Date | null; to: Date | null };
  tags: string[];
}

export const KANBAN_STATUSES = [
  { id: 'novo', title: 'Novo', color: 'bg-blue-500' },
  { id: 'qualificado', title: 'Qualificado', color: 'bg-purple-500' },
  { id: 'proposta', title: 'Proposta', color: 'bg-amber-500' },
  { id: 'negociacao', title: 'Negociação', color: 'bg-orange-500' },
  { id: 'fechado', title: 'Fechado', color: 'bg-green-500' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-500' },
];

export const LEAD_SOURCES = [
  { id: 'manual', label: 'Manual', icon: 'Edit' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { id: 'website', label: 'Website', icon: 'Globe' },
  { id: 'referral', label: 'Indicação', icon: 'Users' },
  { id: 'ads', label: 'Anúncios', icon: 'Megaphone' },
  { id: 'social', label: 'Redes Sociais', icon: 'Share2' },
  { id: 'email', label: 'Email', icon: 'Mail' },
  { id: 'phone', label: 'Telefone', icon: 'Phone' },
  { id: 'event', label: 'Evento', icon: 'Calendar' },
  { id: 'other', label: 'Outro', icon: 'MoreHorizontal' },
];

export const LEAD_PRIORITIES = [
  { id: 'low', label: 'Baixa', color: 'bg-slate-500', textColor: 'text-slate-500' },
  { id: 'medium', label: 'Média', color: 'bg-blue-500', textColor: 'text-blue-500' },
  { id: 'high', label: 'Alta', color: 'bg-orange-500', textColor: 'text-orange-500' },
  { id: 'urgent', label: 'Urgente', color: 'bg-red-500', textColor: 'text-red-500' },
];

export const LEAD_TEMPERATURES = [
  { id: 'cold', label: 'Frio', color: 'bg-blue-400', icon: '❄️' },
  { id: 'warm', label: 'Morno', color: 'bg-yellow-400', icon: '🌤️' },
  { id: 'hot', label: 'Quente', color: 'bg-orange-500', icon: '🔥' },
];

export const ACTIVITY_TYPES = [
  { id: 'call', label: 'Ligação', icon: 'Phone', color: 'bg-green-500' },
  { id: 'email', label: 'Email', icon: 'Mail', color: 'bg-blue-500' },
  { id: 'meeting', label: 'Reunião', icon: 'Calendar', color: 'bg-purple-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', color: 'bg-emerald-500' },
  { id: 'note', label: 'Anotação', icon: 'FileText', color: 'bg-gray-500' },
  { id: 'task', label: 'Tarefa', icon: 'CheckSquare', color: 'bg-amber-500' },
];

export const COMPANY_SIZES = [
  { id: 'micro', label: 'Micro (1-9)' },
  { id: 'small', label: 'Pequena (10-49)' },
  { id: 'medium', label: 'Média (50-249)' },
  { id: 'large', label: 'Grande (250+)' },
];

const DEFAULT_FILTERS: KanbanFilters = {
  status: [],
  priority: [],
  source: [],
  temperature: [],
  hasFollowUp: null,
  dateRange: { from: null, to: null },
  tags: [],
};

export function useKanbanLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<KanbanLead[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<KanbanFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'table'>('kanban');

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_lead_data')
        .select('*')
        .eq('user_id', user.id)
        .order('lead_kanban_order', { ascending: true });

      if (error) throw error;

      // Fetch tag assignments
      const { data: tagAssignments } = await supabase
        .from('crm_lead_tag_assignments')
        .select(`
          lead_id,
          tag:tag_id (
            id,
            name,
            color
          )
        `);

      const tagMap = new Map<string, LeadTag[]>();
      (tagAssignments || []).forEach((assignment: any) => {
        if (assignment.tag) {
          const existing = tagMap.get(assignment.lead_id) || [];
          existing.push(assignment.tag);
          tagMap.set(assignment.lead_id, existing);
        }
      });

      const formattedLeads: KanbanLead[] = (data || []).map((lead: any) => ({
        ...lead,
        lead_status: lead.lead_status || 'novo',
        lead_kanban_order: lead.lead_kanban_order || 0,
        custom_fields: lead.custom_fields as Record<string, any> | null,
        tags: tagMap.get(lead.id) || [],
      }));

      setLeads(formattedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchTags = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('crm_lead_tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchLeads();
    fetchTags();
  }, [fetchLeads, fetchTags]);

  const updateLeadStatus = useCallback(async (
    leadId: string,
    newStatus: string,
    newOrder: number
  ) => {
    if (!user) return;

    const oldLead = leads.find(l => l.id === leadId);
    
    // Optimistic update
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { ...lead, lead_status: newStatus, lead_kanban_order: newOrder }
        : lead
    ));

    try {
      const updateData: any = {
        lead_status: newStatus,
        lead_kanban_order: newOrder,
        updated_at: new Date().toISOString(),
      };

      // If moving to fechado, set won_reason prompt
      // If moving to perdido, set lost_reason prompt
      
      const { error } = await supabase
        .from('crm_lead_data')
        .update(updateData)
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Log activity for status change
      if (oldLead && oldLead.lead_status !== newStatus) {
        await supabase.from('crm_lead_activities').insert({
          lead_id: leadId,
          user_id: user.id,
          activity_type: 'status_change',
          title: `Status alterado para ${KANBAN_STATUSES.find(s => s.id === newStatus)?.title}`,
          metadata: { from: oldLead.lead_status, to: newStatus },
        });
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Erro ao atualizar lead');
      fetchLeads();
    }
  }, [user, leads, fetchLeads]);

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
          lead_source: leadData.lead_source || 'manual',
          priority: leadData.priority || 'medium',
          temperature: leadData.temperature || 'warm',
          follow_up_date: leadData.follow_up_date,
          expected_close_date: leadData.expected_close_date,
          company_name: leadData.company_name,
          company_industry: leadData.company_industry,
          company_size: leadData.company_size,
          products_interested: leadData.products_interested,
        })
        .select()
        .single();

      if (error) throw error;

      // Log creation activity
      await supabase.from('crm_lead_activities').insert({
        lead_id: data.id,
        user_id: user.id,
        activity_type: 'created',
        title: 'Lead criado',
      });

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
          lead_source: leadData.lead_source,
          priority: leadData.priority,
          temperature: leadData.temperature,
          follow_up_date: leadData.follow_up_date,
          expected_close_date: leadData.expected_close_date,
          company_name: leadData.company_name,
          company_industry: leadData.company_industry,
          company_size: leadData.company_size,
          products_interested: leadData.products_interested,
          lost_reason: leadData.lost_reason,
          won_reason: leadData.won_reason,
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

  const bulkUpdateStatus = useCallback(async (leadIds: string[], newStatus: string) => {
    if (!user || leadIds.length === 0) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_data')
        .update({
          lead_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .in('id', leadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(`${leadIds.length} leads atualizados!`);
      fetchLeads();
      return true;
    } catch (error) {
      console.error('Error bulk updating leads:', error);
      toast.error('Erro ao atualizar leads');
      return false;
    }
  }, [user, fetchLeads]);

  const bulkDelete = useCallback(async (leadIds: string[]) => {
    if (!user || leadIds.length === 0) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_data')
        .delete()
        .in('id', leadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
      toast.success(`${leadIds.length} leads excluídos!`);
      return true;
    } catch (error) {
      console.error('Error bulk deleting leads:', error);
      toast.error('Erro ao excluir leads');
      return false;
    }
  }, [user]);

  // Tag management
  const createTag = useCallback(async (name: string, color: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('crm_lead_tags')
        .insert({ user_id: user.id, name, color })
        .select()
        .single();

      if (error) throw error;
      
      setTags(prev => [...prev, data]);
      toast.success('Tag criada!');
      return data;
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Erro ao criar tag');
      return null;
    }
  }, [user]);

  const deleteTag = useCallback(async (tagId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTags(prev => prev.filter(t => t.id !== tagId));
      toast.success('Tag excluída!');
      return true;
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Erro ao excluir tag');
      return false;
    }
  }, [user]);

  const assignTag = useCallback(async (leadId: string, tagId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_tag_assignments')
        .insert({ lead_id: leadId, tag_id: tagId });

      if (error) throw error;

      fetchLeads();
      return true;
    } catch (error) {
      console.error('Error assigning tag:', error);
      return false;
    }
  }, [user, fetchLeads]);

  const removeTag = useCallback(async (leadId: string, tagId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('crm_lead_tag_assignments')
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) throw error;

      fetchLeads();
      return true;
    } catch (error) {
      console.error('Error removing tag:', error);
      return false;
    }
  }, [user, fetchLeads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          lead.lead_name?.toLowerCase().includes(term) ||
          lead.lead_full_name?.toLowerCase().includes(term) ||
          lead.lead_email?.toLowerCase().includes(term) ||
          lead.phone?.includes(term) ||
          lead.company_name?.toLowerCase().includes(term);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(lead.lead_status)) {
        return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(lead.priority || 'medium')) {
        return false;
      }

      // Source filter
      if (filters.source.length > 0 && !filters.source.includes(lead.lead_source || 'manual')) {
        return false;
      }

      // Temperature filter
      if (filters.temperature.length > 0 && !filters.temperature.includes(lead.temperature || 'warm')) {
        return false;
      }

      // Follow-up filter
      if (filters.hasFollowUp === true && !lead.follow_up_date) {
        return false;
      }
      if (filters.hasFollowUp === false && lead.follow_up_date) {
        return false;
      }

      // Tag filter
      if (filters.tags.length > 0) {
        const leadTagIds = lead.tags?.map(t => t.id) || [];
        if (!filters.tags.some(tagId => leadTagIds.includes(tagId))) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange.from) {
        const createdAt = lead.created_at ? new Date(lead.created_at) : null;
        if (!createdAt || createdAt < filters.dateRange.from) return false;
      }
      if (filters.dateRange.to) {
        const createdAt = lead.created_at ? new Date(lead.created_at) : null;
        if (!createdAt || createdAt > filters.dateRange.to) return false;
      }

      return true;
    });
  }, [leads, searchTerm, filters]);

  // Organize leads into columns
  const columns: KanbanColumn[] = KANBAN_STATUSES.map(status => ({
    ...status,
    leads: filteredLeads
      .filter(lead => lead.lead_status === status.id)
      .sort((a, b) => (a.lead_kanban_order || 0) - (b.lead_kanban_order || 0)),
  }));

  // Calculate stats
  const stats = useMemo(() => {
    const totalLeads = leads.length;
    const totalValue = leads.reduce((sum, lead) => sum + (lead.deal_value || 0), 0);
    const openTickets = leads.filter(l => l.is_ticket_open).length;
    const closedLeads = leads.filter(l => l.lead_status === 'fechado').length;
    const lostLeads = leads.filter(l => l.lead_status === 'perdido').length;
    const conversionRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
    
    const valueByStatus = KANBAN_STATUSES.reduce((acc, status) => {
      acc[status.id] = leads
        .filter(l => l.lead_status === status.id)
        .reduce((sum, l) => sum + (l.deal_value || 0), 0);
      return acc;
    }, {} as Record<string, number>);

    const leadsBySource = LEAD_SOURCES.reduce((acc, source) => {
      acc[source.id] = leads.filter(l => (l.lead_source || 'manual') === source.id).length;
      return acc;
    }, {} as Record<string, number>);

    const leadsByPriority = LEAD_PRIORITIES.reduce((acc, priority) => {
      acc[priority.id] = leads.filter(l => (l.priority || 'medium') === priority.id).length;
      return acc;
    }, {} as Record<string, number>);

    const upcomingFollowUps = leads.filter(l => {
      if (!l.follow_up_date) return false;
      const followUpDate = new Date(l.follow_up_date);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return followUpDate >= now && followUpDate <= threeDaysFromNow;
    }).length;

    const overdueFollowUps = leads.filter(l => {
      if (!l.follow_up_date) return false;
      return new Date(l.follow_up_date) < new Date();
    }).length;

    return {
      totalLeads,
      totalValue,
      openTickets,
      closedLeads,
      lostLeads,
      conversionRate,
      valueByStatus,
      leadsBySource,
      leadsByPriority,
      upcomingFollowUps,
      overdueFollowUps,
    };
  }, [leads]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.status.length > 0 ||
      filters.priority.length > 0 ||
      filters.source.length > 0 ||
      filters.temperature.length > 0 ||
      filters.hasFollowUp !== null ||
      filters.tags.length > 0 ||
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null
    );
  }, [filters]);

  return {
    leads: filteredLeads,
    allLeads: leads,
    columns,
    tags,
    isLoading,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    viewMode,
    setViewMode,
    fetchLeads,
    updateLeadStatus,
    updateLeadOrder,
    createLead,
    updateLead,
    deleteLead,
    bulkUpdateStatus,
    bulkDelete,
    createTag,
    deleteTag,
    assignTag,
    removeTag,
    stats,
  };
}
