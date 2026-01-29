import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Search, 
  Bot, 
  User, 
  Circle,
  Filter,
  Mic,
  Image,
  Video,
  FileText,
  MapPin,
  Sticker
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Conversation } from "@/hooks/useInboxConversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  CL: { flag: '🇨🇱', name: 'Chile' },
  CO: { flag: '🇨🇴', name: 'Colômbia' },
  VE: { flag: '🇻🇪', name: 'Venezuela' },
  MX: { flag: '🇲🇽', name: 'México' },
  PE: { flag: '🇵🇪', name: 'Peru' },
  BO: { flag: '🇧🇴', name: 'Bolívia' },
  PY: { flag: '🇵🇾', name: 'Paraguai' },
  UY: { flag: '🇺🇾', name: 'Uruguai' },
  EC: { flag: '🇪🇨', name: 'Equador' },
  IE: { flag: '🇮🇪', name: 'Irlanda' },
  NL: { flag: '🇳🇱', name: 'Holanda' },
  BE: { flag: '🇧🇪', name: 'Bélgica' },
  CH: { flag: '🇨🇭', name: 'Suíça' },
  AT: { flag: '🇦🇹', name: 'Áustria' },
  PL: { flag: '🇵🇱', name: 'Polônia' },
  JP: { flag: '🇯🇵', name: 'Japão' },
  CN: { flag: '🇨🇳', name: 'China' },
  IN: { flag: '🇮🇳', name: 'Índia' },
  AU: { flag: '🇦🇺', name: 'Austrália' },
  NZ: { flag: '🇳🇿', name: 'Nova Zelândia' },
  ZA: { flag: '🇿🇦', name: 'África do Sul' },
  AE: { flag: '🇦🇪', name: 'Emirados Árabes' },
  IL: { flag: '🇮🇱', name: 'Israel' },
  SA: { flag: '🇸🇦', name: 'Arábia Saudita' },
  CA: { flag: '🇨🇦', name: 'Canadá' },
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

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  defaultAgentId?: string | null;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  searchQuery,
  onSearchChange,
  defaultAgentId
}: ConversationListProps) {
  const [sortBy, setSortBy] = useState<'recent' | 'unread'>('recent');

  const sortedConversations = [...conversations].sort((a, b) => {
    if (sortBy === 'unread') {
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (a.unread_count === 0 && b.unread_count > 0) return 1;
    }
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });

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

  return (
    <div className="w-80 border-r border-border/50 flex flex-col h-full bg-inbox-sidebar overflow-hidden">
      {/* Search Header */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-inbox-input"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {conversations.length} conversas
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                {sortBy === 'recent' ? 'Recentes' : 'Não lidas'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border border-border">
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                Mais recentes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('unread')}>
                Não lidas primeiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="py-2">
            {sortedConversations.map((conversation) => {
              const isUnread = conversation.unread_count > 0;
              const mediaPreview = getMediaPreview(conversation.last_message_preview);
              const MediaIcon = mediaPreview.icon;
              const isSelected = selectedId === conversation.id;
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelect(conversation)}
                  className={cn(
                    // Card-like row (more depth, less "flat list")
                    "group w-[calc(100%-16px)] mx-2 p-3 flex items-start gap-3 text-left",
                    "rounded-xl border border-border/30",
                    "bg-card/30 backdrop-blur-sm",
                    "shadow-[var(--shadow-sm)]",
                    "transition-all duration-200",
                    "hover:bg-card/50 hover:border-border/45 hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]",
                    // Selected state
                    isSelected && "bg-card/70 border-primary/25 ring-1 ring-primary/20 shadow-[var(--shadow-md)]",
                    // Unread emphasis (when not selected)
                    isUnread && !isSelected && "border-primary/20"
                  )}
                >
                  {/* Avatar - Clean without status indicator */}
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12">
                    <AvatarImage src={conversation.contact_avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(conversation.contact_name, conversation.phone)}
                    </AvatarFallback>
                  </Avatar>
                    {/* Unread dot */}
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
                        {/* Country flag for international contacts */}
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
                      {/* AI indicator */}
                      {conversation.ai_enabled && (
                        <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      {/* Assigned indicator */}
                      {conversation.assigned_to && (
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      {/* Media icon */}
                      {MediaIcon && (
                        <MediaIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      {/* Message preview */}
                      <p className={cn(
                        "text-xs truncate flex-1",
                        isUnread 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground"
                      )}>
                        {mediaPreview.text}
                      </p>
                    </div>

                    {/* Labels, Agent Badge & Unread badge row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Active Agent Badge - only show if different from default */}
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
                      
                      {isUnread && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 min-w-5 text-xs px-1.5 font-bold shadow-[var(--shadow-sm)]"
                        >
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}