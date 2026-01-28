import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, Link2, ShieldCheck, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAIAgents, type CreateAgentInput } from "@/hooks/useAIAgents";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";

type BotTemplateId = "support" | "sales" | "billing";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const TEMPLATE_PRESETS: Record<BotTemplateId, { title: string; summary: string; systemPrompt: string }> = {
  support: {
    title: "Suporte Técnico",
    summary: "Diagnóstico rápido, passo a passo, foco em resolver.",
    systemPrompt:
      "Você é um atendente de suporte técnico. Faça perguntas objetivas, proponha passos numerados e confirme resultado. Se faltar informação, peça um dado por vez. Seja direto e educado.",
  },
  sales: {
    title: "Vendas",
    summary: "Qualifica, apresenta benefícios e encaminha para pagamento.",
    systemPrompt:
      "Você é um atendente de vendas. Qualifique a necessidade, sugira o plano mais adequado, responda dúvidas e quando o cliente confirmar compra, ajude a finalizar com clareza.",
  },
  billing: {
    title: "Cobrança/Renovação",
    summary: "Renovações, PIX, comprovante e prazos.",
    systemPrompt:
      "Você é um atendente de cobrança e renovação. Seja objetivo sobre valores, prazos e vencimento. Quando o cliente confirmar pagamento/renovação, oriente o processo e solicite comprovante se necessário.",
  },
};

type StepId = "template" | "identity" | "channels" | "features" | "limits" | "routing" | "review";

const STEPS: Array<{ id: StepId; title: string; description: string }> = [
  { id: "template", title: "Template", description: "Comece com um modelo pronto" },
  { id: "identity", title: "Identidade", description: "Nome e descrição do bot" },
  { id: "channels", title: "Canais", description: "Onde ele atua" },
  { id: "features", title: "Recursos", description: "Memória, ferramentas e qualidade" },
  { id: "limits", title: "Limites", description: "Anti-spam e comportamento" },
  { id: "routing", title: "Roteamento", description: "Vincular às instâncias" },
  { id: "review", title: "Revisão", description: "Conferir e criar" },
];

