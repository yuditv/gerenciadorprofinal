import { Brain, Loader2, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAILearning } from "@/hooks/useAILearning";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

interface KnowledgeItem {
  id: string;
  category: string;
  question_pattern: string;
  best_answer: string;
  confidence_score: number;
  usage_count: number;
  created_at: string;
}

interface Props {
  agentId?: string;
}

export function AILearningPanel({ agentId }: Props) {
  const { triggerLearning, isLearning, lastResult } = useAILearning();
  const { user } = useAuth();
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKnowledge = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("ai_knowledge_base" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("confidence_score", { ascending: false })
        .limit(20);

      if (agentId) {
        query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
      }

      const { data } = await query;
      setKnowledge((data as any) || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, [user?.id, agentId]);

  useEffect(() => {
    if (lastResult?.success) fetchKnowledge();
  }, [lastResult]);

  const categoryColors: Record<string, string> = {
    suporte: "bg-blue-500/20 text-blue-400",
    vendas: "bg-green-500/20 text-green-400",
    informação: "bg-yellow-500/20 text-yellow-400",
    técnico: "bg-purple-500/20 text-purple-400",
    geral: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{
              background: 'linear-gradient(135deg, hsl(260 85% 60%) 0%, hsl(200 80% 55%) 100%)',
            }}>
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Aprendizado Contínuo</CardTitle>
              <CardDescription>
                A IA analisa conversas anteriores e aprende padrões para melhorar respostas futuras
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => triggerLearning(agentId)}
            disabled={isLearning}
            className="gap-2"
          >
            {isLearning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isLearning ? "Aprendendo..." : "Iniciar Aprendizado"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastResult && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm space-y-1">
            <p className="font-medium text-primary">Último resultado:</p>
            <p>📊 {lastResult.messages_analyzed} mensagens analisadas</p>
            <p>🔍 {lastResult.qa_pairs_found} pares P&R encontrados</p>
            <p>✨ {lastResult.knowledge_extracted} novos conhecimentos</p>
            <p>🔄 {lastResult.knowledge_updated} conhecimentos atualizados</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : knowledge.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum conhecimento aprendido ainda.</p>
            <p className="text-xs mt-1">Clique em "Iniciar Aprendizado" para começar.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {knowledge.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category] || categoryColors.geral}`}>
                    {item.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Confiança: {Math.round((item.confidence_score || 0) * 100)}%
                  </span>
                  {item.usage_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Usado {item.usage_count}x
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium">{item.question_pattern}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{item.best_answer}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
