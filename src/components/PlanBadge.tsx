import { PlanType, planLabels } from '@/types/client';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  plan: PlanType;
  className?: string;
}

const planStyles: Record<PlanType, string> = {
  monthly: 'bg-plan-monthly/10 text-plan-monthly border-plan-monthly/30',
  quarterly: 'bg-plan-quarterly/10 text-plan-quarterly border-plan-quarterly/30',
  semiannual: 'bg-plan-semiannual/10 text-plan-semiannual border-plan-semiannual/30',
  annual: 'bg-plan-annual/10 text-plan-annual border-plan-annual/30',
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        planStyles[plan],
        className
      )}
    >
      {planLabels[plan]}
    </span>
  );
}
