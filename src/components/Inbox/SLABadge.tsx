import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SLAStatus } from "@/hooks/useInboxSLA";

interface SLABadgeProps {
  slaStatus: SLAStatus | null;
}

export function SLABadge({ slaStatus }: SLABadgeProps) {
  if (!slaStatus) return null;

  const { isBreached, isWarning, remainingMinutes, type } = slaStatus;

  if (!isBreached && !isWarning) return null;

  const formatTime = (minutes: number) => {
    const abs = Math.abs(minutes);
    if (abs < 60) return `${abs}min`;
    if (abs < 1440) return `${Math.round(abs / 60)}h`;
    return `${Math.round(abs / 1440)}d`;
  };

  const label = type === 'first_response' ? '1ª Resposta' : 'Resolução';
  const timeText = isBreached
    ? `Estourado há ${formatTime(remainingMinutes)}`
    : `${formatTime(remainingMinutes)} restantes`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[10px] h-4 px-1.5 animate-pulse",
              isBreached
                ? "border-red-500 text-red-500 bg-red-500/10"
                : "border-yellow-500 text-yellow-500 bg-yellow-500/10"
            )}
          >
            {isBreached ? (
              <AlertTriangle className="h-2.5 w-2.5" />
            ) : (
              <Clock className="h-2.5 w-2.5" />
            )}
            SLA
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{label}</p>
          <p className={cn(isBreached ? "text-red-400" : "text-yellow-400")}>
            {timeText}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
