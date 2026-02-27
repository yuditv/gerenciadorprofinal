import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Phone,
  PhoneOff,
  ShieldX,
  Clock,
  Copy,
  Download,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DispatchProgress } from "@/hooks/useBulkDispatch";

interface DispatchSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: DispatchProgress;
}

interface CategorizedFailure {
  category: string;
  icon: React.ReactNode;
  color: string;
  phones: string[];
}

export function DispatchSummaryDialog({
  open,
  onOpenChange,
  progress,
}: DispatchSummaryDialogProps) {
  const { successPhones, categorizedFailures, totalProcessed, successRate } =
    useMemo(() => {
      const successPhones: string[] = [];
      const failureMap: Record<string, string[]> = {
        no_whatsapp: [],
        invalid_number: [],
        connection_error: [],
        timeout: [],
        blocked: [],
        other: [],
      };

      for (const log of progress.logs) {
        // Extract phone from log messages
        const phoneMatch = log.message.match(
          /(?:✓|✗|⚠)\s*(?:\+?\d[\d\s\-().]*\d|\S+?)(?:\s*[:–—]|\s*\(|$)/
        );
        const rawPhone =
          phoneMatch?.[0]
            ?.replace(/^[✓✗⚠]\s*/, "")
            .replace(/\s*[:–—(].*$/, "")
            .trim() || "";

        if (log.type === "success" && rawPhone) {
          successPhones.push(rawPhone);
        } else if (log.type === "error" && rawPhone) {
          const msg = log.message.toLowerCase();
          if (
            msg.includes("não tem whatsapp") ||
            msg.includes("not on whatsapp") ||
            msg.includes("sem whatsapp") ||
            msg.includes("número inativo")
          ) {
            failureMap.no_whatsapp.push(rawPhone);
          } else if (
            msg.includes("número inválido") ||
            msg.includes("invalid") ||
            msg.includes("incompatível") ||
            msg.includes("formato")
          ) {
            failureMap.invalid_number.push(rawPhone);
          } else if (
            msg.includes("conexão") ||
            msg.includes("connection") ||
            msg.includes("timeout") ||
            msg.includes("tempo esgotado")
          ) {
            failureMap.connection_error.push(rawPhone);
          } else if (
            msg.includes("bloqueado") ||
            msg.includes("blocked") ||
            msg.includes("banned")
          ) {
            failureMap.blocked.push(rawPhone);
          } else {
            failureMap.other.push(rawPhone);
          }
        }
      }

      const categorizedFailures: CategorizedFailure[] = [
        {
          category: "Sem WhatsApp",
          icon: <PhoneOff className="h-4 w-4" />,
          color: "text-red-400",
          phones: failureMap.no_whatsapp,
        },
        {
          category: "Número Inválido",
          icon: <ShieldX className="h-4 w-4" />,
          color: "text-orange-400",
          phones: failureMap.invalid_number,
        },
        {
          category: "Erro de Conexão",
          icon: <Clock className="h-4 w-4" />,
          color: "text-yellow-400",
          phones: failureMap.connection_error,
        },
        {
          category: "Bloqueado",
          icon: <AlertTriangle className="h-4 w-4" />,
          color: "text-rose-400",
          phones: failureMap.blocked,
        },
        {
          category: "Outros Erros",
          icon: <XCircle className="h-4 w-4" />,
          color: "text-muted-foreground",
          phones: failureMap.other,
        },
      ].filter((c) => c.phones.length > 0);

      const totalProcessed = progress.sent + progress.failed;
      const successRate =
        totalProcessed > 0
          ? Math.round((progress.sent / totalProcessed) * 100)
          : 0;

      return { successPhones, categorizedFailures, totalProcessed, successRate };
    }, [progress.logs, progress.sent, progress.failed]);

  const copyPhones = (phones: string[]) => {
    navigator.clipboard.writeText(phones.join("\n"));
  };

  const exportSummary = () => {
    let text = `=== RESUMO DO DISPARO ===\n`;
    text += `Data: ${new Date().toLocaleString("pt-BR")}\n`;
    text += `Total: ${totalProcessed} | Enviados: ${progress.sent} | Falhas: ${progress.failed}\n`;
    text += `Taxa de sucesso: ${successRate}%\n\n`;

    if (successPhones.length > 0) {
      text += `--- ENVIADOS COM SUCESSO (${successPhones.length}) ---\n`;
      text += successPhones.join("\n") + "\n\n";
    }

    for (const cat of categorizedFailures) {
      text += `--- ${cat.category.toUpperCase()} (${cat.phones.length}) ---\n`;
      text += cat.phones.join("\n") + "\n\n";
    }

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumo-disparo-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumo do Disparo
          </DialogTitle>
          <DialogDescription>
            Detalhamento completo do disparo finalizado
          </DialogDescription>
        </DialogHeader>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-3 rounded-xl bg-muted/30 border border-border">
            <div className="text-xl font-bold">{totalProcessed}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-xl font-bold text-emerald-500">
              {progress.sent}
            </div>
            <div className="text-xs text-emerald-500/70">Enviados</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="text-xl font-bold text-destructive">
              {progress.failed}
            </div>
            <div className="text-xs text-destructive/70">Falharam</div>
          </div>
        </div>

        {/* Success Rate Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Taxa de sucesso</span>
            <span className="font-medium">{successRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                successRate >= 80
                  ? "bg-emerald-500"
                  : successRate >= 50
                  ? "bg-yellow-500"
                  : "bg-destructive"
              )}
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* Categorized Results */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pr-2">
            {/* Success Section */}
            {successPhones.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-400">
                      Enviados com Sucesso
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {successPhones.length}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => copyPhones(successPhones)}
                    title="Copiar números"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {successPhones.map((phone, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-muted-foreground flex items-center gap-1.5 py-0.5"
                    >
                      <Phone className="h-3 w-3 text-emerald-500/50" />
                      {phone}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failure Categories */}
            {categorizedFailures.map((cat) => (
              <div
                key={cat.category}
                className="rounded-xl border border-border bg-muted/10 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cat.color}>{cat.icon}</span>
                    <span className={cn("text-sm font-medium", cat.color)}>
                      {cat.category}
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      {cat.phones.length}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => copyPhones(cat.phones)}
                    title="Copiar números"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {cat.phones.map((phone, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-muted-foreground flex items-center gap-1.5 py-0.5"
                    >
                      <Phone className="h-3 w-3 opacity-40" />
                      {phone}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {categorizedFailures.length === 0 && progress.failed === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                🎉 Nenhuma falha registrada!
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            variant="secondary"
            className="flex-1 gap-2"
            onClick={exportSummary}
          >
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
