import { useState } from "react";
import { useWhatsAppProviders, ProviderType } from "@/hooks/useWhatsAppProviders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Star, Globe, Key, Server, Loader2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

const providerLabels: Record<ProviderType, string> = {
  uazapi: "UAZAPI",
  evolution: "Evolution API",
  waha: "WAHA",
  custom: "Personalizado",
};

const providerColors: Record<ProviderType, string> = {
  uazapi: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  evolution: "bg-green-500/20 text-green-400 border-green-500/30",
  waha: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  custom: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

interface ProviderFormData {
  name: string;
  provider_type: ProviderType;
  base_url: string;
  api_token: string;
  is_active: boolean;
  is_default: boolean;
}

const emptyForm: ProviderFormData = {
  name: "",
  provider_type: "uazapi",
  base_url: "",
  api_token: "",
  is_active: true,
  is_default: false,
};

export function WhatsAppProvidersManager() {
  const { providers, isLoading, addProvider, updateProvider, deleteProvider, setDefault } = useWhatsAppProviders();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: typeof providers[0]) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      provider_type: p.provider_type,
      base_url: p.base_url,
      api_token: p.api_token,
      is_active: p.is_active,
      is_default: p.is_default,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.base_url || !form.api_token) return;
    setSaving(true);
    if (editingId) {
      await updateProvider(editingId, { ...form, extra_config: {} });
    } else {
      await addProvider({ ...form, extra_config: {} });
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProvider(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-primary/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Provedores de API WhatsApp
            </CardTitle>
            <CardDescription>
              Gerencie as APIs de WhatsApp utilizadas pelo sistema (UAZAPI, Evolution, WAHA)
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="btn-futuristic" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum provedor cadastrado.</p>
              <p className="text-sm">Clique em "Adicionar" para cadastrar seu primeiro provedor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.name}</span>
                        <Badge variant="outline" className={providerColors[p.provider_type]}>
                          {providerLabels[p.provider_type]}
                        </Badge>
                        {p.is_default && (
                          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Star className="h-3 w-3 mr-1" />
                            Padrão
                          </Badge>
                        )}
                        {!p.is_active && (
                          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {p.base_url}
                        </span>
                        <span className="flex items-center gap-1">
                          <Key className="h-3 w-3" />
                          {p.api_token.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!p.is_default && (
                      <Button variant="ghost" size="icon" onClick={() => setDefault(p.id)} title="Definir como padrão">
                        <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-400" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: p.id, name: p.name })}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card border-primary/20 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Provedor" : "Adicionar Provedor"}</DialogTitle>
            <DialogDescription>
              Configure os dados de conexão da API de WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Minha UAZAPI Principal"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Tipo de Provedor</Label>
                <Select
                  value={form.provider_type}
                  onValueChange={(v) => setForm({ ...form, provider_type: v as ProviderType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uazapi">UAZAPI</SelectItem>
                    <SelectItem value="evolution">Evolution API</SelectItem>
                    <SelectItem value="waha">WAHA</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>URL Base</Label>
                <Input
                  placeholder="https://api.exemplo.com"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {form.provider_type === 'uazapi' && 'Ex: https://zynk2.uazapi.com'}
                  {form.provider_type === 'evolution' && 'Ex: https://evolution.suaempresa.com'}
                  {form.provider_type === 'waha' && 'Ex: http://localhost:3000'}
                  {form.provider_type === 'custom' && 'URL base da sua API personalizada'}
                </p>
              </div>

              <div>
                <Label>Token / API Key</Label>
                <Input
                  type="password"
                  placeholder="Seu token de autenticação"
                  value={form.api_token}
                  onChange={(e) => setForm({ ...form, api_token: e.target.value })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">Habilitar este provedor para uso</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Provedor Padrão</Label>
                  <p className="text-xs text-muted-foreground">Usar como provedor principal do sistema</p>
                </div>
                <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.base_url || !form.api_token}
              className="btn-futuristic"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover Provedor"
        description={`Tem certeza que deseja remover o provedor "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />
    </>
  );
}