export function CreateBotWizardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createAgent, upsertRouting, agentRoutings } = useAIAgents();
  const { instances } = useWhatsAppInstances();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [templateId, setTemplateId] = useState<BotTemplateId>("support");
  const [name, setName] = useState("Bot de Suporte");
  const [description, setDescription] = useState("Atendimento automático no Inbox com memória e limites anti-spam.");

  // Channels
  const [enableInbox, setEnableInbox] = useState(true);
  const [enableChatTest, setEnableChatTest] = useState(true);

  // Features
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryAutoExtract, setMemoryAutoExtract] = useState(true);
  const [memoryGenerateSummary, setMemoryGenerateSummary] = useState(true);
  const [useCannedResponses, setUseCannedResponses] = useState(true);
  const [antiHallucination, setAntiHallucination] = useState(true);

  // Limits
  const [preset, setPreset] = useState<"natural" | "anti_spam">("anti_spam");
  const [bufferEnabled, setBufferEnabled] = useState(true);
  const [bufferWaitSeconds, setBufferWaitSeconds] = useState(8);
  const [bufferMaxMessages, setBufferMaxMessages] = useState(8);

  // Routing
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [overwriteRouting, setOverwriteRouting] = useState(false);

  const routingsByInstanceId = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of (agentRoutings as any[]) ?? []) map.set(r.instance_id, r);
    return map;
  }, [agentRoutings]);

  const availableInstances = useMemo(() => {
    return instances
      .map((i) => {
        const existing = routingsByInstanceId.get(i.id);
        return {
          ...i,
          hasRouting: !!existing,
          routing: existing,
        };
      })
      .filter((i) => overwriteRouting || !i.hasRouting);
  }, [instances, routingsByInstanceId, overwriteRouting]);

  useEffect(() => {
    if (!open) return;
    // Reset wizard each open
    setStepIndex(0);
    setTemplateId("support");
    setName("Bot de Suporte");
    setDescription("Atendimento automático no Inbox com memória e limites anti-spam.");
    setEnableInbox(true);
    setEnableChatTest(true);
    setMemoryEnabled(true);
    setMemoryAutoExtract(true);
    setMemoryGenerateSummary(true);
    setUseCannedResponses(true);
    setAntiHallucination(true);
    setPreset("anti_spam");
    setBufferEnabled(true);
    setBufferWaitSeconds(8);
    setBufferMaxMessages(8);
    setSelectedInstanceIds([]);
    setOverwriteRouting(false);
  }, [open]);

  useEffect(() => {
    // Keep a sensible default name/description when switching template.
    const t = TEMPLATE_PRESETS[templateId];
    setName((prev) => (prev.trim().length ? prev : `Bot de ${t.title}`));
  }, [templateId]);

  const isBusy = createAgent.isPending || upsertRouting.isPending;

  const nextDisabled = useMemo(() => {
    if (!step) return true;
    if (step.id === "identity") return name.trim().length < 2;
    if (step.id === "channels") return !enableInbox && !enableChatTest;
    return false;
  }, [step, name, enableInbox, enableChatTest]);

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goPrev = () => setStepIndex((i) => Math.max(i - 1, 0));

  const buildAgentInput = (): CreateAgentInput => {
    const template = TEMPLATE_PRESETS[templateId];

    const antiSpam = preset === "anti_spam";
    const responseDelayMin = antiSpam ? 6 : 2;
    const responseDelayMax = antiSpam ? 12 : 5;
    const splitMode = antiSpam ? "sentences" : "paragraph";

    // Inbox = WhatsApp inbox webhook path, so must enable WhatsApp.
    const isWhatsAppEnabled = enableInbox;
    const isChatEnabled = enableChatTest;

    const systemPrompt = [
      template.systemPrompt,
      "\n\nRegras gerais:",
      "- Se a mensagem for um áudio transcrito, trate como fala do cliente.",
      "- Seja claro e evite inventar. Se não souber, peça contexto.",
    ].join("\n");

    return {
      name: name.trim(),
      description: description.trim(),
      icon: "bot",
      color: "#3b82f6",
      is_active: true,
      is_whatsapp_enabled: isWhatsAppEnabled,
      is_chat_enabled: isChatEnabled,
      use_native_ai: true,
      ai_model: DEFAULT_MODEL,
      system_prompt: systemPrompt,

      // Sending
      response_delay_min: responseDelayMin,
      response_delay_max: responseDelayMax,
      split_mode: splitMode,
      split_delay_min: antiSpam ? 1 : 1,
      split_delay_max: antiSpam ? 3 : 3,
      max_lines_per_message: 0,
      max_chars_per_message: 0,
      typing_simulation: true,

      // Memory
      memory_enabled: memoryEnabled,
      memory_auto_extract: memoryAutoExtract,
      memory_sync_clients: true,
      memory_generate_summary: memoryGenerateSummary,
      memory_max_items: 20,

      // Buffer
      message_buffer_enabled: bufferEnabled,
      buffer_wait_seconds: bufferWaitSeconds,
      buffer_max_messages: bufferMaxMessages,

      anti_hallucination_enabled: antiHallucination,
      use_canned_responses: useCannedResponses,

      agent_type: "principal",
    };
  };

  const handleToggleInstance = (id: string, checked: boolean) => {
    setSelectedInstanceIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((x) => x !== id);
    });
  };

  const handleCreate = async () => {
    const input = buildAgentInput();
    const created = await createAgent.mutateAsync(input);

    // Auto-link routing for selected instances (Inbox)
    if (enableInbox && selectedInstanceIds.length > 0) {
      for (const instanceId of selectedInstanceIds) {
        await upsertRouting.mutateAsync({ instanceId, agentId: created.id, isActive: true });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Bot (Wizard)
          </DialogTitle>
          <DialogDescription>
            Crie um bot completo para atendimento no Inbox e para testes no chat.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex flex-wrap gap-2">
          {STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIndex(idx)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                idx === stepIndex
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50",
              )}
            >
              {idx < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <span className="w-3.5" />}
              <span className="font-medium">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="mt-4 rounded-xl border border-border/60 bg-card/30 p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>

          {step.id === "template" && (
            <div className="grid gap-3 md:grid-cols-3">
              {(Object.keys(TEMPLATE_PRESETS) as BotTemplateId[]).map((id) => {
                const t = TEMPLATE_PRESETS[id];
                const active = id === templateId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplateId(id)}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="font-medium">{t.title}</span>
                      </div>
                      {active && <Badge variant="secondary">Selecionado</Badge>}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{t.summary}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step.id === "identity" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-name">Nome do bot *</Label>
                <Input
                  id="bot-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Bot de Suporte"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-desc">Descrição</Label>
                <Textarea
                  id="bot-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="O que esse bot faz?"
                />
              </div>
            </div>
          )}

          {step.id === "channels" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div>
                  <p className="font-medium">Inbox (Atendimento)</p>
                  <p className="text-xs text-muted-foreground">Responder automaticamente no Inbox (via instâncias).</p>
                </div>
                <Switch checked={enableInbox} onCheckedChange={setEnableInbox} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div>
                  <p className="font-medium">Chat de teste</p>
                  <p className="text-xs text-muted-foreground">Aparece na aba “Testar Chat”.</p>
                </div>
                <Switch checked={enableChatTest} onCheckedChange={setEnableChatTest} />
              </div>
              {!enableInbox && !enableChatTest && (
                <p className="text-sm text-destructive">Selecione ao menos um canal.</p>
              )}
            </div>
          )}

          {step.id === "features" && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div>
                    <p className="font-medium">Memória do cliente</p>
                    <p className="text-xs text-muted-foreground">Guardar e reutilizar dados do cliente.</p>
                  </div>
                  <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div>
                    <p className="font-medium">Extração automática</p>
                    <p className="text-xs text-muted-foreground">Extrair nome, plano, aparelho etc.</p>
                  </div>
                  <Switch checked={memoryAutoExtract} onCheckedChange={setMemoryAutoExtract} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div>
                    <p className="font-medium">Resumo do cliente</p>
                    <p className="text-xs text-muted-foreground">Gerar um resumo do histórico.</p>
                  </div>
                  <Switch checked={memoryGenerateSummary} onCheckedChange={setMemoryGenerateSummary} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div>
                    <p className="font-medium">Respostas rápidas</p>
                    <p className="text-xs text-muted-foreground">Permitir usar canned responses.</p>
                  </div>
                  <Switch checked={useCannedResponses} onCheckedChange={setUseCannedResponses} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-primary/10 p-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Anti-alucinação</p>
                    <p className="text-xs text-muted-foreground">Reduz respostas inventadas e aumenta cautela.</p>
                  </div>
                </div>
                <Switch checked={antiHallucination} onCheckedChange={setAntiHallucination} />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="font-medium">Ferramentas (actions)</p>
                <p className="text-xs text-muted-foreground">
                  Este bot já pode acionar ferramentas existentes (ex.: PIX/transferência) conforme configuração do agente.
                </p>
              </div>
            </div>
          )}

          {step.id === "limits" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="font-medium">Perfil de comportamento</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant={preset === "natural" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreset("natural")}
                  >
                    Natural
                  </Button>
                  <Button
                    type="button"
                    variant={preset === "anti_spam" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreset("anti_spam")}
                  >
                    Anti-spam
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Anti-spam usa delays maiores e divisão em frases.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div>
                  <p className="font-medium">Buffer de mensagens</p>
                  <p className="text-xs text-muted-foreground">Agrupa mensagens antes de responder.</p>
                </div>
                <Switch checked={bufferEnabled} onCheckedChange={setBufferEnabled} />
              </div>

              {bufferEnabled && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Esperar (segundos)</Label>
                    <Input
                      inputMode="numeric"
                      value={String(bufferWaitSeconds)}
                      onChange={(e) => setBufferWaitSeconds(Math.max(1, Number(e.target.value || 0) || 1))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. mensagens no buffer</Label>
                    <Input
                      inputMode="numeric"
                      value={String(bufferMaxMessages)}
                      onChange={(e) => setBufferMaxMessages(Math.max(1, Number(e.target.value || 0) || 1))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step.id === "routing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-primary/10 p-2">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Vincular bot às instâncias</p>
                    <p className="text-xs text-muted-foreground">
                      Necessário para responder automaticamente no Inbox.
                    </p>
                  </div>
                </div>
                <Switch checked={enableInbox} onCheckedChange={setEnableInbox} />
              </div>

              {enableInbox && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="overwrite"
                        checked={overwriteRouting}
                        onCheckedChange={(v) => setOverwriteRouting(Boolean(v))}
                      />
                      <Label htmlFor="overwrite" className="text-sm">
                        Permitir substituir roteamento existente
                      </Label>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {selectedInstanceIds.length} selecionada(s)
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {availableInstances.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma instância disponível para vincular (ou todas já têm roteamento).
                      </p>
                    ) : (
                      availableInstances.map((inst) => (
                        <label
                          key={inst.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{inst.instance_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {inst.status}
                              {inst.hasRouting && inst.routing?.agent?.name ? ` • atual: ${inst.routing.agent.name}` : ""}
                            </p>
                          </div>
                          <Checkbox
                            checked={selectedInstanceIds.includes(inst.id)}
                            onCheckedChange={(v) => handleToggleInstance(inst.id, Boolean(v))}
                          />
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step.id === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="font-medium">Resumo</p>
                <div className="mt-2 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bot</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">{TEMPLATE_PRESETS[templateId].title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Inbox</span>
                    <span className="font-medium">{enableInbox ? "Ativo" : "Desativado"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Chat de teste</span>
                    <span className="font-medium">{enableChatTest ? "Ativo" : "Desativado"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Memória</span>
                    <span className="font-medium">{memoryEnabled ? "Ativa" : "Desativada"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Anti-spam</span>
                    <span className="font-medium">{preset === "anti_spam" ? "Sim" : "Não"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vincular instâncias</span>
                    <span className="font-medium">{enableInbox ? selectedInstanceIds.length : 0}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">
                  Ao criar, o bot ficará disponível em “Meus Agentes” e (se habilitado) em “Testar Chat”.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={goPrev} disabled={stepIndex === 0 || isBusy}>
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex items-center gap-2">
            {step.id !== "review" ? (
              <Button type="button" onClick={goNext} disabled={nextDisabled || isBusy}>
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={isBusy || name.trim().length < 2}>
                {isBusy ? "Criando..." : "Criar bot"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
