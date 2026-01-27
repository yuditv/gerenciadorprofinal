import { useState } from 'react';
import { Client, planLabels, getDaysUntilExpiration } from '@/types/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CalendarDays, 
  Clock, 
  Users,
  Loader2,
  Repeat,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useScheduledDispatches } from '@/hooks/useScheduledDispatches';

interface Props {
  selectedClients: Client[];
  message: string;
  onMessageChange: (message: string) => void;
}

const messageVariables = [
  { key: '{nome}', description: 'Nome do cliente' },
  { key: '{plano}', description: 'Plano atual' },
  { key: '{vencimento}', description: 'Data de vencimento' },
  { key: '{dias}', description: 'Dias até vencimento' },
];

export function ScheduleDispatch({ selectedClients, message, onMessageChange }: Props) {
  const { createSchedule } = useScheduledDispatches();
  
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [recurrenceType, setRecurrenceType] = useState<string>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>();
  const [isScheduling, setIsScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!scheduledDate || selectedClients.length === 0 || !message.trim()) return;
    
    setIsScheduling(true);
    
    // Combine date and time
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduleDateTime = new Date(scheduledDate);
    scheduleDateTime.setHours(hours, minutes, 0, 0);
    
    const clientIds = selectedClients.map(c => c.id);
    
    const success = await createSchedule(
      clientIds,
      message,
      scheduleDateTime,
      recurrenceType !== 'none' ? recurrenceType : undefined,
      recurrenceEndDate
    );
    
    if (success) {
      setScheduledDate(undefined);
      setRecurrenceType('none');
      setRecurrenceEndDate(undefined);
    }
    
    setIsScheduling(false);
  };

  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" />
          Agendar Disparo
        </CardTitle>
        <CardDescription>
          Programe o envio para uma data e hora específica
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected clients count */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <strong>{selectedClients.length}</strong> cliente(s) selecionado(s)
          </span>
        </div>
        
        {/* Message preview */}
        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Digite a mensagem para agendamento..."
            className="min-h-[100px] resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {messageVariables.map((v) => (
              <Badge
                key={v.key}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                onClick={() => onMessageChange(message + v.key)}
              >
                {v.key}
              </Badge>
            ))}
          </div>
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>Horário</Label>
            <Select value={scheduledTime} onValueChange={setScheduledTime}>
              <SelectTrigger>
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recurrence */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Recorrência
          </Label>
          <Select value={recurrenceType} onValueChange={setRecurrenceType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não repetir</SelectItem>
              <SelectItem value="daily">Diariamente</SelectItem>
              <SelectItem value="weekly">Semanalmente</SelectItem>
              <SelectItem value="monthly">Mensalmente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {recurrenceType !== 'none' && (
          <div className="space-y-2">
            <Label>Repetir até</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !recurrenceEndDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {recurrenceEndDate ? format(recurrenceEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione (opcional)"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={recurrenceEndDate}
                  onSelect={setRecurrenceEndDate}
                  disabled={(date) => date < (scheduledDate || new Date())}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Schedule Button */}
        <Button
          onClick={handleSchedule}
          disabled={isScheduling || selectedClients.length === 0 || !message.trim() || !scheduledDate}
          className="w-full gap-2"
        >
          {isScheduling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Agendando...
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4" />
              Agendar Disparo
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
