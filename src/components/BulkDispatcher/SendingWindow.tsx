import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SendingWindowProps {
  enabled: boolean;
  startTime: string;
  endTime: string;
  allowedDays: number[];
  onEnabledChange: (enabled: boolean) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onAllowedDaysChange: (days: number[]) => void;
}

const DAYS = [
  { value: 7, label: 'D', full: 'Domingo' },
  { value: 1, label: 'S', full: 'Segunda' },
  { value: 2, label: 'T', full: 'Terça' },
  { value: 3, label: 'Q', full: 'Quarta' },
  { value: 4, label: 'Q', full: 'Quinta' },
  { value: 5, label: 'S', full: 'Sexta' },
  { value: 6, label: 'S', full: 'Sábado' },
];

export function SendingWindow({
  enabled,
  startTime,
  endTime,
  allowedDays,
  onEnabledChange,
  onStartTimeChange,
  onEndTimeChange,
  onAllowedDaysChange
}: SendingWindowProps) {
  const toggleDay = (day: number) => {
    if (allowedDays.includes(day)) {
      onAllowedDaysChange(allowedDays.filter(d => d !== day));
    } else {
      onAllowedDaysChange([...allowedDays, day].sort());
    }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="stats-icon-container warning">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Janela de Envio</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Horários permitidos
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-5 pt-4", !enabled && "opacity-50 pointer-events-none")}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Horário de Início</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Horário de Fim</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="bg-background/50"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm">Dias Permitidos</Label>
          <div className="flex gap-2">
            {DAYS.map((day) => {
              const isSelected = allowedDays.includes(day.value);
              return (
                <motion.button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  title={day.full}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "w-10 h-10 rounded-full font-medium text-sm transition-all duration-300",
                    "border-2 backdrop-blur-sm",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
                      : "bg-background/40 text-muted-foreground border-white/10 hover:border-primary/50"
                  )}
                >
                  {day.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {enabled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20"
          >
            <p className="text-sm text-muted-foreground">
              📅 Mensagens serão enviadas apenas entre <strong className="text-foreground">{startTime}</strong> e <strong className="text-foreground">{endTime}</strong>
              {allowedDays.length < 7 && (
                <> nos dias: <strong className="text-foreground">{allowedDays.map(d => DAYS.find(day => day.value === d)?.full).join(', ')}</strong></>
              )}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
