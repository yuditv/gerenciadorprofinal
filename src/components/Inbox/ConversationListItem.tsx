import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, User, Mic, Image, Video, FileText, MapPin, Sticker, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Conversation } from '@/hooks/useInboxConversations';
import { SLABadge } from './SLABadge';
import { SLAStatus } from '@/hooks/useInboxSLA';

// Country code to flag emoji and name mapping
const countryData: Record<string, { flag: string; name: string }> = {
  US: { flag: '🇺🇸', name: 'Estados Unidos' },
  BR: { flag: '🇧🇷', name: 'Brasil' },
  GB: { flag: '🇬🇧', name: 'Reino Unido' },
  PT: { flag: '🇵🇹', name: 'Portugal' },
  ES: { flag: '🇪🇸', name: 'Espanha' },
  FR: { flag: '🇫🇷', name: 'França' },
  DE: { flag: '🇩🇪', name: 'Alemanha' },
  IT: { flag: '🇮🇹', name: 'Itália' },
  AR: { flag: '🇦🇷', name: 'Argentina' },
  MX: { flag: '🇲🇽', name: 'México' },
};

// Media type icons and labels
const getMediaPreview = (preview: string | null) => {
  if (!preview) return { icon: null, text: "Sem mensagens" };
  
  const lowerPreview = preview.toLowerCase();
  
  if (lowerPreview.includes('[audio]') || lowerPreview.includes('audio')) {
    return { icon: Mic, text: "Áudio" };
  }
  if (lowerPreview.includes('[image]') || lowerPreview.includes('imagem') || lowerPreview.includes('[foto]')) {
    return { icon: Image, text: "Imagem" };
  }
  if (lowerPreview.includes('[video]') || lowerPreview.includes('vídeo')) {
    return { icon: Video, text: "Vídeo" };
  }
  if (lowerPreview.includes('[document]') || lowerPreview.includes('documento') || lowerPreview.includes('[arquivo]')) {
    return { icon: FileText, text: "Documento" };
  }
  if (lowerPreview.includes('[location]') || lowerPreview.includes('localização')) {
    return { icon: MapPin, text: "Localização" };
  }
  if (lowerPreview.includes('[sticker]') || lowerPreview.includes('figurinha')) {
    return { icon: Sticker, text: "Sticker" };
  }
  
  return { icon: null, text: preview };
};

const getInitials = (name: string | null, phone: string) => {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return phone.slice(-2);
};

