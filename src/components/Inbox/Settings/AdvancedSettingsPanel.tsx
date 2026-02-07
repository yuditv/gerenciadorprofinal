import { useState } from "react";
import { 
  Clock, Shield, Plus, Trash2, Save, AlertTriangle,
  Bot, MessageSquare, HelpCircle, Settings2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInboxSLA } from "@/hooks/useInboxSLA";
import { useBusinessHours, type DaySchedule } from "@/hooks/useBusinessHours";
import { useTriageConfig, type TriageDepartment } from "@/hooks/useTriageConfig";
import { useContactReasons } from "@/hooks/useContactReasons";
import { InboxLabel } from "@/hooks/useInboxConversations";

interface AdvancedSettingsPanelProps {
  labels: InboxLabel[];
}

export function AdvancedSettingsPanel({ labels }: AdvancedSettingsPanelProps) {
  return (
    <Tabs defaultValue="sla" className="space-y-4">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="sla" className="gap-1.5">
          <Shield className="h-4 w-4" />
          SLA
        </TabsTrigger>
        <TabsTrigger value="hours" className="gap-1.5">
          <Clock className="h-4 w-4" />
          Horário
        </TabsTrigger>
        <TabsTrigger value="triage" className="gap-1.5">
          <Bot className="h-4 w-4" />
          Triagem
        </TabsTrigger>
        <TabsTrigger value="reasons" className="gap-1.5">
          <HelpCircle className="h-4 w-4" />
          Motivos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sla"><SLASettings /></TabsContent>
      <TabsContent value="hours"><BusinessHoursSettings /></TabsContent>
      <TabsContent value="triage"><TriageSettings labels={labels} /></TabsContent>
      <TabsContent value="reasons"><ContactReasonsSettings /></TabsContent>
    </Tabs>
  );
}

