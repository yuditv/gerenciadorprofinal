import { useMemo, useState } from "react";
import { RefreshCw, Copy, Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VPNTestForm } from "@/components/Inbox/VPNTest/VPNTestForm";
import { VPNTestFields } from "@/components/Inbox/VPNTest/VPNTestFields";
import type { VPNTestResult, VPNTestFormValues } from "@/components/Inbox/VPNTest/types";
import { generateOfflineValues, normalizeNumberish } from "@/components/Inbox/VPNTest/utils";

interface VPNTestGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VPNTestGeneratorDialog({ open, onOpenChange }: VPNTestGeneratorDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VPNTestResult | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const defaultValues = useMemo<VPNTestFormValues>(() => generateOfflineValues({
    categoryId: 1,
    connectionLimit: 1,
    minutes: 60,
    v2rayEnabled: true,
    ownerId: 1,
  }), []);

  const [formValues, setFormValues] = useState<VPNTestFormValues>(defaultValues);

  const generateTest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('vpn-test-generator');
      
      if (fnError) {
        throw new Error(fnError.message);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      console.log("🔍 VPN API Response:", JSON.stringify(data, null, 2));
      setRawResponse(data);

      const next: VPNTestResult = {
        mode: "api",
        values: {
          ...formValues,
          username: String(data.username ?? formValues.username).slice(0, 20),
          password: String(data.password ?? formValues.password).slice(0, 20),
          categoryId: normalizeNumberish(data.category_id ?? formValues.categoryId, formValues.categoryId),
          connectionLimit: normalizeNumberish(data.connection_limit ?? formValues.connectionLimit, formValues.connectionLimit),
          minutes: normalizeNumberish(data.duration ?? formValues.minutes, formValues.minutes),
          v2rayEnabled: formValues.v2rayEnabled,
          v2rayUuid: String(data.v2ray_uuid ?? formValues.v2rayUuid),
        },
        raw: data,
      };

      setResult(next);
    } catch (err) {
      console.error("Erro ao gerar teste VPN:", err);

      const message = err instanceof Error ? err.message : String(err);
      const shouldFallbackOffline = /403|just a moment|cloudflare/i.test(message);

      if (shouldFallbackOffline) {
        const offline = generateOfflineValues(formValues);
        setResult({ mode: "offline", values: offline });
        setRawResponse({ offline: true, values: offline });
        setError("Servex bloqueou a requisição (Cloudflare). Geramos os dados offline para você copiar e criar no painel manualmente.");
      } else {
        setError("Erro ao gerar teste. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyField = async (label: string, value: string) => {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        toast({ 
          title: "Copiado!", 
          description: `${label} copiado para a área de transferência` 
        });
      } catch (err) {
        toast({ 
          title: "Erro ao copiar", 
          description: "Não foi possível copiar para a área de transferência",
          variant: "destructive"
        });
      }
    }
  };

  const copyAll = async () => {
    if (rawResponse) {
      const formattedText = JSON.stringify(rawResponse, null, 2);
      try {
        await navigator.clipboard.writeText(formattedText);
        toast({ 
          title: "Copiado!", 
          description: "Todos os dados foram copiados" 
        });
      } catch (err) {
        toast({ 
          title: "Erro ao copiar", 
          description: "Não foi possível copiar para a área de transferência",
          variant: "destructive"
        });
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResult(null);
      setRawResponse(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Gerar Teste VPN / Internet Ilimitada
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <Button 
            onClick={generateTest} 
            disabled={isLoading}
            className="w-full shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Novo Teste
              </>
            )}
          </Button>
          
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm shrink-0">
              {error}
            </div>
          )}

          <div className="rounded-lg border bg-card p-4 shrink-0">
            <VPNTestForm values={formValues} onChange={setFormValues} />
          </div>
          
          {result && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 pr-4">
                <VPNTestFields
                  username={result.values.username}
                  password={result.values.password}
                  connectionLimit={result.values.connectionLimit}
                  minutes={result.values.minutes}
                  v2rayEnabled={result.values.v2rayEnabled}
                  v2rayUuid={result.values.v2rayUuid}
                  onCopy={copyField}
                />
              </div>
            </ScrollArea>
          )}
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 shrink-0 border-t mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
          {rawResponse && (
            <Button onClick={copyAll} variant="default">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Tudo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
