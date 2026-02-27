import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface LearningResult {
  success: boolean;
  session_id?: string;
  messages_analyzed?: number;
  qa_pairs_found?: number;
  knowledge_extracted?: number;
  knowledge_updated?: number;
}

export function useAILearning() {
  const { user } = useAuth();
  const [isLearning, setIsLearning] = useState(false);
  const [lastResult, setLastResult] = useState<LearningResult | null>(null);

  const triggerLearning = async (agentId?: string) => {
    if (!user?.id) {
      toast.error("Você precisa estar logado");
      return;
    }

    setIsLearning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-learning-engine", {
        body: {
          userId: user.id,
          agentId: agentId || null,
          maxMessages: 200,
        },
      });

      if (error) throw error;

      setLastResult(data);

      if (data?.knowledge_extracted > 0 || data?.knowledge_updated > 0) {
        toast.success(
          `Aprendizado concluído! ${data.knowledge_extracted} novos conhecimentos extraídos, ${data.knowledge_updated} atualizados.`
        );
      } else {
        toast.info("Nenhum novo conhecimento identificado nas conversas recentes.");
      }

      return data;
    } catch (err) {
      console.error("Learning error:", err);
      toast.error("Erro ao processar aprendizado");
    } finally {
      setIsLearning(false);
    }
  };

  return { triggerLearning, isLearning, lastResult };
}
