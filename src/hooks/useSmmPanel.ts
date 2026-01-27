import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmmBalanceResponse {
  balance?: string;
  currency?: string;
  error?: string;
}

export interface SmmService {
  service: number;
  name: string;
  type?: string;
  category?: string;
  rate?: string;
  min?: string;
  max?: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
}

export interface SmmAddOrderResponse {
  order?: number;
  error?: string;
}

type InvokePayload<T> = {
  action: "balance" | "services" | "add" | "status";
  payload?: T;
};

async function invokeSmm<TPayload, TResult>(body: InvokePayload<TPayload>) {
  const { data, error } = await supabase.functions.invoke("smm-panel", {
    body,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as TResult;
}

export function useSmmPanel() {
  const balanceQuery = useQuery({
    queryKey: ["smm", "balance"],
    queryFn: () => invokeSmm<undefined, SmmBalanceResponse>({ action: "balance" }),
  });

  const servicesQuery = useQuery({
    queryKey: ["smm", "services"],
    queryFn: () => invokeSmm<undefined, SmmService[]>({ action: "services" }),
  });

  const addOrder = useMutation({
    mutationFn: (payload: {
      service: number;
      link: string;
      quantity: number;
    }) => invokeSmm<typeof payload, SmmAddOrderResponse>({ action: "add", payload }),
  });

  const categories = useMemo(() => {
    const services = servicesQuery.data ?? [];
    const unique = new Set(
      services
        .map((s) => (s.category ?? "").trim())
        .filter(Boolean),
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [servicesQuery.data]);

  return {
    balanceQuery,
    servicesQuery,
    addOrder,
    categories,
  };
}
