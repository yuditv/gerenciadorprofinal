import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerMessages } from "@/hooks/useCustomerMessages";
import { CustomerChatPanel } from "@/components/CustomerChat/CustomerChatPanel";

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

  if (!safeToken) return null;
  if (authLoading) return null;
  if (!user) return null;
  if (isCustomer === false) return null;

  return (
    <div className="h-screen">
      <CustomerChatPanel
        title={info ? `Chat com ${info.owner.display_name}` : "Chat"}
        messages={messages}
        isLoading={isLoading}
        isSending={isSending}
        onSend={sendMessage}
        viewer="customer"
      />
    </div>
  );
}
