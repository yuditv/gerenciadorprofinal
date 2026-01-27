import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function EngajamentoCategoryChips({ categories, value, onChange, className }: Props) {
  const items = ["all", ...categories];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
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
}
