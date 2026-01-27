import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Zap, Play, Pause, Clock, MessageSquare, Tag, Users, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useInboxAutomation, AutomationRule } from "@/hooks/useInboxAutomation";
import { useInboxMacros } from "@/hooks/useInboxMacros";
import { useInboxLabels } from "@/hooks/useInboxLabels";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  { value: "conversation_created", label: "Nova conversa", icon: Zap },
  { value: "message_created", label: "Nova mensagem recebida", icon: MessageSquare },
  { value: "conversation_resolved", label: "Conversa resolvida", icon: Tag },
  { value: "conversation_reopened", label: "Conversa reaberta", icon: Tag },
  { value: "keyword_detected", label: "Palavra-chave detectada", icon: Search },
  { value: "business_hours_start", label: "Início do horário comercial", icon: Clock },
  { value: "business_hours_end", label: "Fim do horário comercial", icon: Clock },
  { value: "inactivity_timeout", label: "Tempo de inatividade", icon: Clock },
];

const ACTION_TYPES = [
  { value: "assign_agent", label: "Atribuir a agente" },
  { value: "assign_team", label: "Atribuir a equipe" },
  { value: "add_label", label: "Adicionar etiqueta" },
  { value: "send_message", label: "Enviar mensagem" },
  { value: "send_private_note", label: "Nota privada" },
  { value: "toggle_ai", label: "Ativar/Desativar IA" },
  { value: "resolve", label: "Resolver conversa" },
  { value: "execute_macro", label: "Executar Macro" },
  { value: "snooze", label: "Adiar conversa" },
  { value: "set_priority", label: "Definir prioridade" },
];

export function AutomationSettings() {
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleActive } = useInboxAutomation();
  const { macros } = useInboxMacros();
  const { labels } = useInboxLabels();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_type: "conversation_created",
    conditions: {} as Record<string, unknown>,
    actions: [] as Array<{ type: string; params?: Record<string, unknown> }>,
    is_active: true,
  });

  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      event_type: "conversation_created",
      conditions: {},
      actions: [],
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      event_type: rule.event_type,
      conditions: rule.conditions || {},
      actions: rule.actions || [],
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleAddAction = (type: string) => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type, params: {} }],
    }));
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
        description: "O nome da regra é obrigatório",
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
      if (editingRule) {
        await updateRule(editingRule.id, formData);
        toast({ title: "Regra atualizada com sucesso" });
      } else {
        await createRule(formData);
        toast({ title: "Regra criada com sucesso" });
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
      await deleteRule(deleteId);
      toast({ title: "Regra excluída com sucesso" });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await toggleActive(id, active);
      toast({ title: active ? "Regra ativada" : "Regra desativada" });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const getEventLabel = (type: string) => {
    return EVENT_TYPES.find(e => e.value === type)?.label || type;
  };

  const getActionLabel = (type: string) => {
    return ACTION_TYPES.find(a => a.value === type)?.label || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Automação</h2>
        <p className="text-muted-foreground">
          Crie regras para automatizar ações com base em eventos.
        </p>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar regras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredRules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhuma regra encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Tente outro termo de busca" : "Crie sua primeira regra de automação"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredRules.map((rule) => (
            <Card key={rule.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className={`h-4 w-4 ${rule.is_active ? "text-yellow-500" : "text-muted-foreground"}`} />
                      {rule.name}
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </CardTitle>
                    {rule.description && (
                      <CardDescription>{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(rule.id, !rule.is_active)}
                    >
                      {rule.is_active ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(rule)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Quando:</span> {getEventLabel(rule.event_type)}
                  <span className="mx-2">→</span>
                  <span className="font-medium">Então:</span>{" "}
                  {rule.actions.map((a, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {getActionLabel(a.type)}
                    </span>
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
              {editingRule ? "Editar Regra" : "Nova Regra de Automação"}
            </DialogTitle>
            <DialogDescription>
              Configure quando e quais ações devem ser executadas automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Regra</Label>
              <Input
                id="name"
                placeholder="Ex: Auto-atribuir novas conversas"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descreva o que esta regra faz"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Quando acontecer</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, event_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((event) => (
                    <SelectItem key={event.value} value={event.value}>
                      <div className="flex items-center gap-2">
                        <event.icon className="h-4 w-4" />
                        {event.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions for keyword detection */}
            {formData.event_type === "keyword_detected" && (
              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  placeholder="urgente, ajuda, suporte"
                  value={(formData.conditions.keywords as string) || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    conditions: { ...prev.conditions, keywords: e.target.value }
                  }))}
                />
              </div>
            )}

            {/* Conditions for inactivity timeout */}
            {formData.event_type === "inactivity_timeout" && (
              <div className="space-y-2">
                <Label>Tempo de inatividade (minutos)</Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={(formData.conditions.inactivity_minutes as number) || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    conditions: { ...prev.conditions, inactivity_minutes: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
            )}

            {/* Condition to block if already has label */}
            {(formData.event_type === "keyword_detected" || 
              formData.event_type === "message_created" ||
              formData.event_type === "conversation_created") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-destructive" />
                  Bloquear se já tiver etiqueta
                </Label>
                <Select
                  value={(formData.conditions.exclude_if_has_label as string) || "none"}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    conditions: { 
                      ...prev.conditions, 
                      exclude_if_has_label: value === "none" ? undefined : value 
                    }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma - sempre executar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma - sempre executar</SelectItem>
                    {labels.map((label) => (
                      <SelectItem key={label.id} value={label.id}>
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: label.color }}
                          />
                          {label.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se o cliente já tiver esta etiqueta, a automação não será executada
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Label>Então executar ({formData.actions.length} ações)</Label>
              {formData.actions.length > 0 && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  {formData.actions.map((action, idx) => (
                    <div key={idx} className="flex flex-col gap-2 bg-background rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{getActionLabel(action.type)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAction(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      

                      {/* Message input for send_message action */}
                      {action.type === "send_message" && (
                        <Textarea
                          placeholder="Digite a mensagem..."
                          rows={2}
                          value={(action.params?.message as string) || ""}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              actions: prev.actions.map((a, i) => 
                                i === idx ? { ...a, params: { ...a.params, message: e.target.value } } : a
                              )
                            }));
                          }}
                        />
                      )}

                      {/* Priority selection for set_priority action */}
                      {action.type === "set_priority" && (
                        <Select
                          value={(action.params?.priority as string) || ""}
                          onValueChange={(value) => {
                            setFormData(prev => ({
                              ...prev,
                              actions: prev.actions.map((a, i) => 
                                i === idx ? { ...a, params: { ...a.params, priority: value } } : a
                              )
                            }));
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecionar prioridade..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <Select onValueChange={handleAddAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar ação..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Ativar regra</Label>
                <p className="text-xs text-muted-foreground">
                  A regra será executada automaticamente quando ativa
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingRule ? "Salvar Alterações" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra será removida permanentemente.
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
