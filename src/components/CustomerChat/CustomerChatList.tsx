import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import type { CustomerConversationView } from "@/hooks/useCustomerConversations";

type Props = {
  conversations: CustomerConversationView[];
  selectedId: string | null;
  onSelect: (c: CustomerConversationView) => void;
  isLoading: boolean;
};

export function CustomerChatList({ conversations, selectedId, onSelect, isLoading }: Props) {
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
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={cn(
                    "w-full p-3 rounded-xl border text-left transition-all",
                    "bg-card/25 border-border/30 hover:bg-card/40",
                    selected && "bg-card/60 border-primary/25 ring-1 ring-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{c.customer_name ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(lastAt), { addSuffix: false, locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.unread_owner_count > 0 ? `${c.unread_owner_count} não lidas` : "Sem pendências"}
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
