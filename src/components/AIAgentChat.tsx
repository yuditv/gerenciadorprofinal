import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, Send, Trash2, ChevronDown, 
  Loader2, User, Sparkles, ThumbsUp, ThumbsDown, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAIAgents, type AIAgent, type AIChatMessage } from "@/hooks/useAIAgents";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AIAgentChat() {
  const { agents, isLoadingAgents, useChatMessages, sendMessage, clearChatHistory, rateMessage } = useAIAgents();
  const { responses: cannedResponses } = useCannedResponses();
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [inputMessage, setInputMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<AIChatMessage[]>([]);
  const [attachment, setAttachment] = useState<
    | null
    | {
        kind: "audio" | "image";
        name: string;
        mimeType: string;
        dataUrl: string;
      }
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Count available canned responses
  const cannedResponsesCount = cannedResponses?.length || 0;

  // Filter agents that have chat enabled
  const chatEnabledAgents = agents.filter(a => a.is_chat_enabled && a.is_active);

  // Auto-select first agent
  useEffect(() => {
    if (chatEnabledAgents.length > 0 && !selectedAgent) {
      setSelectedAgent(chatEnabledAgents[0]);
    }
  }, [chatEnabledAgents, selectedAgent]);

  // Fetch messages for selected agent - always call the hook unconditionally
  const { data: dbMessages = [], isLoading: isLoadingMessages } = useChatMessages(
    selectedAgent?.id ?? null, 
    sessionId
  );

  // Combine DB messages with local optimistic messages
  useEffect(() => {
    setLocalMessages(dbMessages);
  }, [dbMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !attachment) || !selectedAgent || sendMessage.isPending) return;

    const messageContent = inputMessage || (attachment ? `📎 ${attachment.kind === 'audio' ? 'Áudio' : 'Imagem'}: ${attachment.name}` : '');
    const userMessageId = crypto.randomUUID();
    
    const userMessage: AIChatMessage = {
      id: userMessageId,
      agent_id: selectedAgent.id,
      user_id: '',
      session_id: sessionId,
      role: 'user',
      content: messageContent,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    // Optimistically add user message
    setLocalMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    // Focus back on input
    inputRef.current?.focus();

    try {
       const result = await sendMessage.mutateAsync({
        agentId: selectedAgent.id,
         message: messageContent,
        sessionId,
        source: 'web',
         metadata: attachment
           ? {
               media: {
                 kind: attachment.kind,
                 name: attachment.name,
                 mimeType: attachment.mimeType,
                 dataUrl: attachment.dataUrl,
               },
             }
           : {},
      });

      // If backend returned a structured error, surface it (instead of masking with a generic message)
      if (result?.error) {
        setLocalMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          agent_id: selectedAgent.id,
          user_id: '',
          session_id: sessionId,
          role: 'assistant',
          content: `❌ Falha na IA: ${String(result.error)}`,
          metadata: { error: true, details: result.error },
          created_at: new Date().toISOString(),
        }]);
        return;
      }

      // Add assistant response
      if (result?.message) {
        setLocalMessages(prev => [...prev, {
          id: result.message.id || crypto.randomUUID(),
          agent_id: selectedAgent.id,
          user_id: '',
          session_id: sessionId,
          role: 'assistant',
          content: result.message.content,
          metadata: {},
          created_at: result.message.created_at,
        }]);
      } else if (result?.response) {
        // Fallback for different response format
        setLocalMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          agent_id: selectedAgent.id,
          user_id: '',
          session_id: sessionId,
          role: 'assistant',
          content: result.response,
          metadata: {},
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Add error message as assistant response
      setLocalMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        agent_id: selectedAgent.id,
        user_id: '',
        session_id: sessionId,
        role: 'assistant',
        content: `❌ Erro ao processar mensagem: ${error?.message || 'tente novamente.'}`,
        metadata: { error: true, details: error?.message },
        created_at: new Date().toISOString(),
      }]);
    }
  };

  const handlePickFile = async (file: File) => {
    const maxBytes = 12 * 1024 * 1024; // keep it reasonable for data URLs
    if (file.size > maxBytes) {
      toast.error("Arquivo muito grande (máx. 12MB)");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (!isImage && !isAudio) {
      toast.error("Envie apenas imagem ou áudio");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });

    setAttachment({
      kind: isAudio ? "audio" : "image",
      name: file.name || (isAudio ? "audio" : "imagem"),
      mimeType: file.type || (isAudio ? "audio/mpeg" : "image/jpeg"),
      dataUrl,
    });
  };

  const handleClearChat = () => {
    if (selectedAgent) {
      clearChatHistory.mutate({ agentId: selectedAgent.id, sessionId });
      setLocalMessages([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoadingAgents) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (chatEnabledAgents.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <Bot className="h-16 w-16 text-primary relative z-10" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum agente para chat
          </h3>
          <p className="text-muted-foreground max-w-md">
            Crie um agente na aba "Meus Agentes" e ative a opção "Chat Web" para testar aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card flex flex-col h-[600px]">
      {/* Header */}
      <CardHeader className="border-b border-border/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 pr-2">
                  <div 
                    className="p-1.5 rounded-md"
                    style={{ backgroundColor: `${selectedAgent?.color}20` }}
                  >
                    <Bot 
                      className="h-4 w-4" 
                      style={{ color: selectedAgent?.color }} 
                    />
                  </div>
                  <span className="font-medium">{selectedAgent?.name}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {chatEnabledAgents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent);
                      setLocalMessages([]);
                    }}
                    className="gap-2"
                  >
                    <div 
                      className="p-1.5 rounded-md"
                      style={{ backgroundColor: `${agent.color}20` }}
                    >
                      <Bot className="h-3 w-3" style={{ color: agent.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {agent.description}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {selectedAgent?.use_canned_responses !== false && cannedResponsesCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="secondary" 
                      className="gap-1.5 bg-accent/20 text-accent-foreground border-accent/30 hover:bg-accent/30 cursor-default"
                    >
                      <Zap className="h-3 w-3 text-primary" />
                      <span className="font-medium">{cannedResponsesCount}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium mb-1">Respostas Rápidas Ativas</p>
                    <p className="text-xs text-muted-foreground">
                      A IA tem acesso a {cannedResponsesCount} respostas rápidas para responder com precisão sobre preços, planos e outras informações.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={localMessages.length === 0}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {selectedAgent?.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {selectedAgent.description}
          </p>
        )}
      </CardHeader>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {localMessages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="relative mb-4">
                <div 
                  className="absolute inset-0 blur-2xl rounded-full opacity-30"
                  style={{ backgroundColor: selectedAgent?.color }}
                />
                <Sparkles className="h-10 w-10 text-primary relative z-10" />
              </div>
              <h4 className="font-medium text-foreground mb-1">
                Inicie uma conversa
              </h4>
              <p className="text-sm text-muted-foreground">
                Digite uma mensagem para conversar com {selectedAgent?.name}
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {localMessages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role === 'assistant' && (
                  <div 
                    className="shrink-0 p-2 rounded-lg h-fit"
                    style={{ backgroundColor: `${selectedAgent?.color}20` }}
                  >
                    <Bot 
                      className="h-4 w-4" 
                      style={{ color: selectedAgent?.color }} 
                    />
                  </div>
                )}
                
                <div className="flex flex-col">
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 backdrop-blur-sm",
                      message.role === 'user'
                        ? "chat-bubble-glass user"
                        : "chat-bubble-glass assistant"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p 
                      className={cn(
                        "text-xs mt-1 opacity-70"
                      )}
                    >
                      {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  
                  {/* Rating buttons for assistant messages */}
                  {message.role === 'assistant' && (
                    <div className="flex gap-1 mt-1.5 ml-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 w-6 p-0 hover:bg-green-500/20",
                          message.rating === 'up' && "bg-green-500/20 text-green-500"
                        )}
                        onClick={() => rateMessage.mutate({ 
                          messageId: message.id, 
                          rating: message.rating === 'up' ? null : 'up' 
                        })}
                        disabled={rateMessage.isPending}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 w-6 p-0 hover:bg-red-500/20",
                          message.rating === 'down' && "bg-red-500/20 text-red-500"
                        )}
                        onClick={() => rateMessage.mutate({ 
                          messageId: message.id, 
                          rating: message.rating === 'down' ? null : 'down' 
                        })}
                        disabled={rateMessage.isPending}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="shrink-0 p-2 rounded-lg bg-primary/20 h-fit">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {sendMessage.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 justify-start"
            >
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${selectedAgent?.color}20` }}
              >
                <Bot 
                  className="h-4 w-4" 
                  style={{ color: selectedAgent?.color }} 
                />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border/30 bg-background/30">
        {attachment && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Anexo: <span className="text-foreground font-medium">{attachment.name}</span>
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAttachment(null)}>
              Remover
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handlePickFile(f).catch((err) => {
                  console.error(err);
                  toast.error("Falha ao anexar arquivo");
                });
              }
              // allow picking same file again
              e.currentTarget.value = "";
            }}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendMessage.isPending}
            className="shrink-0"
          >
            Anexar
          </Button>
          <Input
            ref={inputRef}
            placeholder="Digite sua mensagem..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sendMessage.isPending}
            className="bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!inputMessage.trim() && !attachment) || sendMessage.isPending}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 px-4"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
