import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Phone, RefreshCw, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  instance_key: string;
  status: string;
}

interface UazapiMessage {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  fromMe: boolean;
  timestamp: string;
}

interface InstanceChatPanelProps {
  instances: WhatsAppInstance[];
}

export function InstanceChatPanel({ instances }: InstanceChatPanelProps) {
  const { toast } = useToast();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [chatActive, setChatActive] = useState(false);
  const [messages, setMessages] = useState<UazapiMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages.length]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!selectedInstance?.instance_key || !phone) return;

    const formattedPhone = phone.replace(/\D/g, "");
    const chatId = `${formattedPhone}@s.whatsapp.net`;

    try {
      const UAZAPI_URL = "https://zynk2.uazapi.com";
      const response = await fetch(`${UAZAPI_URL}/message/find`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": selectedInstance.instance_key,
        },
        body: JSON.stringify({
          chatid: chatId,
          limit: 50,
          offset: 0,
        }),
      });

      if (!response.ok) {
        console.error("Failed to fetch messages:", await response.text());
        return;
      }

      const data = await response.json();
      const rawMessages = data.messages || data || [];

      const parsed: UazapiMessage[] = (Array.isArray(rawMessages) ? rawMessages : []).map((msg: any) => {
        const messageId = msg.key?.id || msg.id || Math.random().toString();
        const isFromMe = msg.key?.fromMe || msg.fromMe || false;

        let content: string | null = null;
        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        if (msg.message?.conversation) {
          content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          content = msg.message.imageMessage.caption || null;
          mediaType = "image";
          mediaUrl = msg.message.imageMessage.url || null;
        } else if (msg.message?.videoMessage) {
          content = msg.message.videoMessage.caption || null;
          mediaType = "video";
          mediaUrl = msg.message.videoMessage.url || null;
        } else if (msg.message?.audioMessage) {
          mediaType = "audio";
          mediaUrl = msg.message.audioMessage.url || null;
        } else if (msg.message?.documentMessage) {
          content = msg.message.documentMessage.fileName || "Documento";
          mediaType = "document";
          mediaUrl = msg.message.documentMessage.url || null;
        }

        const timestamp = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        return { id: messageId, content, mediaUrl, mediaType, fromMe: isFromMe, timestamp };
      }).filter((m: UazapiMessage) => m.content || m.mediaUrl);

      // Sort oldest first
      parsed.sort((a: UazapiMessage, b: UazapiMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setMessages(parsed);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [selectedInstance?.instance_key, phone]);

  const startChat = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || !selectedInstanceId) {
      toast({ title: "Selecione uma instância e digite um número", variant: "destructive" });
      return;
    }

    setChatActive(true);
    setIsLoadingMessages(true);
    await fetchMessages();
    setIsLoadingMessages(false);

    // Start polling every 5 seconds
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchMessages, 5000);
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !selectedInstance?.instance_key || !phone) return;

    setIsSending(true);
    setText("");

    try {
      const formattedPhone = phone.replace(/\D/g, "");
      const UAZAPI_URL = "https://zynk2.uazapi.com";

      const response = await fetch(`${UAZAPI_URL}/message/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": selectedInstance.instance_key,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: content,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Send error:", errText);
        toast({ title: "Erro ao enviar mensagem", description: errText, variant: "destructive" });
        setText(content); // restore
      } else {
        // Add optimistic message
        setMessages(prev => [...prev, {
          id: `local-${Date.now()}`,
          content,
          mediaUrl: null,
          mediaType: null,
          fromMe: true,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error("Send error:", err);
      toast({ title: "Erro ao enviar", variant: "destructive" });
      setText(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    setChatActive(false);
    setMessages([]);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const connectedInstances = instances.filter(i => i.status === "connected");

  if (!chatActive) {
    return (
      <div className="flex-1 flex items-center justify-center bg-inbox p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Chat Instância</h2>
            <p className="text-sm text-muted-foreground">
              Envie e receba mensagens diretamente por uma instância WhatsApp
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Instância</label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhuma instância conectada</SelectItem>
                  ) : (
                    connectedInstances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.instance_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Número do WhatsApp</label>
              <Input
                placeholder="5511999999999"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") startChat();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Digite o número completo com código do país (ex: 5511999999999)
              </p>
            </div>

            <Button
              className="w-full"
              onClick={startChat}
              disabled={!selectedInstanceId || !phone.replace(/\D/g, "")}
            >
              <Phone className="h-4 w-4 mr-2" />
              Iniciar Chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-inbox">
      {/* Header */}
      <header className="h-14 border-b border-border/50 bg-inbox-header flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            ← Voltar
          </Button>
          <div>
            <div className="font-semibold text-sm">{phone}</div>
            <div className="text-xs text-muted-foreground">
              via {selectedInstance?.instance_name}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchMessages} className="h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-2">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                Nenhuma mensagem encontrada. Envie uma mensagem para iniciar.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm border",
                      m.fromMe
                        ? "bg-primary/10 border-primary/20 text-foreground"
                        : "bg-card/40 border-border/30 text-foreground"
                    )}
                  >
                    {m.mediaUrl && m.mediaType === "image" && (
                      <img src={m.mediaUrl} alt="" className="rounded-lg max-w-full mb-2" />
                    )}
                    {m.mediaUrl && m.mediaType === "audio" && (
                      <audio controls src={m.mediaUrl} className="mb-2 max-w-full" />
                    )}
                    {m.content && (
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(m.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-inbox-header p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="min-h-[44px] max-h-40 bg-inbox-input"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
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
