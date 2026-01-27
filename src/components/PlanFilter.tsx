import { PlanType, planLabels } from '@/types/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlanFilterProps {
  selected: PlanType | 'all';
  onSelect: (plan: PlanType | 'all') => void;
}

const planActiveStyles: Record<PlanType | 'all', string> = {
  all: 'bg-foreground text-background hover:bg-foreground/90',
  monthly: 'bg-plan-monthly text-white hover:bg-plan-monthly/90',
  quarterly: 'bg-plan-quarterly text-white hover:bg-plan-quarterly/90',
  semiannual: 'bg-plan-semiannual text-white hover:bg-plan-semiannual/90',
  annual: 'bg-plan-annual text-white hover:bg-plan-annual/90',
};

export function PlanFilter({ selected, onSelect }: PlanFilterProps) {
  const options: (PlanType | 'all')[] = ['all', 'monthly', 'quarterly', 'semiannual', 'annual'];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option}
          variant="outline"
          size="sm"
          onClick={() => onSelect(option)}
          className={cn(
            'transition-all',
            selected === option && planActiveStyles[option]
          )}
        >
          {option === 'all' ? 'Todos' : planLabels[option]}
        </Button>
      ))}
    </div>
  );
}
