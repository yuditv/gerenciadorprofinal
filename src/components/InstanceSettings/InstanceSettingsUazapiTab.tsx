import { useMemo, useState } from "react";
import { useWhatsAppInstances, type WhatsAppInstance, type WhatsAppInstanceStatusDetails } from "@/hooks/useWhatsAppInstances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RefreshCw, LogOut, Save, Loader2, Info } from "lucide-react";

type Props = {
  instance: WhatsAppInstance;
  onSaved?: () => void;
};

export function InstanceSettingsUazapiTab({ instance, onSaved }: Props) {
  const { checkStatus, updateInstanceName, disconnectInstance } = useWhatsAppInstances();
  const [statusLoading, setStatusLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [name, setName] = useState(instance.instance_name || instance.name);
  const [details, setDetails] = useState<WhatsAppInstanceStatusDetails | null>(null);

  const canDisconnect = useMemo(() => {
    const s = (instance.status || "").toLowerCase();
    return s === "connected" || s === "connecting";
  }, [instance.status]);

  const handleRefreshStatus = async () => {
    setStatusLoading(true);
    try {
      const data = await checkStatus(instance.id);
      const d = (data?.details ?? null) as WhatsAppInstanceStatusDetails | null;
      setDetails(d);
      onSaved?.();
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.length > 60) return;

    setRenameLoading(true);
    try {
      const ok = await updateInstanceName(instance.id, trimmed);
      if (ok) onSaved?.();
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectLoading(true);
    try {
      const ok = await disconnectInstance(instance.id);
      if (ok) onSaved?.();
    } finally {
      setDisconnectLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Status detalhado</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{instance.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Número</span>
              <span className="font-medium">{instance.phone_connected || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Perfil</span>
              <span className="font-medium">{instance.profile_name || "—"}</span>
            </div>
            {details?.lastDisconnectReason && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Última desconexão</span>
                <span className="font-medium">{details.lastDisconnectReason}</span>
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={handleRefreshStatus} disabled={statusLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
          Atualizar agora
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label htmlFor="instance-name">Nome da instância</Label>
        <div className="flex gap-2">
          <Input
            id="instance-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <Button onClick={handleRename} disabled={renameLoading || !name.trim()} className="gap-2">
            {renameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Esse nome também será atualizado na UAZAPI.</p>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">Desconectar</p>
        <p className="text-xs text-muted-foreground">
          Isso vai deslogar o WhatsApp desta instância. Você precisará reconectar via QR/pareamento.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!canDisconnect || disconnectLoading} className="gap-2">
              {disconnectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Desconectar instância
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar instância?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai deslogar o WhatsApp desta instância. Você precisará reconectar via QR/pareamento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
