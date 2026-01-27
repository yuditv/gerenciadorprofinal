import { Check, CheckCheck, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isOutgoing: boolean;
  className?: string;
  onRetry?: () => void;
}

export function MessageStatus({ status, isOutgoing, className, onRetry }: MessageStatusProps) {
  if (!isOutgoing) return null;

  const getStatusInfo = () => {
    switch (status) {
      case 'sending':
        return {
          icon: Clock,
          label: 'Enviando...',
          color: 'text-muted-foreground animate-pulse'
        };
      case 'sent':
        return {
          icon: Check,
          label: 'Enviada',
          color: 'text-muted-foreground'
        };
      case 'delivered':
        return {
          icon: CheckCheck,
          label: 'Entregue',
          color: 'text-muted-foreground'
        };
      case 'read':
        return {
          icon: CheckCheck,
          label: 'Lida',
          color: 'text-blue-400'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          label: 'Falha ao enviar - Clique para reenviar',
          color: 'text-destructive'
        };
      default:
        return {
          icon: Check,
          label: 'Enviada',
          color: 'text-muted-foreground'
        };
    }
  };

  const { icon: Icon, label, color } = getStatusInfo();

  // Show retry button for failed messages
  if (status === 'failed' && onRetry) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
          >
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              <RotateCcw className="h-3 w-3 text-destructive hover:animate-spin" />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', className)}>
          <Icon className={cn('h-3 w-3', color)} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
