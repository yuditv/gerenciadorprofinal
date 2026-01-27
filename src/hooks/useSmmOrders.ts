import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SmmOrderRow = {
  id: string;
  created_at: string;
  service_id: number;
  service_name: string | null;
  quantity: number;
  link: string;
  status: string;
  provider_order_id: string | null;
  price_brl: number;
  profit_brl: number;
  // extended columns (may not exist in generated types yet)
  provider_status?: string | null;
  provider_charge?: number | null;
  provider_currency?: string | null;
  provider_remains?: number | null;
  provider_start_count?: number | null;
  provider_refill_id?: string | null;
  provider_refill_status?: string | null;
  cancelled_at?: string | null;
};

type InvokePayload = { action: string; payload?: Record<string, unknown> };

async function invokeSmmOrders(body: InvokePayload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke("smm-orders", {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) throw new Error(error.message);
  if (data?.error) {
    const msg = data.details ? `${data.error}: ${data.details}` : data.error;
    throw new Error(msg);
  }
  return data;
}

export function useSmmOrders() {
  const qc = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["smm", "orders"],
    queryFn: async (): Promise<SmmOrderRow[]> => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) return [];

      // NOTE: cast to any to avoid type drift when DB schema evolves.
      const { data, error } = await supabase
        .from("smm_orders")
        .select(
          "id, created_at, service_id, service_name, quantity, link, status, provider_order_id, price_brl, profit_brl, provider_status, provider_charge, provider_currency, provider_remains, provider_start_count, provider_refill_id, provider_refill_status, cancelled_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any as SmmOrderRow[]) ?? [];
    },
  });

  const createOrder = useMutation({
    mutationFn: async (payload: {
      service_id: number;
      link: string;
      quantity?: number;
      comments?: string;
      runs?: number;
      interval?: number;
    }) => invokeSmmOrders({ action: "create", payload: payload as any }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["smm", "orders"] }),
        qc.invalidateQueries({ queryKey: ["wallet", "balance"] }),
      ]);
    },
  });

  const refreshStatus = useMutation({
    mutationFn: async (id: string) => invokeSmmOrders({ action: "status", payload: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["smm", "orders"] });
    },
  });

  const requestRefill = useMutation({
    mutationFn: async (id: string) => invokeSmmOrders({ action: "refill", payload: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["smm", "orders"] });
    },
  });

  const refreshRefillStatus = useMutation({
    mutationFn: async (refillId: string) =>
      invokeSmmOrders({ action: "refill_status", payload: { refill_id: refillId } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["smm", "orders"] });
    },
  });

  const cancelOrders = useMutation({
    mutationFn: async (ids: string[]) => invokeSmmOrders({ action: "cancel", payload: { ids } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["smm", "orders"] });
    },
  });

  const stats = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const totalOrders = orders.length;
    const totalSold = orders.reduce((acc, o) => acc + Number(o.price_brl ?? 0), 0);
    const totalProfit = orders.reduce((acc, o) => acc + Number(o.profit_brl ?? 0), 0);
    return { totalOrders, totalSold, totalProfit };
  }, [ordersQuery.data]);

  return {
    ordersQuery,
    createOrder,
    refreshStatus,
    requestRefill,
    refreshRefillStatus,
    cancelOrders,
    stats,
  };
}
