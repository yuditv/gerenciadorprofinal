import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Play, Tag, MessageSquare, CheckCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useInboxMacros, InboxMacro, MacroAction } from "@/hooks/useInboxMacros";
import { useToast } from "@/hooks/use-toast";

const ACTION_TYPES = [
  { value: "add_label", label: "Adicionar Etiqueta", icon: Tag },
  { value: "remove_label", label: "Remover Etiqueta", icon: Tag },
  { value: "send_message", label: "Enviar Mensagem", icon: MessageSquare },
  { value: "send_private_note", label: "Nota Privada", icon: MessageSquare },
  { value: "send_template", label: "Enviar Template", icon: MessageSquare },
  { value: "resolve", label: "Resolver Conversa", icon: CheckCircle },
  { value: "toggle_ai", label: "Ativar/Desativar IA", icon: Bot },
  { value: "snooze", label: "Adiar Conversa", icon: Tag },
  { value: "assign_to_me", label: "Assumir Conversa", icon: Tag },
  { value: "set_priority", label: "Definir Prioridade", icon: Tag },
];

export function MacrosSettings() {
  const { macros, isLoading, createMacro, updateMacro, deleteMacro } = useInboxMacros();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<InboxMacro | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    visibility: "personal" as "personal" | "global",
    actions: [] as MacroAction[],
  });

  const [newAction, setNewAction] = useState<MacroAction>({
    type: "send_message",
    params: {},
  });

  const filteredMacros = macros.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingMacro(null);
    setFormData({ name: "", visibility: "personal", actions: [] });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (macro: InboxMacro) => {
    setEditingMacro(macro);
    setFormData({
      name: macro.name,
      visibility: macro.visibility,
      actions: macro.actions,
    });
    setIsDialogOpen(true);
  };

  const handleAddAction = () => {
    if (!newAction.type) return;
    
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { ...newAction }],
    }));
    setNewAction({ type: "send_message", params: {} });
  };

  const handleRemoveAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da macro é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (formData.actions.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma ação",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingMacro) {
        await updateMacro(editingMacro.id, formData);
        toast({ title: "Macro atualizada com sucesso" });
      } else {
        await createMacro(formData);
        toast({ title: "Macro criada com sucesso" });
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
      await deleteMacro(deleteId);
      toast({ title: "Macro excluída com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  const getActionLabel = (type: string) => {
    return ACTION_TYPES.find(a => a.value === type)?.label || type;
  };

  const getActionIcon = (type: string) => {
    const ActionIcon = ACTION_TYPES.find(a => a.value === type)?.icon || Play;
    return <ActionIcon className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Macros</h2>
        <p className="text-muted-foreground">
          Crie atalhos para executar múltiplas ações de uma vez.
        </p>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar macros..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Macro
        </Button>
      </div>

      {/* Macros List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredMacros.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Play className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhuma macro encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Tente outro termo de busca" : "Crie sua primeira macro"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredMacros.map((macro) => (
            <Card key={macro.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      {macro.name}
                      <Badge variant={macro.visibility === "global" ? "secondary" : "outline"}>
                        {macro.visibility === "global" ? "Global" : "Pessoal"}
                      </Badge>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(macro)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(macro.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {macro.actions.map((action, idx) => (
                    <Badge key={idx} variant="outline" className="gap-1">
                      {getActionIcon(action.type)}
                      {getActionLabel(action.type)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMacro ? "Editar Macro" : "Nova Macro"}
            </DialogTitle>
            <DialogDescription>
              Configure uma sequência de ações para executar com um clique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Macro</Label>
              <Input
                id="name"
                placeholder="Ex: Finalizar Atendimento"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value: "personal" | "global") => 
                  setFormData(prev => ({ ...prev, visibility: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Apenas para mim</SelectItem>
                  <SelectItem value="global">Disponível para todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions List */}
            <div className="space-y-2">
              <Label>Ações ({formData.actions.length})</Label>
              {formData.actions.length > 0 && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  {formData.actions.map((action, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-background rounded p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{idx + 1}.</span>
                        {getActionIcon(action.type)}
                        <span>{getActionLabel(action.type)}</span>
                        {action.params?.message && (
                          <span className="text-muted-foreground truncate max-w-[150px]">
                            : {String(action.params.message)}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAction(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Action */}
            <div className="space-y-2 p-3 rounded-lg border">
              <Label>Adicionar Ação</Label>
              <div className="flex gap-2">
                <Select
                  value={newAction.type}
                  onValueChange={(value) => setNewAction({ type: value, params: {} })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" onClick={handleAddAction}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {(newAction.type === "send_message" || newAction.type === "send_private_note") && (
                <Textarea
                  placeholder={newAction.type === "send_private_note" ? "Nota privada..." : "Mensagem a ser enviada..."}
                  value={String(newAction.params?.message || "")}
                  onChange={(e) => setNewAction(prev => ({
                    ...prev,
                    params: { ...prev.params, message: e.target.value }
                  }))}
                  rows={2}
                  className="mt-2"
                />
              )}

              {newAction.type === "send_template" && (
                <Input
                  placeholder="Nome do template..."
                  value={String(newAction.params?.template_name || "")}
                  onChange={(e) => setNewAction(prev => ({
                    ...prev,
                    params: { ...prev.params, template_name: e.target.value }
                  }))}
                  className="mt-2"
                />
              )}

              {newAction.type === "snooze" && (
                <div className="mt-2 space-y-2">
                  <Label className="text-xs">Adiar por (minutos)</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={String(newAction.params?.duration_minutes || "")}
                    onChange={(e) => setNewAction(prev => ({
                      ...prev,
                      params: { ...prev.params, duration_minutes: parseInt(e.target.value) || 0 }
                    }))}
                  />
                </div>
              )}

              {newAction.type === "set_priority" && (
                <Select
                  value={String(newAction.params?.priority || "")}
                  onValueChange={(value) => setNewAction(prev => ({
                    ...prev,
                    params: { ...prev.params, priority: value }
                  }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {newAction.type === "toggle_ai" && (
                <Select
                  value={String(newAction.params?.enabled ?? "true")}
                  onValueChange={(value) => setNewAction(prev => ({
                    ...prev,
                    params: { ...prev.params, enabled: value === "true" }
                  }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Ativar ou desativar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativar IA</SelectItem>
                    <SelectItem value="false">Desativar IA</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingMacro ? "Salvar Alterações" : "Criar Macro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir macro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A macro será removida permanentemente.
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
