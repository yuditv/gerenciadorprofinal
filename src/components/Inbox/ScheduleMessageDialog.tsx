import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/hooks/useInboxConversations";

type ActiveScheduleStatus = "scheduled" | "processing";

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

  const defaultDate = useMemo(() => new Date(Date.now() + 3 * 60 * 60 * 1000), []);

  useEffect(() => {
    if (!open) return;
    setSendAtLocal(toDatetimeLocalValue(defaultDate));
  }, [open, defaultDate]);

  useEffect(() => {
    const checkActive = async () => {
      if (!open || !conversation) return;
      setChecking(true);
      try {
        const { data, error } = await supabase
          .from("inbox_scheduled_messages")
          .select("id,status")
          .eq("conversation_id", conversation.id)
          .in("status", ["scheduled", "processing"] as ActiveScheduleStatus[])
          .limit(1);
        if (error) throw error;
        setHasActiveSchedule((data || []).length > 0);
      } catch (e) {
        // If the table isn't available yet or RLS blocks, don't hard-fail the UI.
        console.warn("[ScheduleMessageDialog] Could not check active schedules:", e);
        setHasActiveSchedule(false);
      } finally {
        setChecking(false);
      }
    };

    checkActive();
  }, [open, conversation?.id]);

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

      const { error } = await supabase
        .from("inbox_scheduled_messages")
        .insert({
          user_id: authData.user.id,
          conversation_id: conversation.id,
          instance_id: conversation.instance_id,
          phone: conversation.phone,
          template_key: "test_finished",
          template_vars: templateVars,
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
      </DialogContent>
    </Dialog>
  );
}
