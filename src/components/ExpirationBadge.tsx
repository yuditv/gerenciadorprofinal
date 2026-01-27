import { ExpirationStatus, getExpirationStatus, getDaysUntilExpiration } from '@/types/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface ExpirationBadgeProps {
  expiresAt: Date;
  className?: string;
}

const statusStyles: Record<ExpirationStatus, string> = {
  active: 'bg-plan-semiannual/10 text-plan-semiannual border-plan-semiannual/30',
  expiring: 'bg-plan-annual/10 text-plan-annual border-plan-annual/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
};

const StatusIcon = ({ status }: { status: ExpirationStatus }) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-3 w-3" />;
    case 'expiring':
      return <Clock className="h-3 w-3" />;
    case 'expired':
      return <AlertTriangle className="h-3 w-3" />;
  }
};

export function ExpirationBadge({ expiresAt, className }: ExpirationBadgeProps) {
  const status = getExpirationStatus(expiresAt);
  const daysLeft = getDaysUntilExpiration(expiresAt);

  const getLabel = () => {
    if (status === 'expired') {
      return `Vencido há ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
    }
    if (status === 'expiring') {
      return daysLeft === 0 ? 'Vence hoje' : `Vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`;
    }
    return 'Ativo';
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        statusStyles[status],
        className
      )}
    >
      <StatusIcon status={status} />
      {getLabel()}
    </span>
  );
}
