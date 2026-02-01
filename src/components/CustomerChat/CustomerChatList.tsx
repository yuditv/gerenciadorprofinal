import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Bot, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
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
};

export function CustomerChatList({ conversations, selectedId, onSelect, onDelete, isLoading, isDeleting }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) => (c.customer_name ?? "").toLowerCase().includes(query));
  }, [conversations, q]);

  return (
    <div className="w-80 border-r border-border/50 flex flex-col h-full bg-inbox-sidebar overflow-hidden">
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
            {filtered.map((c) => {
              const selected = selectedId === c.id;
              const lastAt = c.last_message_at ?? c.updated_at;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "w-full p-3 rounded-xl border text-left transition-all relative group",
                    "bg-card/25 border-border/30 hover:bg-card/40",
                    selected && "bg-card/60 border-primary/25 ring-1 ring-primary/30"
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
                      <div className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(lastAt), { addSuffix: false, locale: ptBR })}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.unread_owner_count > 0 ? `${c.unread_owner_count} não lidas` : "Sem pendências"}
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
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
