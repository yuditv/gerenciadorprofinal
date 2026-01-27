import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Type, Image, Video, Mic, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateScheduleInput } from '@/hooks/useStatusSchedules';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
}

interface StatusScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (schedule: CreateScheduleInput) => Promise<boolean>;
  instances: WhatsAppInstance[];
}

const STATUS_TYPES = [
  { value: 'text', label: 'Texto', icon: Type },
  { value: 'image', label: 'Imagem', icon: Image },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'audio', label: 'Áudio', icon: Mic },
] as const;

const BACKGROUND_COLORS = [
  { id: 1, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 2, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 3, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 4, gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 5, gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 6, gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: 7, gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  { id: 8, gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 9, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 10, gradient: 'linear-gradient(135deg, #20002c 0%, #cbb4d4 100%)' },
];

const FONT_STYLES = [
  { id: 0, name: 'Padrão' },
  { id: 1, name: 'Serif' },
  { id: 2, name: 'Elegante' },
  { id: 3, name: 'Manuscrito' },
  { id: 4, name: 'Bold' },
];

const WEEK_DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export function StatusScheduleDialog({ open, onOpenChange, onSave, instances }: StatusScheduleDialogProps) {
  const [statusType, setStatusType] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [textContent, setTextContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(1);
  const [fontStyle, setFontStyle] = useState(0);
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>();
  const [isSaving, setIsSaving] = useState(false);

  const connectedInstances = instances.filter(i => i.status === 'connected');

  const toggleInstance = (id: string) => {
    const newSet = new Set(selectedInstances);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedInstances(newSet);
  };

  const selectAllInstances = () => {
    if (selectedInstances.size === connectedInstances.length) {
      setSelectedInstances(new Set());
    } else {
      setSelectedInstances(new Set(connectedInstances.map(i => i.id)));
    }
  };

  const toggleRecurrenceDay = (day: number) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  const handleSave = async () => {
    if (!scheduledDate) {
      return;
    }
    if (selectedInstances.size === 0) {
      return;
    }
    if (statusType === 'text' && !textContent.trim()) {
      return;
    }
    if (statusType !== 'text' && !mediaUrl.trim()) {
      return;
    }

    setIsSaving(true);

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const success = await onSave({
      status_type: statusType,
      text_content: statusType === 'text' ? textContent : undefined,
      background_color: backgroundColor,
      font_style: fontStyle,
      media_url: statusType !== 'text' ? mediaUrl : undefined,
      instance_ids: Array.from(selectedInstances),
      scheduled_at: scheduledAt,
      recurrence_type: recurrenceType,
      recurrence_days: recurrenceType === 'weekly' ? recurrenceDays : undefined,
      recurrence_end_date: recurrenceType !== 'none' ? recurrenceEndDate : undefined,
    });

    setIsSaving(false);

    if (success) {
      // Reset form
      setTextContent('');
      setMediaUrl('');
      setSelectedInstances(new Set());
      setScheduledDate(undefined);
      setRecurrenceType('none');
      setRecurrenceDays([]);
      setRecurrenceEndDate(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Novo Agendamento de Status
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Tipo de Status */}
            <div className="space-y-2">
              <Label>Tipo de Status</Label>
              <div className="flex gap-2">
                {STATUS_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    variant={statusType === type.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusType(type.value as typeof statusType)}
                    className="flex-1"
                  >
                    <type.icon className="h-4 w-4 mr-1" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Conteúdo */}
            {statusType === 'text' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Texto do Status</Label>
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Digite o texto do seu status..."
                    rows={4}
                    maxLength={700}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {textContent.length}/700
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Cor de Fundo</Label>
                  <div className="flex flex-wrap gap-2">
                    {BACKGROUND_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setBackgroundColor(color.id)}
                        className={cn(
                          "w-10 h-10 rounded-lg border-2 transition-all",
                          backgroundColor === color.id
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-transparent"
                        )}
                        style={{ background: color.gradient }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Select value={fontStyle.toString()} onValueChange={(v) => setFontStyle(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_STYLES.map((font) => (
                        <SelectItem key={font.id} value={font.id.toString()}>
                          {font.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>URL da Mídia</Label>
                <Input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Insira a URL pública do arquivo de mídia
                </p>
              </div>
            )}

            {/* Instâncias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Instâncias ({selectedInstances.size}/{connectedInstances.length})</Label>
                <Button variant="ghost" size="sm" onClick={selectAllInstances}>
                  {selectedInstances.size === connectedInstances.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50">
                {connectedInstances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma instância conectada</p>
                ) : (
                  connectedInstances.map((instance) => (
                    <Badge
                      key={instance.id}
                      variant={selectedInstances.has(instance.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleInstance(instance.id)}
                    >
                      {instance.instance_name}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Data e Hora */}
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
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, 'PPP', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Hora</Label>
                <Select value={scheduledTime} onValueChange={setScheduledTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeOptions().map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Recorrência */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as typeof recurrenceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Única vez</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === 'weekly' && (
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-2">
                    {WEEK_DAYS.map((day) => (
                      <Button
                        key={day.value}
                        variant={recurrenceDays.includes(day.value) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleRecurrenceDay(day.value)}
                        className="flex-1"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceType !== 'none' && (
                <div className="space-y-2">
                  <Label>Repetir até (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !recurrenceEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurrenceEndDate ? format(recurrenceEndDate, 'PPP', { locale: ptBR }) : 'Sem data final'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={recurrenceEndDate}
                        onSelect={setRecurrenceEndDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              !scheduledDate ||
              selectedInstances.size === 0 ||
              (statusType === 'text' && !textContent.trim()) ||
              (statusType !== 'text' && !mediaUrl.trim())
            }
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
