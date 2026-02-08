import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, Shield, Check, AlertCircle } from "lucide-react";
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

  const saveMutation = useMutation({
    mutationFn: async (handle: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("user_payment_credentials")
        .upsert({
          user_id: user.id,
          mercado_pago_access_token_enc: "",
          infinitepay_handle: handle.trim(),
          updated_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
      toast.success("Credenciais salvas com sucesso!");
      setHandleValue("");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("user_payment_credentials")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
      toast.success("Credenciais removidas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!handleValue.trim()) {
      toast.error("Por favor, insira o Handle InfinitePay");
      return;
    }
    saveMutation.mutate(handleValue);
  };

  const isConfigured = !!(credentials as any)?.infinitepay_handle;

  return (
    <div className="space-y-8">
      {/* API Credentials Section */}
      <ApiCredentialsPanel />

      <Separator />

      {/* InfinitePay Section */}
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold">Pagamento</h2>
          <p className="text-muted-foreground mt-1">
            Configure seu Handle InfinitePay para gerar cobranças
          </p>
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription>
            O Handle é seu nome de usuário na InfinitePay (ex: lucas-renda). Não é necessário API Key.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle>InfinitePay</CardTitle>
                <CardDescription>Usado para gerar cobranças para seus clientes</CardDescription>
              </div>
              {isConfigured && (
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
            {!isConfigured ? (
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
                <Button onClick={handleSave} disabled={saveMutation.isPending || !handleValue.trim()} className="w-full">
                  {saveMutation.isPending ? "Salvando..." : "Salvar Handle"}
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
                      if (confirm("Tem certeza que deseja remover suas credenciais?")) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Removendo..." : "Remover"}
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
                    <Button onClick={handleSave} disabled={saveMutation.isPending || !handleValue.trim()} className="w-full">
                      {saveMutation.isPending ? "Salvando..." : "Salvar Novo Handle"}
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
