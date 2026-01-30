import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AIAgentPreferences = {
  user_id: string;
  auto_start_ai: boolean;
  default_agent_id: string | null;
  expired_client_agent_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Usuário não autenticado");
  return data.user.id;
}

export function useAIAgentPreferences() {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: ["ai-agent-preferences"],
    queryFn: async () => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("ai_agent_preferences")
        .select("user_id, auto_start_ai, default_agent_id, expired_client_agent_id, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      // If not created yet, return defaults (we will upsert on first change)
      return (
        (data as AIAgentPreferences | null) ?? {
          user_id: userId,
          auto_start_ai: false,
          default_agent_id: null,
            expired_client_agent_id: null,
        }
      );
    },
  });

  const upsertPreferences = useMutation({
    mutationFn: async (
      patch: Partial<Pick<AIAgentPreferences, "auto_start_ai" | "default_agent_id" | "expired_client_agent_id">>,
    ) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("ai_agent_preferences")
        .upsert(
          {
            user_id: userId,
            ...patch,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select("user_id, auto_start_ai, default_agent_id, expired_client_agent_id, created_at, updated_at")
        .single();

      if (error) throw error;
      return data as AIAgentPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agent-preferences"] });
      toast.success("Preferências salvas!");
    },
    onError: (error) => {
      console.error("Error saving AI agent preferences:", error);
      toast.error("Erro ao salvar preferências.");
    },
  });

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    error: preferencesQuery.error,
    upsertPreferences,
  };
}
