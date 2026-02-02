import { useEffect, useRef, useState } from "react";
import { Send, Bot, Settings, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import type { CustomerMessage } from "@/hooks/useCustomerMessages";
import type { CustomerConversationView } from "@/hooks/useCustomerConversations";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { MediaMessage } from "./MediaMessage";
import { ChatMediaUploader, MediaPreview } from "./ChatMediaUploader";

type AIAgent = {
  id: string;
  name: string;
  is_active: boolean | null;
};

type Props = {
  title: string;
  messages: CustomerMessage[];
  isLoading: boolean;
  isSending: boolean;
  onSend: (content: string, mediaFile?: File) => Promise<boolean>;
  viewer: "owner" | "customer";
  conversation?: CustomerConversationView | null;
  agents?: AIAgent[];
  onToggleAI?: (enabled: boolean, agentId?: string | null) => Promise<boolean>;
  onSetAgent?: (agentId: string | null) => Promise<boolean>;
};

export function CustomerChatPanel({
  title,
  messages,
  isLoading,
  isSending,
  onSend,
  viewer,
  conversation,
  agents = [],
  onToggleAI,
  onSetAgent,
}: Props) {
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isEnabled, setIsEnabled } = useSystemNotifications();

  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content && !mediaFile) return;
    setText("");
    const file = mediaFile;
    setMediaFile(null);
    await onSend(content, file || undefined);
  };

  const activeAgents = agents.filter((a) => a.is_active);
  const showAIControls = viewer === "owner" && conversation && onToggleAI;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-inbox">
      <header className="h-14 border-b border-border/50 bg-inbox-header flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold truncate">{title}</div>
          {conversation?.ai_enabled && (
            <Bot className="h-4 w-4 text-primary" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEnabled(!isEnabled)}
            className="h-8 w-8"
            title={isEnabled ? "Desativar som" : "Ativar som"}
          >
            {isEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>

          {showAIControls && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">IA</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-4">
                  <div className="font-medium text-sm">Configurações de IA</div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ai-toggle" className="text-sm">Ativar Agente IA</Label>
                    <Switch
                      id="ai-toggle"
                      checked={conversation.ai_enabled}
                      onCheckedChange={(checked) => {
                        const agentId = checked && activeAgents.length > 0 ? activeAgents[0].id : null;
                        onToggleAI(checked, agentId);
                      }}
                    />
                  </div>

                  {conversation.ai_enabled && (
                    <div className="space-y-2">
                      <Label className="text-sm">Agente</Label>
                      <Select
                        value={conversation.active_agent_id || ""}
                        onValueChange={(value) => onSetAgent?.(value || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um agente" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
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
              <AnimatePresence mode="popLayout">
                {messages.map((m) => {
                  const mine = m.sender_type === viewer;
                  const isNewMessage = m.isNew;
                  
                  return (
                    <motion.div 
                      key={m.id} 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <motion.div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2 text-sm border relative overflow-hidden",
                          mine
                            ? "bg-primary/10 border-primary/20 text-foreground"
                            : "bg-card/40 border-border/30 text-foreground"
                        )}
                        animate={isNewMessage && !mine ? {
                          boxShadow: [
                            "0 0 0px hsl(var(--primary) / 0)",
                            "0 0 20px hsl(var(--primary) / 0.5)",
                            "0 0 0px hsl(var(--primary) / 0)"
                          ]
                        } : {}}
                        transition={{ duration: 0.8 }}
                      >
                        {/* Glow overlay for new messages */}
                        {isNewMessage && !mine && (
                          <motion.div
                            className="absolute inset-0 bg-primary/20"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                          />
                        )}
                        {/* Media content */}
                        {m.media_url && (
                          <div className="mb-2 relative z-10">
                            <MediaMessage
                              mediaUrl={m.media_url}
                              mediaType={m.media_type}
                              fileName={m.file_name}
                              mine={mine}
                            />
                          </div>
                        )}
                        {m.content && (
                          <div className="whitespace-pre-wrap break-words relative z-10">{m.content}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1 relative z-10">
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t border-border/50 bg-inbox-header p-3">
        {/* Media preview */}
        {mediaFile && (
          <MediaPreview 
            file={mediaFile} 
            onRemove={() => setMediaFile(null)} 
          />
        )}
        
        <div className="flex gap-2 items-end">
          <ChatMediaUploader 
            onFileSelect={setMediaFile} 
            disabled={isSending}
          />
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
            disabled={isSending || (!text.trim() && !mediaFile)}
            className="h-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
