import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Search, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { Client } from "@/types/client";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";

interface VerificationResult {
  clientId: string;
  clientName: string;
  originalPhone: string;
  normalizedPhone: string;
  exists: boolean;
  whatsappName?: string;
}

interface VerifyClientsWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}

function normalizePhone(raw: string): string {
  // Remove all non-digit chars: (91) 98161-2105 → 9198161210 5
  let phone = raw.replace(/\D/g, "");
  // Add country code if missing
  if (!phone.startsWith("55") && phone.length <= 11) {
    phone = "55" + phone;
  }
  return phone;
}

export function VerifyClientsWhatsAppDialog({ open, onOpenChange, clients }: VerifyClientsWhatsAppDialogProps) {
  const { instances, checkNumbers } = useWhatsAppInstances();
  const connectedInstances = instances.filter(i => i.status === "connected");

  const [selectedInstance, setSelectedInstance] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const handleVerify = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância conectada");
      return;
    }
    if (clients.length === 0) {
      toast.error("Nenhum cliente para verificar");
      return;
    }

    setIsVerifying(true);
    setProgress(0);
    setResults([]);
    setHasRun(true);

    const allResults: VerificationResult[] = [];
    const batchSize = 10;

    // Prepare normalized phones
    const clientsWithPhones = clients.map(c => ({
      client: c,
      normalized: normalizePhone(c.whatsapp),
    }));

    try {
      for (let i = 0; i < clientsWithPhones.length; i += batchSize) {
        const batch = clientsWithPhones.slice(i, i + batchSize);
        const phones = batch.map(b => b.normalized);

        const batchResults = await checkNumbers(selectedInstance, phones, false);

        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const result = batchResults?.[j];
          allResults.push({
            clientId: item.client.id,
            clientName: item.client.name,
            originalPhone: item.client.whatsapp,
            normalizedPhone: item.normalized,
            exists: result?.exists ?? false,
            whatsappName: result?.whatsappName,
          });
        }

        setProgress(((i + batch.length) / clientsWithPhones.length) * 100);
        setResults([...allResults]);
      }

      const valid = allResults.filter(r => r.exists).length;
      const invalid = allResults.filter(r => !r.exists).length;
      toast.success(`Verificação concluída: ${valid} ativos, ${invalid} inativos`);
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Erro durante a verificação");
    } finally {
      setIsVerifying(false);
    }
  };

  const validResults = results.filter(r => r.exists);
  const invalidResults = results.filter(r => !r.exists);

  const exportInactive = () => {
    if (invalidResults.length === 0) return;
    const content = invalidResults.map(r => `${r.clientName} - ${r.originalPhone}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes_whatsapp_inativo.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${invalidResults.length} clientes exportados`);
  };

  const copyInactive = () => {
    if (invalidResults.length === 0) return;
    const content = invalidResults.map(r => `${r.clientName} - ${r.originalPhone}`).join("\n");
    navigator.clipboard.writeText(content);
    toast.success(`${invalidResults.length} clientes copiados`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Verificar WhatsApp dos Clientes
          </DialogTitle>
          <DialogDescription>
            Verifica se os números de WhatsApp dos seus clientes ainda estão ativos
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Instance selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Instância WhatsApp</label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância conectada" />
              </SelectTrigger>
              <SelectContent>
                {connectedInstances.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name} ({inst.phone_connected || "sem número"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {connectedInstances.length === 0 && (
              <p className="text-xs text-destructive">Nenhuma instância conectada encontrada</p>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{clients.length} clientes para verificar</span>
            {hasRun && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {validResults.length} ativos
                </Badge>
                <Badge variant="outline" className="border-destructive/50 text-destructive">
                  <XCircle className="h-3 w-3 mr-1" /> {invalidResults.length} inativos
                </Badge>
              </div>
            )}
          </div>

          {/* Progress */}
          {isVerifying && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Verificando... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Start button */}
          <Button
            onClick={handleVerify}
            disabled={isVerifying || connectedInstances.length === 0}
            className="w-full gap-2"
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isVerifying ? "Verificando..." : "Iniciar Verificação"}
          </Button>

          {/* Results */}
          {hasRun && !isVerifying && results.length > 0 && (
            <div className="space-y-3">
              {invalidResults.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={exportInactive}>
                    <Download className="h-3.5 w-3.5" />
                    Exportar Inativos
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={copyInactive}>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Inativos
                  </Button>
                </div>
              )}

              <ScrollArea className="h-[250px] rounded-lg border border-border/30">
                <div className="p-2 space-y-1">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {r.exists ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.clientName}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{r.originalPhone}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${r.exists ? "border-emerald-500/50 text-emerald-500" : "border-destructive/50 text-destructive"}`}
                      >
                        {r.exists ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
