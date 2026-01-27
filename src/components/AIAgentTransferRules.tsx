import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, Plus, Trash2, Bot, Tag, 
  MessageSquare, Power, Pencil, X, Check, Shuffle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useAIAgentTransferRules, type AIAgentTransferRule, type CreateTransferRuleData } from "@/hooks/useAIAgentTransferRules";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function AIAgentTransferRules() {
  const { agents } = useAIAgents();
  const { rules, isLoadingRules, createRule, updateRule, deleteRule, toggleRuleActive } = useAIAgentTransferRules();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AIAgentTransferRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<AIAgentTransferRule | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateTransferRuleData>({
    source_agent_id: '',
    target_agent_id: '',
    trigger_keywords: [],
    transfer_message: '',
    is_active: true
  });
  const [keywordInput, setKeywordInput] = useState('');

  const resetForm = () => {
    setFormData({
      source_agent_id: '',
      target_agent_id: '',
      trigger_keywords: [],
      transfer_message: '',
      is_active: true
    });
    setKeywordInput('');
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: AIAgentTransferRule) => {
    setEditingRule(rule);
    setFormData({
      source_agent_id: rule.source_agent_id,
      target_agent_id: rule.target_agent_id,
      trigger_keywords: rule.trigger_keywords,
      transfer_message: rule.transfer_message || '',
      is_active: rule.is_active
    });
    setIsDialogOpen(true);
  };

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !formData.trigger_keywords.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        trigger_keywords: [...prev.trigger_keywords, trimmed]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      trigger_keywords: prev.trigger_keywords.filter(k => k !== keyword)
    }));
  };

  const handleSubmit = () => {
    if (!formData.source_agent_id || !formData.target_agent_id) {
      return;
    }

    if (editingRule) {
      updateRule.mutate({
        id: editingRule.id,
        ...formData
      });
    } else {
      createRule.mutate(formData);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (deletingRule) {
      deleteRule.mutate(deletingRule.id);
      setDeletingRule(null);
    }
  };

  const getAgentById = (id: string) => agents.find(a => a.id === id);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" />
            Regras de Transferência (Decisão por IA)
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure para quais agentes especializados a IA pode transferir automaticamente
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="stats-icon-container primary">
                <Shuffle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-sm text-muted-foreground">Total de Regras</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="stats-icon-container success">
                <Power className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {rules.filter(r => r.is_active).length}
                </p>
                <p className="text-sm text-muted-foreground">Regras Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="stats-icon-container accent">
                <Tag className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {rules.reduce((acc, r) => acc + r.trigger_keywords.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Palavras-Chave</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card className="glass-card">
        <CardHeader className="border-b border-border/30">
          <CardTitle className="flex items-center gap-3">
            <div className="stats-icon-container primary">
              <Shuffle className="h-5 w-5 text-primary" />
            </div>
            Rotas de Transferência
          </CardTitle>
          <CardDescription>
            A IA analisa a conversa e decide automaticamente quando transferir para o agente especializado
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoadingRules ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rules.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <Shuffle className="h-16 w-16 text-primary relative z-10" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
                Nenhuma rota configurada
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Crie rotas para que a IA possa transferir conversas para agentes especializados quando detectar interesse específico do cliente
              </p>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeira Rota
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              <AnimatePresence>
                {rules.map((rule) => {
                  const sourceAgent = rule.source_agent || getAgentById(rule.source_agent_id);
                  const targetAgent = rule.target_agent || getAgentById(rule.target_agent_id);
                  
                  return (
                    <motion.div
                      key={rule.id}
                      variants={itemVariants}
                      layout
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <Card className={`border transition-all ${rule.is_active ? 'border-primary/30 bg-primary/5' : 'border-border/30 opacity-60'}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between gap-4">
                            {/* Source Agent → Target Agent */}
                            <div className="flex items-center gap-4 flex-1">
                              {/* Source Agent */}
                              <div className="flex items-center gap-2">
                                <div 
                                  className="p-2 rounded-lg"
                                  style={{ backgroundColor: `${sourceAgent?.color}20` }}
                                >
                                  <Bot className="h-4 w-4" style={{ color: sourceAgent?.color }} />
                                </div>
                                <span className="font-medium text-sm">{sourceAgent?.name || 'Desconhecido'}</span>
                              </div>

                              {/* Arrow */}
                              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

                              {/* Target Agent */}
                              <div className="flex items-center gap-2">
                                <div 
                                  className="p-2 rounded-lg"
                                  style={{ backgroundColor: `${targetAgent?.color}20` }}
                                >
                                  <Bot className="h-4 w-4" style={{ color: targetAgent?.color }} />
                                </div>
                                <span className="font-medium text-sm">{targetAgent?.name || 'Desconhecido'}</span>
                              </div>
                            </div>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={(checked) => 
                                  toggleRuleActive.mutate({ id: rule.id, is_active: checked })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(rule)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingRule(rule)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Transfer Message */}
                          {rule.transfer_message && (
                            <div className="mt-3 pt-3 border-t border-border/30">
                              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                <span className="italic">"{rule.transfer_message}"</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Rota de Transferência' : 'Nova Rota de Transferência'}
            </DialogTitle>
            <DialogDescription>
              A IA analisará a conversa e decidirá automaticamente quando transferir para o agente especializado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Source Agent */}
            <div className="space-y-2">
              <Label>De (Agente Origem) *</Label>
              <Select
                value={formData.source_agent_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, source_agent_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente de origem" />
                </SelectTrigger>
                <SelectContent>
                  {agents.filter(a => a.id !== formData.target_agent_id).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: agent.color }}
                        />
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Agent */}
            <div className="space-y-2">
              <Label>Para (Agente Destino) *</Label>
              <Select
                value={formData.target_agent_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, target_agent_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente de destino" />
                </SelectTrigger>
                <SelectContent>
                  {agents.filter(a => a.id !== formData.source_agent_id).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: agent.color }}
                        />
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Decision Info */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                <Bot className="h-4 w-4 inline-block mr-1" />
                <strong>Decisão Inteligente:</strong> A IA analisará cada mensagem do cliente e decidirá automaticamente quando transferir para este agente especializado, baseado no contexto da conversa e no interesse demonstrado.
              </p>
            </div>

            {/* Transfer Message */}
            <div className="space-y-2">
              <Label>Mensagem de Transferência (Opcional)</Label>
              <Textarea
                placeholder="Ex: Vou transferir você para nosso especialista em internet..."
                value={formData.transfer_message}
                onChange={(e) => setFormData(prev => ({ ...prev, transfer_message: e.target.value }))}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Mensagem enviada antes de transferir para o novo agente
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Regra Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar ou desativar esta regra de transferência
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={
                !formData.source_agent_id || 
                !formData.target_agent_id || 
                createRule.isPending ||
                updateRule.isPending
              }
            >
              {createRule.isPending || updateRule.isPending ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editingRule ? 'Salvar' : 'Criar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
        onConfirm={handleDelete}
        title="Excluir Regra"
        description="Tem certeza que deseja excluir esta regra de transferência? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
