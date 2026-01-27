import { useScheduledDispatches, ScheduledDispatch } from '@/hooks/useScheduledDispatches';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  CalendarDays, 
  Clock, 
  Loader2,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  User,
  Repeat,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

export function ScheduledDispatchList() {
  const { pendingSchedules, sentSchedules, failedSchedules, isLoading, cancelSchedule, deleteSchedule } = useScheduledDispatches();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    await cancelSchedule(id);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteSchedule(deleteId);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-amber-500 text-amber-500"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'sent':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" />Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'cancelled':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRecurrenceLabel = (type: string | null) => {
    switch (type) {
      case 'daily':
        return 'Diário';
      case 'weekly':
        return 'Semanal';
      case 'monthly':
        return 'Mensal';
      default:
        return null;
    }
  };

  const ScheduleItem = ({ schedule }: { schedule: ScheduledDispatch }) => (
    <div className="p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{schedule.client?.name || 'Cliente desconhecido'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            <span>
              {format(new Date(schedule.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {schedule.recurrence_type && (
              <Badge variant="outline" className="text-xs ml-2">
                <Repeat className="h-3 w-3 mr-1" />
                {getRecurrenceLabel(schedule.recurrence_type)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {getStatusBadge(schedule.status)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        {schedule.custom_message}
      </p>
      {schedule.status === 'pending' && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleCancel(schedule.id)}
          >
            Cancelar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => setDeleteId(schedule.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      {schedule.status === 'failed' && schedule.error_message && (
        <p className="text-xs text-destructive mt-1">Erro: {schedule.error_message}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allSchedules = [...pendingSchedules, ...sentSchedules, ...failedSchedules];

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Agendamentos
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              {pendingSchedules.length} pendente(s)
            </Badge>
            <Badge variant="outline" className="border-emerald-500 text-emerald-500">
              {sentSchedules.length} enviado(s)
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>
          Visualize e gerencie disparos agendados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allSchedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum agendamento</p>
            <p className="text-sm">Agende um disparo para ver aqui</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-3">
              {allSchedules.map((schedule) => (
                <ScheduleItem key={schedule.id} schedule={schedule} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
