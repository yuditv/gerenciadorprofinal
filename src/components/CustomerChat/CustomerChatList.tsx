import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Bot, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CustomerConversationView } from "@/hooks/useCustomerConversations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  conversations: CustomerConversationView[];
  selectedId: string | null;
  onSelect: (c: CustomerConversationView) => void;
  onDelete: (id: string) => Promise<boolean>;
  isLoading: boolean;
  isDeleting?: boolean;
  highlightedConversationId?: string | null;
};

export function CustomerChatList({ 
  conversations, 
  selectedId, 
  onSelect, 
  onDelete, 
  isLoading, 
  isDeleting,
  highlightedConversationId 
}: Props) {
  const [q, setQ] = useState("");
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());

  // Track highlighted conversation for animation
  useEffect(() => {
    if (highlightedConversationId) {
      setRecentlyUpdated(prev => new Set(prev).add(highlightedConversationId));
      
      // Remove highlight after animation
      const timer = setTimeout(() => {
        setRecentlyUpdated(prev => {
          const next = new Set(prev);
          next.delete(highlightedConversationId);
          return next;
        });
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [highlightedConversationId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) => (c.customer_name ?? "").toLowerCase().includes(query));
  }, [conversations, q]);

  return (
    <div className="w-full md:w-80 border-r border-border/50 flex flex-col h-full bg-inbox-sidebar overflow-hidden">
      <div className="p-3 border-b border-border/50">
        <Input
          placeholder="Buscar cliente..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-inbox-input"
        />
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum chat</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((c) => {
                const selected = selectedId === c.id;
                const lastAt = c.last_message_at ?? c.updated_at;
                const hasUnread = c.unread_owner_count > 0;
                const isHighlighted = recentlyUpdated.has(c.id);
                
                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                      boxShadow: isHighlighted 
                        ? ["0 0 0px rgba(34, 197, 94, 0)", "0 0 20px rgba(34, 197, 94, 0.5)", "0 0 0px rgba(34, 197, 94, 0)"]
                        : "0 0 0px rgba(0, 0, 0, 0)"
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ 
                      layout: { type: "spring", stiffness: 500, damping: 30 },
                      boxShadow: { duration: 1.5, repeat: isHighlighted ? Infinity : 0 }
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl border text-left transition-all relative group",
                      "bg-card/25 border-border/30 hover:bg-card/40",
                      selected && "bg-card/60 border-primary/25 ring-1 ring-primary/30",
                      hasUnread && !selected && "border-green-500/50 bg-green-500/10"
                    )}
                  >
                    <button
                      onClick={() => onSelect(c)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{c.customer_name ?? "Cliente"}</div>
                          {c.ai_enabled && (
                            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasUnread && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-green-500 text-white text-xs font-bold"
                            >
                              {c.unread_owner_count}
                            </motion.div>
                          )}
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(lastAt), { addSuffix: false, locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "text-xs mt-1",
                        hasUnread ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"
                      )}>
                        {hasUnread ? `${c.unread_owner_count} mensagem${c.unread_owner_count > 1 ? 's' : ''} nova${c.unread_owner_count > 1 ? 's' : ''}` : "Sem pendências"}
                      </div>
                    </button>

                    {/* Delete button - visible on hover */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso vai excluir permanentemente a conversa com "{c.customer_name ?? "Cliente"}" e todas as mensagens. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(c.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
