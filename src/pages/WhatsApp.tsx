import { useState, useEffect, lazy, Suspense } from 'react';
import { useWhatsAppInstances, WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { useCampaigns, Campaign } from '@/hooks/useCampaigns';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  Send, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Zap,
  RefreshCw,
  CalendarDays,
  FileText,
  History,
  Smartphone,
  Megaphone,
  Plus,
  Play,
  Pause,
  QrCode,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  CircleDot,
  Lock,
  CreditCard,
  Link,
  User,
  Settings,
  TestTube2,
  Database,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { WhatsAppTemplateManager } from '@/components/WhatsAppTemplateManager';
import { ScheduleDispatch } from '@/components/ScheduleDispatch';
import { ScheduledDispatchList } from '@/components/ScheduledDispatchList';
import { DispatchHistoryPanel } from '@/components/DispatchHistoryPanel';
import { QRCodeDialog } from '@/components/QRCodeDialog';
import { CreateInstanceDialog } from '@/components/CreateInstanceDialog';
import { CreateCampaignDialog } from '@/components/CreateCampaignDialog';
import { CampaignLogsDialog } from '@/components/CampaignLogsDialog';
import { ImportContactsDialog } from '@/components/ImportContactsDialog';
import { WhatsAppStatus } from '@/components/WhatsAppStatus';
import { BulkDispatcher } from '@/components/BulkDispatcher';
import { SubscriptionPlansDialog } from '@/components/SubscriptionPlansDialog';
import { InstanceSettingsDialog } from '@/components/InstanceSettingsDialog';
import { PlanLimitAlert } from '@/components/PlanLimitAlert';
import { motion } from 'framer-motion';

// Lazy load pages
const Contacts = lazy(() => import('@/pages/Contacts'));
const FilterNumbers = lazy(() => import('@/pages/FilterNumbers'));

export default function WhatsApp() {
  const { 
    instances, 
    isLoading: instancesLoading, 
    createInstance, 
    getQRCode, 
    checkStatus, 
    deleteInstance, 
    getPairingCode,
    configureWebhook,
    testWebhook,
    refetch: refetchInstances 
  } = useWhatsAppInstances();
  const { 
    campaigns, 
    isLoading: campaignsLoading, 
    startCampaign, 
    pauseCampaign, 
    refetch: refetchCampaigns 
  } = useCampaigns();
  const { 
    planType,
    canCreateWhatsAppInstance, 
    canDispatch,
    getRemainingDispatches,
    getRemainingWhatsAppInstances,
    whatsappInstanceCount,
    limits 
  } = usePlanLimits();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('dispatch');
  const [showPlans, setShowPlans] = useState(false);

  // Subscription status
  const subscriptionExpired = planType === 'expired';

  // Instance/Campaign dialogs
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [createInstanceDialogOpen, setCreateInstanceDialogOpen] = useState(false);
  const [createCampaignDialogOpen, setCreateCampaignDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [configuringWebhook, setConfiguringWebhook] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsInstance, setSettingsInstance] = useState<WhatsAppInstance | null>(null);

  // Polling for campaign progress
  useEffect(() => {
    const activeCampaigns = campaigns.filter(c => c.status === 'running');
    if (activeCampaigns.length > 0) {
      const interval = setInterval(() => {
        refetchCampaigns();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [campaigns, refetchCampaigns]);

  // Instance handlers
  const handleShowQRCode = async (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setQrCodeDialogOpen(true);
  };

  const handleCheckStatus = async (instanceId: string) => {
    setCheckingStatus(instanceId);
    try {
      await checkStatus(instanceId);
      await refetchInstances();
      toast.success("Status atualizado!");
    } catch (error) {
      toast.error("Erro ao verificar status");
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleConfigureWebhook = async (instanceId: string) => {
    setConfiguringWebhook(instanceId);
    try {
      await configureWebhook(instanceId);
    } catch (error) {
      toast.error("Erro ao sincronizar webhook");
    } finally {
      setConfiguringWebhook(null);
    }
  };

  const handleTestWebhook = async (instanceId: string) => {
    setTestingWebhook(instanceId);
    try {
      await testWebhook(instanceId);
    } catch (error) {
      toast.error("Erro ao testar webhook");
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleOpenSettings = (instance: WhatsAppInstance) => {
    setSettingsInstance(instance);
    setSettingsDialogOpen(true);
  };
  const handleDeleteInstance = async (instanceId: string) => {
    if (confirm("Tem certeza que deseja excluir esta instância?")) {
      await deleteInstance(instanceId);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    await startCampaign(campaignId);
  };

  const handlePauseCampaign = async (campaignId: string) => {
    await pauseCampaign(campaignId);
  };

  const handleShowLogs = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLogsDialogOpen(true);
  };

  const getInstanceStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1.5">
            <span className="status-indicator online h-2 w-2" />
            Conectado
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive" className="gap-1.5">
            <WifiOff className="w-3 h-3" />
            Desconectado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="w-3 h-3" />
            Aguardando
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-primary/15 text-primary border-primary/30 gap-1.5">
            <Play className="w-3 h-3" />
            Em execução
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 gap-1.5">
            <Pause className="w-3 h-3" />
            Pausada
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Concluída
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1.5">
            <XCircle className="w-3 h-3" />
            Falhou
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="secondary" className="gap-1.5">
            <AlertCircle className="w-3 h-3" />
            Rascunho
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Premium Header */}
      <motion.div 
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="page-header-icon">
          <Send />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gradient">WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie instâncias, campanhas e disparos em massa</p>
        </div>
      </motion.div>

      {/* Subscription Expired Banner */}
      {subscriptionExpired && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card border-destructive/50 bg-destructive/5 p-6 rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Assinatura Expirada</h3>
              <p className="text-muted-foreground">
                Renove sua assinatura para continuar usando disparos, campanhas e instâncias WhatsApp.
              </p>
            </div>
            <Button onClick={() => setShowPlans(true)} className="gap-2">
              <CreditCard className="h-4 w-4" />
              Renovar Agora
            </Button>
          </div>
        </motion.div>
      )}

      {/* Main Tabs with Premium Styling */}
      <div className="relative">
        {/* Overlay when subscription expired */}
        {subscriptionExpired && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Funcionalidades bloqueadas</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Sua assinatura expirou. Renove para continuar usando disparos em massa, campanhas e gerenciamento de instâncias.
              </p>
              <Button onClick={() => setShowPlans(true)} variant="default" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Renovar Assinatura
              </Button>
            </div>
          </div>
        )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full max-w-5xl grid grid-cols-9">
          <TabsTrigger value="dispatch" className="gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Disparo</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Contatos</span>
          </TabsTrigger>
          <TabsTrigger value="filter" className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Filtrar</span>
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-2">
            <CircleDot className="h-4 w-4" />
            <span className="hidden sm:inline">Status</span>
          </TabsTrigger>
          <TabsTrigger value="instances" className="gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Instâncias</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Campanhas</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Agendar</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* Dispatch Tab */}
        <TabsContent value="dispatch" className="space-y-6">
          <BulkDispatcher />
        </TabsContent>

        {/* Filter Numbers Tab */}
        <TabsContent value="filter" className="space-y-6">
          <Suspense fallback={
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          }>
            <FilterNumbers />
          </Suspense>
        </TabsContent>

        {/* Instances Tab */}
        <TabsContent value="instances" className="space-y-6">
          {!canCreateWhatsAppInstance() && limits.whatsappInstances !== -1 && (
            <PlanLimitAlert
              type="limit_reached"
              feature="instâncias WhatsApp"
              planType={planType}
              currentCount={whatsappInstanceCount}
              maxCount={limits.whatsappInstances}
            />
          )}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Suas Instâncias WhatsApp</h2>
              <p className="text-sm text-muted-foreground">Gerencie suas conexões</p>
            </div>
            <Button 
              onClick={() => setCreateInstanceDialogOpen(true)} 
              className="gap-2"
              disabled={!canCreateWhatsAppInstance()}
            >
              <Plus className="w-4 h-4" />
              Nova Instância
              {limits.whatsappInstances !== -1 && (
                <Badge variant="secondary" className="ml-1">
                  {whatsappInstanceCount}/{limits.whatsappInstances}
                </Badge>
              )}
            </Button>
          </div>

          {instancesLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : instances.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="empty-state">
                <div className="empty-state-icon">
                  <Smartphone />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma instância cadastrada</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Crie sua primeira instância WhatsApp para começar a enviar campanhas
                </p>
                <Button onClick={() => setCreateInstanceDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Instância
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div 
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {instances.map((instance) => (
                <motion.div key={instance.id} variants={itemVariants}>
                  <Card className="glass-card group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {/* Profile Picture */}
                          <div className="relative shrink-0">
                            {instance.profile_picture_url ? (
                              <img 
                                src={instance.profile_picture_url} 
                                alt={instance.name}
                                className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-muted-foreground/20">
                                <User className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            {instance.status === 'connected' && (
                              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                            )}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                              {instance.name}
                            </CardTitle>
                            <CardDescription className="flex flex-col gap-0.5">
                              {instance.profile_name && (
                                <span className="font-medium text-foreground/80 truncate">
                                  {instance.profile_name}
                                </span>
                              )}
                              {instance.phone_connected ? (
                                <span className="flex items-center gap-1">
                                  <Smartphone className="w-3 h-3" />
                                  {instance.phone_connected}
                                </span>
                              ) : (
                                <span>Não conectado</span>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        {getInstanceStatusBadge(instance.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Limite diário:</span>
                        <span className="font-semibold">{instance.daily_limit || 500} msgs</span>
                      </div>
                      {instance.status === 'connected' && (
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span>Webhook ativo - pronto para receber mensagens</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Clique em "Webhook" para re-sincronizar se não estiver recebendo mensagens
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleShowQRCode(instance)}
                          className="gap-1.5"
                        >
                          <QrCode className="w-4 h-4" />
                          QR Code
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCheckStatus(instance.id)}
                          disabled={checkingStatus === instance.id}
                          className="gap-1.5"
                        >
                          <RefreshCw className={`w-4 h-4 ${checkingStatus === instance.id ? 'animate-spin' : ''}`} />
                          Status
                        </Button>
                        {instance.status === 'connected' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleConfigureWebhook(instance.id)}
                              disabled={configuringWebhook === instance.id}
                              className="gap-1.5"
                              title="Sincronizar webhook para receber mensagens"
                            >
                              <Link className={`w-4 h-4 ${configuringWebhook === instance.id ? 'animate-pulse' : ''}`} />
                              Webhook
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleTestWebhook(instance.id)}
                              disabled={testingWebhook === instance.id}
                              className="gap-1.5 text-primary hover:text-primary"
                              title="Enviar mensagem de teste para verificar se o webhook está funcionando"
                            >
                              <TestTube2 className={`w-4 h-4 ${testingWebhook === instance.id ? 'animate-spin' : ''}`} />
                              Testar
                            </Button>
                          </>
                         )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenSettings(instance)}
                          title="Configurações avançadas"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteInstance(instance.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Suas Campanhas</h2>
              <p className="text-sm text-muted-foreground">Gerencie campanhas de envio</p>
            </div>
            <Button 
              onClick={() => setCreateCampaignDialogOpen(true)}
              disabled={instances.filter(i => i.status === 'connected').length === 0}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Campanha
            </Button>
          </div>

          {instances.filter(i => i.status === 'connected').length === 0 && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <p className="text-sm text-muted-foreground">
                  Conecte pelo menos uma instância WhatsApp para criar campanhas
                </p>
              </CardContent>
            </Card>
          )}

          {campaignsLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : campaigns.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="empty-state">
                <div className="empty-state-icon">
                  <Megaphone />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Crie sua primeira campanha de envio em massa
                </p>
                <Button 
                  onClick={() => setCreateCampaignDialogOpen(true)}
                  disabled={instances.filter(i => i.status === 'connected').length === 0}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Campanha
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div 
              className="grid gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {campaigns.map((campaign) => (
                <motion.div key={campaign.id} variants={itemVariants}>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          <CardDescription>
                            Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                          </CardDescription>
                        </div>
                        {getCampaignStatusBadge(campaign.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-semibold">{campaign.progress}%</span>
                        </div>
                        <div className="progress-premium">
                          <div 
                            className="progress-premium-bar" 
                            style={{ width: `${campaign.progress}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="kpi-card p-3">
                          <p className="text-2xl font-bold">{campaign.total_contacts}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="kpi-card success p-3">
                          <p className="text-2xl font-bold text-green-500">{campaign.sent_count}</p>
                          <p className="text-xs text-muted-foreground">Enviados</p>
                        </div>
                        <div className="kpi-card danger p-3">
                          <p className="text-2xl font-bold text-destructive">{campaign.failed_count}</p>
                          <p className="text-xs text-muted-foreground">Falhas</p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap pt-2">
                        {campaign.status === 'draft' && campaign.total_contacts > 0 && (
                          <Button size="sm" onClick={() => handleStartCampaign(campaign.id)} className="gap-1.5">
                            <Play className="w-4 h-4" />
                            Iniciar
                          </Button>
                        )}
                        {campaign.status === 'running' && (
                          <Button size="sm" variant="outline" onClick={() => handlePauseCampaign(campaign.id)} className="gap-1.5">
                            <Pause className="w-4 h-4" />
                            Pausar
                          </Button>
                        )}
                        {campaign.status === 'paused' && (
                          <Button size="sm" onClick={() => handleStartCampaign(campaign.id)} className="gap-1.5">
                            <Play className="w-4 h-4" />
                            Retomar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleShowLogs(campaign)} className="gap-1.5">
                          <FileText className="w-4 h-4" />
                          Logs
                        </Button>
                        {(campaign.status === 'draft' || campaign.status === 'paused') && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setImportDialogOpen(true);
                            }}
                            className="gap-1.5"
                          >
                            <Users className="w-4 h-4" />
                            Contatos
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <WhatsAppTemplateManager onSelectTemplate={() => {}} />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <ScheduledDispatchList />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <DispatchHistoryPanel />
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-6">
          <WhatsAppStatus instances={instances} />
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          }>
            <Contacts />
          </Suspense>
        </TabsContent>
      </Tabs>
      </div>

      {/* Dialogs */}
      <QRCodeDialog
        open={qrCodeDialogOpen}
        onOpenChange={setQrCodeDialogOpen}
        instance={selectedInstance}
        getQRCode={getQRCode}
        getPairingCode={getPairingCode}
      />

      <CreateInstanceDialog
        open={createInstanceDialogOpen}
        onOpenChange={setCreateInstanceDialogOpen}
        onCreateInstance={createInstance}
        onRefetch={refetchInstances}
      />

      <CreateCampaignDialog
        open={createCampaignDialogOpen}
        onOpenChange={setCreateCampaignDialogOpen}
        instances={instances.filter(i => i.status === 'connected')}
        onRefetch={refetchCampaigns}
      />

      {selectedCampaign && (
        <>
          <CampaignLogsDialog
            open={logsDialogOpen}
            onOpenChange={setLogsDialogOpen}
            campaign={selectedCampaign}
          />
          <ImportContactsDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            campaign={selectedCampaign}
            onRefetch={refetchCampaigns}
          />
        </>
      )}

      <SubscriptionPlansDialog open={showPlans} onOpenChange={setShowPlans} />

      <InstanceSettingsDialog
        instance={settingsInstance}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onSave={refetchInstances}
      />
    </div>
  );
}
