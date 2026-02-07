import { useState } from "react";
import { Star, Send, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useInboxCSAT } from "@/hooks/useInboxCSAT";

interface CSATSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
}

export function CSATSurveyDialog({ open, onOpenChange, conversationId, contactName }: CSATSurveyDialogProps) {
  const { sendSurvey } = useInboxCSAT();
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    await sendSurvey(conversationId);
    setIsSending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Enviar Pesquisa de Satisfação
          </DialogTitle>
          <DialogDescription>
            Uma pesquisa CSAT será enviada para <strong>{contactName}</strong> ao encerrar o atendimento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">Preview da pesquisa:</p>
            <div className="border border-border/50 rounded-lg p-3 bg-background/50">
              <p className="text-sm">Como você avalia o atendimento?</p>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className="h-6 w-6 text-yellow-500/30" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending} className="gap-2">
            <Send className="h-4 w-4" />
            Enviar Pesquisa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
