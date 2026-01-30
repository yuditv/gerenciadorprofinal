import { supabase } from "@/integrations/supabase/client";

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export async function activateAIForExpiredClient(params: {
  clientWhatsapp: string;
  agentId: string;
}) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const userId = authData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado");

  const phone = normalizePhone(params.clientWhatsapp);
  if (!phone) throw new Error("Telefone do cliente inválido");

  // Find the most recent conversation for this client (by phone) owned by this user.
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convErr) throw convErr;
  if (!conv?.id) {
    throw new Error(
      "Não encontrei uma conversa no Atendimento para este número. Peça para o cliente enviar uma mensagem primeiro.",
    );
  }

  const currentMeta = (conv.metadata as Record<string, unknown> | null) || {};

  const nextMeta: Record<string, unknown> = {
    ...currentMeta,
    // If there was any pending prompt, we consider it decided by CRM action.
    ai_prompt_pending: false,
    ai_prompt_decision: "enabled",
    ai_prompt_decided_at: new Date().toISOString(),
  };

  const { error: updErr } = await supabase
    .from("conversations")
    .update({
      ai_enabled: true,
      ai_paused_at: null,
      assigned_to: null,
      active_agent_id: params.agentId,
      metadata: nextMeta as any,
    })
    .eq("id", conv.id);

  if (updErr) throw updErr;
  return { conversationId: conv.id };
}
