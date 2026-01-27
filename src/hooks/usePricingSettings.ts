import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePricingSettings() {
  const qc = useQueryClient();

  const pricingQuery = useQuery({
    queryKey: ["wallet", "pricing"],
    queryFn: async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) return { markup_percent: 0 };

      const { data, error } = await supabase
        .from("user_pricing_settings")
        .select("markup_percent")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return { markup_percent: Number(data?.markup_percent ?? 0) };
    },
  });

  const upsertMarkup = useMutation({
    mutationFn: async (markup_percent: number) => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const clean = Number(markup_percent);
      if (!Number.isFinite(clean) || clean < 0) throw new Error("Markup inválido");

      const { error } = await supabase
        .from("user_pricing_settings")
        .upsert({ user_id: userId, markup_percent: clean }, { onConflict: "user_id" });
      if (error) throw error;
      return clean;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["wallet", "pricing"] });
    },
  });

  return { pricingQuery, upsertMarkup };
}
