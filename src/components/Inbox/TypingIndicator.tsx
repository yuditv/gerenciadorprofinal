import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  name?: string;
  className?: string;
}

export function TypingIndicator({ name = 'Cliente', className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 py-2", className)}>
      <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1">
          <span 
            className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span 
            className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span 
            className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-xs text-muted-foreground ml-1">
          {name} está digitando...
        </span>
      </div>
    </div>
  );
}
