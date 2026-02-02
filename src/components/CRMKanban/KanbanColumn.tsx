import { memo, useMemo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { KanbanColumn as KanbanColumnType, KanbanLead } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanColumnProps {
  column: KanbanColumnType;
  isOver: boolean;
  onLeadClick: (lead: KanbanLead) => void;
}

export const KanbanColumn = memo(function KanbanColumn({ column, isOver, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver: isOverColumn } = useDroppable({
    id: column.id,
  });

  // Memoize total value calculation
  const totalValue = useMemo(() => 
    column.leads.reduce((sum, lead) => sum + (lead.deal_value || 0), 0),
  [column.leads]);

  // Memoize lead IDs for SortableContext
  const leadIds = useMemo(() => 
    column.leads.map(l => l.id),
  [column.leads]);

  // Stable callback
  const handleLeadClick = useCallback((lead: KanbanLead) => {
    onLeadClick(lead);
  }, [onLeadClick]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-80 min-w-80 rounded-xl bg-muted/30 border border-border/50 transition-all duration-200",
        (isOver || isOverColumn) && "ring-2 ring-primary/50 bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", column.color)} />
            <h3 className="font-semibold text-foreground">{column.title}</h3>
          </div>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {column.leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-sm text-muted-foreground">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        <SortableContext
          items={leadIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 min-h-[100px]">
            {column.leads.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                Arraste leads aqui
              </div>
            ) : (
              column.leads.map((lead) => (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => handleLeadClick(lead)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isOver === nextProps.isOver &&
    prevProps.column.id === nextProps.column.id &&
    prevProps.column.title === nextProps.column.title &&
    prevProps.column.leads.length === nextProps.column.leads.length &&
    prevProps.column.leads.every((lead, i) => lead.id === nextProps.column.leads[i]?.id)
  );
});
