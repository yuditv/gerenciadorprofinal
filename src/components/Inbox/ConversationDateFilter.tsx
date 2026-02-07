import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface ConversationDateFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function ConversationDateFilter({ dateRange, onDateRangeChange }: ConversationDateFilterProps) {
  const [open, setOpen] = useState(false);

  const hasRange = dateRange?.from;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange(undefined);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasRange ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 gap-1.5"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">
              {hasRange
                ? `${format(dateRange.from!, 'dd/MM', { locale: ptBR })}${dateRange.to ? ` - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}` : ''}`
                : 'Data'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              if (range?.to) setOpen(false);
            }}
            numberOfMonths={1}
            locale={ptBR}
          />
          {hasRange && (
            <div className="p-2 border-t border-border">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { onDateRangeChange(undefined); setOpen(false); }}>
                Limpar filtro
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {hasRange && (
        <Badge
          variant="secondary"
          className="h-6 gap-1 cursor-pointer hover:bg-destructive/20"
          onClick={handleClear}
        >
          <CalendarDays className="h-2.5 w-2.5" />
          <span className="text-xs">
            {format(dateRange.from!, 'dd/MM', { locale: ptBR })}
            {dateRange.to && ` - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`}
          </span>
          <X className="h-2.5 w-2.5 text-muted-foreground" />
        </Badge>
      )}
    </div>
  );
}
