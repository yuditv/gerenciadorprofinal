import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/hooks/useInboxConversations";

type ActiveScheduleStatus = "scheduled" | "processing";

type InboxScheduledMessage = {
  id: string;
  status: string;
  send_at: string;
  template_key: string | null;
  created_at?: string;
};

function toDatetimeLocalValue(date: Date) {
  // yyyy-MM-ddTHH:mm (local)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  conversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
}) {
  const { toast } = useToast();
  const [sendAtLocal, setSendAtLocal] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasActiveSchedule, setHasActiveSchedule] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<InboxScheduledMessage | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [messageMode, setMessageMode] = useState<"template" | "manual">("template");
  const [templateKey, setTemplateKey] = useState<string>("test_finished");
  const [manualMessage, setManualMessage] = useState<string>("");

  const defaultDate = useMemo(() => new Date(Date.now() + 3 * 60 * 60 * 1000), []);

  useEffect(() => {
    if (!open) return;
    setSendAtLocal(toDatetimeLocalValue(defaultDate));
    setMessageMode("template");
    setTemplateKey("test_finished");
    setManualMessage("");
  }, [open, defaultDate]);

  useEffect(() => {
    const checkActive = async () => {
      if (!open || !conversation) return;
      setChecking(true);
      try {
        const { data, error } = await supabase
          .from("inbox_scheduled_messages")
          .select("id,status,send_at,template_key,created_at")
          .eq("conversation_id", conversation.id)
          .in("status", ["scheduled", "processing"] as ActiveScheduleStatus[])
          .limit(1);
        if (error) throw error;
        const row = (data || [])[0] as InboxScheduledMessage | undefined;
        setActiveSchedule(row ?? null);
        setHasActiveSchedule(!!row);
      } catch (e) {
        // If the table isn't available yet or RLS blocks, don't hard-fail the UI.
        console.warn("[ScheduleMessageDialog] Could not check active schedules:", e);
        setHasActiveSchedule(false);
        setActiveSchedule(null);
      } finally {
        setChecking(false);
      }
    };

    checkActive();
  }, [open, conversation?.id]);

  const handleCancelActive = async () => {
    if (!conversation) return;

    setIsLoading(true);
    try {
      // Cancel only the active schedule(s) for this conversation
      const { error } = await supabase
        .from("inbox_scheduled_messages")
        .update({ status: "cancelled" } as any)
        .eq("conversation_id", conversation.id)
        .in("status", ["scheduled", "processing"] as any);
      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "O agendamento desta conversa foi cancelado.",
      });

      setHasActiveSchedule(false);
      setActiveSchedule(null);
    } catch (e) {
      console.error("[ScheduleMessageDialog] cancel error:", e);
      toast({
        title: "Erro ao cancelar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteActive = async () => {
    if (!conversation) return;

    setIsLoading(true);
    try {
      // Remove ONLY the scheduled/processing rows for this conversation
      const { error } = await supabase
        .from("inbox_scheduled_messages")
        .delete()
        .eq("conversation_id", conversation.id)
        .in("status", ["scheduled", "processing"] as any);
      if (error) throw error;

      toast({
        title: "Agendamento removido",
        description: "O agendamento foi removido desta conversa.",
      });

      setConfirmDeleteOpen(false);
      setHasActiveSchedule(false);
      setActiveSchedule(null);
    } catch (e) {
      console.error("[ScheduleMessageDialog] delete error:", e);
      toast({
        title: "Erro ao remover",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!conversation) return;
    if (!sendAtLocal) return;

    if (hasActiveSchedule) {
      toast({
        title: "Agendamento bloqueado",
        description: "Já existe uma mensagem agendada para esta conversa.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!authData.user) throw new Error("Usuário não autenticado");

      // Interpret datetime-local as local time.
      const sendAt = new Date(sendAtLocal);
      if (Number.isNaN(sendAt.getTime())) {
        throw new Error("Data/hora inválida");
      }

      const templateVars = {
        nome: conversation.contact_name ?? "",
        telefone: conversation.phone,
        conversation_id: conversation.id,
      };

      const finalTemplateKey = (messageMode === "template" ? templateKey : "manual").toString().trim();
      if (!finalTemplateKey) {
        throw new Error("Informe a chave do template");
      }

      const finalTemplateVars: Record<string, unknown> = { ...templateVars };
      if (messageMode === "manual") {
        if (!manualMessage.trim()) {
          throw new Error("Escreva a mensagem manual");
        }
        finalTemplateVars.message = manualMessage.trim();
      }

      const { error } = await supabase
        .from("inbox_scheduled_messages")
        .insert({
          user_id: authData.user.id,
          conversation_id: conversation.id,
          instance_id: conversation.instance_id,
          phone: conversation.phone,
          template_key: finalTemplateKey,
          template_vars: finalTemplateVars,
          send_at: sendAt.toISOString(),
          status: "scheduled",
        } as any);
      if (error) throw error;

      toast({
        title: "Mensagem agendada",
        description: "A mensagem será enviada automaticamente no horário definido.",
      });
      onOpenChange(false);
    } catch (e) {
      console.error("[ScheduleMessageDialog] schedule error:", e);
      toast({
        title: "Erro ao agendar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Agendar mensagem
          </DialogTitle>
          <DialogDescription>
            Envia uma mensagem automática via WhatsApp (padrão: +3h). Se já existir um agendamento ativo nesta conversa, o sistema bloqueia.
          </DialogDescription>
        </DialogHeader>

        {hasActiveSchedule && activeSchedule && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Agendamento ativo nesta conversa</p>
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground/80">Enviar em:</span>{" "}
                {new Date(activeSchedule.send_at).toLocaleString("pt-BR")}
              </p>
              <p>
                <span className="font-medium text-foreground/80">Status:</span> {activeSchedule.status}
              </p>
              {activeSchedule.template_key && (
                <p>
                  <span className="font-medium text-foreground/80">Template:</span> {activeSchedule.template_key}
                </p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleCancelActive} disabled={isLoading || checking}>
                Cancelar agendamento
              </Button>
              <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={isLoading || checking}>
                Remover
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label>Mensagem do agendamento</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={messageMode === "template" ? "default" : "outline"}
              onClick={() => setMessageMode("template")}
              disabled={isLoading || checking}
            >
              Usar template
            </Button>
            <Button
              type="button"
              variant={messageMode === "manual" ? "default" : "outline"}
              onClick={() => setMessageMode("manual")}
              disabled={isLoading || checking}
            >
              Escrever manual
            </Button>
          </div>

          {messageMode === "template" ? (
            <div className="grid gap-2">
              <Label htmlFor="templateKey" className="text-xs text-muted-foreground">
                Chave do template
              </Label>
              <Input
                id="templateKey"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                placeholder="ex: test_finished"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis automáticas: <span className="font-medium">{"{{nome}}"}</span> e <span className="font-medium">{"{{telefone}}"}</span>.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="manualMessage" className="text-xs text-muted-foreground">
                Texto da mensagem
              </Label>
              <Textarea
                id="manualMessage"
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada automaticamente…"
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Dica: você pode usar <span className="font-medium">{"{{nome}}"}</span> e <span className="font-medium">{"{{telefone}}"}</span> no texto.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sendAt">Enviar em</Label>
          <Input
            id="sendAt"
            type="datetime-local"
            value={sendAtLocal}
            onChange={(e) => setSendAtLocal(e.target.value)}
          />
          {checking && <p className="text-xs text-muted-foreground">Verificando agendamentos…</p>}
          {hasActiveSchedule && (
            <p className="text-xs text-destructive">
              Já existe um agendamento ativo nesta conversa (bloqueado).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSchedule} disabled={isLoading || checking || hasActiveSchedule}>
            {isLoading ? "Agendando…" : "Agendar"}
          </Button>
        </DialogFooter>

        {/* Confirm delete */}
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover agendamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove o agendamento desta conversa. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteActive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
                {isLoading ? "Removendo…" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
