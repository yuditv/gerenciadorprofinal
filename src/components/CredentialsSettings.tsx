import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, Shield, Check, AlertCircle, Eye, EyeOff, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiCredentialsPanel } from "@/components/ApiCredentials/ApiCredentialsPanel";
import { Separator } from "@/components/ui/separator";

export function CredentialsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [handleValue, setHandleValue] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [showMpToken, setShowMpToken] = useState(false);

  // Fetch existing credentials
  const { data: credentials } = useQuery({
    queryKey: ["payment-credentials", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_payment_credentials")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // InfinitePay save
  const saveHandleMutation = useMutation({
    mutationFn: async (handle: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("user_payment_credentials")
        .upsert({
          user_id: user.id,
          mercado_pago_access_token_enc: (credentials as any)?.mercado_pago_access_token_enc || "",
          infinitepay_handle: handle.trim(),
          updated_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
      toast.success("Handle InfinitePay salvo!");
      setHandleValue("");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Mercado Pago save
  const saveMpMutation = useMutation({
    mutationFn: async (token: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("user_payment_credentials")
        .upsert({
          user_id: user.id,
          mercado_pago_access_token_enc: token.trim(),
          infinitepay_handle: (credentials as any)?.infinitepay_handle || "",
          updated_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
      toast.success("Access Token do Mercado Pago salvo!");
      setMpToken("");
      setShowMpToken(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Delete specific credential field
  const deleteHandleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const mpTokenValue = (credentials as any)?.mercado_pago_access_token_enc || "";
      if (mpTokenValue) {
        // Keep MP token, just clear handle
        const { error } = await supabase
          .from("user_payment_credentials")
          .update({ infinitepay_handle: null, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // No MP token either, delete the row
        const { error } = await supabase
          .from("user_payment_credentials")
          .delete()
          .eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
      toast.success("Handle InfinitePay removido!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const deleteMpMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const handleVal = (credentials as any)?.infinitepay_handle || "";
      if (handleVal) {
        const { error } = await supabase
          .from("user_payment_credentials")
          .update({ mercado_pago_access_token_enc: null, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_payment_credentials")
          .delete()
          .eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
      toast.success("Token Mercado Pago removido!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const handleSaveHandle = () => {
    if (!handleValue.trim()) {
      toast.error("Por favor, insira o Handle InfinitePay");
      return;
    }
    saveHandleMutation.mutate(handleValue);
  };

  const handleSaveMp = () => {
    if (!mpToken.trim()) {
      toast.error("Por favor, insira o Access Token do Mercado Pago");
      return;
    }
    saveMpMutation.mutate(mpToken);
  };

  const isHandleConfigured = !!(credentials as any)?.infinitepay_handle;
  const isMpConfigured = !!(credentials as any)?.mercado_pago_access_token_enc;

  const maskedMpToken = (credentials as any)?.mercado_pago_access_token_enc
    ? `${((credentials as any).mercado_pago_access_token_enc as string).slice(0, 12)}${"•".repeat(16)}${((credentials as any).mercado_pago_access_token_enc as string).slice(-4)}`
    : "";

  return (
    <div className="space-y-8">
      {/* API Credentials Section */}
      <ApiCredentialsPanel />

      <Separator />

      {/* Payment Section */}
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Pagamento
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure suas credenciais de pagamento
          </p>
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription>
            Suas credenciais de pagamento são usadas para gerar cobranças diretamente para seus clientes.
          </AlertDescription>
        </Alert>

        {/* Mercado Pago Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <CardTitle>Mercado Pago</CardTitle>
                <CardDescription>Gere cobranças PIX via Mercado Pago</CardDescription>
              </div>
              {isMpConfigured && (
                <div className="ml-auto">
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-500/10 px-3 py-1.5 rounded-full">
                    <Check className="h-4 w-4" />
                    Configurado
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isMpConfigured ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mp-token">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="mp-token"
                      type={showMpToken ? "text" : "password"}
                      value={mpToken}
                      onChange={(e) => setMpToken(e.target.value)}
                      placeholder="APP_USR-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowMpToken(!showMpToken)}
                    >
                      {showMpToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Mercado Pago → Seu Negócio → Configurações → Credenciais de Produção → Access Token
                  </p>
                </div>
                <Button onClick={handleSaveMp} disabled={saveMpMutation.isPending || !mpToken.trim()} className="w-full">
                  {saveMpMutation.isPending ? "Salvando..." : "Salvar Access Token"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Access Token configurado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Token: <code className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{maskedMpToken}</code>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cobranças PIX serão geradas pela sua conta Mercado Pago
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Última atualização: {new Date((credentials as any)?.updated_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setMpToken(""); setShowMpToken(false); setMpToken((credentials as any)?.mercado_pago_access_token_enc || ""); }} className="flex-1">
                    Atualizar Token
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja remover o Access Token do Mercado Pago?")) {
                        deleteMpMutation.mutate();
                      }
                    }}
                    disabled={deleteMpMutation.isPending}
                  >
                    {deleteMpMutation.isPending ? "Removendo..." : "Remover"}
                  </Button>
                </div>
                {mpToken && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="mp-token-update">Novo Access Token</Label>
                    <div className="relative">
                      <Input
                        id="mp-token-update"
                        type={showMpToken ? "text" : "password"}
                        value={mpToken}
                        onChange={(e) => setMpToken(e.target.value)}
                        placeholder="APP_USR-..."
                        className="pr-10 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowMpToken(!showMpToken)}
                      >
                        {showMpToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={handleSaveMp} disabled={saveMpMutation.isPending || !mpToken.trim()} className="w-full">
                      {saveMpMutation.isPending ? "Salvando..." : "Salvar Novo Token"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* InfinitePay Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>InfinitePay</CardTitle>
                <CardDescription>Usado para gerar cobranças por cartão de crédito</CardDescription>
              </div>
              {isHandleConfigured && (
                <div className="ml-auto">
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-500/10 px-3 py-1.5 rounded-full">
                    <Check className="h-4 w-4" />
                    Configurado
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isHandleConfigured ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ip-handle">Handle InfinitePay</Label>
                  <Input
                    id="ip-handle"
                    type="text"
                    value={handleValue}
                    onChange={(e) => setHandleValue(e.target.value)}
                    placeholder="ex: lucas-renda"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: InfinitePay → Perfil → seu nome de usuário (handle)
                  </p>
                </div>
                <Button onClick={handleSaveHandle} disabled={saveHandleMutation.isPending || !handleValue.trim()} className="w-full">
                  {saveHandleMutation.isPending ? "Salvando..." : "Salvar Handle"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Handle configurado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Handle: <span className="font-mono font-medium">{(credentials as any)?.infinitepay_handle}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cobranças serão creditadas na sua conta InfinitePay
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Última atualização: {new Date((credentials as any)?.updated_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setHandleValue((credentials as any)?.infinitepay_handle || "")} className="flex-1">
                    Atualizar Handle
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja remover o Handle InfinitePay?")) {
                        deleteHandleMutation.mutate();
                      }
                    }}
                    disabled={deleteHandleMutation.isPending}
                  >
                    {deleteHandleMutation.isPending ? "Removendo..." : "Remover"}
                  </Button>
                </div>
                {handleValue && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="ip-handle-update">Novo Handle</Label>
                    <Input
                      id="ip-handle-update"
                      type="text"
                      value={handleValue}
                      onChange={(e) => setHandleValue(e.target.value)}
                      placeholder="ex: lucas-renda"
                    />
                    <Button onClick={handleSaveHandle} disabled={saveHandleMutation.isPending || !handleValue.trim()} className="w-full">
                      {saveHandleMutation.isPending ? "Salvando..." : "Salvar Novo Handle"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
