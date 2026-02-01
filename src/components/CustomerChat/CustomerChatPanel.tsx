import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerMessage } from "@/hooks/useCustomerMessages";

type Props = {
  title: string;
  messages: CustomerMessage[];
  isLoading: boolean;
  isSending: boolean;
  onSend: (content: string) => Promise<boolean>;
  viewer: "owner" | "customer";
};

export function CustomerChatPanel({ title, messages, isLoading, isSending, onSend, viewer }: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    await onSend(content);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-inbox">
      <header className="h-14 border-b border-border/50 bg-inbox-header flex items-center justify-between px-4 shrink-0">
        <div className="font-semibold truncate">{title}</div>
      </header>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">Nenhuma mensagem ainda.</div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_type === viewer;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2 text-sm border",
                        mine
                          ? "bg-primary/10 border-primary/20 text-foreground"
                          : "bg-card/40 border-border/30 text-foreground"
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t border-border/50 bg-inbox-header p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="min-h-[44px] max-h-40 bg-inbox-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || !text.trim()}
            className="h-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
