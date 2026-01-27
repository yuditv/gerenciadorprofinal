import { useState } from "react";
import { Plus, Search, Edit2, Trash2, RefreshCw, CloudDownload, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInboxLabels, InboxLabel, UAZAPI_COLORS } from "@/hooks/useInboxLabels";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useToast } from "@/hooks/use-toast";

export function LabelsSettings() {
  const { 
    labels, 
    isLoading, 
    isSyncing,
    createLabel, 
    updateLabel, 
    deleteLabel,
    syncFromWhatsApp 
  } = useInboxLabels();
  const { instances } = useWhatsAppInstances();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<InboxLabel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#00a884",
    colorCode: 0,
  });

  // Filter labels by search and optionally by instance
  const filteredLabels = labels.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesInstance = selectedInstanceId === "all" || !selectedInstanceId || 
      l.instance_id === selectedInstanceId || 
      !l.instance_id; // Include global labels
    return matchesSearch && matchesInstance;
  });

  // Get connected instances
  const connectedInstances = instances.filter(i => i.status === 'connected');

  const handleOpenCreate = () => {
    setEditingLabel(null);
    setFormData({ name: "", description: "", color: "#00a884", colorCode: 0 });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (label: InboxLabel) => {
    setEditingLabel(label);
    setFormData({
      name: label.name,
      description: label.description || "",
      color: label.color,
      colorCode: label.color_code ?? 0,
    });
    setIsDialogOpen(true);
  };

  const handleColorSelect = (code: number, hex: string) => {
    setFormData(prev => ({ ...prev, color: hex, colorCode: code }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da etiqueta é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingLabel) {
        await updateLabel(editingLabel.id, {
          name: formData.name,
          description: formData.description,
          color: formData.color,
          colorCode: formData.colorCode,
        });
        toast({ title: "Etiqueta atualizada com sucesso" });
      } else {
        await createLabel({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          colorCode: formData.colorCode,
          instanceId: selectedInstanceId !== "all" ? selectedInstanceId : undefined,
        });
        toast({ title: "Etiqueta criada com sucesso" });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteLabel(deleteId);
      toast({ title: "Etiqueta excluída com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  const handleSyncFromWhatsApp = async () => {
    if (!selectedInstanceId || selectedInstanceId === "all") {
      toast({
        title: "Selecione uma instância",
        description: "Escolha uma instância WhatsApp para sincronizar as etiquetas",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await syncFromWhatsApp(selectedInstanceId);
      toast({
        title: "Sincronização concluída",
        description: `${result.imported} novas etiquetas importadas de ${result.total} encontradas`,
      });
    } catch (error) {
      toast({
        title: "Erro ao sincronizar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const getInstanceName = (instanceId: string | null) => {
    if (!instanceId) return null;
    return instances.find(i => i.id === instanceId)?.instance_name;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Etiquetas</h2>
        <p className="text-muted-foreground">
          Crie etiquetas coloridas para organizar suas conversas. Sincronize com o WhatsApp para usar as mesmas etiquetas no app oficial.
        </p>
      </div>

      {/* Instance Selector + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <SelectValue placeholder="Todas as instâncias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as instâncias</SelectItem>
            {connectedInstances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  {instance.instance_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={handleSyncFromWhatsApp}
          disabled={!selectedInstanceId || selectedInstanceId === "all" || isSyncing}
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CloudDownload className="h-4 w-4 mr-2" />
          )}
          Sincronizar do WhatsApp
        </Button>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar etiquetas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Etiqueta
        </Button>
      </div>

      {/* Labels List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredLabels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhuma etiqueta encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Tente outro termo de busca" : "Crie sua primeira etiqueta ou sincronize do WhatsApp"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filteredLabels.map((label) => (
            <div
              key={label.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{label.name}</span>
                    {label.whatsapp_label_id && (
                      <Badge variant="secondary" className="text-xs">
                        <Smartphone className="h-3 w-3 mr-1" />
                        WhatsApp
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {label.description && (
                      <span className="truncate max-w-[200px]">{label.description}</span>
                    )}
                    {label.instance_id && getInstanceName(label.instance_id) && (
                      <span className="text-muted-foreground/70">
                        • {getInstanceName(label.instance_id)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(label)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(label.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLabel ? "Editar Etiqueta" : "Nova Etiqueta"}
            </DialogTitle>
            <DialogDescription>
              {editingLabel 
                ? "Atualize os dados da etiqueta."
                : "Crie uma etiqueta para categorizar suas conversas. Se uma instância estiver selecionada, a etiqueta será sincronizada com o WhatsApp."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Urgente, VIP, Suporte"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                placeholder="Descrição da etiqueta"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor (compatível com WhatsApp)</Label>
              <div className="flex flex-wrap gap-2">
                {UAZAPI_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.code}
                    type="button"
                    onClick={() => handleColorSelect(colorOption.code, colorOption.hex)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      formData.colorCode === colorOption.code 
                        ? "border-foreground scale-110 ring-2 ring-offset-2 ring-primary" 
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: colorOption.hex }}
                    title={colorOption.name}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cor selecionada: {UAZAPI_COLORS.find(c => c.code === formData.colorCode)?.name || "Verde"}
              </p>
            </div>

            {selectedInstanceId && selectedInstanceId !== "all" && !editingLabel && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                  A etiqueta será criada também no WhatsApp
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingLabel ? "Salvar Alterações" : "Criar Etiqueta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              A etiqueta será removida de todas as conversas. Se estiver sincronizada com o WhatsApp, será excluída de lá também. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
