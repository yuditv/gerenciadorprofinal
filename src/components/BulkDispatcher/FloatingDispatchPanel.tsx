import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Pause, Play, Square, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useBulkDispatchContext } from "@/contexts/BulkDispatchContext";
import { useAuth } from "@/hooks/useAuth";

export function FloatingDispatchPanel() {
  const { user } = useAuth();
  const { progress, pauseDispatch, resumeDispatch, cancelDispatch } = useBulkDispatchContext();
  const [isOpen, setIsOpen] = useState(false);

  const shouldShow = !!user && (progress.isRunning || progress.sent > 0 || progress.failed > 0);
  const percentage = useMemo(() => {
    if (!progress.total) return 0;
    return Math.round(((progress.sent + progress.failed) / progress.total) * 100);
  }, [progress.total, progress.sent, progress.failed]);

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur shadow-lg">
        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          className={cn(
            "w-full px-4 py-3 flex items-center justify-between gap-3",
            "text-left"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center",
              "bg-primary/10 border border-primary/20"
            )}>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">Disparo</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "border",
                    progress.isRunning
                      ? (progress.isPaused
                          ? "bg-secondary/40 border-border text-foreground"
                          : "bg-primary/10 border-primary/20 text-primary")
                      : "bg-secondary/40 border-border text-foreground"
                  )}
                >
                  {progress.isRunning ? (progress.isPaused ? "Pausado" : "Rodando") : "Finalizado"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {progress.total} total • {progress.sent} enviados • {progress.failed} falharam • {percentage}%
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1">
            {progress.isRunning && (
              <>
                {progress.isPaused ? (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resumeDispatch();
                    }}
                    aria-label="Retomar disparo"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      pauseDispatch();
                    }}
                    aria-label="Pausar disparo"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelDispatch();
                  }}
                  aria-label="Cancelar disparo"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </>
            )}

            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border"
            >
              <div className="px-4 py-3 space-y-2">
                {progress.currentContact && progress.isRunning && !progress.isPaused && (
                  <div className="text-xs text-muted-foreground">
                    Enviando para: <span className="text-foreground font-medium">{progress.currentContact}</span>
                  </div>
                )}

                {progress.logs.length > 0 && (
                  <ScrollArea className="h-[160px] rounded-xl border border-border bg-background/40">
                    <div className="p-2 space-y-1">
                      {progress.logs
                        .slice(-30)
                        .reverse()
                        .map((log, idx) => (
                          <div
                            key={`${log.time.getTime()}-${idx}`}
                            className={cn(
                              "text-xs px-2 py-1 rounded-lg",
                              "flex gap-2",
                              log.type === "error" && "bg-destructive/10 text-destructive",
                              log.type === "success" && "bg-primary/10 text-primary",
                              log.type === "warning" && "bg-secondary/40 text-foreground",
                              log.type === "info" && "bg-secondary/20 text-foreground"
                            )}
                          >
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {log.time.toLocaleTimeString("pt-BR")}
                            </span>
                            <span className="min-w-0 break-words">{log.message}</span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
