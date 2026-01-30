 import { useState } from "react";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Button } from "@/components/ui/button";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { Eye, EyeOff, CreditCard, Shield, Check, AlertCircle } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { useAuth } from "@/hooks/useAuth";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 
 export function CredentialsSettings() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
   const [showToken, setShowToken] = useState(false);
   const [accessToken, setAccessToken] = useState("");
 
   // Fetch existing credentials
   const { data: credentials, isLoading } = useQuery({
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
 
   // Save/update mutation
   const saveMutation = useMutation({
     mutationFn: async (token: string) => {
       if (!user?.id) throw new Error("Usuário não autenticado");
       if (!token.trim()) throw new Error("Token não pode estar vazio");
 
       // Store token (Edge Function uses service role to decrypt/access)
       const { error } = await supabase
         .from("user_payment_credentials")
         .upsert({
           user_id: user.id,
           mercado_pago_access_token_enc: token,
           updated_at: new Date().toISOString(),
         });
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["payment-credentials"] });
       toast.success("Credenciais salvas com sucesso!");
       setAccessToken("");
     },
     onError: (error: Error) => {
       console.error("Error saving credentials:", error);
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
       console.error("Error deleting credentials:", error);
       toast.error(`Erro ao remover: ${error.message}`);
     },
   });
 
   const handleSave = () => {
     if (!accessToken.trim()) {
       toast.error("Por favor, insira o Access Token");
       return;
     }
     saveMutation.mutate(accessToken);
   };
 
   const isConfigured = !!credentials;
 
   return (
     <div className="space-y-6 max-w-2xl">
       <div>
         <h2 className="text-2xl font-bold">Credenciais</h2>
         <p className="text-muted-foreground mt-1">
           Configure suas credenciais do Mercado Pago para gerar PIX na sua conta
         </p>
       </div>
 
       {/* Info Alert */}
       <Alert className="border-primary/20 bg-primary/5">
         <Shield className="h-4 w-4 text-primary" />
         <AlertDescription>
           Seus dados são armazenados de forma segura e criptografada. Nunca compartilhe seu Access Token com terceiros.
         </AlertDescription>
       </Alert>
 
       {/* Mercado Pago Card */}
       <Card>
         <CardHeader>
           <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
               <CreditCard className="h-5 w-5 text-blue-500" />
             </div>
             <div>
               <CardTitle>Mercado Pago</CardTitle>
               <CardDescription>
                 Usado para gerar PIX para seus clientes
               </CardDescription>
             </div>
             {isConfigured && (
               <div className="ml-auto">
                 <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
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
                 <Label htmlFor="mp-token">Access Token</Label>
                 <div className="relative">
                   <Input
                     id="mp-token"
                     type={showToken ? "text" : "password"}
                     value={accessToken}
                     onChange={(e) => setAccessToken(e.target.value)}
                     placeholder="APP_USR-xxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxx"
                     className="pr-10"
                   />
                   <button
                     type="button"
                     onClick={() => setShowToken(!showToken)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                   >
                     {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </button>
                 </div>
                 <p className="text-xs text-muted-foreground">
                   Encontre em: Mercado Pago → Seu negócio → Configurações → Credenciais
                 </p>
               </div>
 
               <Button
                 onClick={handleSave}
                 disabled={saveMutation.isPending || !accessToken.trim()}
                 className="w-full"
               >
                 {saveMutation.isPending ? "Salvando..." : "Salvar Credenciais"}
               </Button>
             </>
           ) : (
             <div className="space-y-4">
               <div className="rounded-lg border bg-muted/30 p-4">
                 <div className="flex items-start gap-3">
                   <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                   <div>
                     <p className="text-sm font-medium">Credenciais configuradas</p>
                     <p className="text-xs text-muted-foreground mt-1">
                       PIX gerados para clientes serão creditados na sua conta Mercado Pago
                     </p>
                     <p className="text-xs text-muted-foreground mt-2">
                       Última atualização: {new Date(credentials.updated_at).toLocaleString("pt-BR")}
                     </p>
                   </div>
                 </div>
               </div>
 
               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   onClick={() => setAccessToken("***")}
                   className="flex-1"
                 >
                   Atualizar Token
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
 
               {accessToken && (
                 <div className="space-y-2 pt-2 border-t">
                   <Label htmlFor="mp-token-update">Novo Access Token</Label>
                   <div className="relative">
                     <Input
                       id="mp-token-update"
                       type={showToken ? "text" : "password"}
                       value={accessToken}
                       onChange={(e) => setAccessToken(e.target.value)}
                       placeholder="APP_USR-xxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxx"
                       className="pr-10"
                     />
                     <button
                       type="button"
                       onClick={() => setShowToken(!showToken)}
                       className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                     >
                       {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                     </button>
                   </div>
                   <Button
                     onClick={handleSave}
                     disabled={saveMutation.isPending || !accessToken.trim()}
                     className="w-full"
                   >
                     {saveMutation.isPending ? "Salvando..." : "Salvar Novo Token"}
                   </Button>
                 </div>
               )}
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }