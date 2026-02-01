import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, RefreshCw, Filter, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KanbanBoard } from '@/components/CRMKanban/KanbanBoard';
import { KanbanStats } from '@/components/CRMKanban/KanbanStats';
import { LeadDetailsDialog } from '@/components/CRMKanban/LeadDetailsDialog';
import { CreateLeadDialog } from '@/components/CRMKanban/CreateLeadDialog';
import { useKanbanLeads, KanbanLead } from '@/hooks/useKanbanLeads';

export default function CRMKanban() {
  const { searchTerm, setSearchTerm, fetchLeads, isLoading } = useKanbanLeads();
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleLeadClick = (lead: KanbanLead) => {
    setSelectedLead(lead);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
              <LayoutGrid className="h-8 w-8 text-primary" />
              CRM Kanban
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus leads e oportunidades de vendas
            </p>
          </div>

          <div className="flex items-center gap-3">
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

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchLeads}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Create Lead */}
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Stats */}
        <KanbanStats />

        {/* Kanban Board */}
        <div className="bg-card/30 rounded-xl border border-border/50 p-4">
          <KanbanBoard onLeadClick={handleLeadClick} />
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
    </div>
  );
}
