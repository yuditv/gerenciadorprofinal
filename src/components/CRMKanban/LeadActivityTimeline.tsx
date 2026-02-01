import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  Mail,
  Calendar,
  MessageCircle,
  FileText,
  CheckSquare,
  Plus,
  Check,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLeadActivities } from '@/hooks/useLeadActivities';
import { ACTIVITY_TYPES, LeadActivity } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface LeadActivityTimelineProps {
  leadId: string | null;
}

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  whatsapp: MessageCircle,
  note: FileText,
  task: CheckSquare,
  status_change: RefreshCw,
  created: Plus,
};

export function LeadActivityTimeline({ leadId }: LeadActivityTimelineProps) {
  const {
    activities,
    isLoading,
    fetchActivities,
    createActivity,
    markAsCompleted,
    deleteActivity,
  } = useLeadActivities(leadId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newActivity, setNewActivity] = useState({
    activity_type: 'note',
    title: '',
    description: '',
    scheduled_at: '',
  });

  useEffect(() => {
    if (leadId) {
      fetchActivities();
    }
  }, [leadId, fetchActivities]);

  const handleCreateActivity = async () => {
    if (!newActivity.title.trim()) return;

    await createActivity({
      activity_type: newActivity.activity_type,
      title: newActivity.title,
      description: newActivity.description || null,
      scheduled_at: newActivity.scheduled_at || null,
    });

    setNewActivity({
      activity_type: 'note',
      title: '',
      description: '',
      scheduled_at: '',
    });
    setShowAddDialog(false);
  };

  const getActivityIcon = (type: string) => {
    const Icon = ACTIVITY_ICONS[type] || FileText;
    return Icon;
  };

  const getActivityColor = (type: string) => {
    const activityType = ACTIVITY_TYPES.find(t => t.id === type);
    return activityType?.color || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Activity Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setShowAddDialog(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Registrar Atividade
      </Button>

      {/* Timeline */}
      <ScrollArea className="h-[300px]">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma atividade registrada</p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Vertical line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.activity_type);
              const color = getActivityColor(activity.activity_type);

              return (
                <div key={activity.id} className="relative pl-10 pr-2 group">
                  {/* Icon */}
                  <div
                    className={cn(
                      "absolute left-1 w-7 h-7 rounded-full flex items-center justify-center",
                      color
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>

                  {/* Content */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {activity.scheduled_at && !activity.completed_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => markAsCompleted(activity.id)}
                          >
                            <Check className="h-3 w-3 text-green-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteActivity(activity.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                      {activity.scheduled_at && (
                        <>
                          <span>•</span>
                          <span className={activity.completed_at ? 'line-through' : 'text-primary'}>
                            Agendado: {format(new Date(activity.scheduled_at), 'dd/MM HH:mm')}
                          </span>
                        </>
                      )}
                      {activity.completed_at && (
                        <>
                          <span>•</span>
                          <span className="text-green-500">✓ Concluído</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add Activity Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Atividade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={newActivity.activity_type}
                onValueChange={(value) =>
                  setNewActivity({ ...newActivity, activity_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((type) => {
                    const Icon = ACTIVITY_ICONS[type.id];
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={newActivity.title}
                onChange={(e) =>
                  setNewActivity({ ...newActivity, title: e.target.value })
                }
                placeholder="Ex: Ligação de follow-up"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newActivity.description}
                onChange={(e) =>
                  setNewActivity({ ...newActivity, description: e.target.value })
                }
                placeholder="Detalhes da atividade..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Agendar para (opcional)</Label>
              <Input
                type="datetime-local"
                value={newActivity.scheduled_at}
                onChange={(e) =>
                  setNewActivity({ ...newActivity, scheduled_at: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateActivity} disabled={!newActivity.title.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
