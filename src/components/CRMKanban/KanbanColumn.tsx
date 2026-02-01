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

export function KanbanColumn({ column, isOver, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver: isOverColumn } = useDroppable({
    id: column.id,
  });

  const totalValue = column.leads.reduce((sum, lead) => sum + (lead.deal_value || 0), 0);

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
          items={column.leads.map(l => l.id)}
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
                  onClick={() => onLeadClick(lead)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
