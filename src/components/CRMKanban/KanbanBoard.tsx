import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn as KanbanColumnComponent } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useKanbanLeads, KanbanLead, KANBAN_STATUSES } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  onLeadClick: (lead: KanbanLead) => void;
}

export function KanbanBoard({ onLeadClick }: KanbanBoardProps) {
  const { columns, updateLeadStatus, updateLeadOrder, isLoading } = useKanbanLeads();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeLead = activeId
    ? columns.flatMap(c => c.leads).find(l => l.id === activeId)
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    // Find which column the lead is being dropped into
    let targetColumnId: string | null = null;
    let targetIndex = 0;

    // Check if dropped directly on a column
    const droppedOnColumn = KANBAN_STATUSES.find(s => s.id === overId);
    if (droppedOnColumn) {
      targetColumnId = droppedOnColumn.id;
      const targetColumn = columns.find(c => c.id === targetColumnId);
      targetIndex = targetColumn?.leads.length || 0;
    } else {
      // Dropped on another lead - find which column it belongs to
      for (const column of columns) {
        const leadIndex = column.leads.findIndex(l => l.id === overId);
        if (leadIndex !== -1) {
          targetColumnId = column.id;
          targetIndex = leadIndex;
          break;
        }
      }
    }

    if (!targetColumnId) return;

    // Find the active lead's current column
    const activeLead = columns.flatMap(c => c.leads).find(l => l.id === activeLeadId);
    if (!activeLead) return;

    // Update the lead's status and order
    updateLeadStatus(activeLeadId, targetColumnId, targetIndex);
  }, [columns, updateLeadStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-250px)]">
        {columns.map((column) => (
          <SortableContext
            key={column.id}
            items={column.leads.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumnComponent
              column={column}
              isOver={overId === column.id}
              onLeadClick={onLeadClick}
            />
          </SortableContext>
        ))}
      </div>

      <DragOverlay>
        {activeLead && (
          <KanbanCard
            lead={activeLead}
            isDragging
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
