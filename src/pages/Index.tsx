import { useState, useMemo, useCallback, useEffect } from 'react';
import logoFuturistic from '@/assets/logo-red-futuristic.png';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { useClientTags } from '@/hooks/useClientTags';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useNotifications } from '@/hooks/useNotifications';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Client, PlanType, planLabels, getExpirationStatus } from '@/types/client';
import { ClientCard } from '@/components/ClientCard';
import { ClientTable } from '@/components/ClientTable';
import { ClientForm } from '@/components/ClientForm';
import { usePlanSettings } from '@/hooks/usePlanSettings';
import { ClientStats } from '@/components/ClientStats';
import { RetentionMetrics } from '@/components/RetentionMetrics';
import { ClientCharts } from '@/components/ClientCharts';
import { FinancialReport } from '@/components/FinancialReport';
import { SearchBar } from '@/components/SearchBar';
import { PlanFilter } from '@/components/PlanFilter';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { ExpiringClientsAlert } from '@/components/ExpiringClientsAlert';
import { RenewalHistoryDialog } from '@/components/RenewalHistoryDialog';
import { ChangePlanDialog } from '@/components/ChangePlanDialog';
import { NotificationHistoryDialog } from '@/components/NotificationHistoryDialog';
import { ImportClientsDialog } from '@/components/ImportClientsDialog';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import { SendWhatsAppDialog } from '@/components/SendWhatsAppDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { TagManager } from '@/components/TagManager';
import { TagFilter } from '@/components/TagFilter';
import { TagBadge } from '@/components/TagBadge';
import { TagSelector } from '@/components/TagSelector';
import { QuickKPIs } from '@/components/QuickKPIs';
import { NotificationCenter } from '@/components/NotificationCenter';
import { GlobalSearch } from '@/components/GlobalSearch';
import { SubscriptionPlansDialog } from '@/components/SubscriptionPlansDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Users, Download, FileSpreadsheet, History, FileText, Sparkles, Zap, ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, List, CheckSquare, Square, X, RefreshCw as RefreshCwIcon, Trash2, Send, Upload, Search, MessageSquare, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportClientsToCSV, exportRenewalHistoryToCSV } from '@/lib/exportClients';
import { exportReportToPDF } from '@/lib/exportPDF';
import { getDaysUntilExpiration } from '@/types/client';
import { supabase } from '@/integrations/supabase/client';
import { useAIAgentPreferences } from '@/hooks/useAIAgentPreferences';
import { activateAIForExpiredClient } from '@/lib/activateExpiredClientAI';

