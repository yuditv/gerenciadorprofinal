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
              "border",
              "transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.55)]"
                : [
                    "bg-card/40 text-foreground",
                    "border-primary/35",
                    "hover:bg-primary/10 hover:border-primary/55",
                    "hover:shadow-[0_10px_30px_-14px_hsl(var(--primary)/0.35)]",
                  ].join(" "),
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
