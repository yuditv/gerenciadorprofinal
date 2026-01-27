import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  User, 
  Smartphone, 
  Package, 
  Calendar,
  Star,
  MessageSquare,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { useAIClientMemoryByPhone, useAIClientMemories, type AIClientMemory } from '@/hooks/useAIClientMemories';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AIMemoryPanelProps {
  phone: string | null;
  agentId?: string | null;
}

export function AIMemoryPanel({ phone, agentId }: AIMemoryPanelProps) {
  const { data: memory, isLoading } = useAIClientMemoryByPhone(phone, agentId);
  const { deleteMemory, clearCustomMemories } = useAIClientMemories(agentId);
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Memória da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!memory) {
    return (
      <Card className="glass-card border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <Brain className="h-4 w-4" />
            Memória da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma memória registrada para este contato.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sentimentConfig = {
    positive: { label: 'Positivo', color: 'bg-emerald-500/20 text-emerald-500', icon: '😊' },
    neutral: { label: 'Neutro', color: 'bg-blue-500/20 text-blue-500', icon: '😐' },
    negative: { label: 'Negativo', color: 'bg-red-500/20 text-red-500', icon: '😤' },
  };

  const sentiment = sentimentConfig[memory.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Memória da IA
            {memory.is_vip && (
              <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">
                <Star className="h-3 w-3 mr-1" />
                VIP
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Sentiment & Interactions */}
          <div className="flex items-center justify-between text-xs">
            <Badge variant="outline" className={cn("text-xs", sentiment.color)}>
              {sentiment.icon} {sentiment.label}
            </Badge>
            <span className="text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {memory.total_interactions} interações
            </span>
          </div>

          {/* Basic Info */}
          <div className="space-y-1.5">
            {memory.client_name && (
              <div className="flex items-center gap-2 text-xs">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{memory.client_name}</span>
                {memory.nickname && (
                  <span className="text-muted-foreground">({memory.nickname})</span>
                )}
              </div>
            )}

            {memory.device && (
              <div className="flex items-center gap-2 text-xs">
                <Smartphone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Dispositivo:</span>
                <span className="font-medium">{memory.device}</span>
              </div>
            )}

            {memory.app_name && (
              <div className="flex items-center gap-2 text-xs">
                <Package className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">App:</span>
                <span className="font-medium">{memory.app_name}</span>
              </div>
            )}

            {memory.plan_name && (
              <div className="flex items-center gap-2 text-xs">
                <Package className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Plano:</span>
                <span className="font-medium">{memory.plan_name}</span>
                {memory.plan_price && (
                  <span className="text-muted-foreground">
                    (R$ {memory.plan_price.toFixed(2)})
                  </span>
                )}
              </div>
            )}

            {memory.expiration_date && (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Vencimento:</span>
                <span className="font-medium">
                  {format(new Date(memory.expiration_date), "dd/MM/yyyy")}
                </span>
              </div>
            )}
          </div>

          {/* AI Summary */}
          {memory.ai_summary && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Resumo da IA
                </div>
                <p className="text-xs bg-primary/5 p-2 rounded-md border border-primary/10 line-clamp-3">
                  {memory.ai_summary}
                </p>
              </div>
            </>
          )}

          {/* Custom Memories */}
          {memory.custom_memories && memory.custom_memories.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  Informações Adicionais ({memory.custom_memories.length})
                </div>
                <ScrollArea className="max-h-24">
                  <div className="space-y-1">
                    {memory.custom_memories.map((mem, idx) => (
                      <div 
                        key={idx} 
                        className="text-xs bg-muted/50 px-2 py-1 rounded flex items-start gap-2"
                      >
                        <span className="font-medium text-primary min-w-fit">{mem.key}:</span>
                        <span className="text-muted-foreground">{mem.value}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {/* Last Interaction */}
          <div className="text-xs text-muted-foreground text-right pt-1">
            Última interação: {format(new Date(memory.last_interaction_at), "dd/MM/yy HH:mm", { locale: ptBR })}
          </div>

          {/* Clear Memory Action */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar Memórias
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar memórias da IA?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá apagar todas as memórias personalizadas e o resumo da IA para este contato.
                  As informações básicas (nome, dispositivo, etc.) serão mantidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => {
                    if (phone) {
                      clearCustomMemories.mutate({ phone, agentId: agentId || undefined });
                    }
                  }}
                >
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  );
}
