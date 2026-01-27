import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  Type, 
  Image, 
  Video, 
  Mic, 
  Repeat, 
  XCircle, 
  Trash2,
  CheckCircle,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { StatusSchedule } from '@/hooks/useStatusSchedules';

interface StatusScheduleCardProps {
  schedule: StatusSchedule;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_ICONS = {
  text: Type,
  image: Image,
  video: Video,
  audio: Mic,
};

const STATUS_LABELS = {
  pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
  sent: { label: 'Enviado', variant: 'default' as const, icon: CheckCircle },
  failed: { label: 'Falhou', variant: 'destructive' as const, icon: AlertCircle },
  cancelled: { label: 'Cancelado', variant: 'outline' as const, icon: XCircle },
};

const RECURRENCE_LABELS = {
  none: 'Única vez',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
};

const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const BACKGROUND_COLORS: Record<number, string> = {
  1: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  2: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  3: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  4: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  5: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  6: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  7: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  8: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  9: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  10: 'linear-gradient(135deg, #20002c 0%, #cbb4d4 100%)',
};

export function StatusScheduleCard({ schedule, onCancel, onDelete }: StatusScheduleCardProps) {
  const StatusIcon = STATUS_ICONS[schedule.status_type];
  const statusInfo = STATUS_LABELS[schedule.status];
  const StatusBadgeIcon = statusInfo.icon;

  const scheduledDate = new Date(schedule.scheduled_at);
  const isRecurrent = schedule.recurrence_type !== 'none';

  const getRecurrenceLabel = () => {
    if (schedule.recurrence_type === 'weekly' && schedule.recurrence_days) {
      const days = schedule.recurrence_days.map(d => WEEK_DAYS_SHORT[d]).join(', ');
      return `${RECURRENCE_LABELS[schedule.recurrence_type]} (${days})`;
    }
    return RECURRENCE_LABELS[schedule.recurrence_type];
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {/* Preview thumbnail */}
          <div 
            className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-white"
            style={{ 
              background: schedule.status_type === 'text' 
                ? BACKGROUND_COLORS[schedule.background_color] || BACKGROUND_COLORS[1]
                : 'hsl(var(--muted))'
            }}
          >
            <StatusIcon className="h-8 w-8" />
          </div>

          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Status type & content preview */}
                <p className="text-sm font-medium truncate">
                  {schedule.status_type === 'text' 
                    ? schedule.text_content?.substring(0, 50) + (schedule.text_content && schedule.text_content.length > 50 ? '...' : '')
                    : schedule.media_url?.split('/').pop()
                  }
                </p>

                {/* Schedule info */}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(scheduledDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(scheduledDate, 'HH:mm')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    {schedule.instance_ids.length}
                  </span>
                </div>

                {/* Recurrence */}
                {isRecurrent && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Repeat className="h-3 w-3" />
                    <span>{getRecurrenceLabel()}</span>
                  </div>
                )}

                {/* Results for sent/failed */}
                {(schedule.status === 'sent' || schedule.status === 'failed') && (
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    {schedule.success_count > 0 && (
                      <span className="text-green-600">✓ {schedule.success_count}</span>
                    )}
                    {schedule.fail_count > 0 && (
                      <span className="text-destructive">✗ {schedule.fail_count}</span>
                    )}
                  </div>
                )}

                {/* Error message */}
                {schedule.error_message && (
                  <p className="text-xs text-destructive mt-1 truncate">
                    {schedule.error_message}
                  </p>
                )}
              </div>

              {/* Status badge */}
              <Badge variant={statusInfo.variant} className="flex-shrink-0">
                <StatusBadgeIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>

            {/* Actions */}
            {schedule.status === 'pending' && (
              <div className="flex justify-end gap-1 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(schedule.id)}
                  className="h-7 text-xs"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(schedule.id)}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </Button>
              </div>
            )}

            {schedule.status !== 'pending' && (
              <div className="flex justify-end mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(schedule.id)}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
