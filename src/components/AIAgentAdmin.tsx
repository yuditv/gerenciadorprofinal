import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, Plus, Settings, Trash2, Power, ExternalLink, 
  MessageSquare, Smartphone, Globe, Pencil, Link2, Shuffle, Users, Settings2, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAIAgents, type AIAgent } from "@/hooks/useAIAgents";
import { CreateAgentDialog } from "./CreateAgentDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { WhatsAppAgentRouting } from "./WhatsAppAgentRouting";
import { AIAgentTransferRules } from "./AIAgentTransferRules";
import { SubAgentsPanel } from "./SubAgentsPanel";
import { AIMaintenanceDialog } from "./AIMaintenanceDialog";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitAlert } from "./PlanLimitAlert";

export function AIAgentAdmin() {
  const { agents, isLoadingAgents, deleteAgent, toggleAgentActive } = useAIAgents();
  const { 
    planType, 
    canCreateAIAgent, 
    canCreateSubAgents, 
    getRemainingAIAgents, 
    aiAgentCount,
    limits 
  } = usePlanLimits();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AIAgent | null>(null);
  const [selectedPrincipalAgent, setSelectedPrincipalAgent] = useState<string | null>(null);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  
  const canCreate = canCreateAIAgent();
  const remainingAgents = getRemainingAIAgents();
  const maxAgents = limits.aiAgents;
  
  // Filter agents by type - use any to bypass type check since agent_type exists in DB
  const principalAgents = agents.filter(a => (a as any).agent_type !== 'sub_agent');
  const subAgents = agents.filter(a => (a as any).agent_type === 'sub_agent');

  const handleToggleActive = (agent: AIAgent) => {
    toggleAgentActive.mutate({ id: agent.id, is_active: !agent.is_active });
  };

  const handleDelete = () => {
    if (deletingAgent) {
      deleteAgent.mutate(deletingAgent.id);
      setDeletingAgent(null);
    }
  };

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
    <Tabs defaultValue="agents" className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="sub-agents" className="gap-2">
            <Users className="h-4 w-4" />
            Sub-Agentes
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-2">
            <Link2 className="h-4 w-4" />
            Roteamento
          </TabsTrigger>
          <TabsTrigger value="transfer" className="gap-2">
            <Shuffle className="h-4 w-4" />
            Transferências
          </TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setIsMaintenanceOpen(true)} 
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Manutenção
          </Button>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)} 
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            disabled={!canCreate}
            title={!canCreate ? `Limite de ${maxAgents === -1 ? '∞' : maxAgents} agentes atingido` : undefined}
          >
            <Plus className="h-4 w-4" />
            Novo Agente
            {maxAgents !== -1 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {aiAgentCount}/{maxAgents}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Plan Limit Warning */}
      {maxAgents !== -1 && remainingAgents <= 1 && remainingAgents > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-600 dark:text-yellow-400">
            Você pode criar apenas mais {remainingAgents} agente(s) no seu plano atual.
          </AlertDescription>
        </Alert>
      )}

      {!canCreate && maxAgents !== -1 && (
        <PlanLimitAlert
          type="limit_reached"
          feature="agentes IA"
          planType={planType}
          currentCount={aiAgentCount}
          maxCount={maxAgents}
        />
      )}

      <TabsContent value="agents" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card group hover:shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="stats-icon-container primary">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-sm text-muted-foreground">Total de Agentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card group hover:shadow-[0_0_40px_hsl(142_76%_45%/0.15)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="stats-icon-container success">
                <Power className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.filter(a => a.is_active).length}
                </p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card group hover:shadow-[0_0_40px_hsl(var(--accent)/0.15)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="stats-icon-container accent">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.filter(a => a.is_chat_enabled).length}
                </p>
                <p className="text-sm text-muted-foreground">Com Chat Web</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      <Card className="glass-card">
        <CardHeader className="border-b border-border/30">
          <CardTitle className="flex items-center gap-3">
            <div className="stats-icon-container primary">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            Agentes Configurados
          </CardTitle>
          <CardDescription>
            Gerencie seus agentes conectados ao n8n
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : agents.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <Bot className="h-16 w-16 text-primary relative z-10" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
                Nenhum agente configurado
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Crie seu primeiro agente de IA conectando um workflow do n8n para automatizar conversas
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)} 
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Primeiro Agente
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence>
                {agents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    variants={itemVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Card className="agent-card-premium group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                              style={{ 
                                backgroundColor: `${agent.color}20`,
                                boxShadow: `0 0 20px ${agent.color}30`
                              }}
                            >
                              <Bot 
                                className="h-5 w-5 transition-colors" 
                                style={{ color: agent.color }} 
                              />
                            </div>
                            <div>
                              <CardTitle className="text-base">{agent.name}</CardTitle>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge 
                                  variant={agent.is_active ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {agent.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={agent.is_active}
                            onCheckedChange={() => handleToggleActive(agent)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {agent.description || "Sem descrição"}
                        </p>

                        {/* Capabilities */}
                        <div className="flex gap-2">
                          {agent.is_chat_enabled && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Globe className="h-3 w-3" />
                              Web
                            </Badge>
                          )}
                          {agent.is_whatsapp_enabled && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Smartphone className="h-3 w-3" />
                              WhatsApp
                            </Badge>
                          )}
                        </div>

                        {/* Webhook URL (truncated) */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{agent.webhook_url}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 gap-1"
                            onClick={() => setEditingAgent(agent)}
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingAgent(agent)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <CreateAgentDialog
        open={isCreateDialogOpen || !!editingAgent}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingAgent(null);
          }
        }}
        editingAgent={editingAgent}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingAgent}
        onOpenChange={(open) => !open && setDeletingAgent(null)}
        onConfirm={handleDelete}
        title="Excluir Agente"
        description={`Tem certeza que deseja excluir o agente "${deletingAgent?.name}"? Esta ação não pode ser desfeita e todo o histórico de conversas será perdido.`}
      />
      </TabsContent>

      <TabsContent value="sub-agents">
        {!canCreateSubAgents() ? (
          <PlanLimitAlert
            type="blocked"
            feature="Sub-Agentes"
            planType={planType}
          />
        ) : principalAgents.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="pt-6 text-center">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                Crie primeiro um Agente Principal para gerenciar Sub-Agentes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selecione o Agente Principal</CardTitle>
                <CardDescription>
                  Escolha qual Agente Principal você deseja configurar os Sub-Agentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {principalAgents.map((agent) => (
                    <Button
                      key={agent.id}
                      variant={selectedPrincipalAgent === agent.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPrincipalAgent(agent.id)}
                      className="gap-2"
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: agent.color || '#3b82f6' }}
                      />
                      {agent.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {selectedPrincipalAgent && (
              <SubAgentsPanel principalAgentId={selectedPrincipalAgent} />
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="routing">
        <WhatsAppAgentRouting />
      </TabsContent>

      <TabsContent value="transfer">
        <AIAgentTransferRules />
      </TabsContent>

      {/* Maintenance Dialog */}
      <AIMaintenanceDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
      />
    </Tabs>
  );
}
