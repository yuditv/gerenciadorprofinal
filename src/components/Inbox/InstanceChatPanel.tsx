import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RefreshCw, Smartphone, Loader2, Search, ArrowLeft, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const UAZAPI_URL = "https://zynk2.uazapi.com";
const INSTANCE_TOKEN = "1c173ba3-f126-47e1-8f96-f9c857c16e90";

interface UazapiChat {
  id: string;
  phone: string;
  name: string;
  image?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isGroup?: boolean;
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
  instances: any[];
}

export function InstanceChatPanel({ instances }: InstanceChatPanelProps) {
  const { toast } = useToast();
  const [chats, setChats] = useState<UazapiChat[]>([]);
  const [filteredChats, setFilteredChats] = useState<UazapiChat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<UazapiChat | null>(null);
  const [messages, setMessages] = useState<UazapiMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Filter chats by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredChats(chats.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q)
      ));
    }
  }, [searchQuery, chats]);

  // Fetch all chats from UAZAPI on mount
  const fetchChats = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      // Try /chat/list endpoint
      const response = await fetch(`${UAZAPI_URL}/chat/list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": INSTANCE_TOKEN,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        console.error("Chat list error:", await response.text());
        toast({ title: "Erro ao carregar conversas", variant: "destructive" });
        setIsLoadingChats(false);
        return;
      }

      const data = await response.json();
      const rawChats = Array.isArray(data) ? data : (data.chats || data.data || []);

      const parsed: UazapiChat[] = rawChats.map((chat: any) => {
        const chatId = chat.id || chat.chatid || chat.jid || "";
        const phone = chatId.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const isGroup = chatId.includes("@g.us");
        const name = chat.name || chat.wa_name || chat.pushName || chat.contact?.name || phone;
        const image = chat.image || chat.imagePreview || chat.profilePicture || null;
        const lastMsg = chat.lastMessage?.conversation ||
          chat.lastMessage?.extendedTextMessage?.text ||
          chat.wa_lastMessageTextVote ||
          chat.lastMessageText ||
          "";
        const lastTime = chat.wa_lastMsgTimestamp
          ? new Date(Number(chat.wa_lastMsgTimestamp) * 1000).toISOString()
          : chat.lastMessageTime || null;
        const unread = chat.wa_unreadCount || chat.unreadCount || 0;

        return {
          id: chatId,
          phone,
          name,
          image,
          lastMessage: lastMsg,
          lastMessageTime: lastTime,
          unreadCount: unread,
          isGroup,
        };
      });

      // Sort by last message time (most recent first)
      parsed.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setChats(parsed);
    } catch (err) {
      console.error("Error fetching chats:", err);
      toast({ title: "Erro ao carregar conversas", variant: "destructive" });
    } finally {
      setIsLoadingChats(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const fetchMessages = useCallback(async (chatId?: string) => {
    const targetChatId = chatId || selectedChat?.id;
    if (!targetChatId) return;

    try {
      const response = await fetch(`${UAZAPI_URL}/message/find`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": INSTANCE_TOKEN,
        },
        body: JSON.stringify({
          chatid: targetChatId,
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

      parsed.sort((a: UazapiMessage, b: UazapiMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(parsed);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [selectedChat?.id]);

  const selectChat = async (chat: UazapiChat) => {
    setSelectedChat(chat);
    setMessages([]);
    setIsLoadingMessages(true);

    // Stop old polling
    if (pollingRef.current) clearInterval(pollingRef.current);

    await fetchMessages(chat.id);
    setIsLoadingMessages(false);

    // Start polling
    pollingRef.current = setInterval(() => fetchMessages(chat.id), 5000);
  };

  const startNewChat = () => {
    const cleanPhone = newPhone.replace(/\D/g, "");
    if (!cleanPhone) return;

    const chatId = `${cleanPhone}@s.whatsapp.net`;
    const newChat: UazapiChat = {
      id: chatId,
      phone: cleanPhone,
      name: cleanPhone,
    };

    selectChat(newChat);
    setNewPhone("");
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !selectedChat) return;

    setIsSending(true);
    setText("");

    try {
      const response = await fetch(`${UAZAPI_URL}/message/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": INSTANCE_TOKEN,
        },
        body: JSON.stringify({
          phone: selectedChat.phone,
          message: content,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        toast({ title: "Erro ao enviar", description: errText, variant: "destructive" });
        setText(content);
      } else {
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
    setSelectedChat(null);
    setMessages([]);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {/* Chat List Sidebar */}
      <div className={cn(
        "w-80 border-r border-border/50 flex flex-col bg-inbox-sidebar shrink-0",
        selectedChat ? "hidden md:flex" : "flex flex-1 md:flex-none"
      )}>
        {/* Header */}
        <div className="p-3 border-b border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Chat Instância</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchChats} disabled={isLoadingChats}>
              <RefreshCw className={cn("h-3.5 w-3.5", isLoadingChats && "animate-spin")} />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-inbox-input"
            />
          </div>

          {/* New chat */}
          <div className="flex gap-1.5">
            <Input
              placeholder="Novo chat: 5511..."
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="h-8 text-sm bg-inbox-input"
              onKeyDown={e => { if (e.key === "Enter") startNewChat(); }}
            />
            <Button size="sm" className="h-8 shrink-0" onClick={startNewChat} disabled={!newPhone.replace(/\D/g, "")}>
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Chat list */}
        <ScrollArea className="flex-1">
          {isLoadingChats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12 px-4">
              {searchQuery ? "Nenhuma conversa encontrada" : "Nenhuma conversa"}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => selectChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors",
                    selectedChat?.id === chat.id && "bg-primary/10"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={chat.image || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {chat.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{chat.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(chat.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {chat.lastMessage || chat.phone}
                      </span>
                      {(chat.unreadCount || 0) > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 h-4 shrink-0">
                          {chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Panel */}
      <div className={cn(
        "flex-1 min-w-0 flex flex-col",
        selectedChat ? "flex" : "hidden md:flex"
      )}>
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center bg-inbox">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm">Selecione uma conversa para começar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <header className="h-14 border-b border-border/50 bg-inbox-header flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedChat.image || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {selectedChat.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm">{selectedChat.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedChat.phone}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => fetchMessages()} className="h-8 w-8">
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
                      Nenhuma mensagem. Envie uma para iniciar.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2 text-sm border",
                          m.fromMe
                            ? "bg-primary/10 border-primary/20 text-foreground"
                            : "bg-card/40 border-border/30 text-foreground"
                        )}>
                          {m.mediaUrl && m.mediaType === "image" && (
                            <img src={m.mediaUrl} alt="" className="rounded-lg max-w-full mb-2" />
                          )}
                          {m.mediaUrl && m.mediaType === "audio" && (
                            <audio controls src={m.mediaUrl} className="mb-2 max-w-full" />
                          )}
                          {m.mediaUrl && m.mediaType === "video" && (
                            <video controls src={m.mediaUrl} className="rounded-lg max-w-full mb-2" />
                          )}
                          {m.content && (
                            <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(m.timestamp).toLocaleString("pt-BR")}
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
                <Button onClick={handleSend} disabled={isSending || !text.trim()} className="h-10 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
