import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Trash2,
  RefreshCw,
  Brain,
  MessageSquare,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  History,
  Zap,
  Settings2,
} from 'lucide-react';
import { useAIMaintenance, type MaintenanceStats } from '@/hooks/useAIMaintenance';
import { cn } from '@/lib/utils';

interface AIMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIMaintenanceDialog({ open, onOpenChange }: AIMaintenanceDialogProps) {
  const {
    stats,
    isLoadingStats,
    refreshStats,
    clearMemories,
    clearChatHistory,
    clearMessageBuffers,
    clearAllData,
    reloadAgentConfigs,
    isClearingMemories,
    isClearingChat,
    isClearingBuffers,
    isClearingAll,
    isReloading,
  } = useAIMaintenance();

  const [confirmAction, setConfirmAction] = useState<{
    type: 'memories' | 'chat' | 'buffers' | 'all' | null;
    title: string;
    description: string;
  }>({ type: null, title: '', description: '' });

  const [options, setOptions] = useState({
    clearOldOnly: false, // Default to false for complete cleanup
    daysOld: 30,
  });

  const handleConfirmAction = () => {
    switch (confirmAction.type) {
      case 'memories':
        clearMemories.mutate({ oldOnly: options.clearOldOnly, daysOld: options.daysOld });
        break;
      case 'chat':
        clearChatHistory.mutate({ oldOnly: options.clearOldOnly, daysOld: options.daysOld });
        break;
      case 'buffers':
        clearMessageBuffers.mutate();
        break;
      case 'all':
        clearAllData.mutate({ oldOnly: options.clearOldOnly, daysOld: options.daysOld });
        break;
    }
    setConfirmAction({ type: null, title: '', description: '' });
  };

