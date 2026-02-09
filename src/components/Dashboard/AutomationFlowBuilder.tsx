import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Workflow, 
  Plus, 
  Zap, 
  Clock, 
  MessageSquare, 
  Bell, 
  Mail,
  Tag,
  UserCheck,
  GitBranch,
  Play,
  Pause,
  Trash2,
  Edit,
  Settings,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { toast } from 'sonner';

interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface TriggerConfig {
  type: 'new_conversation' | 'message_received' | 'no_response' | 'expiring_soon' | 'status_change' | 'schedule';
  conditions: Record<string, any>;
}

interface ActionConfig {
  id: string;
  type: 'send_message' | 'send_email' | 'add_label' | 'assign_agent' | 'notify' | 'wait';
  config: Record<string, any>;
}

const TRIGGER_TYPES = [
  { id: 'new_conversation', label: 'Nova Conversa', icon: MessageSquare, color: 'bg-blue-500' },
  { id: 'message_received', label: 'Mensagem Recebida', icon: MessageSquare, color: 'bg-green-500' },
  { id: 'no_response', label: 'Sem Resposta', icon: Clock, color: 'bg-amber-500' },
  { id: 'expiring_soon', label: 'Cliente Expirando', icon: AlertTriangle, color: 'bg-red-500' },
  { id: 'status_change', label: 'Mudança de Status', icon: GitBranch, color: 'bg-purple-500' },
  { id: 'schedule', label: 'Agendado', icon: Timer, color: 'bg-cyan-500' },
];

const ACTION_TYPES = [
  { id: 'send_message', label: 'Enviar Mensagem', icon: MessageSquare },
  { id: 'send_email', label: 'Enviar Email', icon: Mail },
  { id: 'add_label', label: 'Adicionar Etiqueta', icon: Tag },
  { id: 'assign_agent', label: 'Atribuir Atendente', icon: UserCheck },
  { id: 'notify', label: 'Notificar', icon: Bell },
  { id: 'wait', label: 'Aguardar', icon: Clock },
];

