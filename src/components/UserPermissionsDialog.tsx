import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Settings, Eye, Edit } from "lucide-react";
import { AdminUser, UserPermissions } from "@/hooks/useAdminUsers";

interface UserPermissionsDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, permissions: Partial<UserPermissions>) => Promise<void>;
}

const permissionGroups = [
  {
    title: "Dashboard",
    permissions: [
      { key: "can_view_dashboard", label: "Visualizar Dashboard", icon: Eye },
    ],
  },
  {
    title: "Clientes",
    permissions: [
      { key: "can_view_clients", label: "Visualizar Clientes", icon: Eye },
      { key: "can_manage_clients", label: "Gerenciar Clientes", icon: Edit },
    ],
  },
  {
    title: "Contatos",
    permissions: [
      { key: "can_view_contacts", label: "Visualizar Contatos", icon: Eye },
      { key: "can_manage_contacts", label: "Gerenciar Contatos", icon: Edit },
    ],
  },
  {
    title: "WhatsApp",
    permissions: [
      { key: "can_view_whatsapp", label: "Visualizar WhatsApp", icon: Eye },
      { key: "can_manage_whatsapp", label: "Gerenciar WhatsApp", icon: Edit },
    ],
  },
  {
    title: "Disparos",
    permissions: [
      { key: "can_view_dispatches", label: "Visualizar Disparos", icon: Eye },
      { key: "can_send_dispatches", label: "Enviar Disparos", icon: Edit },
    ],
  },
  {
    title: "Campanhas",
    permissions: [
      { key: "can_view_campaigns", label: "Visualizar Campanhas", icon: Eye },
      { key: "can_manage_campaigns", label: "Gerenciar Campanhas", icon: Edit },
    ],
  },
  {
    title: "Aquecimento",
    permissions: [
      { key: "can_view_warming", label: "Visualizar Aquecimento", icon: Eye },
      { key: "can_manage_warming", label: "Gerenciar Aquecimento", icon: Edit },
    ],
  },
  {
    title: "Outros",
    permissions: [
      { key: "can_view_ai_agent", label: "Visualizar Agente IA", icon: Eye },
      { key: "can_view_settings", label: "Visualizar Configurações", icon: Eye },
      { key: "can_view_reports", label: "Visualizar Relatórios", icon: Eye },
      { key: "can_view_reseller", label: "Área de Revenda", icon: Eye },
    ],
  },
];

const defaultPermissions: UserPermissions = {
  can_view_dashboard: true,
  can_view_clients: true,
  can_manage_clients: true,
  can_view_contacts: true,
  can_manage_contacts: true,
  can_view_whatsapp: true,
  can_manage_whatsapp: true,
  can_view_dispatches: true,
  can_send_dispatches: true,
  can_view_campaigns: true,
  can_manage_campaigns: true,
  can_view_warming: true,
  can_manage_warming: true,
  can_view_ai_agent: true,
  can_view_settings: true,
  can_view_reports: true,
  can_view_reseller: false,
};

export function UserPermissionsDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: UserPermissionsDialogProps) {
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.permissions) {
      setPermissions({
        ...defaultPermissions,
        ...user.permissions,
      });
    } else {
      setPermissions(defaultPermissions);
    }
  }, [user]);

  const handleToggle = (key: string, value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    await onSave(user.id, permissions);
    setIsSaving(false);
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-primary/20 max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Permissões do Usuário
          </DialogTitle>
          <DialogDescription>
            Configure as permissões de acesso para{" "}
            <strong>{user.profile?.display_name || user.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {permissionGroups.map((group) => (
              <div key={group.title}>
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {group.title}
                </h4>
                <div className="space-y-3">
                  {group.permissions.map((perm) => {
                    const Icon = perm.icon;
                    const isEnabled = permissions[perm.key as keyof UserPermissions] ?? true;
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor={perm.key} className="cursor-pointer">
                            {perm.label}
                          </Label>
                        </div>
                        <Switch
                          id={perm.key}
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleToggle(perm.key, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-4 bg-border/30" />
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-primary/30"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-futuristic"
          >
            {isSaving ? "Salvando..." : "Salvar Permissões"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
