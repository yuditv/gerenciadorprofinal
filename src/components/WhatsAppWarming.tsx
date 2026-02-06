import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Flame, 
  Play, 
  Pause, 
  Settings, 
  MessageSquare, 
  Users, 
  Zap,
  Clock,
  Globe,
  Smartphone,
  RefreshCw,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Activity,
  Sparkles,
  Loader2,
  History,
  Calendar,
  Bell,
  BellOff
} from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useWarmingSessions, WarmingSession } from "@/hooks/useWarmingSessions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WarmingSessionHistory } from "./WarmingSessionHistory";
import { WarmingScheduler, ScheduleConfig } from "./WarmingScheduler";
import { cn } from "@/lib/utils";

interface WarmingTemplate {
  id: string;
  content: string;
}

type WarmingStatus = 'idle' | 'running' | 'paused';
type WarmingPhase = 'initialization' | 'warming' | 'completed';
type ConversationSpeed = 'slow' | 'normal' | 'fast';

export function WhatsAppWarming() {
  const { user } = useAuth();
  const { instances, isLoading } = useWhatsAppInstances();
  const connectedInstances = instances.filter(i => i.status === 'connected');
  
  // Use warming sessions hook
  const {
    sessions,
    currentSession,
    logs: sessionLogs,
    saveSession,
    startWarming: startWarmingSession,
    pauseWarming: pauseWarmingSession,
    stopWarming: stopWarmingSession,
    getStatus,
    fetchSessions,
    setCurrentSession
  } = useWarmingSessions();
  
  // Local warming state (synced with session)
  const [warmingStatus, setWarmingStatus] = useState<WarmingStatus>(
    currentSession?.status === 'running' ? 'running' : 
    currentSession?.status === 'paused' ? 'paused' : 'idle'
  );
  const [warmingPhase, setWarmingPhase] = useState<WarmingPhase>('initialization');
  const [overallProgress, setOverallProgress] = useState(currentSession?.progress || 0);
  const [messagesSent, setMessagesSent] = useState(currentSession?.messages_sent || 0);
  const [messagesReceived, setMessagesReceived] = useState(currentSession?.messages_received || 0);
  const [sessionId, setSessionId] = useState<string | null>(currentSession?.id || null);
  
  // Instance selection
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(
    new Set(currentSession?.selected_instances || [])
  );
  const [balancingMode, setBalancingMode] = useState<string>(currentSession?.balancing_mode || 'auto');
  
  // Configuration
  const [dailyLimit, setDailyLimit] = useState(currentSession?.daily_limit || 50);
  const [templates, setTemplates] = useState<WarmingTemplate[]>(
    currentSession?.templates?.map((t, i) => ({ id: String(i), content: t })) || [
      { id: '1', content: 'Oi, tudo bem?' },
      { id: '2', content: 'Como você está?' },
      { id: '3', content: 'Bom dia!' },
      { id: '4', content: 'Boa tarde!' },
    ]
  );
  const [newTemplate, setNewTemplate] = useState('');
  const [batchTemplates, setBatchTemplates] = useState('');
  const [conversationSpeed, setConversationSpeed] = useState<ConversationSpeed>(
    (currentSession?.conversation_speed as ConversationSpeed) || 'normal'
  );
  const [useAI, setUseAI] = useState(currentSession?.use_ai || false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGeneratedMessages, setAiGeneratedMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Debug panel and UI state
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>(['Sistema iniciado']);
  const [activeTab, setActiveTab] = useState<'config' | 'history'>('config');
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Load session from history
  const loadSessionFromHistory = useCallback((session: WarmingSession) => {
    setSelectedInstances(new Set(session.selected_instances));
    setBalancingMode(session.balancing_mode);
    setConversationSpeed(session.conversation_speed);
    setDailyLimit(session.daily_limit);
    setUseAI(session.use_ai);
    setTemplates(session.templates.map((t, i) => ({ id: String(i), content: t })));
    setCurrentSession(session);
    setSessionId(session.id);
    setActiveTab('config');
    toast.success('Configuração carregada do histórico');
  }, [setCurrentSession]);

  // Sync with current session
  useEffect(() => {
    if (currentSession) {
      setWarmingStatus(
        currentSession.status === 'running' ? 'running' : 
        currentSession.status === 'paused' ? 'paused' : 'idle'
      );
      setOverallProgress(currentSession.progress);
      setMessagesSent(currentSession.messages_sent);
      setMessagesReceived(currentSession.messages_received);
      setSessionId(currentSession.id);
      
      if (currentSession.status === 'running') {
        setWarmingPhase('warming');
      } else if (currentSession.status === 'completed') {
        setWarmingPhase('completed');
      }
    }
  }, [currentSession]);

  // Add session logs to local logs
  useEffect(() => {
    if (sessionLogs.length > 0) {
      const newLogs = sessionLogs.map(log => 
        `[${new Date(log.created_at).toLocaleTimeString()}] ${log.ai_generated ? '🤖' : '📝'} ${log.message.substring(0, 30)}... - ${log.status}`
      );
      setLogs(prev => [...prev.slice(-20), ...newLogs.slice(0, 10)]);
    }
  }, [sessionLogs]);

  // Generate AI messages
  const generateAIMessages = useCallback(async () => {
    if (!useAI) return null;
    
    setIsGeneratingAI(true);
    setLogs(prev => [...prev, 'Gerando mensagens com IA...']);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-warming-message', {
        body: { 
          templates: templates.map(t => t.content),
          context: `Velocidade: ${conversationSpeed}`
        }
      });
      
      if (error) {
        console.error('AI generation error:', error);
        toast.error("Erro ao gerar mensagens com IA");
        setLogs(prev => [...prev, `Erro IA: ${error.message}`]);
        return null;
      }
      
      if (data?.messages && data.messages.length > 0) {
        setAiGeneratedMessages(data.messages);
        setLogs(prev => [...prev, `IA gerou ${data.messages.length} mensagens`]);
        toast.success(`${data.messages.length} mensagens geradas com IA!`);
        return data.messages;
      }
      
      return null;
    } catch (err) {
      console.error('Error calling AI:', err);
      toast.error("Falha na comunicação com IA");
      setLogs(prev => [...prev, 'Falha na comunicação com IA']);
      return null;
    } finally {
      setIsGeneratingAI(false);
    }
  }, [useAI, templates, conversationSpeed]);

  // Add AI messages to templates
  const addAIMessagesToTemplates = () => {
    if (aiGeneratedMessages.length === 0) {
      toast.error("Nenhuma mensagem de IA disponível");
      return;
    }
    
    const newTemplates = aiGeneratedMessages.map(content => ({
      id: crypto.randomUUID(),
      content
    }));
    
    setTemplates(prev => [...prev, ...newTemplates]);
    setAiGeneratedMessages([]);
    toast.success(`${newTemplates.length} mensagens adicionadas aos templates`);
    setLogs(prev => [...prev, `${newTemplates.length} mensagens IA adicionadas`]);
  };

  // Toggle instance selection
  const toggleInstance = (instanceId: string) => {
    setSelectedInstances(prev => {
      const newSet = new Set(prev);
      if (newSet.has(instanceId)) {
        newSet.delete(instanceId);
      } else {
        newSet.add(instanceId);
      }
      return newSet;
    });
  };

  // Select all instances
  const selectAllInstances = () => {
    if (selectedInstances.size === connectedInstances.length) {
      setSelectedInstances(new Set());
    } else {
      setSelectedInstances(new Set(connectedInstances.map(i => i.id)));
    }
  };

  // Add single template
  const addTemplate = () => {
    if (!newTemplate.trim()) return;
    setTemplates(prev => [...prev, { id: crypto.randomUUID(), content: newTemplate.trim() }]);
    setNewTemplate('');
  };

  // Add batch templates
  const addBatchTemplates = () => {
    const lines = batchTemplates.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      toast.error("Digite pelo menos uma mensagem");
      return;
    }
    
    const newTemplates = lines.map(line => ({
      id: crypto.randomUUID(),
      content: line.trim()
    }));
    
    setTemplates(prev => [...prev, ...newTemplates]);
    setBatchTemplates('');
    toast.success(`${newTemplates.length} templates adicionados`);
  };

  // Remove template
  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // Clear all templates
  const clearAllTemplates = () => {
    setTemplates([]);
    toast.success("Templates removidos");
  };

  // Save session configuration
  const saveSessionConfig = async () => {
    if (!user) {
      toast.error("Faça login para salvar");
      return null;
    }
    
    setIsSaving(true);
    try {
      const sessionData: any = {
        name: 'Sessão de Aquecimento',
        selected_instances: Array.from(selectedInstances),
        balancing_mode: balancingMode as 'auto' | 'round-robin' | 'random',
        conversation_speed: conversationSpeed,
        daily_limit: dailyLimit,
        use_ai: useAI,
        templates: templates.map(t => t.content),
      };
      
      // Add schedule config if enabled
      if (scheduleConfig?.enabled) {
        const today = new Date();
        const [hours, minutes] = scheduleConfig.startTime.split(':').map(Number);
        today.setHours(hours, minutes, 0, 0);
        
        if (today <= new Date()) {
          today.setDate(today.getDate() + 1);
        }
        
        sessionData.scheduled_start_time = today.toISOString();
        sessionData.schedule_enabled = true;
        sessionData.schedule_recurrence = scheduleConfig.recurrence;
        sessionData.schedule_days = scheduleConfig.days;
        sessionData.status = 'scheduled';
      }
      
      const saved = await saveSession(sessionData);
      if (saved) {
        setSessionId(saved.id);
        toast.success("Configuração salva!");
        return saved;
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Start warming
  const startWarming = async () => {
    if (selectedInstances.size < 2) {
      toast.error("Selecione pelo menos 2 instâncias");
      return;
    }
    
    if (templates.length === 0) {
      toast.error("Adicione pelo menos um template de mensagem");
      return;
    }
    
    setLogs(prev => [...prev, 'Salvando configuração...']);
    
    // Save or update session first
    let session = sessionId ? currentSession : await saveSessionConfig();
    
    if (!session) {
      toast.error("Erro ao criar sessão");
      return;
    }
    
    setLogs(prev => [...prev, `Iniciando aquecimento com ${selectedInstances.size} instâncias...`]);
    
    // Start the real warming via Edge Function
    const result = await startWarmingSession(session.id);
    
    if (result) {
      setWarmingStatus('running');
      setWarmingPhase('warming');
      setLogs(prev => [...prev, 'Aquecimento iniciado via Uazapi!']);
    }
  };

  // Pause warming
  const pauseWarming = async () => {
    if (sessionId) {
      await pauseWarmingSession(sessionId);
    }
    setWarmingStatus('paused');
    setLogs(prev => [...prev, 'Aquecimento pausado']);
  };

  // Resume warming
  const resumeWarming = async () => {
    if (sessionId) {
      await startWarmingSession(sessionId);
    }
    setWarmingStatus('running');
    setLogs(prev => [...prev, 'Aquecimento retomado']);
  };

  // Stop warming
  const stopWarming = async () => {
    if (sessionId) {
      await stopWarmingSession(sessionId);
    }
    setWarmingStatus('idle');
    setWarmingPhase('initialization');
    setOverallProgress(0);
    setMessagesSent(0);
    setMessagesReceived(0);
    setLogs(prev => [...prev, 'Aquecimento finalizado']);
  };

  const getSpeedDescription = (speed: ConversationSpeed) => {
    switch (speed) {
      case 'slow': return 'Intervalos de 60-120 segundos. Mais seguro e natural.';
      case 'normal': return 'Intervalos de 30-80 segundos. Velocidade equilibrada e natural.';
      case 'fast': return 'Intervalos de 10-30 segundos. Mais rápido, maior risco.';
    }
  };

  const getSpeedLabel = (speed: ConversationSpeed) => {
    switch (speed) {
      case 'slow': return 'Lento';
      case 'normal': return 'Normal';
      case 'fast': return 'Rápido';
    }
  };

  const handleScheduleSave = (config: ScheduleConfig) => {
    setScheduleConfig(config);
    setLogs(prev => [...prev, config.enabled 
      ? `Agendamento configurado: ${config.startTime} (${config.recurrence})`
      : 'Agendamento desativado'
    ]);
  };

  const canStartWarming = selectedInstances.size >= 2 && templates.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Scheduler Dialog */}
      <WarmingScheduler
        open={showScheduler}
        onOpenChange={setShowScheduler}
        onSave={handleScheduleSave}
        currentSchedule={scheduleConfig}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 shrink-0" />
            <span className="truncate">Aquecimento de WhatsApp</span>
          </h2>
          <p className="text-muted-foreground text-xs sm:text-base">
            Sistema inteligente de aquecimento para números WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Notifications Toggle */}
          <Button
            variant={notificationsEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setNotificationsEnabled(!notificationsEnabled);
              toast.info(notificationsEnabled ? 'Notificações desativadas' : 'Notificações ativadas');
            }}
            className="gap-1.5 text-xs sm:text-sm"
          >
            {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{notificationsEnabled ? 'Notificações On' : 'Notificações Off'}</span>
          </Button>
          
          {/* Schedule Button */}
          <Button
            variant={scheduleConfig?.enabled ? "default" : "outline"}
            size="sm"
            onClick={() => setShowScheduler(true)}
            className="gap-1.5 text-xs sm:text-sm"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{scheduleConfig?.enabled ? `Agendado ${scheduleConfig.startTime}` : 'Agendar'}</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'history')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        <Card className={cn("warming-stat-card", warmingStatus === 'running' && "running")}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="stats-icon-container primary shrink-0">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                <p className="font-semibold text-sm sm:text-base capitalize truncate">
                  {warmingStatus === 'idle' ? 'Parado' : warmingStatus === 'running' ? 'Executando' : 'Pausado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="warming-stat-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="stats-icon-container info shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Instâncias</p>
                <p className="font-semibold text-sm sm:text-base">{selectedInstances.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="warming-stat-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="stats-icon-container success shrink-0">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Msgs</p>
                <p className="font-semibold text-sm sm:text-base">{messagesSent + messagesReceived}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="warming-stat-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="stats-icon-container warning shrink-0">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Progresso</p>
                <p className="font-semibold text-sm sm:text-base">{Math.round(overallProgress)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="warming-stat-card col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="stats-icon-container accent shrink-0">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Modo</p>
                <p className="font-semibold text-sm sm:text-base capitalize truncate">
                  {balancingMode === 'auto' ? 'Auto' : balancingMode === 'round-robin' ? 'Sequencial' : 'Aleatório'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Instance Selection */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          <Card className="glass-card">
            <CardHeader className="border-b border-border/30 p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                <div className="stats-icon-container info shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <span className="truncate">Seleção de Instâncias</span>
              </CardTitle>
              <CardDescription>
                Selecione as instâncias que irão trocar mensagens entre si
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              {/* Balancing Mode */}
              <div className="space-y-2">
                <Label>Modo de Balanceamento</Label>
                <Select value={balancingMode} onValueChange={setBalancingMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Automático (Inteligente)
                      </div>
                    </SelectItem>
                    <SelectItem value="round-robin">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Round Robin
                      </div>
                    </SelectItem>
                    <SelectItem value="random">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Aleatório
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  As instâncias serão balanceadas automaticamente baseado na performance e uso
                </p>
              </div>

              {/* Instances List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Instâncias Conectadas e Ativas</Label>
                  <Badge variant="secondary">{connectedInstances.length} disponíveis</Badge>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : connectedInstances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-medium">Nenhuma instância conectada e ativa</p>
                    <p className="text-sm text-muted-foreground">
                      Configure suas instâncias na aba Instâncias primeiro
                    </p>
                  </div>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllInstances}
                      className="mb-3"
                    >
                      {selectedInstances.size === connectedInstances.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </Button>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {connectedInstances.map((instance) => (
                          <div 
                            key={instance.id}
                            className={cn(
                              "instance-select-card",
                              selectedInstances.has(instance.id) && "selected"
                            )}
                            onClick={() => toggleInstance(instance.id)}
                          >
                            <Checkbox 
                              checked={selectedInstances.has(instance.id)}
                              onCheckedChange={() => toggleInstance(instance.id)}
                            />
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{instance.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {instance.phone_connected || "Número conectado"}
                              </p>
                            </div>
                            <div className="status-indicator online" />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>

              {/* Instance Summary */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-background/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total:</p>
                  <p className="font-semibold text-sm sm:text-base">{instances.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">Conectadas:</p>
                  <p className="font-semibold text-sm sm:text-base text-green-500">{connectedInstances.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">Selecionadas:</p>
                  <p className="font-semibold text-sm sm:text-base text-primary">{selectedInstances.size}</p>
                </div>
              </div>

              {/* Insufficient Instances Warning */}
              {connectedInstances.length < 2 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Instâncias Insuficientes</AlertTitle>
                  <AlertDescription>
                    São necessárias pelo menos 2 instâncias conectadas e selecionadas.
                    Conecte mais instâncias primeiro.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Warming Configuration */}
          <Card className="glass-card">
            <CardHeader className="border-b border-border/30 p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                <div className="stats-icon-container accent shrink-0">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                </div>
                Configurações de Aquecimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
              {/* Message Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <Label className="font-medium">Configurações de Mensagens</Label>
                </div>
                
                <div className="space-y-2">
                  <Label>Limite Padrão de Mensagens por Dia</Label>
                  <Input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                    min={1}
                    max={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este será o limite padrão. Você pode configurar limites específicos por instância abaixo.
                  </p>
                </div>
              </div>

              {/* Templates Section */}
              <div className="space-y-4">
                <Label className="font-medium">Templates de Mensagens</Label>
                <p className="text-sm text-muted-foreground">
                  Adicione até 5000 palavras de templates para personalização com IA
                </p>

                {/* Batch Add */}
                <div className="space-y-2">
                  <Label>Adicionar Templates em Lote</Label>
                  <Textarea
                    value={batchTemplates}
                    onChange={(e) => setBatchTemplates(e.target.value)}
                    placeholder={`Digite suas mensagens, uma por linha, por exemplo:
Oi! Tudo bem?
Como você está?
Bom dia!
Boa tarde!
Boa noite!`}
                    className="min-h-[120px]"
                  />
                  <Button variant="outline" onClick={addBatchTemplates} className="gap-2 w-full sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Adicionar em Lote
                  </Button>
                </div>

                {/* Current Templates */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Templates Atuais ({templates.length})</Label>
                    {templates.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAllTemplates}>
                        Limpar Todos
                      </Button>
                    )}
                  </div>
                  
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-2 space-y-2">
                      {templates.map((template) => (
                        <div 
                          key={template.id}
                          className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/30"
                        >
                          <span className="text-sm truncate flex-1">{template.content}</span>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTemplate(template.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Add individual template */}
                  <div className="flex gap-2">
                    <Input
                      value={newTemplate}
                      onChange={(e) => setNewTemplate(e.target.value)}
                      placeholder="Adicionar mensagem individual..."
                      onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
                    />
                    <Button variant="outline" size="icon" onClick={addTemplate}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Timing Settings */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Timing Avançado</span>
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <Label>Velocidade da Conversa</Label>
                    </div>
                    <Select value={conversationSpeed} onValueChange={(v) => setConversationSpeed(v as ConversationSpeed)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">
                          🐢 Lento - 60-120 segundos entre mensagens
                        </SelectItem>
                        <SelectItem value="normal">
                          ⚡ Normal - 30-80 segundos entre mensagens
                        </SelectItem>
                        <SelectItem value="fast">
                          🚀 Rápido - 10-30 segundos entre mensagens
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        <strong>Modo {getSpeedLabel(conversationSpeed)}:</strong> {getSpeedDescription(conversationSpeed)}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* AI Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Configurações de IA</Label>
                </div>
                
                <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">Usar IA para Personalização</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Gera frases curtas mais naturais e humanizadas
                    </p>
                  </div>
                  <Switch checked={useAI} onCheckedChange={setUseAI} className="shrink-0" />
                </div>

                {useAI && (
                  <div className="space-y-4 p-3 sm:p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4 shrink-0" />
                          Gerador de Mensagens IA
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Gere mensagens naturais baseadas nos seus templates
                        </p>
                      </div>
                      <Button 
                        onClick={generateAIMessages}
                        disabled={isGeneratingAI}
                        className="gap-2 w-full sm:w-auto shrink-0"
                        size="sm"
                      >
                        {isGeneratingAI ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Gerar Mensagens
                          </>
                        )}
                      </Button>
                    </div>

                    {/* AI Generated Messages Preview */}
                    {aiGeneratedMessages.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Mensagens Geradas pela IA ({aiGeneratedMessages.length})</Label>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={addAIMessagesToTemplates}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Adicionar aos Templates
                          </Button>
                        </div>
                        <ScrollArea className="h-[120px] border rounded-lg bg-background/50">
                          <div className="p-2 space-y-2">
                            {aiGeneratedMessages.map((msg, index) => (
                              <div 
                                key={index}
                                className="flex items-center gap-2 p-2 bg-primary/10 rounded border border-primary/20"
                              >
                                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                                <span className="text-sm">{msg}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        A IA gera mensagens curtas e naturais baseadas nos seus templates para simular conversas reais entre amigos.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Controles de Aquecimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canStartWarming && warmingStatus === 'idle' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Para iniciar o aquecimento, você precisa de pelo menos 2 instâncias conectadas.
                  </AlertDescription>
                </Alert>
              )}

              {/* Save Config Button */}
              {warmingStatus === 'idle' && (
                <Button 
                  variant="outline"
                  className="w-full gap-2 mb-2" 
                  onClick={saveSessionConfig}
                  disabled={isSaving || !user}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Salvar Configuração
                    </>
                  )}
                </Button>
              )}

              {warmingStatus === 'idle' ? (
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  disabled={!canStartWarming || !user}
                  onClick={startWarming}
                >
                  <Play className="h-5 w-5" />
                  Iniciar Aquecimento Real
                </Button>
              ) : warmingStatus === 'running' ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2" 
                    size="lg"
                    onClick={pauseWarming}
                  >
                    <Pause className="h-5 w-5" />
                    Pausar
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 gap-2" 
                    size="lg"
                    onClick={stopWarming}
                  >
                    <X className="h-5 w-5" />
                    Parar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 gap-2" 
                    size="lg"
                    onClick={resumeWarming}
                  >
                    <Play className="h-5 w-5" />
                    Retomar
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 gap-2" 
                    size="lg"
                    onClick={stopWarming}
                  >
                    <X className="h-5 w-5" />
                    Parar
                  </Button>
                </div>
              )}

              {!user && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Faça login para salvar configurações e iniciar o aquecimento real.
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Dica:</strong> O aquecimento funciona melhor com 3-5 instâncias conectadas.</p>
                <p><strong>Recomendação:</strong> Execute o aquecimento por pelo menos 24 horas para melhores resultados.</p>
                {useAI && (
                  <p className="text-primary"><strong>🤖 IA Ativa:</strong> Mensagens serão geradas automaticamente durante o aquecimento.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Panel */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Progresso do Aquecimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={warmingStatus === 'running' ? 'default' : 'secondary'}>
                  {warmingStatus === 'idle' ? 'Aguardando' : warmingStatus === 'running' ? 'Executando' : 'Pausado'}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Fase Atual</span>
                <Badge variant="outline" className="capitalize">
                  {warmingPhase === 'initialization' ? 'Inicialização' : warmingPhase === 'warming' ? 'Aquecendo' : 'Completo'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Progresso Geral</span>
                  <span className="font-semibold">{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} />
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-xs">Mensagens Enviadas</span>
                  </div>
                  <p className="text-2xl font-bold">{messagesSent}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-xs">Mensagens Recebidas</span>
                  </div>
                  <p className="text-2xl font-bold">{messagesReceived}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debug Panel */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Settings className="h-4 w-4" />
                  Debug Panel
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={warmingStatus === 'running' ? 'default' : 'secondary'}>
                    {warmingStatus === 'running' ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDebug(!showDebug)}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
                    {showDebug ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
                <div>
                  <p className="text-lg font-bold">{connectedInstances.length}</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{messagesSent + messagesReceived}</p>
                  <p className="text-xs text-muted-foreground">Messages</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{Math.floor(selectedInstances.size / 2)}</p>
                  <p className="text-xs text-muted-foreground">Active Pairs</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{logs.length}</p>
                  <p className="text-xs text-muted-foreground">Log Entries</p>
                </div>
              </div>
              
              {showDebug && (
                <ScrollArea className="h-[150px] mt-4 border rounded p-2">
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <p key={index} className="text-xs font-mono text-muted-foreground">
                        [{new Date().toLocaleTimeString()}] {log}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <WarmingSessionHistory 
            sessions={sessions} 
            onLoadSession={loadSessionFromHistory}
            onRefresh={fetchSessions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
