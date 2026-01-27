import { Client, planLabels } from '@/types/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Calendar, ArrowRight } from 'lucide-react';
import { PlanBadge } from './PlanBadge';

interface RenewalHistoryDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenewalHistoryDialog({ client, open, onOpenChange }: RenewalHistoryDialogProps) {
  if (!client) return null;

  const sortedHistory = [...client.renewalHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Renovações
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
            <span className="font-medium text-lg">{client.name}</span>
            <PlanBadge plan={client.plan} />
          </div>

          {sortedHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhuma renovação registrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                O histórico aparecerá aqui quando o plano for renovado.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {sortedHistory.map((renewal, index) => (
                  <div
                    key={renewal.id}
                    className="relative pl-6 pb-3 border-l-2 border-border last:border-l-transparent"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-[-5px] top-0 h-2.5 w-2.5 rounded-full bg-primary" />
                    
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Renovação #{sortedHistory.length - index}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(renewal.date, "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{format(renewal.previousExpiresAt, 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{format(renewal.newExpiresAt, 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">
                          Plano: {planLabels[renewal.plan]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
