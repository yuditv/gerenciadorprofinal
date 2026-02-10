import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Smartphone, Wifi, WifiOff, RefreshCw, Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  phone_connected?: string;
  daily_limit?: number;
}

interface InstanceSidebarProps {
  instances: WhatsAppInstance[];
  selectedIds: string[];
  balancingMode: 'automatic' | 'round-robin' | 'single';
  onSelectionChange: (ids: string[]) => void;
  onBalancingModeChange: (mode: 'automatic' | 'round-robin' | 'single') => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  horizontal?: boolean;
}

export function InstanceSidebar({
  instances,
  selectedIds,
  balancingMode,
  onSelectionChange,
  onBalancingModeChange,
  onRefresh,
  isLoading,
  horizontal = false
}: InstanceSidebarProps) {
  const connectedInstances = instances.filter(i => i.status === 'connected');

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

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  if (horizontal) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <span className="font-medium">Instâncias</span>
            <Badge variant="secondary" className="text-xs">
              {selectedIds.length}/{connectedInstances.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll} disabled={connectedInstances.length === 0}>
              Todas
            </Button>
            {onRefresh && (
              <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {instances.map(instance => {
            const isSelected = selectedIds.includes(instance.id);
            const isConnected = instance.status === 'connected';
            
            return (
              <motion.div
                key={instance.id}
                onClick={() => isConnected && handleToggle(instance.id)}
                whileHover={isConnected ? { scale: 1.02 } : {}}
                whileTap={isConnected ? { scale: 0.98 } : {}}
                className={cn(
                  "flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all",
                  "border backdrop-blur-sm",
                  isSelected && "bg-primary/10 border-primary/50",
                  !isSelected && isConnected && "bg-background/40 border-white/10 hover:border-primary/30",
                  !isConnected && "opacity-50 cursor-not-allowed border-white/5"
                )}
              >
                <div className="instance-avatar">
                  {getInitials(instance.instance_name)}
                </div>
                <div>
                  <p className="font-medium text-sm truncate max-w-[120px]">{instance.instance_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isConnected ? '🟢 Online' : '🔴 Offline'}
                  </p>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="instance-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="stats-icon-container primary p-2">
            <Smartphone className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Instâncias</span>
        </div>
        {onRefresh && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-1 mb-3">
        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={selectAll} disabled={connectedInstances.length === 0}>
          Todas
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => onSelectionChange([])}>
          Limpar
        </Button>
      </div>

      {/* Instances List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {instances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma instância</p>
            </div>
          ) : (
            instances.map(instance => {
              const isSelected = selectedIds.includes(instance.id);
              const isConnected = instance.status === 'connected';
              
              return (
                <motion.div
                  key={instance.id}
                  onClick={() => isConnected && handleToggle(instance.id)}
                  whileHover={isConnected ? { x: 4 } : {}}
                  whileTap={isConnected ? { scale: 0.98 } : {}}
                  className={cn(
                    "instance-mini-card",
                    isSelected && "selected",
                    !isConnected && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="instance-avatar">
                    {getInitials(instance.instance_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{instance.instance_name}</p>
                    <div className="flex items-center gap-1">
                      {isConnected ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs text-emerald-500">Online</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-xs text-red-400">Offline</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Balancing Mode */}
      <div className="mt-3 pt-3 border-t border-border/30">
        <p className="text-xs text-muted-foreground mb-2">Modo de Envio</p>
        <Select value={balancingMode} onValueChange={(v) => onBalancingModeChange(v as any)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="automatic">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-primary" />
                  Automático
                </span>
                <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                  Distribui automaticamente priorizando instâncias menos utilizadas
                </span>
              </div>
            </SelectItem>
            <SelectItem value="round-robin">
              <div className="flex flex-col gap-0.5">
                <span>🔄 Alternado</span>
                <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                  Alterna o envio entre instâncias, uma por vez em sequência
                </span>
              </div>
            </SelectItem>
            <SelectItem value="single">
              <div className="flex flex-col gap-0.5">
                <span>1️⃣ Única</span>
                <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                  Usa apenas uma instância para todos os envios
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection Count */}
      <div className="mt-3 text-center">
        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs transition-all",
            selectedIds.length > 0 && "bg-primary/20 text-primary border-primary/30"
          )}
        >
          {selectedIds.length} selecionada(s)
        </Badge>
      </div>
    </div>
  );
}
