import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Timer, Pause, Brain, Phone, Archive, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimingConfigProps {
  minDelay: number;
  maxDelay: number;
  pauseAfterMessages: number;
  pauseDurationMinutes: number;
  stopAfterMessages: number;
  smartDelay: boolean;
  attentionCall: boolean;
  attentionCallDelay: number;
  autoArchive: boolean;
  aiPersonalization: boolean;
  onConfigChange: (config: Partial<TimingConfigProps>) => void;
}

export function TimingConfig({
  minDelay,
  maxDelay,
  pauseAfterMessages,
  pauseDurationMinutes,
  stopAfterMessages,
  smartDelay,
  attentionCall,
  attentionCallDelay,
  autoArchive,
  aiPersonalization,
  onConfigChange
}: TimingConfigProps) {
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="stats-icon-container info">
            <Timer className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Configurações de Timing</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Controle de velocidade e pausas
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        {/* Delay Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Delay entre mensagens
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Mínimo (segundos)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[minDelay]}
                  onValueChange={([v]) => onConfigChange({ minDelay: v })}
                  min={1}
                  max={30}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={minDelay}
                  onChange={(e) => onConfigChange({ minDelay: Number(e.target.value) })}
                  className="w-16 text-center bg-background/50"
                  min={1}
                  max={30}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Máximo (segundos)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[maxDelay]}
                  onValueChange={([v]) => onConfigChange({ maxDelay: v })}
                  min={1}
                  max={60}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={maxDelay}
                  onChange={(e) => onConfigChange({ maxDelay: Number(e.target.value) })}
                  className="w-16 text-center bg-background/50"
                  min={1}
                  max={60}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pause Settings */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Pause className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">Pausas Automáticas</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pausar a cada (mensagens)</Label>
              <Input
                type="number"
                value={pauseAfterMessages}
                onChange={(e) => onConfigChange({ pauseAfterMessages: Number(e.target.value) })}
                min={0}
                placeholder="Ex: 100"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Duração da pausa (minutos)</Label>
              <Input
                type="number"
                value={pauseDurationMinutes}
                onChange={(e) => onConfigChange({ pauseDurationMinutes: Number(e.target.value) })}
                min={1}
                placeholder="Ex: 30"
                className="bg-background/50"
              />
            </div>
          </div>
          {pauseAfterMessages > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20"
            >
              <p className="text-sm text-muted-foreground">
                O sistema pausará automaticamente a cada <strong className="text-foreground">{pauseAfterMessages}</strong> mensagens 
                por <strong className="text-foreground">{pauseDurationMinutes}</strong> minutos
              </p>
            </motion.div>
          )}
        </div>

        {/* Stop Settings */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Parar completamente após (mensagens) - 0 = desativado
            </Label>
            <Input
              type="number"
              value={stopAfterMessages}
              onChange={(e) => onConfigChange({ stopAfterMessages: Number(e.target.value) })}
              min={0}
              placeholder="Ex: 500"
              className="bg-background/50"
            />
          </div>
          {stopAfterMessages > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                O disparo irá parar após {stopAfterMessages} mensagens
              </Badge>
            </motion.div>
          )}
        </div>

        {/* Advanced Toggles */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <Label className="text-sm font-medium">Opções Avançadas</Label>
          
          <div className="grid grid-cols-1 gap-3">
            <motion.div 
              className={cn(
                "flex items-center justify-between p-4 rounded-xl transition-all duration-300",
                "bg-gradient-to-r from-muted/30 to-transparent border border-white/10",
                smartDelay && "border-primary/30 bg-primary/5"
              )}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  smartDelay ? "bg-primary/20" : "bg-muted/50"
                )}>
                  <Brain className={cn("w-5 h-5", smartDelay ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <Label className="text-sm cursor-pointer">Delay Inteligente</Label>
                  <p className="text-xs text-muted-foreground">
                    Varia o delay de forma não-linear
                  </p>
                </div>
              </div>
              <Switch
                checked={smartDelay}
                onCheckedChange={(v) => onConfigChange({ smartDelay: v })}
              />
            </motion.div>

            <motion.div 
              className={cn(
                "flex items-center justify-between p-4 rounded-xl transition-all duration-300",
                "bg-gradient-to-r from-muted/30 to-transparent border border-white/10",
                attentionCall && "border-orange-500/30 bg-orange-500/5"
              )}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  attentionCall ? "bg-orange-500/20" : "bg-muted/50"
                )}>
                  <Phone className={cn("w-5 h-5", attentionCall ? "text-orange-500" : "text-muted-foreground")} />
                </div>
                <div>
                  <Label className="text-sm cursor-pointer">Ligação de Atenção</Label>
                  <p className="text-xs text-muted-foreground">
                    Faz ligação após cada mensagem
                  </p>
                </div>
              </div>
              <Switch
                checked={attentionCall}
                onCheckedChange={(v) => onConfigChange({ attentionCall: v })}
              />
            </motion.div>

            {/* Attention Call Delay Slider */}
            {attentionCall && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-4 pr-4 pb-2"
              >
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm text-muted-foreground">
                      Delay antes da ligação
                    </Label>
                    <Badge variant="outline" className="border-orange-500/30 text-orange-500">
                      {attentionCallDelay}s
                    </Badge>
                  </div>
                  <Slider
                    value={[attentionCallDelay]}
                    onValueChange={([v]) => onConfigChange({ attentionCallDelay: v })}
                    min={0}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Aguarda {attentionCallDelay} segundo(s) após enviar a mensagem
                  </p>
                </div>
              </motion.div>
            )}

            <motion.div 
              className={cn(
                "flex items-center justify-between p-4 rounded-xl transition-all duration-300",
                "bg-gradient-to-r from-muted/30 to-transparent border border-white/10",
                autoArchive && "border-blue-500/30 bg-blue-500/5"
              )}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  autoArchive ? "bg-blue-500/20" : "bg-muted/50"
                )}>
                  <Archive className={cn("w-5 h-5", autoArchive ? "text-blue-500" : "text-muted-foreground")} />
                </div>
                <div>
                  <Label className="text-sm cursor-pointer">Arquivar Chats</Label>
                  <p className="text-xs text-muted-foreground">Arquiva após enviar</p>
                </div>
              </div>
              <Switch
                checked={autoArchive}
                onCheckedChange={(v) => onConfigChange({ autoArchive: v })}
              />
            </motion.div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-white/5 opacity-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted/30">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <Label className="text-sm">IA Personalização</Label>
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
              </div>
              <Switch checked={aiPersonalization} disabled />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
