import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Wifi, WifiOff, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  phone_connected?: string;
  daily_limit?: number;
}

interface InstanceSelectorProps {
  instances: WhatsAppInstance[];
  selectedIds: string[];
  balancingMode: 'automatic' | 'round-robin' | 'single';
  onSelectionChange: (ids: string[]) => void;
  onBalancingModeChange: (mode: 'automatic' | 'round-robin' | 'single') => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function InstanceSelector({
  instances,
  selectedIds,
  balancingMode,
  onSelectionChange,
  onBalancingModeChange,
  onRefresh,
  isLoading
}: InstanceSelectorProps) {
  const connectedInstances = instances.filter(i => i.status === 'connected');
  const selectedCount = selectedIds.length;

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(connectedInstances.map(i => i.id));
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="stats-icon-container primary">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                Seleção de Instâncias
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Escolha as instâncias para disparo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 animate-pulse gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Sincronizando
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={selectAll} disabled={connectedInstances.length === 0 || isLoading}>
              Selecionar Todas
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedCount === 0 || isLoading}>
              Limpar
            </Button>
            {onRefresh && (
              <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading} title="Atualizar status das instâncias">
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {instances.length === 0 ? (
          <div className="empty-state py-10">
            <div className="empty-state-icon mb-4">
              <Smartphone className="h-10 w-10" />
            </div>
            <p className="font-medium text-foreground mb-1">Nenhuma instância encontrada</p>
            <p className="text-sm text-muted-foreground">Crie uma instância na aba "Instâncias"</p>
          </div>
        ) : (
          <>
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {instances.map(instance => {
                const isSelected = selectedIds.includes(instance.id);
                const isConnected = instance.status === 'connected';
                
                return (
                  <motion.div
                    key={instance.id}
                    variants={itemVariants}
                    onClick={() => isConnected && handleToggle(instance.id)}
                    whileHover={isConnected ? { scale: 1.02 } : {}}
                    whileTap={isConnected ? { scale: 0.98 } : {}}
                    className={cn(
                      "relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-300",
                      "bg-background/40 backdrop-blur-sm",
                      isSelected && "bg-primary/10 border-primary/50 shadow-[0_0_25px_hsl(var(--primary)/0.2)]",
                      !isSelected && isConnected && "border-white/10 hover:border-primary/30 hover:bg-primary/5",
                      !isConnected && "opacity-50 cursor-not-allowed border-white/5"
                    )}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-primary rounded-r-full"
                      />
                    )}
                    
                    <Checkbox
                      checked={isSelected}
                      disabled={!isConnected}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium truncate">
                          {instance.instance_name}
                        </span>
                        {isConnected ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Conectado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                            <WifiOff className="w-3 h-3" />
                            Offline
                          </Badge>
                        )}
                      </div>
                      {instance.phone_connected && (
                        <p className="text-sm text-muted-foreground">
                          📱 {instance.phone_connected}
                        </p>
                      )}
                      {instance.daily_limit && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Limite: {instance.daily_limit} msgs/dia
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Modo de balanceamento:</span>
                <Select value={balancingMode} onValueChange={(v) => onBalancingModeChange(v as any)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          Automático (Inteligente)
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Distribui mensagens entre as instâncias automaticamente, priorizando as menos utilizadas
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="round-robin">
                      <div className="flex flex-col gap-0.5">
                        <span>🔄 Round Robin (Alternado)</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Alterna o envio entre as instâncias selecionadas, uma por vez, em sequência
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="single">
                      <div className="flex flex-col gap-0.5">
                        <span>1️⃣ Única Instância</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Usa apenas uma instância para todos os envios
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-sm transition-all",
                  selectedCount > 0 && "bg-primary/20 text-primary border-primary/30"
                )}
              >
                {selectedCount} instância(s) selecionada(s)
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
