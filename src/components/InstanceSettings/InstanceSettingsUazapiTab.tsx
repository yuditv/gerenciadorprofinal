import { useMemo, useState } from "react";
import { useWhatsAppInstances, type WhatsAppInstance, type WhatsAppInstanceStatusDetails } from "@/hooks/useWhatsAppInstances";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { RefreshCw, LogOut, Save, Loader2, Info, Radio, Upload, User, Trash2 } from "lucide-react";

type Props = {
  instance: WhatsAppInstance;
  onSaved?: () => void;
};

export function InstanceSettingsUazapiTab({ instance, onSaved }: Props) {
  const { checkStatus, updateInstanceName, updateProfileName, updateProfileImage, disconnectInstance, setInstancePresence } = useWhatsAppInstances();
  const [statusLoading, setStatusLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [profileNameLoading, setProfileNameLoading] = useState(false);
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [name, setName] = useState(instance.instance_name || instance.name);
  const [profileName, setProfileName] = useState(instance.profile_name || "");
  const [imagePreview, setImagePreview] = useState<string | null>(instance.profile_picture_url);
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

  const handleTogglePresence = async () => {
    setPresenceLoading(true);
    try {
      const newPresence = instance.presence_status === 'available' ? 'unavailable' : 'available';
      await setInstancePresence(instance.id, newPresence);
      onSaved?.();
    } finally {
      setPresenceLoading(false);
    }
  };

  const handleUpdateProfileName = async () => {
    const trimmed = profileName.trim();
    if (!trimmed) return;
    if (trimmed.length > 100) {
      toast.error("Nome do perfil deve ter no máximo 100 caracteres");
      return;
    }

    setProfileNameLoading(true);
    try {
      const ok = await updateProfileName(instance.id, trimmed);
      if (ok) onSaved?.();
    } finally {
      setProfileNameLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setProfileImageLoading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setImagePreview(base64);
        
        // Send to UAZAPI
        const ok = await updateProfileImage(instance.id, base64);
        if (ok) onSaved?.();
        setProfileImageLoading(false);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler a imagem");
        setProfileImageLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Image upload error:", error);
      setProfileImageLoading(false);
    }
  };

  const handleRemoveImage = async () => {
    setProfileImageLoading(true);
    try {
      const ok = await updateProfileImage(instance.id, "remove");
      if (ok) {
        setImagePreview(null);
        onSaved?.();
      }
    } finally {
      setProfileImageLoading(false);
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

      {/* Profile Name */}
      <div className="space-y-3">
        <Label htmlFor="profile-name">Nome do perfil no WhatsApp</Label>
        <div className="flex gap-2">
          <Input
            id="profile-name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Ex: Minha Empresa - Atendimento"
            maxLength={100}
          />
          <Button onClick={handleUpdateProfileName} disabled={profileNameLoading || !profileName.trim()} className="gap-2">
            {profileNameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Nome que aparece no perfil do WhatsApp para todos os contatos.
        </p>
      </div>

      <Separator />

      {/* Profile Image */}
      <div className="space-y-3">
        <Label>Foto do perfil no WhatsApp</Label>
        <div className="flex items-start gap-4">
          <Avatar className="h-24 w-24 border-2 border-muted">
            {imagePreview ? (
              <AvatarImage src={imagePreview} alt="Profile" />
            ) : (
              <AvatarFallback>
                <User className="h-12 w-12 text-muted-foreground" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => document.getElementById("profile-image-upload")?.click()}
                disabled={profileImageLoading}
                className="gap-2"
              >
                {profileImageLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Alterar foto
              </Button>
              {imagePreview && (
                <Button
                  variant="outline"
                  onClick={handleRemoveImage}
                  disabled={profileImageLoading}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: JPEG, PNG. Tamanho recomendado: 640×640 pixels.
            </p>
            <input
              id="profile-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Presence Control */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Status de Presença</p>
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="flex-1">
            <p className="font-medium">
              {instance.presence_status === 'available' ? 'Online' : 'Offline'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {instance.presence_status === 'available' 
                ? 'Instância aparece como disponível/online no WhatsApp' 
                : 'Instância aparece como indisponível/offline no WhatsApp'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={instance.presence_status === 'available'}
              onCheckedChange={handleTogglePresence}
              disabled={presenceLoading}
            />
            {presenceLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
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