export function AutomationFlowBuilder() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTrigger, setFormTrigger] = useState<TriggerConfig>({ type: 'new_conversation', conditions: {} });
  const [formActions, setFormActions] = useState<ActionConfig[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    fetchFlows();
  }, [user, ownerId]);

  const fetchFlows = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const resolvedOwnerId = ownerId || user.id;
      
      const { data, error } = await supabase
        .from('automation_flows')
        .select('*')
        .eq('user_id', resolvedOwnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedFlows: AutomationFlow[] = (data || []).map((flow: any) => ({
        id: flow.id,
        name: flow.name,
        description: flow.description || '',
        trigger: (flow.trigger_config as TriggerConfig) || { type: 'new_conversation', conditions: {} },
        actions: (flow.actions_config as ActionConfig[]) || [],
        isActive: flow.is_active,
        createdAt: flow.created_at,
        lastTriggered: flow.last_triggered_at,
        triggerCount: flow.trigger_count || 0,
      }));

      setFlows(formattedFlows);
    } catch (error) {
      console.error('Error fetching flows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTrigger({ type: 'new_conversation', conditions: {} });
    setFormActions([]);
    setFormIsActive(true);
    setEditingFlow(null);
  };

  const handleCreateFlow = async () => {
    if (!user || !formName.trim()) {
      toast.error('Nome da automação é obrigatório');
      return;
    }

    try {
      const resolvedOwnerId = ownerId || user.id;
      
      if (editingFlow) {
        const { error } = await supabase
          .from('automation_flows')
          .update({
            name: formName,
            description: formDescription,
            trigger_config: formTrigger as any,
            actions_config: formActions as any,
            is_active: formIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingFlow.id);

        if (error) throw error;
        toast.success('Automação atualizada!');
      } else {
        const { error } = await supabase
          .from('automation_flows')
          .insert({
            user_id: resolvedOwnerId,
            name: formName,
            description: formDescription,
            trigger_config: formTrigger as any,
            actions_config: formActions as any,
            is_active: formIsActive,
          });

        if (error) throw error;
        toast.success('Automação criada!');
      }

      setShowCreateDialog(false);
      resetForm();
      fetchFlows();
    } catch (error: any) {
      console.error('Error saving flow:', error);
      toast.error('Erro ao salvar automação');
    }
  };

  const handleToggleFlow = async (flow: AutomationFlow) => {
    try {
      const { error } = await supabase
        .from('automation_flows')
        .update({ is_active: !flow.isActive })
        .eq('id', flow.id);

      if (error) throw error;
      
      setFlows(prev => prev.map(f => 
        f.id === flow.id ? { ...f, isActive: !f.isActive } : f
      ));
      
      toast.success(flow.isActive ? 'Automação pausada' : 'Automação ativada');
    } catch (error) {
      console.error('Error toggling flow:', error);
      toast.error('Erro ao atualizar automação');
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Excluir esta automação?')) return;

    try {
      const { error } = await supabase
        .from('automation_flows')
        .delete()
        .eq('id', flowId);

      if (error) throw error;
      
      setFlows(prev => prev.filter(f => f.id !== flowId));
      toast.success('Automação excluída');
    } catch (error) {
      console.error('Error deleting flow:', error);
      toast.error('Erro ao excluir automação');
    }
  };

  const addAction = () => {
    setFormActions(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'send_message',
      config: {},
    }]);
  };

  const removeAction = (actionId: string) => {
    setFormActions(prev => prev.filter(a => a.id !== actionId));
  };

  const updateAction = (actionId: string, updates: Partial<ActionConfig>) => {
    setFormActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, ...updates } : a
    ));
  };

  const getTriggerInfo = (type: string) => TRIGGER_TYPES.find(t => t.id === type);
  const getActionInfo = (type: string) => ACTION_TYPES.find(a => a.id === type);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              Automações
            </CardTitle>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">Nenhuma automação criada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie automações para executar ações automaticamente baseadas em gatilhos.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Automação
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {flows.map(flow => {
                const triggerInfo = getTriggerInfo(flow.trigger.type);
                const TriggerIcon = triggerInfo?.icon || Zap;
                
                return (
                  <div
                    key={flow.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      flow.isActive 
                        ? "bg-muted/50 border-border/50" 
                        : "bg-muted/20 border-border/30 opacity-70"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          triggerInfo?.color || "bg-primary",
                          "text-white"
                        )}>
                          <TriggerIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{flow.name}</h3>
                            <Badge variant={flow.isActive ? 'default' : 'secondary'}>
                              {flow.isActive ? 'Ativo' : 'Pausado'}
                            </Badge>
                          </div>
                          {flow.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {flow.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {flow.triggerCount} execuções
                            </span>
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {flow.actions.length} ações
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleFlow(flow)}
                        >
                          {flow.isActive ? (
                            <Pause className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Play className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingFlow(flow);
                            setFormName(flow.name);
                            setFormDescription(flow.description);
                            setFormTrigger(flow.trigger);
                            setFormActions(flow.actions);
                            setFormIsActive(flow.isActive);
                            setShowCreateDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteFlow(flow.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Actions Preview */}
                    {flow.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
                        <span className="text-xs text-muted-foreground">Ações:</span>
                        {flow.actions.slice(0, 4).map((action, i) => {
                          const actionInfo = getActionInfo(action.type);
                          const ActionIcon = actionInfo?.icon || Settings;
                          return (
                            <Badge 
                              key={action.id} 
                              variant="outline" 
                              className="gap-1 text-xs"
                            >
                              <ActionIcon className="h-3 w-3" />
                              {actionInfo?.label}
                            </Badge>
                          );
                        })}
                        {flow.actions.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{flow.actions.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFlow ? 'Editar Automação' : 'Nova Automação'}
            </DialogTitle>
            <DialogDescription>
              Configure o gatilho e as ações que serão executadas automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Automação</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Boas-vindas para novos leads"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descreva o que esta automação faz..."
                  rows={2}
                />
              </div>
            </div>

            {/* Trigger Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Gatilho
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {TRIGGER_TYPES.map(trigger => {
                  const Icon = trigger.icon;
                  const isSelected = formTrigger.type === trigger.id;
                  return (
                    <button
                      key={trigger.id}
                      type="button"
                      onClick={() => setFormTrigger({ type: trigger.id as any, conditions: {} })}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all",
                        isSelected 
                          ? "border-primary bg-primary/10" 
                          : "border-border/50 hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded", trigger.color, "text-white")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{trigger.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Trigger Conditions */}
              {formTrigger.type === 'no_response' && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                  <Label className="text-sm">Após quantas horas sem resposta?</Label>
                  <Select
                    value={String(formTrigger.conditions.hours || 24)}
                    onValueChange={(v) => setFormTrigger(prev => ({
                      ...prev,
                      conditions: { ...prev.conditions, hours: parseInt(v) }
                    }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 6, 12, 24, 48, 72].map(h => (
                        <SelectItem key={h} value={String(h)}>{h} hora{h > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formTrigger.type === 'expiring_soon' && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                  <Label className="text-sm">Quantos dias antes do vencimento?</Label>
                  <Select
                    value={String(formTrigger.conditions.days || 7)}
                    onValueChange={(v) => setFormTrigger(prev => ({
                      ...prev,
                      conditions: { ...prev.conditions, days: parseInt(v) }
                    }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 7, 14, 30].map(d => (
                        <SelectItem key={d} value={String(d)}>{d} dia{d > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  Ações
                </Label>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Ação
                </Button>
              </div>

              {formActions.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Adicione ações que serão executadas quando o gatilho for ativado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formActions.map((action, index) => {
                    const actionInfo = getActionInfo(action.type);
                    const ActionIcon = actionInfo?.icon || Settings;
                    
                    return (
                      <div key={action.id} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{index + 1}</Badge>
                            <Select
                              value={action.type}
                              onValueChange={(v) => updateAction(action.id, { type: v as any, config: {} })}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_TYPES.map(at => (
                                  <SelectItem key={at.id} value={at.id}>
                                    <div className="flex items-center gap-2">
                                      <at.icon className="h-4 w-4" />
                                      {at.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeAction(action.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Action Config */}
                        {action.type === 'send_message' && (
                          <div className="space-y-2">
                            <Label className="text-sm">Mensagem</Label>
                            <Textarea
                              value={action.config.message || ''}
                              onChange={(e) => updateAction(action.id, {
                                config: { ...action.config, message: e.target.value }
                              })}
                              placeholder="Digite a mensagem a ser enviada..."
                              rows={2}
                            />
                          </div>
                        )}

                        {action.type === 'wait' && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Aguardar</Label>
                            <Input
                              type="number"
                              value={action.config.minutes || 5}
                              onChange={(e) => updateAction(action.id, {
                                config: { ...action.config, minutes: parseInt(e.target.value) || 5 }
                              })}
                              className="w-20"
                              min={1}
                            />
                            <span className="text-sm text-muted-foreground">minutos</span>
                          </div>
                        )}

                        {action.type === 'notify' && (
                          <div className="space-y-2">
                            <Label className="text-sm">Mensagem da Notificação</Label>
                            <Input
                              value={action.config.notification || ''}
                              onChange={(e) => updateAction(action.id, {
                                config: { ...action.config, notification: e.target.value }
                              })}
                              placeholder="Ex: Novo lead aguardando atendimento"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
              <div>
                <Label>Ativar automação</Label>
                <p className="text-sm text-muted-foreground">
                  A automação começará a funcionar imediatamente
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFlow}>
              {editingFlow ? 'Salvar Alterações' : 'Criar Automação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
