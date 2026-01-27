import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EngajamentoCategoryChipsProps = {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export const EngajamentoCategoryChips = React.forwardRef<HTMLDivElement, EngajamentoCategoryChipsProps>(
  ({ categories, value, onChange, className }, ref) => {
  const items = ["all", ...categories];

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* horizontal chip row (looks like the reference UI and avoids 'messy' multi-line wrapping) */}
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-2 min-w-max">
          {items.map((c) => {
            const active = value === c;
            const label = c === "all" ? "Todas" : c;
            return (
              <Button
                key={c}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => onChange(c)}
                className={cn(
                  "h-9 rounded-full",
                  "px-3",
                  "text-xs font-medium",
                  "border",
                  "transition-all duration-200",
                  "max-w-[240px]",
                  "truncate",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.65)]"
                    : [
                        "bg-card/35 text-foreground",
                        "border-primary/30",
                        "hover:bg-primary/10 hover:border-primary/55",
                        "hover:shadow-[0_12px_30px_-16px_hsl(var(--primary)/0.4)]",
                      ].join(" "),
                )}
                title={label}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* subtle edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
  },
);

EngajamentoCategoryChips.displayName = "EngajamentoCategoryChips";
