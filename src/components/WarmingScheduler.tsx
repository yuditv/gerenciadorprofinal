import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Calendar, 
  Clock, 
  Repeat, 
  Bell,
  BellRing,
  Save,
  X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WarmingSchedulerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (schedule: ScheduleConfig) => void;
  currentSchedule?: ScheduleConfig | null;
}

export interface ScheduleConfig {
  enabled: boolean;
  startTime: string; // HH:mm format
  recurrence: 'none' | 'daily' | 'weekly';
  days: number[]; // 0-6 for Sun-Sat
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export function WarmingScheduler({ 
  open, 
  onOpenChange, 
  onSave, 
  currentSchedule 
}: WarmingSchedulerProps) {
  const [enabled, setEnabled] = useState(currentSchedule?.enabled ?? false);
  const [startTime, setStartTime] = useState(currentSchedule?.startTime ?? '09:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>(
    currentSchedule?.recurrence ?? 'none'
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(
    currentSchedule?.days ?? [1, 2, 3, 4, 5] // Mon-Fri default
  );
  const [notifyOnStart, setNotifyOnStart] = useState(currentSchedule?.notifyOnStart ?? true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(currentSchedule?.notifyOnComplete ?? true);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSave = () => {
    if (enabled && recurrence === 'weekly' && selectedDays.length === 0) {
      toast.error('Selecione pelo menos um dia da semana');
      return;
    }

    const schedule: ScheduleConfig = {
      enabled,
      startTime,
      recurrence,
      days: selectedDays,
      notifyOnStart,
      notifyOnComplete,
    };

    onSave(schedule);
    onOpenChange(false);
    
    if (enabled) {
      toast.success('Agendamento configurado!');
    } else {
      toast.info('Agendamento desativado');
    }
  };

  const getNextScheduledTime = (): string => {
    if (!enabled) return '';
    
    const now = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(hours, minutes, 0, 0);
    
    if (recurrence === 'none') {
      if (scheduled <= now) {
        scheduled.setDate(scheduled.getDate() + 1);
      }
      return format(scheduled, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
    
    if (recurrence === 'daily') {
      if (scheduled <= now) {
        scheduled.setDate(scheduled.getDate() + 1);
      }
      return format(scheduled, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
    
    if (recurrence === 'weekly') {
      const currentDay = now.getDay();
      const sortedDays = [...selectedDays].sort((a, b) => a - b);
      
      // Find next day
      let nextDay = sortedDays.find(d => d > currentDay || (d === currentDay && scheduled > now));
      
      if (nextDay === undefined) {
        nextDay = sortedDays[0];
        scheduled.setDate(scheduled.getDate() + (7 - currentDay + nextDay));
      } else {
        scheduled.setDate(scheduled.getDate() + (nextDay - currentDay));
      }
      
      return format(scheduled, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR });
    }
    
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendamento Automático
          </DialogTitle>
          <DialogDescription>
            Configure o horário de início automático do aquecimento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Ativar Agendamento</p>
              <p className="text-sm text-muted-foreground">
                Iniciar aquecimento automaticamente
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Start Time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horário de Início
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  Recorrência
                </Label>
                <Select value={recurrence} onValueChange={(v) => setRecurrence(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Única vez</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanal (dias específicos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Days Selection (for weekly) */}
              {recurrence === 'weekly' && (
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.value}
                        variant={selectedDays.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDay(day.value)}
                        className="w-12"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notifications */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificações
                </Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="notifyStart"
                      checked={notifyOnStart}
                      onCheckedChange={(c) => setNotifyOnStart(c === true)}
                    />
                    <label htmlFor="notifyStart" className="text-sm">
                      Notificar ao iniciar
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="notifyComplete"
                      checked={notifyOnComplete}
                      onCheckedChange={(c) => setNotifyOnComplete(c === true)}
                    />
                    <label htmlFor="notifyComplete" className="text-sm">
                      Notificar ao concluir
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {enabled && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Próximo agendamento:</span>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {getNextScheduledTime()}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
