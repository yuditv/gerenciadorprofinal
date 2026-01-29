import * as React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDragScrollVertical } from "@/hooks/useDragScrollVertical";

type Service = {
  service: number;
  name: string;
  category?: string | null;
  rate?: string | number | null;
};

export type EngajamentoServiceListProps = {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isFetching: boolean;
  onRetry: () => void;
  services: Service[];
  onSelectService: (serviceId: number) => void;
};

export const EngajamentoServiceList = React.forwardRef<HTMLDivElement, EngajamentoServiceListProps>(
  ({ isLoading, isError, errorMessage, isFetching, onRetry, services, onSelectService }, ref) => {
    const currency = React.useMemo(
      () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
      [],
    );

    const { ref: scrollRef, isDragging, handlers } = useDragScrollVertical<HTMLDivElement>();

    const renderRate = (rate: Service["rate"]) => {
      if (rate === null || rate === undefined || rate === "") return "";

      const numeric = typeof rate === "number" ? rate : Number(String(rate).replace(",", "."));
      if (Number.isFinite(numeric)) {
        return `${currency.format(numeric)} / 1k`;
      }

      return String(rate);
    };

    return (
      <div ref={ref}>
        <div
          ref={scrollRef}
          className={cn(
            "h-[420px] overflow-y-auto pr-2",
            // Ajuda o usuário a perceber que dá para arrastar
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
          {...handlers}
        >
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando serviços...</div>
          ) : isError ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-sm text-destructive">{errorMessage}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Tentar novamente
              </Button>
            </div>
          ) : services.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum serviço encontrado</div>
          ) : (
            <div className="space-y-2">
              {services.slice(0, 500).map((s) => (
                <button
                  key={s.service}
                  type="button"
                  onClick={() => onSelectService(s.service)}
                  className={cn(
                    "w-full text-left rounded-2xl border border-border/70 px-4 py-3",
                    "bg-card/50 backdrop-blur",
                    "hover:border-primary/35 hover:shadow-md",
                    "transition-all duration-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        <span className="text-primary">#{s.service}</span> — {s.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.category ?? "Sem categoria"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {s.rate ? renderRate(s.rate) : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

EngajamentoServiceList.displayName = "EngajamentoServiceList";
