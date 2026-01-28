import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type WalletTopup = {
  id: string;
  amount_brl: number;
  credits: number;
  status: string;
  pix_code: string | null;
  pix_qr_code: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
};

export function useWalletTopup() {
  const qc = useQueryClient();

  const createTopup = useMutation({
    mutationFn: async (amount_brl: number) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente para gerar o PIX.");
      }

      const { data, error } = await supabase.functions.invoke("wallet-pix", {
        body: { action: "create", amount_brl },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.topup as WalletTopup;
    },
  });

  const checkTopup = useMutation({
    mutationFn: async (topup_id: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente para verificar o pagamento.");
      }

      const { data, error } = await supabase.functions.invoke("wallet-pix", {
        body: { action: "check", topup_id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { topup: WalletTopup; wallet_credits?: number };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["wallet", "balance"] });
      await qc.invalidateQueries({ queryKey: ["wallet", "transactions"] });
    },
  });

  return { createTopup, checkTopup };
}
