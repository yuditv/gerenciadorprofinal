import { useState } from "react";
import { Sparkles, Loader2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AISummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
  existingSummary?: string | null;
}

export function AISummaryDialog({
  open,
  onOpenChange,
  conversationId,
  contactName,
  existingSummary,
}: AISummaryDialogProps) {
  const [summary, setSummary] = useState(existingSummary || "");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      // Fetch last messages from conversation
      const { data: messages, error: msgError } = await supabase
        .from("chat_inbox_messages")
        .select("content, sender_type, created_at")
        .eq("conversation_id", conversationId)
        .eq("is_private", false)
        .order("created_at", { ascending: true })
        .limit(50);

      if (msgError) throw msgError;

      if (!messages || messages.length === 0) {
        toast.error("Sem mensagens para resumir");
        return;
      }

      // Build conversation transcript
      const transcript = messages
        .filter((m) => m.content)
        .map(
          (m) =>
            `${m.sender_type === "contact" ? contactName : "Atendente"}: ${m.content}`
        )
        .join("\n");

      // Call AI to summarize
      const { data, error } = await supabase.functions.invoke(
        "generate-copy",
        {
          body: {
            prompt: `Resuma esta conversa de atendimento em português de forma objetiva, destacando: 1) Motivo do contato, 2) Principais pontos discutidos, 3) Resolução/próximos passos. Máximo 150 palavras.\n\nConversa:\n${transcript}`,
            type: "copy",
            tone: "formal",
            includeVariables: false,
            quantity: 1,
          },
        }
      );

      if (error || data?.error) {
        toast.error("Erro ao gerar resumo");
        return;
      }

      const generatedSummary =
        data?.messages?.[0] || "Não foi possível gerar o resumo.";
      setSummary(generatedSummary);

      // Save to database
      await supabase
        .from("conversations")
        .update({ summary: generatedSummary })
        .eq("id", conversationId);

      toast.success("Resumo gerado e salvo!");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Erro ao gerar resumo");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Resumo da Conversa
          </DialogTitle>
          <DialogDescription>
            Resumo gerado por IA para {contactName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {summary ? (
            <ScrollArea className="max-h-[300px]">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {summary}
                </p>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Clique em "Gerar Resumo" para a IA analisar a conversa</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={generateSummary}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {summary ? "Regenerar" : "Gerar Resumo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
