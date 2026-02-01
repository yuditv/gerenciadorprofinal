import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type LinkInfo = {
  owner_id: string;
  is_active: boolean;
  expires_at: string | null;
  owner: { display_name: string; avatar_url: string | null };
};

export default function CustomerChatInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const safeToken = useMemo(() => (token ?? "").trim(), [token]);

  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!safeToken) {
      setInfo(null);
      setInfoLoading(false);
      return;
    }
    (async () => {
      try {
        setInfoLoading(true);
        const { data, error } = await supabase.functions.invoke("customer-chat-link-info", {
          body: { token: safeToken },
        });
        if (error) throw error;
        setInfo(data as LinkInfo);
      } catch (e) {
        console.error("[CustomerChatInvite] link-info failed", e);
        setInfo(null);
      } finally {
        setInfoLoading(false);
      }
    })();
  }, [safeToken]);

  const redeem = async (customerName: string) => {
    const { data, error } = await supabase.functions.invoke("customer-chat-redeem-link", {
      body: { token: safeToken, customer_name: customerName },
    });
    if (error) throw error;
    return data as { conversation_id: string; owner_id: string };
  };

  const handleSubmit = async () => {
    if (!safeToken) return;
    if (!email.trim() || !password.trim()) {
      toast({ title: "Preencha e-mail e senha" });
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast({ title: "Nome obrigatório" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // After signup user might still be logged in immediately (email confirmation depends on settings).
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          toast({
            title: "Verifique seu e-mail",
            description: "Confirme o cadastro para entrar no chat.",
          });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

      const customerName = mode === "signup" ? name.trim() : name.trim();
      if (!customerName) {
        toast({ title: "Informe seu nome" });
        return;
      }

      await redeem(customerName);
      navigate(`/c/${safeToken}/chat`);
    } catch (e: any) {
      console.error("[CustomerChatInvite] submit failed", e);
      toast({
        title: "Erro",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already logged in, allow going straight to chat (customer route will handle non-customer)
  const handleEnterChat = () => {
    navigate(`/c/${safeToken}/chat`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <main className="w-full max-w-lg">
        <Card className="bg-card/40">
          <CardHeader>
            <CardTitle>
              {infoLoading
                ? "Carregando..."
                : info
                ? `Chat com ${info.owner.display_name}`
                : "Link inválido"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!safeToken ? (
              <div className="text-sm text-muted-foreground">Token ausente.</div>
            ) : infoLoading ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : !info ? (
              <div className="text-sm text-muted-foreground">Este link não está disponível.</div>
            ) : (
              <>
                {authLoading ? (
                  <div className="h-10 rounded-md bg-muted animate-pulse" />
                ) : user ? (
                  <Button className="w-full" onClick={handleEnterChat}>
                    Entrar no chat
                  </Button>
                ) : (
                  <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="signup">Criar conta</TabsTrigger>
                      <TabsTrigger value="signin">Entrar</TabsTrigger>
                    </TabsList>

                    <TabsContent value="signup" className="space-y-3">
                      <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
                      <Input
                        placeholder="Seu e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                      />
                      <Input
                        placeholder="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                      />
                      <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Aguarde..." : "Criar e entrar"}
                      </Button>
                    </TabsContent>

                    <TabsContent value="signin" className="space-y-3">
                      <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
                      <Input
                        placeholder="Seu e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                      />
                      <Input
                        placeholder="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                      />
                      <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Aguarde..." : "Entrar"}
                      </Button>
                    </TabsContent>
                  </Tabs>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
