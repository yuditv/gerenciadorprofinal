import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ApiCredential {
  id: string;
  user_id: string;
  provider_name: string;
  api_label: string;
  api_key_enc: string;
  base_url: string | null;
  model_default: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateApiCredentialInput {
  provider_name: string;
  api_label: string;
  api_key: string;
  base_url?: string;
  model_default?: string;
}

export interface UpdateApiCredentialInput {
  id: string;
  provider_name?: string;
  api_label?: string;
  api_key?: string;
  base_url?: string;
  model_default?: string;
  is_active?: boolean;
}

const PROVIDER_PRESETS: Record<string, { base_url: string; models: string[] }> = {
  openai: {
    base_url: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  anthropic: {
    base_url: "https://api.anthropic.com/v1",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  },
  google: {
    base_url: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  groq: {
    base_url: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
  },
  deepseek: {
    base_url: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  openrouter: {
    base_url: "https://openrouter.ai/api/v1",
    models: ["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514", "google/gemini-2.5-pro"],
  },
  custom: {
    base_url: "",
    models: [],
  },
};

export const PROVIDERS = [
  { value: "openai", label: "OpenAI", icon: "🤖", description: "GPT-4o, GPT-4, GPT-3.5" },
  { value: "anthropic", label: "Anthropic", icon: "🧠", description: "Claude Sonnet, Haiku, Opus" },
  { value: "google", label: "Google AI", icon: "🔮", description: "Gemini Pro, Flash" },
  { value: "groq", label: "Groq", icon: "⚡", description: "LLaMA, Mixtral (ultra rápido)" },
  { value: "deepseek", label: "DeepSeek", icon: "🔍", description: "DeepSeek Chat, Reasoner" },
  { value: "openrouter", label: "OpenRouter", icon: "🌐", description: "Acesse múltiplos provedores" },
  { value: "custom", label: "Personalizado", icon: "🔧", description: "Qualquer API compatível" },
];

export { PROVIDER_PRESETS };

export function useApiCredentials() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["api-credentials", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_api_credentials" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ApiCredential[];
    },
    enabled: !!user?.id,
  });

  const createCredential = useMutation({
    mutationFn: async (input: CreateApiCredentialInput) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("user_api_credentials" as any)
        .insert({
          user_id: user.id,
          provider_name: input.provider_name,
          api_label: input.api_label,
          api_key_enc: input.api_key,
          base_url: input.base_url || null,
          model_default: input.model_default || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ApiCredential;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-credentials"] });
      toast.success("Credencial adicionada com sucesso!");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast.error("Já existe uma credencial com esse nome.");
      } else {
        toast.error(`Erro ao adicionar: ${error.message}`);
      }
    },
  });

  const updateCredential = useMutation({
    mutationFn: async ({ id, ...input }: UpdateApiCredentialInput) => {
      if (!user?.id) throw new Error("Não autenticado");
      const updateData: Record<string, unknown> = {};
      if (input.provider_name !== undefined) updateData.provider_name = input.provider_name;
      if (input.api_label !== undefined) updateData.api_label = input.api_label;
      if (input.api_key !== undefined) updateData.api_key_enc = input.api_key;
      if (input.base_url !== undefined) updateData.base_url = input.base_url;
      if (input.model_default !== undefined) updateData.model_default = input.model_default;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;

      const { data, error } = await supabase
        .from("user_api_credentials" as any)
        .update(updateData as any)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ApiCredential;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-credentials"] });
      toast.success("Credencial atualizada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteCredential = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("user_api_credentials" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-credentials"] });
      toast.success("Credencial removida!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("user_api_credentials" as any)
        .update({ is_active } as any)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-credentials"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    credentials,
    isLoading,
    createCredential,
    updateCredential,
    deleteCredential,
    toggleActive,
  };
}
