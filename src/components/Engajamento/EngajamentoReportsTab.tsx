import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSmmOrders } from "@/hooks/useSmmOrders";

type Preset = "today" | "7d" | "30d" | "month";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return `"${s.replace(/\"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function EngajamentoReportsTab() {
  const { ordersQuery } = useSmmOrders();
  const [preset, setPreset] = useState<Preset>("7d");

  const filtered = useMemo(() => {
    const all = ordersQuery.data ?? [];
    const now = new Date();

    let start: Date;
    if (preset === "today") start = startOfToday();
    else if (preset === "month") start = startOfMonth();
    else {
      const days = preset === "7d" ? 7 : 30;
      start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return all.filter((o) => new Date(o.created_at) >= start);
  }, [ordersQuery.data, preset]);

  const totals = useMemo(() => {
    const totalOrders = filtered.length;
    const totalSold = filtered.reduce((acc, o) => acc + Number(o.price_brl ?? 0), 0);
    const totalProfit = filtered.reduce((acc, o) => acc + Number(o.profit_brl ?? 0), 0);
    return { totalOrders, totalSold, totalProfit };
  }, [filtered]);

  const exportCsv = () => {
    const rows = filtered.map((o) => ({
      created_at: o.created_at,
      service_id: o.service_id,
      service_name: o.service_name ?? "",
      quantity: o.quantity,
      price_brl: Number(o.price_brl ?? 0).toFixed(2),
      profit_brl: Number(o.profit_brl ?? 0).toFixed(2),
      status: o.status,
      provider_order_id: o.provider_order_id ?? "",
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smm_orders_${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-primary/15">
      <CardHeader className="space-y-1">
        <CardTitle>Relatórios</CardTitle>
        <CardDescription>Lucro estimado e total vendido por período.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={preset === "today" ? "default" : "outline"}
            onClick={() => setPreset("today")}
          >
            Hoje
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preset === "7d" ? "default" : "outline"}
            onClick={() => setPreset("7d")}
          >
            7 dias
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preset === "30d" ? "default" : "outline"}
            onClick={() => setPreset("30d")}
          >
            30 dias
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preset === "month" ? "default" : "outline"}
            onClick={() => setPreset("month")}
          >
            Mês atual
          </Button>

          <div className="flex-1" />
          <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
            Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Lucro estimado</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {totals.totalProfit.toFixed(2)}
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total vendido</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {totals.totalSold.toFixed(2)}
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pedidos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {totals.totalOrders}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
