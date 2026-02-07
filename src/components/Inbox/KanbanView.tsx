import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, MessageSquare, Archive, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Conversation } from "@/hooks/useInboxConversations";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KanbanViewProps {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
  selectedId: string | null;
}

const COLUMNS = [
  { status: 'open', label: 'Aguardando', icon: Clock, color: 'text-yellow-500', bgColor: 'border-yellow-500/30' },
  { status: 'pending', label: 'Em Atendimento', icon: MessageSquare, color: 'text-blue-500', bgColor: 'border-blue-500/30' },
  { status: 'resolved', label: 'Resolvido', icon: CheckCircle, color: 'text-green-500', bgColor: 'border-green-500/30' },
  { status: 'snoozed', label: 'Arquivado', icon: Archive, color: 'text-gray-500', bgColor: 'border-gray-500/30' },
];

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const PRIORITY_LABELS = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function KanbanView({ conversations, onSelect, selectedId }: KanbanViewProps) {
  const columns = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      conversations: conversations
        .filter(c => c.status === col.status)
        .sort((a, b) => {
          // Sort by priority first (urgent > high > medium > low)
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (pDiff !== 0) return pDiff;
          // Then by last message time
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        }),
    }));
  }, [conversations]);

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="flex gap-4 min-w-max h-full">
        {columns.map(column => (
          <div
            key={column.status}
            className={cn(
              "flex flex-col w-72 sm:w-80 rounded-xl border-2 bg-card/30 backdrop-blur-sm shrink-0",
              column.bgColor
            )}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-border/30 flex items-center gap-2">
              <column.icon className={cn("h-4 w-4", column.color)} />
              <span className="font-semibold text-sm">{column.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {column.conversations.length}
              </Badge>
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {column.conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    Nenhuma conversa
                  </div>
                ) : (
                  column.conversations.map((conv, index) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => onSelect(conv)}
                      className={cn(
                        "p-3 rounded-lg border border-border/40 bg-card/60 cursor-pointer",
                        "hover:border-primary/30 hover:shadow-sm transition-all",
                        selectedId === conv.id && "border-primary/50 ring-1 ring-primary/20"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={conv.contact_avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {conv.contact_name?.slice(0, 2).toUpperCase() || conv.phone.slice(-2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-sm truncate">
                              {conv.contact_name || conv.phone}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(conv.last_message_at), {
                                addSuffix: false,
                                locale: ptBR
                              })}
                            </span>
                          </div>
                          
                          {/* Ticket number */}
                          {conv.ticket_number && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              #{conv.ticket_number}
                            </span>
                          )}

                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conv.last_message_preview || "Sem mensagens"}
                          </p>

                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {/* Priority */}
                            <div className="flex items-center gap-1">
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                PRIORITY_COLORS[conv.priority]
                              )} />
                              <span className="text-[10px] text-muted-foreground">
                                {PRIORITY_LABELS[conv.priority]}
                              </span>
                            </div>

                            {/* Unread */}
                            {conv.unread_count > 0 && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                {conv.unread_count}
                              </Badge>
                            )}

                            {/* AI indicator */}
                            {conv.ai_enabled && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                                🤖 IA
                              </Badge>
                            )}

                            {/* Labels */}
                            {conv.labels?.slice(0, 2).map(l => (
                              <span
                                key={l.id}
                                className="inline-flex items-center px-1 rounded text-[9px]"
                                style={{
                                  backgroundColor: `${l.label?.color}20`,
                                  color: l.label?.color,
                                }}
                              >
                                {l.label?.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}
