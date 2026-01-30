import { useMemo } from "react";
import { Bot, Settings2 } from "lucide-react";

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

  const principalActiveAgents = useMemo(() => {
    return agents
      .filter((a) => (a as any).agent_type !== "sub_agent")
      .filter((a) => a.is_active)
      .filter((a) => a.is_whatsapp_enabled);
  }, [agents]);

  const defaultAgentId = preferences?.default_agent_id ?? null;
  const autoStartAI = preferences?.auto_start_ai ?? false;

  const isBusy = isLoading || isLoadingAgents || upsertPreferences.isPending;
  const canEnableAutoStart = !!defaultAgentId;

  return (
    <Card className="glass-card">
      <CardHeader className="border-b border-border/30">
        <CardTitle className="flex items-center gap-3">
          <div className="stats-icon-container primary">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          Preferências
        </CardTitle>
        <CardDescription>
          Defina se a IA deve iniciar automaticamente em novas conversas e qual agente será usado por padrão.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Agente padrão</Label>
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
                {principalActiveAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      {agent.name}
                    </span>
                  </SelectItem>
                ))}
                {!isLoadingAgents && principalActiveAgents.length === 0 && (
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
                <p className="text-xs text-muted-foreground">Em novas conversas, ligar a IA sem perguntar no Atendimento.</p>
              </div>
              <Switch
                checked={autoStartAI}
                disabled={isBusy || (!autoStartAI && !canEnableAutoStart)}
                onCheckedChange={(checked) => {
                  // Regra aprovada: para ligar auto-start, exigir agente padrão.
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
      </CardContent>
    </Card>
  );
}
