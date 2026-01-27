import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CircularProgress } from '@/components/ui/circular-progress';
import { 
  Play, Pause, Square, BarChart3, 
  CheckCircle2, XCircle, Clock, User, Archive,
  Zap, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DispatchProgressProps {
  progress: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    archived: number;
    currentContact?: string;
    isPaused: boolean;
    isRunning: boolean;
    estimatedTimeRemaining?: number;
    logs: Array<{
      time: Date;
      type: 'success' | 'error' | 'info' | 'warning';
      message: string;
    }>;
  };
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  canStart: boolean;
  showArchiveCount?: boolean;
}

export function DispatchProgress({
  progress,
  onStart,
  onPause,
  onResume,
  onCancel,
  canStart,
  showArchiveCount = true
}: DispatchProgressProps) {
  const percentage = progress.total > 0 
    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
    : 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />;
      default:
        return <BarChart3 className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "stats-icon-container transition-all",
              progress.isRunning && !progress.isPaused ? "primary glow-pulse" : "primary"
            )}>
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Progresso do Disparo</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Acompanhe em tempo real
              </p>
            </div>
          </div>
          {progress.isRunning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Badge 
                className={cn(
                  "font-medium gap-1.5",
                  progress.isPaused 
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" 
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                )}
              >
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  progress.isPaused ? "bg-yellow-400" : "bg-emerald-500 animate-pulse"
                )} />
                {progress.isPaused ? 'Pausado' : 'Em andamento'}
              </Badge>
            </motion.div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {/* Main Action Button */}
        <div className="flex gap-2">
          {!progress.isRunning ? (
            <motion.div className="flex-1" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button 
                onClick={onStart} 
                disabled={!canStart}
                className="w-full h-14 text-lg gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                size="lg"
              >
                <Play className="w-6 h-6" />
                Iniciar Disparo
                {progress.total > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-white/20">
                    {progress.total} contatos
                  </Badge>
                )}
              </Button>
            </motion.div>
          ) : (
            <>
              {progress.isPaused ? (
                <motion.div className="flex-1" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button 
                    onClick={onResume} 
                    className="w-full h-12 gap-2"
                    variant="default"
                  >
                    <Play className="w-5 h-5" />
                    Retomar
                  </Button>
                </motion.div>
              ) : (
                <motion.div className="flex-1" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button 
                    onClick={onPause} 
                    className="w-full h-12 gap-2"
                    variant="secondary"
                  >
                    <Pause className="w-5 h-5" />
                    Pausar
                  </Button>
                </motion.div>
              )}
              <Button 
                onClick={onCancel} 
                variant="destructive"
                className="h-12 px-6"
              >
                <Square className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Circular Progress - Shown during dispatch */}
        <AnimatePresence>
          {(progress.isRunning || progress.sent > 0 || progress.failed > 0) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <CircularProgress 
                value={percentage} 
                size={140}
                strokeWidth={10}
                animated={progress.isRunning && !progress.isPaused}
              />
              
              {/* Current Contact */}
              {progress.currentContact && progress.isRunning && !progress.isPaused && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <User className="w-4 h-4 animate-pulse" />
                  <span>Enviando para: <span className="text-foreground font-medium">{progress.currentContact}</span></span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        {(progress.total > 0) && (
          <motion.div 
            className="grid grid-cols-4 gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center p-3 rounded-xl bg-muted/30 border border-white/10">
              <div className="text-xl font-bold">{progress.total}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <div className="text-xl font-bold text-emerald-500">{progress.sent}</div>
              <div className="text-xs text-emerald-500/70 mt-0.5">Enviados</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20">
              <div className="text-xl font-bold text-red-500">{progress.failed}</div>
              <div className="text-xs text-red-500/70 mt-0.5">Falharam</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30 border border-white/10">
              <div className="text-xl font-bold text-muted-foreground">{progress.pending}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Pendentes</div>
            </div>
          </motion.div>
        )}

        {/* Estimated Time */}
        {progress.isRunning && progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground p-3 rounded-xl bg-muted/20"
          >
            <Clock className="w-4 h-4" />
            <span>Tempo estimado: ~{formatTime(Math.round(progress.estimatedTimeRemaining))}</span>
          </motion.div>
        )}

        {/* Activity Log */}
        {progress.logs.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Atividade Recente
            </div>
            <ScrollArea className="h-[140px] rounded-xl bg-background/50 border border-white/10">
              <div className="p-3 space-y-1">
                <AnimatePresence mode="popLayout">
                  {progress.logs.slice(-20).reverse().map((log, index) => (
                    <motion.div
                      key={`${log.time.getTime()}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {getLogIcon(log.type)}
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        {log.time.toLocaleTimeString('pt-BR')}
                      </span>
                      <span className={cn(
                        "flex-1",
                        log.type === 'error' && 'text-red-400',
                        log.type === 'success' && 'text-emerald-400',
                        log.type === 'warning' && 'text-yellow-400'
                      )}>
                        {log.message}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
