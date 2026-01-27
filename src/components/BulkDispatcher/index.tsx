import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Send, RotateCcw, Users, MessageSquare,
  Play, Pause, Square, Sparkles, Clock, Zap, Bell, Volume2
} from 'lucide-react';
import { InstanceSidebar } from './InstanceSidebar';
import { ComposerStudio } from './ComposerStudio';
import { PhonePreview } from './PhonePreview';
import { BottomPanel } from './BottomPanel';
import { DispatchProgress } from './DispatchProgress';
import { ConfigManager } from './ConfigManager';
import { DispatchMessage } from '@/hooks/useBulkDispatch';
import { useBulkDispatchContext } from '@/contexts/BulkDispatchContext';
import { useDispatchConfigs } from '@/hooks/useDispatchConfigs';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useContactsSupabase } from '@/hooks/useContactsSupabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Contact, SavedContact } from './ContactsManager';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import confetti from 'canvas-confetti';

export function BulkDispatcher() {
  const { toast } = useToast();
  const { permission, requestPermission, showLocalNotification, isSupported } = usePushNotifications();
  const { playDispatchComplete, playDispatchFailure } = useSoundEffects();
  
  // Dispatch notification preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem('dispatch-notifications-enabled');
    return stored !== 'false';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('dispatch-sound-enabled');
    return stored !== 'false';
  });
  
  // Persist preferences
  useEffect(() => {
    localStorage.setItem('dispatch-notifications-enabled', String(notificationsEnabled));
  }, [notificationsEnabled]);
  
  useEffect(() => {
    localStorage.setItem('dispatch-sound-enabled', String(soundEnabled));
  }, [soundEnabled]);
  
  const { instances, isLoading: instancesLoading, refetch: fetchInstances, checkNumbers, refreshAllStatus } = useWhatsAppInstances();
  const {
    config,
    contacts,
    progress,
    setContacts,
    updateConfig,
    resetConfig,
    startDispatch,
    pauseDispatch,
    resumeDispatch,
    cancelDispatch,
    loadConfig,
  } = useBulkDispatchContext();
  
  const {
    configs: savedConfigs,
    isLoading: configsLoading,
    saveConfig,
    updateConfig: updateSavedConfig,
    deleteConfig,
    configToDispatchConfig,
  } = useDispatchConfigs();

  const {
    contacts: savedContactsRaw,
    isLoading: savedContactsLoading,
    refetch: refreshSavedContacts,
    importContacts,
    loadMoreContacts,
    pagination: savedContactsPagination,
    hasInitialLoad: savedContactsInitialized,
    searchContactsRemote,
  } = useContactsSupabase();

  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [shouldLoadSavedContacts, setShouldLoadSavedContacts] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('contacts');
  
  useEffect(() => {
    if (shouldLoadSavedContacts && !savedContactsInitialized) {
      refreshSavedContacts();
    }
  }, [shouldLoadSavedContacts, savedContactsInitialized, refreshSavedContacts]);
  
  useEffect(() => {
    setSavedContacts(savedContactsRaw.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || undefined,
      notes: c.notes || undefined
    })));
  }, [savedContactsRaw]);

  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleSaveContacts = useCallback(async (contactsToSave: { name: string; phone: string; email?: string }[]) => {
    setIsSavingContacts(true);
    try {
      await importContacts(contactsToSave.map(c => ({
        name: c.name,
        phone: c.phone,
        email: c.email || ''
      })));
      return true;
    } catch (error) {
      console.error('Error saving contacts:', error);
      return false;
    } finally {
      setIsSavingContacts(false);
    }
  }, [importContacts]);

  useEffect(() => {
    const autoRefresh = async () => {
      if (!isRefreshingStatus && !progress.isRunning) {
        setIsRefreshingStatus(true);
        try {
          await refreshAllStatus();
        } finally {
          setIsRefreshingStatus(false);
        }
      }
    };

    autoRefresh();
    refreshIntervalRef.current = setInterval(autoRefresh, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshAllStatus, progress.isRunning]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshingStatus(true);
    try {
      await refreshAllStatus();
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [refreshAllStatus]);

  const handleContactsChange = useCallback((newContacts: Contact[]) => {
    setContacts(newContacts.map(c => ({
      phone: c.phone,
      name: c.name,
      plan: c.plan,
      expires_at: c.expires_at,
      link: c.link,
      email: c.email,
      variables: c.variables,
      originalId: c.originalId
    })));
  }, [setContacts]);

  const handleVerifyContacts = useCallback(async () => {
    if (contacts.length === 0 || !config.instanceIds[0]) {
      toast({
        title: 'Aviso',
        description: 'Selecione uma instância e adicione contatos primeiro',
        variant: 'destructive'
      });
      return;
    }

    setIsVerifying(true);
    setVerificationProgress(0);

    const instance = instances.find(i => i.id === config.instanceIds[0]);
    if (!instance) {
      setIsVerifying(false);
      return;
    }

    const batchSize = 10;
    const verified: Contact[] = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const phones = batch.map(c => c.phone);

      try {
        const results = await checkNumbers(instance.id, phones, true);
        
        if (results) {
          batch.forEach((contact, idx) => {
            const result = results.find(r => r.phone.includes(contact.phone.slice(-8)));
            verified.push({
              ...contact,
              isValid: result?.exists ?? undefined,
              whatsappName: result?.whatsappName
            } as Contact);
          });
        } else {
          batch.forEach(contact => {
            verified.push({ ...contact, isValid: undefined } as Contact);
          });
        }
      } catch (error) {
        batch.forEach(contact => {
          verified.push({ ...contact, isValid: undefined } as Contact);
        });
      }

      setVerificationProgress(((i + batch.length) / contacts.length) * 100);
    }

    handleContactsChange(verified);
    setIsVerifying(false);
    
    const validCount = verified.filter(c => c.isValid === true).length;
    const invalidCount = verified.filter(c => c.isValid === false).length;
    
    toast({
      title: 'Verificação Concluída',
      description: `${validCount} válidos, ${invalidCount} inválidos`,
    });
  }, [contacts, config.instanceIds, instances, checkNumbers, toast, handleContactsChange]);

  const handleMessagesChange = useCallback((messages: DispatchMessage[]) => {
    updateConfig({ messages });
  }, [updateConfig]);

  const canStart = 
    config.instanceIds.length > 0 &&
    config.messages.length > 0 &&
    config.messages.some(m => m.content.trim().length > 0) &&
    contacts.length > 0 &&
    !progress.isRunning;

  const handleStart = async () => {
    const selectedInstances = instances.filter(i => config.instanceIds.includes(i.id));
    await startDispatch(selectedInstances);
    refreshSavedContacts();
  };

  const handleSaveConfig = useCallback(async (name: string) => {
    await saveConfig(name, config);
  }, [saveConfig, config]);

  const handleLoadConfig = useCallback((savedConfig: any) => {
    const dispatchConfig = configToDispatchConfig(savedConfig);
    loadConfig(dispatchConfig);
  }, [configToDispatchConfig, loadConfig]);

  const handleUpdateConfig = useCallback(async (id: string, name: string) => {
    await updateSavedConfig(id, name, config);
  }, [updateSavedConfig, config]);

  const handleDeleteConfig = useCallback(async (id: string) => {
    await deleteConfig(id);
  }, [deleteConfig]);

  const connectedInstances = instances.filter(i => i.status === 'connected').length;
  const selectedInstances = config.instanceIds.length;
  const totalMessages = config.messages.length;
  const percentage = progress.total > 0 
    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
    : 0;

  // Track previous progress state to detect completion
  const prevProgressRef = useRef({ isRunning: false, sent: 0 });
  const dispatchStartTimeRef = useRef<number | null>(null);
  const [messagesPerMinute, setMessagesPerMinute] = useState<number | null>(null);

  // Track dispatch start time and calculate speed
  useEffect(() => {
    if (progress.isRunning && !dispatchStartTimeRef.current) {
      dispatchStartTimeRef.current = Date.now();
    } else if (!progress.isRunning) {
      dispatchStartTimeRef.current = null;
      setMessagesPerMinute(null);
    }
  }, [progress.isRunning]);

  // Update messages per minute calculation
  useEffect(() => {
    if (!progress.isRunning || !dispatchStartTimeRef.current) return;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - dispatchStartTimeRef.current!;
      const elapsedMinutes = elapsedMs / 60000;
      
      if (elapsedMinutes > 0 && progress.sent > 0) {
        const speed = progress.sent / elapsedMinutes;
        setMessagesPerMinute(Math.round(speed * 10) / 10);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [progress.isRunning, progress.sent]);
  
  // Fire confetti and show notification when dispatch completes
  useEffect(() => {
    const wasRunning = prevProgressRef.current.isRunning;
    const justCompleted = wasRunning && !progress.isRunning && progress.sent > 0;
    
    if (justCompleted) {
      const total = progress.sent + progress.failed;
      const failureRate = total > 0 ? (progress.failed / total) * 100 : 0;
      const hasHighFailures = failureRate >= 30; // 30% or more failures
      
      // Show browser notification (works even in background)
      if (notificationsEnabled && permission === 'granted') {
        if (hasHighFailures) {
          showLocalNotification('⚠️ Disparo com Falhas', {
            body: `❌ ${progress.failed} falharam (${failureRate.toFixed(0)}%) • ✅ ${progress.sent} enviados`,
            tag: 'dispatch-complete',
            requireInteraction: true,
          });
        } else {
          showLocalNotification('🎉 Disparo Concluído!', {
            body: `✅ ${progress.sent} enviados • ❌ ${progress.failed} falharam`,
            tag: 'dispatch-complete',
            requireInteraction: true,
          });
        }
      }

      // Play appropriate sound
      if (soundEnabled) {
        if (hasHighFailures) {
          playDispatchFailure();
        } else {
          playDispatchComplete();
        }
      }

      // Fire confetti only on success (low failure rate)
      if (!hasHighFailures) {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);
      }
    }

    prevProgressRef.current = { isRunning: progress.isRunning, sent: progress.sent };
  }, [progress.isRunning, progress.sent, progress.failed, permission, showLocalNotification, notificationsEnabled, soundEnabled, playDispatchComplete, playDispatchFailure]);

  // Request notification permission when dispatch starts (if not granted)
  useEffect(() => {
    if (progress.isRunning && permission === 'default' && isSupported) {
      requestPermission();
    }
  }, [progress.isRunning, permission, isSupported, requestPermission]);

  // Format estimated time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (!seconds || seconds <= 0) return null;
    
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.ceil(seconds % 60);
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.ceil((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  };

  // Calculate estimated time based on progress
  const estimatedTimeRemaining = progress.isRunning && progress.estimatedTimeRemaining 
    ? formatTimeRemaining(progress.estimatedTimeRemaining)
    : null;

  return (
    <div className="space-y-4 pb-8">
      {/* Premium Header with Progress Integration */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-background via-background to-primary/5 border border-border/50"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative p-6">
          {/* Top Row - Title & Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <motion.div 
                className="page-header-icon"
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-7 h-7" />
              </motion.div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">Disparo Studio</h1>
                  <Badge className="bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-primary/30">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Pro
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Crie e execute campanhas de WhatsApp com controle total
                </p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-2">
              <motion.div 
                className="quick-action-btn"
                whileHover={{ scale: 1.02 }}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  connectedInstances > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                )} />
                <span className="text-sm">{connectedInstances} online</span>
              </motion.div>
              <motion.div 
                className="quick-action-btn"
                whileHover={{ scale: 1.02 }}
              >
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm">{contacts.length} contatos</span>
              </motion.div>
              <motion.div 
                className="quick-action-btn"
                whileHover={{ scale: 1.02 }}
              >
                <MessageSquare className="w-4 h-4 text-accent" />
                <span className="text-sm">{totalMessages} mensagens</span>
              </motion.div>
              
              {/* Notification & Sound Toggles */}
              <div className="flex items-center gap-1 ml-2 border-l border-border/50 pl-2">
                <motion.button
                  onClick={() => {
                    if (permission === 'default' && isSupported) {
                      requestPermission().then(granted => {
                        if (granted) setNotificationsEnabled(true);
                      });
                    } else {
                      setNotificationsEnabled(!notificationsEnabled);
                    }
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    notificationsEnabled && permission === 'granted'
                      ? "bg-primary/20 text-primary" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={notificationsEnabled ? "Desativar notificações" : "Ativar notificações"}
                >
                  <Bell className="w-4 h-4" />
                </motion.button>
                <motion.button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    soundEnabled 
                      ? "bg-primary/20 text-primary" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={soundEnabled ? "Desativar som" : "Ativar som"}
                >
                  <Volume2 className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>
          
          {/* Progress Bar - Only show when running */}
          <AnimatePresence>
            {progress.isRunning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      progress.isPaused ? "bg-yellow-500" : "bg-emerald-500 animate-pulse"
                    )} />
                    <span className="text-sm font-medium">
                      {progress.isPaused ? 'Pausado' : 'Enviando...'}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress.sent + progress.failed} / {progress.total} ({percentage}%)
                  </span>
                </div>
                <div className="mission-progress">
                  <motion.div 
                    className="mission-progress-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <ConfigManager
              configs={savedConfigs}
              currentConfig={config}
              isLoading={configsLoading}
              onSave={handleSaveConfig}
              onLoad={handleLoadConfig}
              onUpdate={handleUpdateConfig}
              onDelete={handleDeleteConfig}
            />
            <Button variant="outline" size="sm" onClick={resetConfig} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              Resetar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Content - Studio Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_300px] gap-4">
        {/* Left - Instance Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden xl:block"
        >
          <InstanceSidebar
            instances={instances}
            selectedIds={config.instanceIds}
            balancingMode={config.balancingMode}
            onSelectionChange={(ids) => updateConfig({ instanceIds: ids })}
            onBalancingModeChange={(mode) => updateConfig({ balancingMode: mode })}
            onRefresh={handleManualRefresh}
            isLoading={instancesLoading || isRefreshingStatus}
          />
        </motion.div>

        {/* Center - Message Composer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <ComposerStudio
            messages={config.messages}
            randomizeOrder={config.randomizeOrder}
            onMessagesChange={handleMessagesChange}
            onRandomizeChange={(randomize) => updateConfig({ randomizeOrder: randomize })}
          />
        </motion.div>

        {/* Right - Phone Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="hidden xl:flex items-start justify-center pt-4"
        >
          <PhonePreview 
            message={config.messages[0]}
            contactName={contacts[0]?.name || "João Silva"}
          />
        </motion.div>
      </div>

      {/* Mobile Instance Selector */}
      <div className="xl:hidden">
        <InstanceSidebar
          instances={instances}
          selectedIds={config.instanceIds}
          balancingMode={config.balancingMode}
          onSelectionChange={(ids) => updateConfig({ instanceIds: ids })}
          onBalancingModeChange={(mode) => updateConfig({ balancingMode: mode })}
          onRefresh={handleManualRefresh}
          isLoading={instancesLoading || isRefreshingStatus}
          horizontal
        />
      </div>

      {/* Bottom Panel - Expandable Sections */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <BottomPanel
          activeTab={activeBottomTab}
          onTabChange={setActiveBottomTab}
          // Contacts props
          contacts={contacts.map(c => ({ ...c, isValid: undefined })) as Contact[]}
          verifyNumbers={config.verifyNumbers}
          onContactsChange={handleContactsChange}
          onVerifyChange={(verify) => updateConfig({ verifyNumbers: verify })}
          isVerifying={isVerifying}
          verificationProgress={verificationProgress}
          onVerifyContacts={handleVerifyContacts}
          savedContacts={savedContacts}
          isLoadingSaved={savedContactsLoading}
          onRefreshSaved={refreshSavedContacts}
          onSaveContacts={handleSaveContacts}
          isSaving={isSavingContacts}
          onTabChangeInternal={(tab) => {
            if (tab === 'saved') {
              setShouldLoadSavedContacts(true);
            }
          }}
          savedContactsTotal={savedContactsPagination.totalCount}
          hasMoreSavedContacts={savedContactsPagination.hasMore}
          onLoadMoreSavedContacts={loadMoreContacts}
          onSearchSavedContacts={searchContactsRemote}
          // Timing props
          minDelay={config.minDelay}
          maxDelay={config.maxDelay}
          pauseAfterMessages={config.pauseAfterMessages}
          pauseDurationMinutes={config.pauseDurationMinutes}
          stopAfterMessages={config.stopAfterMessages}
          smartDelay={config.smartDelay}
          attentionCall={config.attentionCall}
          attentionCallDelay={config.attentionCallDelay}
          onTimingChange={(updates) => updateConfig(updates as any)}
          // Sending window props
          businessHoursEnabled={config.businessHoursEnabled}
          businessHoursStart={config.businessHoursStart}
          businessHoursEnd={config.businessHoursEnd}
          allowedDays={config.allowedDays}
          onWindowChange={(updates) => updateConfig(updates as any)}
        />
      </motion.div>

      {/* Progress Section - Below Bottom Panel */}
      {(progress.isRunning || progress.sent > 0 || progress.failed > 0 || progress.logs.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <DispatchProgress
            progress={progress}
            onStart={handleStart}
            onPause={pauseDispatch}
            onResume={resumeDispatch}
            onCancel={cancelDispatch}
            canStart={canStart}
          />
        </motion.div>
      )}

      {/* Action Bar - Fixed at Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="sticky bottom-4 z-10"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-background via-background to-primary/5 border border-border/50 backdrop-blur-xl p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5" />
          
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Status Summary */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  connectedInstances > 0 ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                )} />
                <span>{connectedInstances} instâncias</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <span className="text-sm text-muted-foreground">
                {contacts.length} contatos • {totalMessages} mensagens
              </span>
              
              {/* Speed & Time Indicators */}
              <AnimatePresence>
                {progress.isRunning && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2"
                  >
                    <div className="h-4 w-px bg-border" />
                    
                    {/* Speed Indicator */}
                    {messagesPerMinute !== null && (
                      <div className="flex items-center gap-1.5 text-sm bg-accent/10 text-accent px-2.5 py-1 rounded-full">
                        <Zap className="w-3.5 h-3.5" />
                        <span className="font-medium">{messagesPerMinute}/min</span>
                      </div>
                    )}
                    
                    {/* Estimated Time */}
                    {estimatedTimeRemaining && (
                      <div className="flex items-center gap-1.5 text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">~{estimatedTimeRemaining}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center gap-3">
              {!progress.isRunning ? (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    onClick={handleStart} 
                    disabled={!canStart}
                    className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25 px-8"
                    size="lg"
                  >
                    <Play className="w-5 h-5" />
                    Iniciar Disparo
                    {contacts.length > 0 && (
                      <Badge variant="secondary" className="ml-1 bg-white/20 text-white">
                        {contacts.length}
                      </Badge>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2">
                  {progress.isPaused ? (
                    <Button onClick={resumeDispatch} className="gap-2" size="lg">
                      <Play className="w-5 h-5" />
                      Retomar
                    </Button>
                  ) : (
                    <Button onClick={pauseDispatch} variant="secondary" className="gap-2" size="lg">
                      <Pause className="w-5 h-5" />
                      Pausar
                    </Button>
                  )}
                  <Button onClick={cancelDispatch} variant="destructive" size="lg">
                    <Square className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default BulkDispatcher;
