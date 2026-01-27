import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWallet() {
  const walletQuery = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) return { credits: 0 };

      const { data, error } = await supabase
        .from("user_wallets")
        .select("credits")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      return { credits: Number(data?.credits ?? 0) };
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["wallet", "transactions"],
    queryFn: async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, type, credits, amount_brl, reference_type, reference_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return { walletQuery, transactionsQuery };
}
