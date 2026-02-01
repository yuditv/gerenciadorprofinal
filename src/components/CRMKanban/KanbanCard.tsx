import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign,
  Clock,
  AlertCircle,
  GripVertical,
  Building,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { KanbanLead, LEAD_PRIORITIES, LEAD_TEMPERATURES } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  lead: KanbanLead;
  isDragging?: boolean;
  onClick: () => void;
}

export function KanbanCard({ lead, isDragging = false, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = lead.lead_name || lead.lead_full_name || lead.phone;
  const initials = displayName
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const priority = LEAD_PRIORITIES.find(p => p.id === (lead.priority || 'medium'));
  const temperature = LEAD_TEMPERATURES.find(t => t.id === (lead.temperature || 'warm'));

  const isOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date();
  const hasFollowUpSoon = lead.follow_up_date && !isOverdue && 
    new Date(lead.follow_up_date) <= new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border border-border/50 rounded-lg p-3 cursor-pointer",
        "hover:border-primary/50 hover:shadow-md transition-all group",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2",
        isOverdue && "border-l-4 border-l-red-500",
        hasFollowUpSoon && "border-l-4 border-l-amber-500"
      )}
      onClick={onClick}
    >
      {/* Header with avatar and name */}
      <div className="flex items-start gap-2 mb-2">
        {/* Drag handle */}
        <div
          className="opacity-0 group-hover:opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={lead.contact_avatar || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{displayName}</p>
          {lead.company_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building className="h-3 w-3" />
              {lead.company_name}
            </p>
          )}
        </div>

        {/* Temperature */}
        <span className="text-lg" title={temperature?.label}>
          {temperature?.icon}
        </span>
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.slice(0, 3).map(tag => (
            <Badge
              key={tag.id}
              className="text-[10px] px-1.5 py-0"
              style={{ backgroundColor: tag.color }}
            >
              <span className="text-white">{tag.name}</span>
            </Badge>
          ))}
          {lead.tags.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{lead.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Info row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {/* Value */}
        {lead.deal_value ? (
          <div className="flex items-center gap-1 text-green-500 font-medium">
            <DollarSign className="h-3 w-3" />
            R$ {lead.deal_value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </div>
        ) : (
          <span>-</span>
        )}

        {/* Priority badge */}
        <Badge
          variant="outline"
          className={cn("text-[10px] h-5", priority?.textColor)}
        >
          {priority?.label}
        </Badge>
      </div>

      {/* Follow-up date */}
      {lead.follow_up_date && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-xs",
            isOverdue && "text-red-500",
            hasFollowUpSoon && !isOverdue && "text-amber-500",
            !isOverdue && !hasFollowUpSoon && "text-muted-foreground"
          )}
        >
          {isOverdue ? (
            <AlertCircle className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          <span>
            {isOverdue ? 'Atrasado: ' : 'Follow-up: '}
            {format(new Date(lead.follow_up_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      )}

      {/* Last activity */}
      {lead.last_message_at && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Última msg: {format(new Date(lead.last_message_at), 'dd/MM HH:mm', { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