  const isAnyOperationRunning = isClearingMemories || isClearingChat || isClearingBuffers || isClearingAll || isReloading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/20">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              Manutenção da IA
            </DialogTitle>
            <DialogDescription>
              Limpe cache, memórias e dados antigos para otimizar o desempenho dos agentes
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
            <div className="space-y-6 py-2">
              {/* Stats Overview */}
              <Card className="glass-card border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      Estatísticas Atuais
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refreshStats()}
                      disabled={isLoadingStats}
                    >
                      <RefreshCw className={cn("h-4 w-4", isLoadingStats && "animate-spin")} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingStats ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatsCard
                        icon={Brain}
                        label="Memórias"
                        value={stats.memoriesCount}
                        color="text-purple-500"
                      />
                      <StatsCard
                        icon={MessageSquare}
                        label="Mensagens Chat"
                        value={stats.chatMessagesCount}
                        color="text-blue-500"
                      />
                      <StatsCard
                        icon={Clock}
                        label="Buffers Ativos"
                        value={stats.buffersCount}
                        color="text-amber-500"
                      />
                      <StatsCard
                        icon={History}
                        label="Dados Antigos"
                        value={stats.oldDataCount}
                        color="text-red-500"
                        subtitle={`>${options.daysOld} dias`}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Options */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Opções de Limpeza</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="clear-old-only" className="flex items-center gap-2">
                        Modo seguro (apenas dados antigos)
                        {!options.clearOldOnly && (
                          <Badge variant="destructive" className="text-xs">TUDO SERÁ APAGADO</Badge>
                        )}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {options.clearOldOnly 
                          ? `Remove apenas dados com mais de ${options.daysOld} dias`
                          : '⚠️ Remove TODOS os dados, incluindo recentes'}
                      </p>
                    </div>
                    <Switch
                      id="clear-old-only"
                      checked={options.clearOldOnly}
                      onCheckedChange={(checked) => setOptions(prev => ({ ...prev, clearOldOnly: checked }))}
                    />
                  </div>

                  {options.clearOldOnly && (
                    <div className="flex items-center gap-4 pl-4 border-l-2 border-primary/20">
                      <Label>Dias:</Label>
                      <div className="flex gap-2">
                        {[7, 15, 30, 60, 90].map((days) => (
                          <Button
                            key={days}
                            variant={options.daysOld === days ? "default" : "outline"}
                            size="sm"
                            onClick={() => setOptions(prev => ({ ...prev, daysOld: days }))}
                          >
                            {days}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Ações de Limpeza
                </h4>

                {/* Clear Memories */}
                <ActionCard
                  icon={Brain}
                  title="Limpar Memórias de Clientes"
                  description="Remove todas as memórias extraídas pela IA sobre clientes (nome, plano, dispositivo, etc.)"
                  color="purple"
                  isLoading={isClearingMemories}
                  disabled={isAnyOperationRunning}
                  buttonLabel={options.clearOldOnly ? `Limpar >${options.daysOld}d` : "Limpar Tudo"}
                  onAction={() => setConfirmAction({
                    type: 'memories',
                    title: 'Limpar Memórias?',
                    description: options.clearOldOnly 
                      ? `Isso irá remover memórias de clientes com mais de ${options.daysOld} dias. Dados recentes serão mantidos.`
                      : '⚠️ Isso irá remover TODAS as memórias de clientes. A IA não lembrará mais de nenhuma informação previamente coletada.',
                  })}
                />

                {/* Clear Chat History */}
                <ActionCard
                  icon={MessageSquare}
                  title="Limpar Histórico de Chat"
                  description="Remove o histórico de conversas do chat web com os agentes de IA"
                  color="blue"
                  isLoading={isClearingChat}
                  disabled={isAnyOperationRunning}
                  buttonLabel={options.clearOldOnly ? `Limpar >${options.daysOld}d` : "Limpar Tudo"}
                  onAction={() => setConfirmAction({
                    type: 'chat',
                    title: 'Limpar Histórico de Chat?',
                    description: options.clearOldOnly
                      ? `Isso irá remover mensagens de chat com mais de ${options.daysOld} dias. Dados recentes serão mantidos.`
                      : '⚠️ Isso irá remover TODO o histórico de conversas do chat web com a IA.',
                  })}
                />

                {/* Clear Message Buffers */}
                <ActionCard
                  icon={Clock}
                  title="Limpar Buffers de Mensagens"
                  description="Remove mensagens pendentes no buffer de processamento da IA"
                  color="amber"
                  isLoading={isClearingBuffers}
                  disabled={isAnyOperationRunning}
                  onAction={() => setConfirmAction({
                    type: 'buffers',
                    title: 'Limpar Buffers?',
                    description: 'Isso irá cancelar todas as mensagens que estão aguardando processamento pela IA. Clientes podem precisar reenviar suas mensagens.',
                  })}
                />

                <Separator />

                {/* Reload Configurations */}
                <ActionCard
                  icon={Sparkles}
                  title="Recarregar Configurações"
                  description="Força a atualização dos prompts e configurações dos agentes (aplicado na próxima mensagem)"
                  color="green"
                  isLoading={isReloading}
                  disabled={isAnyOperationRunning}
                  buttonLabel="Recarregar"
                  variant="secondary"
                  onAction={() => reloadAgentConfigs.mutate()}
                />

                <Separator />

                {/* Clear All - Danger Zone */}
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-destructive/20">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <h4 className="font-medium text-destructive">Reset Completo da IA</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Remove todas as memórias, histórico de chat e buffers. Use apenas em casos extremos.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isAnyOperationRunning}
                        onClick={() => setConfirmAction({
                          type: 'all',
                          title: 'Reset Completo?',
                          description: options.clearOldOnly
                            ? `Isso irá remover TODOS os dados da IA com mais de ${options.daysOld} dias. Esta ação não pode ser desfeita.`
                            : 'Isso irá remover TODOS os dados da IA: memórias, histórico e buffers. Esta ação NÃO pode ser desfeita!',
                        })}
                      >
                        {isClearingAll ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Limpar Tudo
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info */}
              <Card className="bg-muted/30 border-muted">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5" />
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Dica:</strong> As configurações de prompt são carregadas a cada mensagem recebida.</p>
                      <p>Alterar o prompt no painel de agentes é aplicado imediatamente na próxima resposta.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={confirmAction.type !== null} 
        onOpenChange={(open) => !open && setConfirmAction({ type: null, title: '', description: '' })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirmAction.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Stats Card Component
function StatsCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <Icon className={cn("h-5 w-5 mx-auto mb-1", color)} />
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
    </div>
  );
}

// Action Card Component
function ActionCard({
  icon: Icon,
  title,
  description,
  color,
  isLoading,
  disabled,
  onAction,
  buttonLabel = "Limpar",
  variant = "outline",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: 'purple' | 'blue' | 'amber' | 'green' | 'red';
  isLoading: boolean;
  disabled: boolean;
  onAction: () => void;
  buttonLabel?: string;
  variant?: 'outline' | 'secondary' | 'destructive';
}) {
  const colorClasses = {
    purple: 'text-purple-500 bg-purple-500/20',
    blue: 'text-blue-500 bg-blue-500/20',
    amber: 'text-amber-500 bg-amber-500/20',
    green: 'text-green-500 bg-green-500/20',
    red: 'text-red-500 bg-red-500/20',
  };

  return (
    <Card className="glass-card">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg", colorClasses[color])}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium">{title}</h4>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
          <Button
            variant={variant}
            size="sm"
            disabled={disabled}
            onClick={onAction}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              buttonLabel
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