const Index = () => {
  const { user } = useAuth();
  const { getPlanName } = usePlanSettings();
  const { clients, isLoading, addClient, updateClient, deleteClient, renewClient, importClients, expiringClients, expiredClients } = useClients();
  const { tags, createTag, updateTag, deleteTag, assignTag, removeTag, getClientTags, getClientsByTag } = useClientTags();
  const { instances } = useWhatsAppInstances();
  const { isActive, canAccessFeature } = useSubscription();
  const { isAdmin } = useUserPermissions();
  const { preferences: aiPrefs } = useAIAgentPreferences();
  const { 
    notifications, 
    unreadConversations, 
    pendingMessages, 
    markAsRead, 
    markAllAsRead, 
    dismiss: dismissNotification, 
    refresh: refreshNotifications 
  } = useNotifications({ clients, instances });
  
  // Check if subscription is active for restricted actions (admins bypass this check)
  const isSubscriptionActive = isActive() || isAdmin;
  const canCreateClients = canAccessFeature('can_create_clients') || isAdmin;
  const canEditClients = canAccessFeature('can_edit_clients') || isAdmin;
  const canDeleteClients = canAccessFeature('can_delete_clients') || isAdmin;
  const canSendWhatsapp = canAccessFeature('can_send_whatsapp') || isAdmin;
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [changePlanClient, setChangePlanClient] = useState<Client | null>(null);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationClient, setNotificationClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanType | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'expiresAt' | 'plan'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailClient, setEmailClient] = useState<Client | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappClient, setWhatsappClient] = useState<Client | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const clientsPerPage = viewMode === 'grid' ? 12 : 20;

  // Show subscription dialog when trying to use blocked feature
  const showSubscriptionRequired = () => {
    toast.error('Assinatura necessária', {
      description: 'Sua assinatura expirou. Renove para continuar usando.',
      action: {
        label: 'Assinar',
        onClick: () => setSubscriptionDialogOpen(true),
      },
    });
  };

  // Wrapped action handlers with subscription check
  const handleAddClientClick = () => {
    if (!canCreateClients) {
      showSubscriptionRequired();
      return;
    }
    setEditingClient(null);
    setFormOpen(true);
  };

  const handleEditClientClick = (client: Client) => {
    if (!canEditClients) {
      showSubscriptionRequired();
      return;
    }
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleDeleteClientClick = (id: string) => {
    if (!canDeleteClients) {
      showSubscriptionRequired();
      return;
    }
    const client = clients.find((c) => c.id === id);
    if (client) {
      setClientToDelete(client);
      setDeleteDialogOpen(true);
    }
  };

  const handleSendWhatsappClick = (client: Client) => {
    if (!canSendWhatsapp) {
      showSubscriptionRequired();
      return;
    }
    setWhatsappClient(client);
    setWhatsappDialogOpen(true);
  };

  const handleRenewClientClick = async (clientId: string) => {
    if (!canEditClients) {
      showSubscriptionRequired();
      return;
    }
    const result = await renewClient(clientId);
    if (result) {
      toast.success('Cliente renovado com sucesso!');
    }
  };

  const handleImportClick = () => {
    if (!canCreateClients) {
      showSubscriptionRequired();
      return;
    }
    setImportDialogOpen(true);
  };

  // Global search keyboard shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredAndSortedClients = useMemo(() => {
    const filtered = clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.email.toLowerCase().includes(search.toLowerCase()) ||
        client.whatsapp.includes(search);
      const matchesPlan = planFilter === 'all' || client.plan === planFilter;
      
      // Tag filter
      let matchesTags = true;
      if (tagFilter.length > 0) {
        const clientTagIds = getClientTags(client.id).map(t => t.id);
        matchesTags = tagFilter.every(tagId => clientTagIds.includes(tagId));
      }
      
      return matchesSearch && matchesPlan && matchesTags;
    });

    // Sort clients
    const planOrder: Record<PlanType, number> = { monthly: 1, quarterly: 2, semiannual: 3, annual: 4 };
    
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, 'pt-BR');
      } else if (sortBy === 'expiresAt') {
        comparison = a.expiresAt.getTime() - b.expiresAt.getTime();
      } else if (sortBy === 'plan') {
        comparison = planOrder[a.plan] - planOrder[b.plan];
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [clients, search, planFilter, tagFilter, sortBy, sortOrder, getClientTags]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedClients.length / clientsPerPage);
  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    return filteredAndSortedClients.slice(startIndex, startIndex + clientsPerPage);
  }, [filteredAndSortedClients, currentPage, clientsPerPage]);

  // Reset page when filters change
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, planFilter, sortBy, sortOrder]);

  const totalRenewals = useMemo(() => {
    return clients.reduce((acc, c) => acc + (c.renewalHistory?.length || 0), 0);
  }, [clients]);

  // Selection helpers
  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const selectAllOnPage = () => {
    const allIds = new Set(paginatedClients.map(c => c.id));
    setSelectedClients(allIds);
  };

  const clearSelection = () => {
    setSelectedClients(new Set());
  };

  const isAllOnPageSelected = paginatedClients.length > 0 && paginatedClients.every(c => selectedClients.has(c.id));

  // Bulk actions
  const handleBulkRenew = async () => {
    const selectedIds = Array.from(selectedClients);
    let successCount = 0;
    
    for (const id of selectedIds) {
      const result = await renewClient(id);
      if (result) successCount++;
    }
    
    if (successCount > 0) {
      toast.success(`${successCount} cliente(s) renovado(s) com sucesso!`);
    }
    if (successCount < selectedIds.length) {
      toast.error(`${selectedIds.length - successCount} renovação(ões) falhou(aram)`);
    }
    clearSelection();
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedClients);
    let successCount = 0;
    
    for (const id of selectedIds) {
      await deleteClient(id);
      successCount++;
    }
    
    toast.success(`${successCount} cliente(s) excluído(s) com sucesso!`);
    clearSelection();
    setBulkDeleteDialogOpen(false);
  };


  const handleAddClient = async (data: Omit<Client, 'id' | 'renewalHistory'>) => {
    const result = await addClient(data);
    if (result) {
      toast.success('Cliente cadastrado com sucesso!');
    } else {
      toast.error('Erro ao cadastrar cliente');
    }
  };

  const handleEditClient = async (data: Omit<Client, 'id' | 'renewalHistory'>) => {
    if (editingClient) {
      await updateClient(editingClient.id, data);
      setEditingClient(null);
      toast.success('Cliente atualizado com sucesso!');
    }
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleOpenDelete = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      setClientToDelete(client);
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      await deleteClient(clientToDelete.id);
      setClientToDelete(null);
      setDeleteDialogOpen(false);
      toast.success('Cliente excluído com sucesso!');
    }
  };

  const handleRenewClient = async (id: string) => {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    const newExpiresAt = await renewClient(id);
    if (newExpiresAt) {
      toast.success(
        `Plano ${planLabels[client.plan]} renovado! Novo vencimento: ${format(newExpiresAt, "dd 'de' MMM, yyyy", { locale: ptBR })}`,
        { duration: 4000 }
      );
    } else {
      toast.error('Erro ao renovar plano');
    }
  };

  const handleViewHistory = (client: Client) => {
    setHistoryClient(client);
    setHistoryDialogOpen(true);
  };

  const handleOpenChangePlan = (client: Client) => {
    setChangePlanClient(client);
    setChangePlanDialogOpen(true);
  };

  const handleViewNotifications = (client: Client) => {
    setNotificationClient(client);
    setNotificationDialogOpen(true);
  };

  const handleSendEmail = (client: Client) => {
    setEmailClient(client);
    setEmailDialogOpen(true);
  };

  const handleSendWhatsApp = (client: Client) => {
    setWhatsappClient(client);
    setWhatsappDialogOpen(true);
  };

  const handleActivateAIForExpiredClient = async (client: Client) => {
    if (!isSubscriptionActive) {
      showSubscriptionRequired();
      return;
    }

    if (getExpirationStatus(client.expiresAt) !== 'expired') {
      toast.error('A IA só pode ser ativada por aqui para clientes expirados.');
      return;
    }

    const agentId = aiPrefs?.expired_client_agent_id ?? null;
    if (!agentId) {
      toast.error('Configure o agente para clientes expirados', {
        description: 'Vá em Agente IA → Preferências → “Agente para Clientes Expirados (CRM)”.',
      });
      return;
    }

    try {
      const { conversationId } = await activateAIForExpiredClient({
        clientWhatsapp: client.whatsapp,
        agentId,
      });
      toast.success('IA ativada no Atendimento!', {
        description: `Conversa: ${conversationId}`,
      });
    } catch (e: any) {
      console.error('[CRM] activateAIForExpiredClient error:', e);
      toast.error('Não foi possível ativar a IA.', {
        description: e?.message ? String(e.message) : 'Erro inesperado',
      });
    }
  };

  const handleConfirmChangePlan = async (clientId: string, newPlan: PlanType, newExpiresAt: Date) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    await updateClient(clientId, { plan: newPlan, expiresAt: newExpiresAt });
    toast.success(
      `Plano alterado para ${planLabels[newPlan]}! Novo vencimento: ${format(newExpiresAt, "dd 'de' MMM, yyyy", { locale: ptBR })}`,
      { duration: 4000 }
    );
  };

  const handleExportClients = () => {
    if (clients.length === 0) {
      toast.error('Não há clientes para exportar');
      return;
    }
    exportClientsToCSV(filteredAndSortedClients);
    toast.success(`${filteredAndSortedClients.length} cliente(s) exportado(s) para CSV`);
  };

  const handleExportRenewals = () => {
    if (totalRenewals === 0) {
      toast.error('Não há renovações para exportar');
      return;
    }
    exportRenewalHistoryToCSV(clients);
    toast.success(`Histórico de renovações exportado para CSV`);
  };

  const handleExportPDF = () => {
    if (clients.length === 0) {
      toast.error('Não há clientes para exportar');
      return;
    }
    exportReportToPDF(clients, getPlanName);
    toast.success('Relatório exportado para PDF');
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingClient(null);
    }
  };

  const handleAlertClientClick = (client: Client) => {
    handleOpenEdit(client);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/20" style={{
        background: "hsl(230 18% 8% / 0.65)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.2), 0 0 40px hsl(0 75% 55% / 0.06)"
      }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="h-14 w-14 rounded-xl overflow-hidden" style={{
                  boxShadow: "0 0 30px hsl(0 75% 55% / 0.4), 0 0 60px hsl(0 75% 55% / 0.2)",
                  border: "1px solid hsl(0 75% 55% / 0.3)"
                }}>
                  <img src={logoFuturistic} alt="Logo" className="h-full w-full object-cover" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 10px hsl(0 75% 55%)" }}></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">Gerenciador de Clientes</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Sistema inteligente de gestão
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Global Search Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setGlobalSearchOpen(true)}
                className="hidden md:flex gap-2 border-primary/30 text-muted-foreground hover:border-primary hover:bg-primary/10"
                style={{ background: "hsl(230 18% 10% / 0.6)", backdropFilter: "blur(12px)" }}
              >
                <Search className="h-4 w-4" />
                <span>Buscar...</span>
                <kbd className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-primary/20 text-primary">⌘K</kbd>
              </Button>

              {/* Notification Center */}
              <NotificationCenter
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onDismiss={dismissNotification}
                onRefresh={refreshNotifications}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="hidden sm:flex glass-card border-primary/30 hover:border-primary hover:neon-glow transition-all duration-300">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-card border-border/50">
                  <DropdownMenuItem onClick={handleImportClick} className="hover:bg-primary/10">
                    <Upload className="h-4 w-4 mr-2 text-green-500" />
                    Importar Clientes (XLSX/CSV)
                    {!canCreateClients && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={handleExportClients} className="hover:bg-primary/10">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" />
                    Exportar Clientes (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportRenewals} className="hover:bg-primary/10">
                    <History className="h-4 w-4 mr-2 text-accent" />
                    Exportar Renovações (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={handleExportPDF} className="hover:bg-primary/10">
                    <FileText className="h-4 w-4 mr-2 text-plan-annual" />
                    Relatório Completo (PDF)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <SoundToggle />
              <ThemeToggle />

              <Button onClick={() => setFormOpen(true)} className="gap-2 btn-futuristic text-primary-foreground font-semibold">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Cliente</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Quick KPIs */}
        <div className="animate-fade-in">
          <QuickKPIs 
            clients={clients} 
            instances={instances} 
            pendingMessages={pendingMessages}
            unreadConversations={unreadConversations}
          />
        </div>

        {/* Expiring Alert */}
        <ExpiringClientsAlert 
          expiringClients={expiringClients}
          expiredClients={expiredClients}
          onClientClick={handleAlertClientClick}
        />

        {/* Stats */}
        <div className="animate-fade-in">
          <ClientStats clients={clients} />
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between glass-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <SearchBar value={search} onChange={setSearch} />
          <div className="flex flex-wrap gap-2 items-center">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-border/50 rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`rounded-none px-3 ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={`rounded-none px-3 ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 glass-card border-primary/30 hover:border-primary">
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Ordenar:</span>
                  <span className="font-medium">
                    {sortBy === 'name' ? 'Nome' : sortBy === 'expiresAt' ? 'Vencimento' : 'Plano'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({sortOrder === 'asc' ? '↑' : '↓'})
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border-border/50 z-50">
                <DropdownMenuItem onClick={() => { setSortBy('name'); setSortOrder(sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  Nome {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('expiresAt'); setSortOrder(sortBy === 'expiresAt' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  Vencimento {sortBy === 'expiresAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('plan'); setSortOrder(sortBy === 'plan' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  Plano {sortBy === 'plan' && (sortOrder === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <PlanFilter selected={planFilter} onSelect={setPlanFilter} />
            <TagFilter 
              tags={tags} 
              selectedTagIds={tagFilter} 
              onToggle={(id) => setTagFilter(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])}
              onClear={() => setTagFilter([])}
            />
            <TagManager tags={tags} onCreate={createTag} onUpdate={updateTag} onDelete={deleteTag} />
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedClients.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card border border-primary/50 rounded-xl px-4 py-3 flex items-center gap-4 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span className="font-medium">{selectedClients.size} selecionado(s)</span>
            </div>
            <div className="h-6 w-px bg-border/50" />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                onClick={handleBulkRenew}
              >
                <RefreshCwIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Renovar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                onClick={handleBulkRenew}
              >
                <RefreshCwIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Renovar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Excluir</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Selection Controls & Client Grid */}
        {filteredAndSortedClients.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl">
            <div className="relative inline-block">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mx-auto flex items-center justify-center mb-6 float">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute inset-0 h-20 w-20 rounded-full border-2 border-primary/30 animate-ping"></div>
            </div>
            <h3 className="text-xl font-semibold text-gradient mb-3">
              {clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {clients.length === 0
                ? 'Comece adicionando seu primeiro cliente para desbloquear todo o potencial do sistema.'
                : 'Tente ajustar os filtros de busca para encontrar o que procura.'}
            </p>
            {clients.length === 0 && (
              <Button onClick={handleAddClientClick} className="gap-2 btn-futuristic text-primary-foreground font-semibold px-8">
                <Plus className="h-4 w-4" />
                Adicionar Cliente
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Select All Toggle */}
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={isAllOnPageSelected ? clearSelection : selectAllOnPage}
              >
                {isAllOnPageSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {isAllOnPageSelected ? 'Desmarcar todos' : 'Selecionar todos da página'}
              </Button>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {paginatedClients.map((client, index) => (
                  <div 
                    key={client.id} 
                    className="animate-fade-in relative"
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    {/* Selection Checkbox */}
                    <button
                      onClick={() => toggleClientSelection(client.id)}
                      className={`absolute top-3 right-3 z-20 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedClients.has(client.id)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background/80 border-border/50 hover:border-primary/50'
                      }`}
                    >
                      {selectedClients.has(client.id) && <CheckSquare className="h-4 w-4" />}
                    </button>
                    <ClientCard
                      client={client}
                      onEdit={handleEditClientClick}
                      onDelete={handleDeleteClientClick}
                      onRenew={handleRenewClientClick}
                      onViewHistory={handleViewHistory}
                      onChangePlan={handleOpenChangePlan}
                      onViewNotifications={handleViewNotifications}
                      onSendEmail={handleSendEmail}
                      onSendWhatsApp={handleSendWhatsappClick}
                      onActivateAI={handleActivateAIForExpiredClient}
                      getPlanName={getPlanName}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <ClientTable
                clients={paginatedClients}
                onEdit={handleEditClientClick}
                onDelete={handleDeleteClientClick}
                onRenew={handleRenewClientClick}
                onViewHistory={handleViewHistory}
                onChangePlan={handleOpenChangePlan}
                onViewNotifications={handleViewNotifications}
                onSendEmail={handleSendEmail}
                onActivateAI={handleActivateAIForExpiredClient}
                getPlanName={getPlanName}
                selectedClients={selectedClients}
                onToggleSelection={toggleClientSelection}
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="glass-card border-primary/30 hover:border-primary"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 1) return true;
                      return false;
                    })
                    .map((page, index, arr) => {
                      const showEllipsis = index > 0 && page - arr[index - 1] > 1;
                      return (
                        <span key={page} className="flex items-center">
                          {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={currentPage === page 
                              ? "btn-futuristic text-primary-foreground min-w-[36px]" 
                              : "glass-card border-primary/30 hover:border-primary min-w-[36px]"
                            }
                          >
                            {page}
                          </Button>
                        </span>
                      );
                    })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="glass-card border-primary/30 hover:border-primary"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <span className="text-sm text-muted-foreground ml-2">
                  {filteredAndSortedClients.length} cliente(s)
                </span>
              </div>
            )}
          </>
        )}

        {/* Retention Metrics */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <RetentionMetrics clients={clients} />
        </div>

        {/* Charts */}
        <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <ClientCharts clients={clients} />
        </div>

        {/* Financial Report */}
        <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <FinancialReport clients={clients} />
        </div>
      </main>

      {/* Forms & Dialogs */}
      <ClientForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSubmit={editingClient ? handleEditClient : handleAddClient}
        initialData={editingClient}
      />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        clientName={clientToDelete?.name || ''}
      />
      <RenewalHistoryDialog
        client={historyClient}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />
      <ChangePlanDialog
        client={changePlanClient}
        open={changePlanDialogOpen}
        onOpenChange={setChangePlanDialogOpen}
        onConfirm={handleConfirmChangePlan}
      />
      <NotificationHistoryDialog
        client={notificationClient}
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
      />
      {/* Bulk Delete Confirmation */}
      <DeleteConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        clientName={`${selectedClients.size} cliente(s)`}
      />
      {/* Import Clients Dialog */}
      <ImportClientsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={importClients}
      />
      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        client={emailClient}
      />
      <SendWhatsAppDialog
        client={whatsappClient}
        instances={instances}
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
      />
      {/* Global Search */}
      <GlobalSearch
        clients={clients}
        instances={instances}
        isOpen={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
      />
      {/* Subscription Dialog */}
      <SubscriptionPlansDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
      />
      </div>
    </>
  );
};

export default Index;