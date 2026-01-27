import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmmBalanceResponse {
  balance?: string;
  currency?: string;
  error?: string;
  details?: string;
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
  details?: string;
}

type SmmServicesResponse = {
  services?: SmmService[];
  error?: string;
  details?: string;
};

type InvokePayload<T> = {
  action: "balance" | "services" | "add" | "status";
  payload?: T;
};

async function invokeSmm<TPayload, TResult>(body: InvokePayload<TPayload>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke("smm-panel", {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as TResult;
}

function throwIfApiError<T extends { error?: string; details?: string }>(data: T): T {
  if (data?.error) {
    const msg = data.details ? `${data.error}: ${data.details}` : data.error;
    throw new Error(msg);
  }
  return data;
}

export function useSmmPanel() {
  const balanceQuery = useQuery({
    queryKey: ["smm", "balance"],
    queryFn: async () => {
      const res = await invokeSmm<undefined, SmmBalanceResponse>({ action: "balance" });
      return throwIfApiError(res);
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["smm", "services"],
    queryFn: async () => {
      const res = await invokeSmm<undefined, SmmServicesResponse>({ action: "services" });
      const ok = throwIfApiError(res);
      return ok.services ?? [];
    },
  });

  const addOrder = useMutation({
    mutationFn: (payload: {
      service: number;
      link: string;
      quantity: number;
    }) =>
      invokeSmm<typeof payload, SmmAddOrderResponse>({ action: "add", payload }).then(
        (r) => throwIfApiError(r),
      ),
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
