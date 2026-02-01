import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerMessages } from "@/hooks/useCustomerMessages";
import { Send, Wifi, Shield, Globe, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import customerChatBg from "@/assets/customer-chat-bg.jpg";

type LinkInfo = {
  owner_id: string;
  is_active: boolean;
  expires_at: string | null;
  owner: { display_name: string; avatar_url: string | null };
};

export default function CustomerChatRoom() {
  const { token } = useParams();
  const safeToken = useMemo(() => (token ?? "").trim(), [token]);
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isCustomer, setIsCustomer] = useState<boolean | null>(null);
  const [text, setText] = useState("");

  const { messages, isLoading, isSending, sendMessage } = useCustomerMessages(
    conversationId,
    "customer",
    info && user ? { owner_id: info.owner_id, customer_user_id: user.id } : null
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/c/${safeToken}`);
      return;
    }
  }, [authLoading, user, navigate, safeToken]);

  // Fetch link info + resolve conversation for this customer
  useEffect(() => {
    if (!safeToken) return;
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("customer-chat-link-info", {
          body: { token: safeToken },
        });
        if (error) throw error;
        const linkInfo = data as LinkInfo;
        setInfo(linkInfo);

        // Is this user a customer? (customers will have a conversation row)
        const { data: conv, error: convError } = await supabase
          .from("customer_conversations")
          .select("id")
          .eq("owner_id", linkInfo.owner_id)
          .eq("customer_user_id", user.id)
          .maybeSingle();
        if (convError) throw convError;

        if (!conv?.id) {
          setIsCustomer(false);
          navigate("/");
          return;
        }
        setIsCustomer(true);
        setConversationId(conv.id);
      } catch (e) {
        console.error("[CustomerChatRoom] init failed", e);
        setInfo(null);
      }
    })();
  }, [safeToken, user, navigate]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    await sendMessage(content);
  };

  if (!safeToken) return null;
  if (authLoading) return null;
  if (!user) return null;
  if (isCustomer === false) return null;

  return (
    <div 
      className="h-screen w-full flex flex-col relative overflow-hidden"
      style={{
        backgroundImage: `url(${customerChatBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Futuristic Header */}
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="shrink-0 border-b border-cyan-500/30 bg-black/40 backdrop-blur-md"
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                  <Tv className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-black animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg">
                  {info ? info.owner.display_name : "Carregando..."}
                </h1>
                <p className="text-xs text-cyan-400 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Conexão Segura
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30">
                <Wifi className="h-3 w-3" />
                VPN
              </div>
              <div className="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full border border-cyan-500/30">
                <Globe className="h-3 w-3" />
                IPTV
              </div>
            </div>
          </div>
        </motion.header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="h-12 rounded-xl bg-white/5 animate-pulse" 
                  />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-16"
              >
                <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/30">
                  <Tv className="h-10 w-10 text-cyan-400" />
                </div>
                <p className="text-white/60 text-sm">Inicie uma conversa</p>
                <p className="text-cyan-400/60 text-xs mt-1">Internet Ilimitada • VPN Premium</p>
              </motion.div>
            ) : (
              messages.map((m, index) => {
                const mine = m.sender_type === "customer";
                return (
                  <motion.div 
                    key={m.id} 
                    initial={{ opacity: 0, x: mine ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm backdrop-blur-sm",
                        mine
                          ? "bg-gradient-to-r from-cyan-500/80 to-purple-500/80 text-white border border-cyan-400/30"
                          : "bg-white/10 text-white border border-white/20"
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      <div className={cn(
                        "text-[10px] mt-1",
                        mine ? "text-cyan-200/70" : "text-white/50"
                      )}>
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="shrink-0 border-t border-cyan-500/30 bg-black/60 backdrop-blur-md p-3"
        >
          <div className="flex gap-2 items-end">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="min-h-[44px] max-h-40 bg-white/10 border-cyan-500/30 text-white placeholder:text-white/40 focus:border-cyan-400 focus:ring-cyan-400/30 resize-none"
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
              className="h-11 px-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 border-0 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-cyan-400/50 mt-2">
            🔒 Mensagens criptografadas • Internet Ilimitada VPN
          </p>
        </motion.div>
      </div>
    </div>
  );
}
