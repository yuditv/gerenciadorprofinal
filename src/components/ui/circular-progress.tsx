import { cn } from '@/lib/utils';

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  animated?: boolean;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  className,
  showValue = true,
  animated = true,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-all duration-500 ease-out",
            animated && value > 0 && value < 100 && "animate-pulse"
          )}
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(142 76% 36%)" /> {/* Emerald-like color */}
          </linearGradient>
        </defs>
      </svg>
      
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            "font-bold transition-all duration-300",
            size >= 100 ? "text-2xl" : "text-lg"
          )}>
            {Math.round(value)}%
          </span>
          {size >= 100 && (
            <span className="text-xs text-muted-foreground">concluído</span>
          )}
        </div>
      )}
      
      {/* Animated glow effect when in progress */}
      {animated && value > 0 && value < 100 && (
        <div 
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{
            background: `conic-gradient(from 0deg, transparent, hsl(var(--primary)), transparent)`,
            animationDuration: '2s',
          }}
        />
      )}
    </div>
  );
}
