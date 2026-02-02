import { useMemo } from "react";
import { Bot, Settings2, MessageCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useAIAgentPreferences } from "@/hooks/useAIAgentPreferences";

export function AIAgentPreferencesPanel() {
  const { agents, isLoadingAgents } = useAIAgents();
  const { preferences, isLoading, upsertPreferences } = useAIAgentPreferences();

  // Agents for WhatsApp (principal + active + whatsapp enabled)
  const whatsappAgents = useMemo(() => {
    return agents
      .filter((a) => (a as any).agent_type !== "sub_agent")
      .filter((a) => a.is_active)
      .filter((a) => a.is_whatsapp_enabled);
  }, [agents]);

  // Agents for Customer Chat (principal + active + chat enabled)
  const chatAgents = useMemo(() => {
    return agents
      .filter((a) => (a as any).agent_type !== "sub_agent")
      .filter((a) => a.is_active)
      .filter((a) => a.is_chat_enabled);
  }, [agents]);

  const defaultAgentId = preferences?.default_agent_id ?? null;
  const autoStartAI = preferences?.auto_start_ai ?? false;
  const expiredClientAgentId = preferences?.expired_client_agent_id ?? null;
  const customerChatAgentId = preferences?.customer_chat_agent_id ?? null;
  const customerChatAutoStart = preferences?.customer_chat_auto_start ?? false;

  const isBusy = isLoading || isLoadingAgents || upsertPreferences.isPending;
  const canEnableAutoStart = !!defaultAgentId;
  const canEnableCustomerChatAutoStart = !!customerChatAgentId;

  return (
    <div className="space-y-6">
      {/* WhatsApp Preferences */}
      <Card className="glass-card">
        <CardHeader className="border-b border-border/30">
          <CardTitle className="flex items-center gap-3">
            <div className="stats-icon-container primary">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            Preferências WhatsApp
          </CardTitle>
          <CardDescription>
            Defina se a IA deve iniciar automaticamente em novas conversas do WhatsApp e qual agente será usado por padrão.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Agente padrão (WhatsApp)</Label>
              <Select
                value={defaultAgentId ?? "__none__"}
                onValueChange={(value) => {
                  const next = value === "__none__" ? null : value;
                  upsertPreferences.mutate({ default_agent_id: next });
                }}
                disabled={isBusy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {whatsappAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        {agent.name}
                      </span>
                    </SelectItem>
                  ))}
                  {!isLoadingAgents && whatsappAgents.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Nenhum agente ativo com WhatsApp
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dica: apenas agentes ativos e com WhatsApp habilitado aparecem aqui.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Iniciar IA automaticamente</Label>
                  <p className="text-xs text-muted-foreground">Em novas conversas WhatsApp, ligar a IA sem perguntar.</p>
                </div>
                <Switch
                  checked={autoStartAI}
                  disabled={isBusy || (!autoStartAI && !canEnableAutoStart)}
                  onCheckedChange={(checked) => {
                    if (checked && !defaultAgentId) return;
                    upsertPreferences.mutate({ auto_start_ai: checked });
                  }}
                />
              </div>

              {!canEnableAutoStart && (
                <Alert>
                  <AlertDescription>
                    Para ativar o <span className="font-medium">Auto IA</span>, primeiro selecione um <span className="font-medium">Agente padrão</span>.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Agente para Clientes Expirados (CRM)</Label>
              <Select
                value={expiredClientAgentId ?? "__none__"}
                onValueChange={(value) => {
                  const next = value === "__none__" ? null : value;
                  upsertPreferences.mutate({ expired_client_agent_id: next });
                }}
                disabled={isBusy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {whatsappAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        {agent.name}
                      </span>
                    </SelectItem>
                  ))}
                  {!isLoadingAgents && whatsappAgents.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Nenhum agente ativo com WhatsApp
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esse agente será usado quando você clicar em <span className="font-medium">Ativar IA</span> em um cliente expirado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Chat Preferences */}
      <Card className="glass-card">
        <CardHeader className="border-b border-border/30">
          <CardTitle className="flex items-center gap-3">
            <div className="stats-icon-container accent">
              <MessageCircle className="h-5 w-5 text-accent" />
            </div>
            Preferências Chat do Cliente
          </CardTitle>
          <CardDescription>
            Configure a IA para o Chat do Cliente (chat web integrado).
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Agente padrão (Chat do Cliente)</Label>
              <Select
                value={customerChatAgentId ?? "__none__"}
                onValueChange={(value) => {
                  const next = value === "__none__" ? null : value;
                  upsertPreferences.mutate({ customer_chat_agent_id: next });
                }}
                disabled={isBusy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {chatAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        {agent.name}
                      </span>
                    </SelectItem>
                  ))}
                  {!isLoadingAgents && chatAgents.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Nenhum agente ativo com Chat habilitado
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apenas agentes ativos com <span className="font-medium">Chat Web</span> habilitado aparecem aqui.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Iniciar IA automaticamente</Label>
                  <p className="text-xs text-muted-foreground">Em novas conversas de chat, ativar IA automaticamente.</p>
                </div>
                <Switch
                  checked={customerChatAutoStart}
                  disabled={isBusy || (!customerChatAutoStart && !canEnableCustomerChatAutoStart)}
                  onCheckedChange={(checked) => {
                    if (checked && !customerChatAgentId) return;
                    upsertPreferences.mutate({ customer_chat_auto_start: checked });
                  }}
                />
              </div>

              {!canEnableCustomerChatAutoStart && (
                <Alert>
                  <AlertDescription>
                    Para ativar o <span className="font-medium">Auto IA</span>, primeiro selecione um <span className="font-medium">Agente padrão</span> para o Chat.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Alert className="bg-primary/5 border-primary/20">
            <AlertDescription className="text-sm">
              <strong>Nota:</strong> Quando o cliente acessar o chat, a IA será ativada automaticamente com o agente configurado acima. 
              Os sub-agentes vinculados ao agente principal também funcionarão para especialização.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