const formatPhone = (phone: string) => {
  if (phone.length === 13) {
    return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
};

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  defaultAgentId?: string | null;
  onSelect: (conversation: Conversation) => void;
  getSLAStatus?: (createdAt: string, firstReplyAt: string | null, priority: string) => SLAStatus | null;
}

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  defaultAgentId,
  onSelect,
  getSLAStatus,
}: ConversationListItemProps) {
  const isUnread = conversation.unread_count > 0;
  const mediaPreview = getMediaPreview(conversation.last_message_preview);
  const MediaIcon = mediaPreview.icon;
  const slaStatus = getSLAStatus && (conversation.status === 'open' || conversation.status === 'pending')
    ? getSLAStatus(conversation.created_at, conversation.first_reply_at, conversation.priority)
    : null;

  return (
    <button
      onClick={() => onSelect(conversation)}
      className={cn(
        "group relative w-[calc(100%-16px)] mx-2 p-3 flex items-start gap-3 text-left",
        "rounded-xl border border-border/30",
        "bg-card/30",
        "shadow-[var(--shadow-sm)]",
        "transition-all duration-200",
        "hover:bg-card/40 hover:border-border/45 hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]",
        isSelected && [
          "bg-card/60 border-primary/25 ring-1 ring-primary/30",
          "shadow-[var(--shadow-md)]",
          "[box-shadow:var(--shadow-md),var(--shadow-glow)]",
        ].join(" "),
        isUnread && !isSelected && "border-primary/25 bg-card/30"
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.contact_avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {getInitials(conversation.contact_name, conversation.phone)}
          </AvatarFallback>
        </Avatar>
        {isUnread && !isSelected && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full",
              "bg-primary",
              "ring-2 ring-background"
            )}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header row: Name + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {conversation.country_code && conversation.country_code !== 'BR' && countryData[conversation.country_code] && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm shrink-0" role="img" aria-label={countryData[conversation.country_code].name}>
                      {countryData[conversation.country_code].flag}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {countryData[conversation.country_code].name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <span className={cn(
              "truncate text-sm",
              isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
            )}>
              {conversation.contact_name || formatPhone(conversation.phone)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(conversation.last_message_at), {
              addSuffix: false,
              locale: ptBR
            })}
          </span>
        </div>

        {/* Message preview row */}
        <div className="flex items-center gap-1.5">
          {conversation.ai_enabled && (
            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          {conversation.assigned_to && (
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          {MediaIcon && (
            <MediaIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <p className={cn(
            "text-xs truncate flex-1",
            isUnread 
              ? "text-foreground font-medium" 
              : "text-muted-foreground"
          )}>
            {mediaPreview.text}
          </p>
          {/* Ticket number */}
          {conversation.ticket_number && (
            <span className="text-[9px] text-muted-foreground font-mono shrink-0">
              #{conversation.ticket_number}
            </span>
          )}
        </div>

        {/* Labels, Agent Badge & Unread badge row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {conversation.active_agent && 
           conversation.active_agent_id !== defaultAgentId && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span 
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[100px]"
                    style={{ 
                      backgroundColor: `${conversation.active_agent.color || '#3b82f6'}20`,
                      color: conversation.active_agent.color || '#3b82f6',
                      border: `1px solid ${conversation.active_agent.color || '#3b82f6'}40`
                    }}
                  >
                    <Bot className="h-3 w-3 shrink-0" />
                    {conversation.active_agent.name}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Agente especialista ativo
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {conversation.labels?.slice(0, 2).map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[100px]"
              style={{ 
                backgroundColor: `${l.label?.color}20`,
                color: l.label?.color,
                border: `1px solid ${l.label?.color}40`
              }}
            >
              {l.label?.name}
            </span>
          ))}
          {conversation.labels && conversation.labels.length > 2 && (
            <span className="text-[10px] text-muted-foreground font-medium">
              +{conversation.labels.length - 2}
            </span>
          )}
          
          {/* SLA Badge */}
          <SLABadge slaStatus={slaStatus} />

          {isUnread && (
            <Badge 
              variant="destructive" 
              className={cn(
                "ml-auto h-5 min-w-5 text-xs px-1.5 font-bold",
                "shadow-[var(--shadow-sm)]",
                isSelected && "ring-1 ring-background/20"
              )}
            >
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>

      {/* Left accent bar */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-3 bottom-3 w-[3px] rounded-full",
          "transition-all duration-200",
          isSelected && "bg-primary opacity-100",
          isUnread && !isSelected && "bg-primary/50 opacity-70",
          !isUnread && !isSelected && "opacity-0"
        )}
      />
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.defaultAgentId === nextProps.defaultAgentId &&
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
    prevProps.conversation.last_message_at === nextProps.conversation.last_message_at &&
    prevProps.conversation.last_message_preview === nextProps.conversation.last_message_preview &&
    prevProps.conversation.contact_name === nextProps.conversation.contact_name &&
    prevProps.conversation.contact_avatar === nextProps.conversation.contact_avatar &&
    prevProps.conversation.ai_enabled === nextProps.conversation.ai_enabled &&
    prevProps.conversation.active_agent_id === nextProps.conversation.active_agent_id &&
    prevProps.conversation.assigned_to === nextProps.conversation.assigned_to &&
    JSON.stringify(prevProps.conversation.labels) === JSON.stringify(nextProps.conversation.labels)
  );
});
