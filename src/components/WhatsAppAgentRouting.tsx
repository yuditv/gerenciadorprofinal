import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Smartphone, Bot, Link2, Unlink, Settings2, 
  Phone, Power, Loader2, Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIAgents, type AIAgent } from "@/hooks/useAIAgents";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface RoutingWithRelations {
  id: string;
  instance_id: string;
  agent_id: string;
  is_active: boolean;
  instance: {
    id: string;
    instance_name: string;
    status: string;
  } | null;
  agent: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export function WhatsAppAgentRouting() {
  const { instances, isLoading: isLoadingInstances } = useWhatsAppInstances();
  const { 
    agents, 
    isLoadingAgents, 
    agentRoutings, 
    isLoadingRoutings,
    upsertRouting,
    deleteRouting
  } = useAIAgents();

  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [deletingRouting, setDeletingRouting] = useState<RoutingWithRelations | null>(null);

  const routings = agentRoutings as RoutingWithRelations[];
  const activeAgents = agents.filter(a => a.is_active && a.is_whatsapp_enabled);
  
  // Filter out instances that already have routing
  const availableInstances = instances.filter(
    inst => !routings.find(r => r.instance_id === inst.id)
  );

  const handleCreateRouting = () => {
    if (!selectedInstance || !selectedAgent) return;
    
    upsertRouting.mutate({
      instanceId: selectedInstance,
      agentId: selectedAgent,
      isActive: true
    }, {
      onSuccess: () => {
        setSelectedInstance("");
        setSelectedAgent("");
      }
    });
  };

  const handleToggleRouting = (routing: RoutingWithRelations) => {
    upsertRouting.mutate({
      instanceId: routing.instance_id,
      agentId: routing.agent_id,
      isActive: !routing.is_active
    });
  };

  const handleDeleteRouting = () => {
    if (deletingRouting) {
      deleteRouting.mutate(deletingRouting.id);
      setDeletingRouting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-emerald-500';
      case 'connecting': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected': return <Badge variant="default" className="bg-emerald-500/20 text-emerald-500">Conectado</Badge>;
      case 'connecting': return <Badge variant="default" className="bg-yellow-500/20 text-yellow-500">Conectando</Badge>;
      default: return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const isLoading = isLoadingInstances || isLoadingAgents || isLoadingRoutings;

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
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/20">
          <Link2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Roteamento WhatsApp → Agente IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure qual agente de IA responde em cada instância WhatsApp
          </p>
        </div>
      </div>

      {/* Create New Routing */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 border-dashed border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Roteamento
          </CardTitle>
          <CardDescription>
            Vincule uma instância WhatsApp a um agente de IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select
                value={selectedInstance}
                onValueChange={setSelectedInstance}
                disabled={isLoading || availableInstances.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    availableInstances.length === 0 
                      ? "Nenhuma instância disponível" 
                      : "Selecione uma instância"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <Phone className={`h-3 w-3 ${getStatusColor(instance.status)}`} />
                        <span>{instance.instance_name}</span>
                        {instance.phone_connected && (
                          <span className="text-xs text-muted-foreground">
                            ({instance.phone_connected})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-center">
              <Link2 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1">
              <Select
                value={selectedAgent}
                onValueChange={setSelectedAgent}
                disabled={isLoading || activeAgents.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    activeAgents.length === 0 
                      ? "Nenhum agente disponível" 
                      : "Selecione um agente"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {activeAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-3 w-3" style={{ color: agent.color }} />
                        <span>{agent.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCreateRouting}
              disabled={!selectedInstance || !selectedAgent || upsertRouting.isPending}
              className="gap-2"
            >
              {upsertRouting.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Vincular
            </Button>
          </div>

          {availableInstances.length === 0 && instances.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Todas as instâncias já possuem roteamento configurado.
            </p>
          )}

          {activeAgents.length === 0 && agents.length > 0 && (
            <p className="text-sm text-yellow-500 mt-3">
              Nenhum agente ativo com WhatsApp habilitado. Ative um agente primeiro.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Current Routings */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Roteamentos Ativos
          </CardTitle>
          <CardDescription>
            Instâncias vinculadas a agentes de IA para resposta automática
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : routings.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <Unlink className="h-12 w-12 text-muted-foreground relative z-10" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
                Nenhum roteamento configurado
              </h3>
              <p className="text-muted-foreground max-w-md">
                Vincule uma instância WhatsApp a um agente de IA para ativar respostas automáticas
              </p>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <AnimatePresence>
                {routings.map((routing) => (
                  <motion.div
                    key={routing.id}
                    variants={itemVariants}
                    layout
                    exit={{ opacity: 0, x: -20 }}
                    className="group"
                  >
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 transition-all duration-300">
                      {/* Instance Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                          <Smartphone className={`h-5 w-5 ${getStatusColor(routing.instance?.status || 'disconnected')}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {routing.instance?.instance_name || 'Instância removida'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {routing.instance && getStatusBadge(routing.instance.status)}
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="hidden sm:flex items-center gap-2 text-muted-foreground shrink-0">
                        <div className="w-8 h-px bg-border" />
                        <Link2 className="h-4 w-4" />
                        <div className="w-8 h-px bg-border" />
                      </div>

                      {/* Agent Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div 
                          className="p-2 rounded-lg shrink-0"
                          style={{ backgroundColor: `${routing.agent?.color || '#3b82f6'}20` }}
                        >
                          <Bot 
                            className="h-5 w-5" 
                            style={{ color: routing.agent?.color || '#3b82f6' }} 
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {routing.agent?.name || 'Agente removido'}
                          </p>
                          <Badge 
                            variant={routing.is_active ? "default" : "secondary"}
                            className="text-xs mt-0.5"
                          >
                            {routing.is_active ? 'Ativo' : 'Pausado'}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <Switch
                          checked={routing.is_active}
                          onCheckedChange={() => handleToggleRouting(routing)}
                          disabled={upsertRouting.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingRouting(routing)}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="p-2 rounded-lg bg-primary/20 h-fit">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Como funciona?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Mensagens recebidas na instância WhatsApp são enviadas ao agente de IA vinculado
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  O agente processa a mensagem via webhook n8n e retorna a resposta
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  A resposta é enviada automaticamente de volta ao contato no WhatsApp
                </li>
              </ul>
              <p className="text-xs text-muted-foreground pt-2">
                <strong>URL do Webhook:</strong> Configure no UAZAPI para receber mensagens
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingRouting}
        onOpenChange={(open) => !open && setDeletingRouting(null)}
        onConfirm={handleDeleteRouting}
        title="Remover Roteamento"
        description={`Tem certeza que deseja desvincular a instância "${deletingRouting?.instance?.instance_name}" do agente "${deletingRouting?.agent?.name}"? A instância parará de receber respostas automáticas.`}
      />
    </div>
  );
}
