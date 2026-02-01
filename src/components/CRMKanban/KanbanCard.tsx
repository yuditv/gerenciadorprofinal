import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, Phone, DollarSign, MessageCircle, GripVertical } from 'lucide-react';
import { KanbanLead } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface KanbanCardProps {
  lead: KanbanLead;
  isDragging?: boolean;
  onClick: () => void;
}

export function KanbanCard({ lead, isDragging, onClick }: KanbanCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-card border border-border/50 rounded-lg p-3 cursor-pointer",
        "hover:border-primary/50 hover:shadow-md transition-all duration-200",
        (isDragging || isSortableDragging) && "opacity-50 shadow-xl rotate-2 scale-105"
      )}
      onClick={onClick}
    >
      {/* Drag Handle + Avatar + Name */}
      <div className="flex items-start gap-3 mb-3">
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mt-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={lead.contact_avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate">
            {displayName}
          </h4>
          {lead.lead_email && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {lead.lead_email}
            </p>
          )}
        </div>
      </div>

      {/* Deal Value */}
      {lead.deal_value && lead.deal_value > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <DollarSign className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-500">
            R$ {lead.deal_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{lead.phone}</span>
        </div>

        {lead.last_message_at && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {formatDistanceToNow(new Date(lead.last_message_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        )}
      </div>

      {/* Ticket Badge */}
      {lead.is_ticket_open && (
        <Badge variant="secondary" className="mt-2 text-xs">
          Ticket Aberto
        </Badge>
      )}
    </div>
  );
}
