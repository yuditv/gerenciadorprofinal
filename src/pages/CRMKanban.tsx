import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  RefreshCw,
  Filter,
  LayoutGrid,
  Table,
  List,
  Download,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/CRMKanban/KanbanBoard';
import { KanbanStats } from '@/components/CRMKanban/KanbanStats';
import { KanbanTableView } from '@/components/CRMKanban/KanbanTableView';
import { KanbanFiltersPanel } from '@/components/CRMKanban/KanbanFiltersPanel';
import { KanbanExportDialog } from '@/components/CRMKanban/KanbanExportDialog';
import { LeadDetailsDialog } from '@/components/CRMKanban/LeadDetailsDialog';
import { CreateLeadDialog } from '@/components/CRMKanban/CreateLeadDialog';
import { useKanbanLeads, KanbanLead } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

export default function CRMKanban() {
  const {
    leads,
    allLeads,
    tags,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    viewMode,
    setViewMode,
    fetchLeads,
    bulkDelete,
    isLoading,
    stats,
  } = useKanbanLeads();

  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleLeadClick = (lead: KanbanLead) => {
    setSelectedLead(lead);
  };

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl" style={{
              background: "linear-gradient(135deg, hsl(330 85% 55%) 0%, hsl(350 80% 50%) 100%)",
              boxShadow: "0 8px 32px hsl(330 85% 55% / 0.35), 0 0 60px hsl(330 85% 55% / 0.15)"
            }}>
              <LayoutGrid className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient">
                CRM Kanban
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus leads e oportunidades de vendas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar leads..."
                className="pl-10"
              />
            </div>

            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="kanban" className="px-3">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="table" className="px-3">
                  <Table className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFiltersPanel(true)}
              className="relative"
            >
              <Filter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </Button>

            {/* Export */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchLeads}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>

            {/* Create Lead */}
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {filters.status.length > 0 && (
              <Badge variant="secondary">
                Status: {filters.status.length}
              </Badge>
            )}
            {filters.priority.length > 0 && (
              <Badge variant="secondary">
                Prioridade: {filters.priority.length}
              </Badge>
            )}
            {filters.temperature.length > 0 && (
              <Badge variant="secondary">
                Temperatura: {filters.temperature.length}
              </Badge>
            )}
            {filters.source.length > 0 && (
              <Badge variant="secondary">
                Origem: {filters.source.length}
              </Badge>
            )}
            {filters.tags.length > 0 && (
              <Badge variant="secondary">
                Tags: {filters.tags.length}
              </Badge>
            )}
            {filters.hasFollowUp !== null && (
              <Badge variant="secondary">
                {filters.hasFollowUp ? 'Com follow-up' : 'Sem follow-up'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground h-6"
            >
              Limpar
            </Button>
          </div>
        )}

        {/* Stats */}
        <KanbanStats />

        {/* Content */}
        <div className="bg-card/30 rounded-xl border border-border/50 p-4">
          {viewMode === 'kanban' ? (
            <KanbanBoard onLeadClick={handleLeadClick} />
          ) : (
            <KanbanTableView
              leads={leads}
              onLeadClick={handleLeadClick}
              onBulkDelete={bulkDelete}
            />
          )}
        </div>
      </motion.div>

      {/* Lead Details Dialog */}
      <LeadDetailsDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      />

      {/* Create Lead Dialog */}
      <CreateLeadDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Filters Panel */}
      <KanbanFiltersPanel
        open={showFiltersPanel}
        onOpenChange={setShowFiltersPanel}
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        tags={tags}
      />

      {/* Export Dialog */}
      <KanbanExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        leads={allLeads}
      />
    </div>
  );
}
