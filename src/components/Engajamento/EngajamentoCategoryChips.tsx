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
    <div ref={ref} className={cn("flex flex-wrap items-center gap-2", className)}>
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
              "rounded-full px-4",
              "transition-all",
              active
                ? "shadow-md"
                : "border-primary/30 bg-card/50 hover:bg-primary/10 hover:border-primary/45",
            )}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
  },
);

EngajamentoCategoryChips.displayName = "EngajamentoCategoryChips";
