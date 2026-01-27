import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePricingSettings() {
  const qc = useQueryClient();

  const pricingQuery = useQuery({
    queryKey: ["wallet", "pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_settings")
        .select("markup_percent")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return { markup_percent: Number(data?.markup_percent ?? 0) };
    },
  });

  const upsertMarkup = useMutation({
    mutationFn: async (markup_percent: number) => {
      const clean = Number(markup_percent);
      if (!Number.isFinite(clean) || clean < 0) throw new Error("Markup inválido");

      const { error } = await supabase
        .from("pricing_settings")
        .upsert({ id: 1, markup_percent: clean }, { onConflict: "id" });
      if (error) throw error;
      return clean;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["wallet", "pricing"] });
    },
  });

  return { pricingQuery, upsertMarkup };
}
