import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SmmService } from "@/hooks/useSmmPanel";
import { useSmmOrders } from "@/hooks/useSmmOrders";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = (status ?? "").toLowerCase();
  if (["failed", "refunded", "canceled"].some((x) => s.includes(x))) return "destructive";
  if (["submitted", "completed", "success"].some((x) => s.includes(x))) return "default";
  if (["pending"].some((x) => s.includes(x))) return "secondary";
  return "outline";
}

export function EngajamentoOrdersTab(props: { services: SmmService[] }) {
  const { ordersQuery, refreshStatus, requestRefill, refreshRefillStatus, cancelOrders } = useSmmOrders();

  const serviceById = useMemo(() => {
    const map = new Map<number, SmmService>();
    for (const s of props.services) map.set(s.service, s);
    return map;
  }, [props.services]);

  return (
    <Card className="border-primary/15">
      <CardHeader className="space-y-1">
        <CardTitle>Meus pedidos</CardTitle>
        <CardDescription>Acompanhe status, refill e cancelamento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => ordersQuery.refetch()}
            disabled={ordersQuery.isFetching}
          >
            <RefreshCw className={ordersQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Atualizar lista
          </Button>
        </div>

        <div className="w-full overflow-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Serviço</th>
                <th className="p-3">Qtd</th>
                <th className="p-3">Preço (cr)</th>
                <th className="p-3">Lucro</th>
                <th className="p-3">Status</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(ordersQuery.data ?? []).map((o) => {
                const svc = serviceById.get(o.service_id);
                const canRefill = Boolean(svc?.refill);
                const canCancel = Boolean(svc?.cancel);
                const shownStatus = o.provider_status ?? o.status;

                return (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.service_name ?? `#${o.service_id}`}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{o.link}</div>
                    </td>
                    <td className="p-3 tabular-nums">{o.quantity ?? 0}</td>
                    <td className="p-3 tabular-nums">{Number(o.price_brl ?? 0).toFixed(2)}</td>
                    <td className="p-3 tabular-nums">{Number(o.profit_brl ?? 0).toFixed(2)}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant(shownStatus)}>{shownStatus}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground tabular-nums">
                      {o.provider_order_id ?? "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => refreshStatus.mutate(o.id)}
                          disabled={refreshStatus.isPending}
                        >
                          Atualizar status
                        </Button>

                        {canRefill && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => requestRefill.mutate(o.id)}
                              disabled={requestRefill.isPending}
                            >
                              Refill
                            </Button>
                            {o.provider_refill_id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => refreshRefillStatus.mutate(o.provider_refill_id!)}
                                disabled={refreshRefillStatus.isPending}
                              >
                                Status refill
                              </Button>
                            )}
                          </>
                        )}

                        {canCancel && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelOrders.mutate([o.id])}
                            disabled={cancelOrders.isPending}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!ordersQuery.isLoading && (ordersQuery.data ?? []).length === 0 && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={8}>
                    Nenhum pedido ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
