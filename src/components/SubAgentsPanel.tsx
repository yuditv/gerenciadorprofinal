import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, Plus, Trash2, GripVertical, Power, ChevronDown, ChevronUp,
  Brain, Sparkles, MessageSquare, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSubAgents } from "@/hooks/useSubAgents";
import { useAIAgents } from "@/hooks/useAIAgents";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface SubAgentsPanelProps {
  principalAgentId: string;
}

export function SubAgentsPanel({ principalAgentId }: SubAgentsPanelProps) {
  const { 
    subAgentLinks, 
    isLoadingLinks, 
    getUnlinkedSubAgents,
    createLink,
    deleteLink,
    toggleLinkActive,
    reorderLinks,
  } = useSubAgents(principalAgentId);
  
  const { agents } = useAIAgents();
  
  const [selectedSubAgent, setSelectedSubAgent] = useState<string>("");
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unlinkedSubAgents = getUnlinkedSubAgents();
  
  // Get principal agent for display
  const principalAgent = agents.find(a => a.id === principalAgentId);

  const handleAddSubAgent = () => {
    if (!selectedSubAgent) return;
    
    createLink.mutate({
      principal_agent_id: principalAgentId,
      sub_agent_id: selectedSubAgent,
      priority: subAgentLinks.length + 1,
    });
    
    setSelectedSubAgent("");
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...subAgentLinks];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderLinks.mutate(newOrder.map(l => l.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === subAgentLinks.length - 1) return;
    const newOrder = [...subAgentLinks];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderLinks.mutate(newOrder.map(l => l.id));
  };

  const handleDelete = () => {
    if (deletingLink) {
      deleteLink.mutate(deletingLink);
      setDeletingLink(null);
    }
  };

  if (isLoadingLinks) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="glass-card border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/20">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">
                Sub-Agentes de "{principalAgent?.name || 'Agente Principal'}"
              </h3>
              <p className="text-sm text-muted-foreground">
                Os Sub-Agentes são especialistas que o Agente Principal pode consultar internamente.
                O cliente <strong>sempre</strong> conversa com o Principal, mas ele busca informações
                nos especialistas quando necessário.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Sub-Agent */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Sub-Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select value={selectedSubAgent} onValueChange={setSelectedSubAgent}>
              <SelectTrigger className="flex-1 bg-background/50">
                <SelectValue placeholder="Selecione um Sub-Agente..." />
              </SelectTrigger>
              <SelectContent>
                {unlinkedSubAgents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <p>Nenhum Sub-Agente disponível.</p>
                    <p className="text-xs mt-1">
                      Crie novos agentes com tipo "Sub-Agente".
                    </p>
                  </div>
                ) : (
                  unlinkedSubAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: agent.color || '#3b82f6' }}
                        />
                        <span>{agent.name}</span>
                        {agent.specialization && (
                          <Badge variant="outline" className="text-xs ml-2">
                            {agent.specialization}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAddSubAgent}
              disabled={!selectedSubAgent || createLink.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Vincular
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Linked Sub-Agents List */}
      <Card className="glass-card">
        <CardHeader className="border-b border-border/30">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Sub-Agentes Vinculados ({subAgentLinks.length})
          </CardTitle>
          <CardDescription>
            Arraste para reordenar a prioridade de consulta
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {subAgentLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum Sub-Agente vinculado ainda.</p>
              <p className="text-sm">Adicione especialistas para o Agente Principal consultar.</p>
            </div>
          ) : (
            <motion.div className="space-y-3">
              <AnimatePresence>
                {subAgentLinks.map((link, index) => (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={`p-4 rounded-lg border transition-all ${
                      link.is_active 
                        ? 'bg-card/50 border-border/50 hover:border-primary/30' 
                        : 'bg-muted/30 border-muted opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Drag Handle & Priority */}
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 hover:bg-muted rounded disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <button 
                          onClick={() => handleMoveDown(index)}
                          disabled={index === subAgentLinks.length - 1}
                          className="p-1 hover:bg-muted rounded disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Priority Badge */}
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ 
                          backgroundColor: `${link.sub_agent?.color || '#3b82f6'}20`,
                          color: link.sub_agent?.color || '#3b82f6'
                        }}
                      >
                        #{link.priority}
                      </div>

                      {/* Agent Icon */}
                      <div 
                        className="p-2 rounded-lg"
                        style={{ 
                          backgroundColor: `${link.sub_agent?.color || '#3b82f6'}20`,
                        }}
                      >
                        <Bot 
                          className="h-5 w-5" 
                          style={{ color: link.sub_agent?.color || '#3b82f6' }} 
                        />
                      </div>

                      {/* Agent Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {link.sub_agent?.name || 'Agente'}
                          </span>
                          {link.sub_agent?.specialization && (
                            <Badge variant="outline" className="text-xs">
                              {link.sub_agent.specialization}
                            </Badge>
                          )}
                        </div>
                        {link.sub_agent?.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {link.sub_agent.description}
                          </p>
                        )}
                      </div>

                      {/* Expand Info */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExpandedId(
                              expandedId === link.id ? null : link.id
                            )}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Ver detalhes do prompt
                        </TooltipContent>
                      </Tooltip>

                      {/* Toggle Active */}
                      <Switch
                        checked={link.is_active}
                        onCheckedChange={(checked) => 
                          toggleLinkActive.mutate({ id: link.id, is_active: checked })
                        }
                      />

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingLink(link.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {expandedId === link.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                            {link.sub_agent?.system_prompt && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <Brain className="h-3 w-3" />
                                  System Prompt
                                </p>
                                <p className="text-sm bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                                  {link.sub_agent.system_prompt}
                                </p>
                              </div>
                            )}
                            {link.sub_agent?.consultation_context && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  Contexto de Consulta
                                </p>
                                <p className="text-sm bg-muted/50 rounded-lg p-3">
                                  {link.sub_agent.consultation_context}
                                </p>
                              </div>
                            )}
                            {!link.sub_agent?.system_prompt && !link.sub_agent?.consultation_context && (
                              <p className="text-sm text-muted-foreground italic">
                                Nenhum prompt configurado para este Sub-Agente.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* How it Works Info */}
      <Card className="glass-card border-accent/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent/20">
              <MessageSquare className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="font-medium">Como funciona a consulta?</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>O cliente envia uma mensagem para o Agente Principal</li>
                <li>O Principal detecta que precisa de informação especializada</li>
                <li>Usa a ferramenta <code className="bg-muted px-1 rounded">consult_specialist</code> para consultar o Sub-Agente</li>
                <li>O Sub-Agente responde com a informação técnica</li>
                <li>O Principal incorpora a resposta e responde ao cliente de forma natural</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                O cliente <strong>nunca sabe</strong> que existe um Sub-Agente - a conversa parece única e fluida.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deletingLink}
        onOpenChange={(open) => !open && setDeletingLink(null)}
        onConfirm={handleDelete}
        title="Desvincular Sub-Agente"
        description="Tem certeza que deseja desvincular este Sub-Agente? O Agente Principal não poderá mais consultá-lo."
      />
    </div>
  );
}