// ─── SLA Settings ───
function SLASettings() {
  const { config, saveConfig, isLoading } = useInboxSLA();
  const [firstResponse, setFirstResponse] = useState(config?.first_response_minutes || 15);
  const [resolution, setResolution] = useState(config?.resolution_minutes || 240);
  const [isActive, setIsActive] = useState(config?.is_active ?? true);

  const handleSave = () => {
    saveConfig({
      first_response_minutes: firstResponse,
      resolution_minutes: resolution,
      is_active: isActive,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Acordo de Nível de Serviço (SLA)
        </CardTitle>
        <CardDescription>
          Configure alertas visuais para tempo máximo de resposta e resolução
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label>SLA Ativo</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Primeira Resposta (min)</Label>
            <Input
              type="number"
              value={firstResponse}
              onChange={e => setFirstResponse(Number(e.target.value))}
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              Alerta quando a 1ª resposta não for enviada dentro deste prazo
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Resolução (min)</Label>
            <Input
              type="number"
              value={resolution}
              onChange={e => setResolution(Number(e.target.value))}
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              Alerta quando a conversa não for resolvida dentro deste prazo
            </p>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
          <p className="font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Multiplicadores por Prioridade:
          </p>
          <p>🔴 Urgente: 0.25x (25% do tempo) | 🟠 Alta: 0.5x | 🟡 Média: 1x | 🟢 Baixa: 2x</p>
        </div>

        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar SLA
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Business Hours Settings ───
function BusinessHoursSettings() {
  const { config, saveConfig, DAY_NAMES } = useBusinessHours();
  const [isEnabled, setIsEnabled] = useState(config?.is_enabled ?? false);
  const [autoReply, setAutoReply] = useState(config?.auto_reply_message || '');
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    config?.schedule || [
      { day: 0, enabled: false, start: '09:00', end: '18:00' },
      { day: 1, enabled: true, start: '09:00', end: '18:00' },
      { day: 2, enabled: true, start: '09:00', end: '18:00' },
      { day: 3, enabled: true, start: '09:00', end: '18:00' },
      { day: 4, enabled: true, start: '09:00', end: '18:00' },
      { day: 5, enabled: true, start: '09:00', end: '18:00' },
      { day: 6, enabled: false, start: '09:00', end: '18:00' },
    ]
  );

  const updateScheduleDay = (dayIndex: number, updates: Partial<DaySchedule>) => {
    setSchedule(prev => prev.map(s => s.day === dayIndex ? { ...s, ...updates } : s));
  };

  const handleSave = () => {
    saveConfig({
      is_enabled: isEnabled,
      auto_reply_message: autoReply,
      schedule,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horário de Atendimento
        </CardTitle>
        <CardDescription>
          Configure o horário comercial e mensagem automática fora do expediente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label>Ativar Horário Comercial</Label>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        {isEnabled && (
          <>
            <div className="space-y-3">
              {schedule.sort((a, b) => a.day - b.day).map(day => (
                <div key={day.day} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={enabled => updateScheduleDay(day.day, { enabled })}
                  />
                  <span className="text-sm font-medium w-20">{DAY_NAMES[day.day]}</span>
                  {day.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={day.start}
                        onChange={e => updateScheduleDay(day.day, { start: e.target.value })}
                        className="w-28 h-8"
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={day.end}
                        onChange={e => updateScheduleDay(day.day, { end: e.target.value })}
                        className="w-28 h-8"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Mensagem Automática (fora do horário)</Label>
              <Textarea
                value={autoReply}
                onChange={e => setAutoReply(e.target.value)}
                placeholder="Use {start} e {end} para os horários..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {'{start}'}, {'{end}'}, {'{dia}'}
              </p>
            </div>
          </>
        )}

        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar Horário
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Triage Settings ───
function TriageSettings({ labels }: { labels: InboxLabel[] }) {
  const { config, saveConfig } = useTriageConfig();
  const [isEnabled, setIsEnabled] = useState(config?.is_enabled ?? false);
  const [welcomeMessage, setWelcomeMessage] = useState(config?.welcome_message || '');
  const [collectName, setCollectName] = useState(config?.collect_name ?? true);
  const [collectReason, setCollectReason] = useState(config?.collect_reason ?? true);
  const [fallbackMessage, setFallbackMessage] = useState(config?.fallback_message || '');
  const [departments, setDepartments] = useState<TriageDepartment[]>(
    config?.departments || [
      { name: 'Suporte Técnico', description: 'Problemas técnicos', label_id: null },
      { name: 'Financeiro', description: 'Pagamentos e renovações', label_id: null },
      { name: 'Comercial', description: 'Novos planos', label_id: null },
    ]
  );

  const addDepartment = () => {
    setDepartments(prev => [...prev, { name: '', description: '', label_id: null }]);
  };

  const removeDepartment = (index: number) => {
    setDepartments(prev => prev.filter((_, i) => i !== index));
  };

  const updateDepartment = (index: number, updates: Partial<TriageDepartment>) => {
    setDepartments(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const handleSave = () => {
    saveConfig({
      is_enabled: isEnabled,
      welcome_message: welcomeMessage,
      collect_name: collectName,
      collect_reason: collectReason,
      fallback_message: fallbackMessage,
      departments,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Chatbot de Triagem
        </CardTitle>
        <CardDescription>
          Bot que coleta informações antes de direcionar ao atendente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label>Ativar Triagem</Label>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        {isEnabled && (
          <>
            <div className="space-y-2">
              <Label>Mensagem de Boas-vindas</Label>
              <Textarea
                value={welcomeMessage}
                onChange={e => setWelcomeMessage(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={collectName} onCheckedChange={setCollectName} />
                <Label className="text-sm">Coletar nome</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={collectReason} onCheckedChange={setCollectReason} />
                <Label className="text-sm">Coletar motivo</Label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Departamentos</Label>
                <Button variant="outline" size="sm" onClick={addDepartment} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              </div>
              {departments.map((dept, index) => (
                <div key={index} className="flex gap-2 items-start p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={dept.name}
                      onChange={e => updateDepartment(index, { name: e.target.value })}
                      placeholder="Nome do departamento"
                      className="h-8"
                    />
                    <Input
                      value={dept.description}
                      onChange={e => updateDepartment(index, { description: e.target.value })}
                      placeholder="Descrição breve"
                      className="h-8"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeDepartment(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Mensagem de Fallback</Label>
              <Textarea
                value={fallbackMessage}
                onChange={e => setFallbackMessage(e.target.value)}
                rows={2}
              />
            </div>
          </>
        )}

        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar Triagem
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Contact Reasons Settings ───
function ContactReasonsSettings() {
  const { reasons, createReason, deleteReason } = useContactReasons();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createReason(newName, newColor);
    setNewName('');
  };

  const PRESET_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Motivos de Contato
        </CardTitle>
        <CardDescription>
          Categorize por que os clientes entram em contato para identificar padrões
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Ex: Suporte Técnico, Financeiro..."
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="h-8 w-8 rounded-md border-2 transition-all shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? 'white' : 'transparent',
                }}
              />
            ))}
          </div>
          <Button onClick={handleCreate} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        <div className="space-y-2">
          {reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum motivo criado. Adicione acima.
            </p>
          ) : (
            reasons.map(reason => (
              <div key={reason.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: reason.color }} />
                <span className="text-sm flex-1">{reason.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteReason(reason.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
