import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { processMessage } from '@/lib/spintaxParser';
import { useToast } from '@/hooks/use-toast';
import { useSoundEffects } from '@/hooks/useSoundEffects';

export interface DispatchContact {
  phone: string;
  name?: string;
  plan?: string;
  expires_at?: string;
  link?: string;
  email?: string;
  variables?: Record<string, string>;
  originalId?: string; // ID do contato original se veio de "Meus Contatos"
}

export interface DispatchMessage {
  id: string;
  content: string;
  variations?: string[];
  // Media fields
  mediaType?: 'none' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  fileName?: string;
  mimetype?: string;
}

export interface DispatchConfig {
  instanceIds: string[];
  balancingMode: 'automatic' | 'round-robin' | 'single';
  messages: DispatchMessage[];
  randomizeOrder: boolean;
  minDelay: number;
  maxDelay: number;
  pauseAfterMessages: number;
  pauseDurationMinutes: number;
  stopAfterMessages: number;
  smartDelay: boolean;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  allowedDays: number[];
  verifyNumbers: boolean;
  autoArchive: boolean;
  attentionCall: boolean;
  attentionCallDelay: number;
}

export interface DispatchProgress {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  archived: number;
  currentContact?: string;
  isPaused: boolean;
  isRunning: boolean;
  estimatedTimeRemaining?: number;
  logs: Array<{
    time: Date;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;
}

// Persisted state for resuming dispatch after browser close
interface PersistedDispatchState {
  contacts: DispatchContact[];
  config: DispatchConfig;
  currentIndex: number;
  sent: number;
  failed: number;
  archived: number;
  historyRecordId?: string;
  logs: Array<{
    time: string; // ISO string for serialization
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;
}

const DISPATCH_STORAGE_KEY = 'bulk_dispatch_state';

const DEFAULT_CONFIG: DispatchConfig = {
  instanceIds: [],
  balancingMode: 'automatic',
  messages: [],
  randomizeOrder: false,
  minDelay: 15,
  maxDelay: 25,
  pauseAfterMessages: 10,
  pauseDurationMinutes: 30,
  stopAfterMessages: 0,
  smartDelay: true,
  businessHoursEnabled: false,
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
  allowedDays: [1, 2, 3, 4, 5, 6, 7],
  verifyNumbers: true,
  autoArchive: true,
  attentionCall: false,
  attentionCallDelay: 2,
};

function loadPersistedState(): PersistedDispatchState | null {
  try {
    const stored = localStorage.getItem(DISPATCH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as PersistedDispatchState;
    }
  } catch (error) {
    console.warn('Failed to load persisted dispatch state:', error);
  }
  return null;
}

function savePersistedState(state: PersistedDispatchState | null) {
  try {
    if (state) {
      localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(DISPATCH_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save dispatch state:', error);
  }
}

export function useBulkDispatch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { playDispatchComplete } = useSoundEffects();
  const [config, setConfig] = useState<DispatchConfig>(DEFAULT_CONFIG);
  const [contacts, setContacts] = useState<DispatchContact[]>([]);
  const [progress, setProgress] = useState<DispatchProgress>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    archived: 0,
    isPaused: false,
    isRunning: false,
    logs: [],
  });
  
  // Track if we have a pending resume from persisted state
  const [hasPendingResume, setHasPendingResume] = useState(false);
  const persistedStateRef = useRef<PersistedDispatchState | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const instanceIndexRef = useRef(0);
  const currentIndexRef = useRef(0);
  const historyRecordIdRef = useRef<string | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted && persisted.contacts.length > 0 && persisted.currentIndex < persisted.contacts.length) {
      persistedStateRef.current = persisted;
      setContacts(persisted.contacts);
      setConfig(persisted.config);
      setHasPendingResume(true);
      
      // Restore progress as paused
      const restoredLogs = persisted.logs.map(log => ({
        ...log,
        time: new Date(log.time)
      }));
      
      setProgress({
        total: persisted.contacts.length,
        sent: persisted.sent,
        failed: persisted.failed,
        pending: persisted.contacts.length - persisted.sent - persisted.failed,
        archived: persisted.archived,
        isPaused: true,
        isRunning: true, // Mark as running but paused
        logs: [
          { time: new Date(), type: 'warning', message: '⚠️ Disparo restaurado - pausado automaticamente' },
          ...restoredLogs
        ],
      });
      
      pausedRef.current = true;
      currentIndexRef.current = persisted.currentIndex;
      historyRecordIdRef.current = persisted.historyRecordId || null;
      
      toast({
        title: '📋 Disparo Restaurado',
        description: `Encontramos um disparo pendente (${persisted.sent}/${persisted.contacts.length}). Clique em Retomar para continuar.`,
      });
    }
  }, []);

  const addLog = useCallback((type: DispatchProgress['logs'][0]['type'], message: string) => {
    setProgress(prev => ({
      ...prev,
      logs: [{ time: new Date(), type, message }, ...prev.logs.slice(0, 99)]
    }));
  }, []);

  const getRandomDelay = useCallback(() => {
    const { minDelay, maxDelay, smartDelay } = config;
    let delay = minDelay + Math.random() * (maxDelay - minDelay);
    
    if (smartDelay) {
      // Add some variance to make it less predictable
      const variance = delay * 0.3 * (Math.random() - 0.5);
      delay += variance;
    }
    
    return Math.max(1, delay) * 1000; // Convert to milliseconds
  }, [config]);

  const getNextInstance = useCallback((instances: any[]) => {
    const connectedInstances = instances.filter(i => i.status === 'connected');
    if (connectedInstances.length === 0) return null;

    if (config.balancingMode === 'single') {
      return connectedInstances[0];
    }

    if (config.balancingMode === 'round-robin') {
      const instance = connectedInstances[instanceIndexRef.current % connectedInstances.length];
      instanceIndexRef.current++;
      return instance;
    }

    // Automatic/intelligent - random selection weighted by recent usage
    const randomIndex = Math.floor(Math.random() * connectedInstances.length);
    return connectedInstances[randomIndex];
  }, [config.balancingMode]);

  const selectRandomMessage = useCallback((): DispatchMessage => {
    const { messages, randomizeOrder } = config;
    if (messages.length === 0) return { id: '', content: '' };

    let selectedMessage: DispatchMessage;
    
    if (randomizeOrder) {
      selectedMessage = messages[Math.floor(Math.random() * messages.length)];
    } else {
      selectedMessage = messages[0];
    }

    // If message has variations, pick content randomly
    let content = selectedMessage.content;
    if (selectedMessage.variations && selectedMessage.variations.length > 0) {
      const allOptions = [selectedMessage.content, ...selectedMessage.variations];
      content = allOptions[Math.floor(Math.random() * allOptions.length)];
    }

    return {
      ...selectedMessage,
      content
    };
  }, [config.messages, config.randomizeOrder]);

  const isWithinBusinessHours = useCallback(() => {
    if (!config.businessHoursEnabled) return true;

    const now = new Date();
    const currentDay = now.getDay() || 7; // Convert Sunday from 0 to 7
    
    if (!config.allowedDays.includes(currentDay)) {
      return false;
    }

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= config.businessHoursStart && currentTime <= config.businessHoursEnd;
  }, [config]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const tryParseInteractiveMenu = (message: string): null | {
    menuType: 'button' | 'list' | 'poll' | 'carousel';
    text: string;
    choices: string[];
    footerText?: string;
    listButton?: string;
    selectableCount?: number;
    imageButton?: string;
  } => {
    // New format: includes a Base64 JSON payload at the end
    // Example: ...\n\n[MENU_DATA:BASE64]
    const b64Match = message.match(/\[MENU_DATA:([A-Za-z0-9+/=]+)\]\s*$/m);
    if (b64Match?.[1]) {
      try {
        const json = decodeURIComponent(escape(atob(b64Match[1])));
        const parsed = JSON.parse(json) as {
          menuType?: string;
          text?: string;
          choices?: string[];
          footerText?: string;
          listButton?: string;
          selectableCount?: number;
          imageButton?: string;
        };

        if (!parsed.menuType || !parsed.text || !Array.isArray(parsed.choices) || parsed.choices.length === 0) {
          return null;
        }

        const menuType = parsed.menuType as 'button' | 'list' | 'poll' | 'carousel';
        if (!['button', 'list', 'poll', 'carousel'].includes(menuType)) return null;

        return {
          menuType,
          text: String(parsed.text),
          choices: parsed.choices.map(String),
          footerText: parsed.footerText ? String(parsed.footerText) : undefined,
          listButton: parsed.listButton ? String(parsed.listButton) : undefined,
          selectableCount: typeof parsed.selectableCount === 'number' ? parsed.selectableCount : undefined,
          imageButton: parsed.imageButton ? String(parsed.imageButton) : undefined,
        };
      } catch {
        // fallthrough
      }
    }

    // Legacy format (best-effort):
    // [MENU:BUTTON]\nText...\n\nOpções: a | b | c\n\nFooter...
    const headMatch = message.match(/^\[MENU:(BUTTON|LIST|POLL|CAROUSEL)\]\s*\n([\s\S]*)$/m);
    if (!headMatch) return null;

    const menuType = headMatch[1].toLowerCase() as 'button' | 'list' | 'poll' | 'carousel';
    const rest = headMatch[2] ?? '';

    const parts = rest.split(/\n\n+/);
    const optionsPartIndex = parts.findIndex(p => /^Opções\s*:/i.test(p.trim()));
    if (optionsPartIndex === -1) return null;

    const text = parts.slice(0, optionsPartIndex).join('\n\n').trim();
    const optionsRaw = parts[optionsPartIndex].replace(/^Opções\s*:\s*/i, '').trim();
    const choices = optionsRaw ? optionsRaw.split(' | ').map(s => s.trim()).filter(Boolean) : [];
    const footerText = parts.slice(optionsPartIndex + 1).join('\n\n').trim() || undefined;

    if (!text || choices.length === 0) return null;

    return { menuType, text, choices, footerText };
  };

  // Save state to localStorage for recovery
  const persistCurrentState = useCallback((
    contactsList: DispatchContact[],
    configData: DispatchConfig,
    currentIdx: number,
    sent: number,
    failed: number,
    archived: number,
    historyId?: string,
    logs?: DispatchProgress['logs']
  ) => {
    const state: PersistedDispatchState = {
      contacts: contactsList,
      config: configData,
      currentIndex: currentIdx,
      sent,
      failed,
      archived,
      historyRecordId: historyId,
      logs: (logs || []).slice(0, 50).map(log => ({
        ...log,
        time: log.time.toISOString()
      }))
    };
    savePersistedState(state);
  }, []);

  const clearPersistedState = useCallback(() => {
    savePersistedState(null);
    persistedStateRef.current = null;
    setHasPendingResume(false);
  }, []);

  const startDispatch = useCallback(async (instancesData: any[], resumeFromIndex?: number) => {
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }

    if (contacts.length === 0) {
      toast({ title: 'Erro', description: 'Nenhum contato para enviar', variant: 'destructive' });
      return;
    }

    if (config.messages.length === 0) {
      toast({ title: 'Erro', description: 'Nenhuma mensagem configurada', variant: 'destructive' });
      return;
    }

    const selectedInstances = instancesData.filter(i => 
      config.instanceIds.includes(i.id) && i.status === 'connected'
    );

    if (selectedInstances.length === 0) {
      toast({ title: 'Erro', description: 'Nenhuma instância conectada selecionada', variant: 'destructive' });
      return;
    }

    abortControllerRef.current = new AbortController();
    pausedRef.current = false;
    instanceIndexRef.current = 0;

    const startIndex = resumeFromIndex ?? 0;
    const isResuming = startIndex > 0;
    
    let sentCount = isResuming ? progress.sent : 0;
    let failedCount = isResuming ? progress.failed : 0;
    let archivedCount = isResuming ? progress.archived : 0;
    let historyRecordId = historyRecordIdRef.current;

    if (!isResuming) {
      setProgress({
        total: contacts.length,
        sent: 0,
        failed: 0,
        pending: contacts.length,
        archived: 0,
        isPaused: false,
        isRunning: true,
        logs: [],
      });

      addLog('info', `Iniciando disparo para ${contacts.length} contatos`);
      addLog('info', `${selectedInstances.length} instância(s) selecionada(s)`);

      // Create dispatch history record
      const { data: historyRecord } = await supabase
        .from('bulk_dispatch_history')
        .insert({
          user_id: user.id,
          dispatch_type: 'whatsapp',
          target_type: 'contacts',
          total_recipients: contacts.length,
          status: 'running',
          message_content: config.messages[0]?.content || ''
        })
        .select()
        .single();

      historyRecordId = historyRecord?.id || null;
      historyRecordIdRef.current = historyRecordId;
    } else {
      setProgress(prev => ({
        ...prev,
        isPaused: false,
        isRunning: true,
      }));
      addLog('info', `Retomando disparo do contato ${startIndex + 1}/${contacts.length}`);
    }

    setHasPendingResume(false);
    let messagesSinceLastPause = 0;

    for (let i = startIndex; i < contacts.length; i++) {
      currentIndexRef.current = i;
      
      // Persist state for recovery
      persistCurrentState(
        contacts,
        config,
        i,
        sentCount,
        failedCount,
        archivedCount,
        historyRecordId || undefined,
        progress.logs
      );

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        addLog('warning', 'Disparo cancelado pelo usuário');
        break;
      }

      // Check if paused
      while (pausedRef.current) {
        await sleep(1000);
        if (abortControllerRef.current?.signal.aborted) break;
      }

      // Check business hours
      if (!isWithinBusinessHours()) {
        addLog('warning', 'Fora do horário comercial, aguardando...');
        while (!isWithinBusinessHours() && !abortControllerRef.current?.signal.aborted) {
          await sleep(60000); // Check every minute
        }
        if (abortControllerRef.current?.signal.aborted) break;
        addLog('info', 'Retomando dentro do horário comercial');
      }

      const contact = contacts[i];
      const instance = getNextInstance(selectedInstances);
      
      if (!instance) {
        addLog('error', 'Nenhuma instância disponível');
        failedCount++;
        
        // Auto-pause on failure
        pausedRef.current = true;
        setProgress(prev => ({ ...prev, isPaused: true, failed: failedCount }));
        addLog('warning', '⚠️ Disparo pausado automaticamente devido a falha');
        toast({
          title: '⚠️ Disparo Pausado',
          description: 'O disparo foi pausado devido a uma falha. Verifique e clique em Retomar.',
          variant: 'destructive',
        });
        continue;
      }

      // Select and process message
      const selectedMessage = selectRandomMessage();
      const processedMessage = processMessage(selectedMessage.content, contact);

      // Format phone number
      let phone = contact.phone.replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length <= 11) {
        phone = '55' + phone;
      }

      setProgress(prev => ({
        ...prev,
        currentContact: contact.name || phone,
      }));

      try {
        // If message is an interactive menu placeholder, send it via whatsapp-instances -> /send/menu
        const interactiveMenu = (!selectedMessage.mediaType || selectedMessage.mediaType === 'none')
          ? tryParseInteractiveMenu(processedMessage)
          : null;

        const { data, error } = interactiveMenu
          ? await supabase.functions.invoke('whatsapp-instances', {
              body: {
                action: 'send_menu',
                phone,
                instanceKey: instance.instance_key,
                menuType: interactiveMenu.menuType,
                text: interactiveMenu.text,
                choices: interactiveMenu.choices,
                footerText: interactiveMenu.footerText,
                listButton: interactiveMenu.listButton,
                selectableCount: interactiveMenu.selectableCount,
                imageButton: interactiveMenu.imageButton,
              }
            })
          : await (async () => {
              // Build request body based on media type
              // deno-lint-ignore no-explicit-any
              const requestBody: Record<string, any> = {
                instanceKey: instance.instance_key,
                phone,
                autoArchive: config.autoArchive, // Use config setting
              };

              if (selectedMessage.mediaType && selectedMessage.mediaType !== 'none' && selectedMessage.mediaUrl) {
                requestBody.mediaType = selectedMessage.mediaType;
                requestBody.mediaUrl = selectedMessage.mediaUrl;
                requestBody.fileName = selectedMessage.fileName;
                requestBody.caption = processedMessage;
              } else {
                requestBody.message = processedMessage;
              }

              return supabase.functions.invoke('send-whatsapp-uazapi', {
                body: requestBody
              });
            })();

        if (error) throw error;

        sentCount++;
        
        // Make attention call if enabled
        if (config.attentionCall && instance.instance_key) {
          // Wait for configured delay
          await sleep(config.attentionCallDelay * 1000);
          
          try {
            await supabase.functions.invoke('whatsapp-instances', {
              body: {
                action: 'make_call',
                phone,
                instanceKey: instance.instance_key
              }
            });
            addLog('info', `📞 Ligação para ${contact.name || phone}`);
          } catch (callErr) {
            console.error('Attention call failed:', callErr);
            addLog('warning', `⚠️ Falha na ligação para ${contact.name || phone}`);
          }
        }
        
        // Check if chat was archived successfully (only available for send-whatsapp-uazapi)
        if (!interactiveMenu && config.autoArchive && data?.archived) {
          archivedCount++;
          addLog('success', `✓ ${contact.name || phone} (arquivado)`);
        } else {
          addLog('success', `✓ ${contact.name || phone}`);
        }

        // Move contact to sent_contacts if it came from saved contacts
        if (contact.originalId) {
          try {
            // Insert into sent_contacts
            await (supabase as any).from('sent_contacts').insert({
              user_id: user.id,
              name: contact.name || '',
              phone: phone,
              email: contact.email || null,
              original_contact_id: contact.originalId,
              dispatch_history_id: historyRecordId || null,
              sent_at: new Date().toISOString(),
            });

            // Delete from contacts
            await (supabase as any)
              .from('contacts')
              .delete()
              .eq('id', contact.originalId)
              .eq('user_id', user.id);
          } catch (moveErr) {
            console.error('Error moving contact to sent:', moveErr);
          }
        }

        // Log to notification history
        await supabase.from('notification_history').insert({
          user_id: user.id,
          notification_type: 'bulk_whatsapp',
          status: 'sent',
          subject: `Disparo em massa`
        });

      } catch (err: any) {
        failedCount++;
        addLog('error', `✗ ${contact.name || phone}: ${err.message}`);
        
        // AUTO-PAUSE ON FAILURE: Pause immediately when a message fails
        pausedRef.current = true;
        setProgress(prev => ({ 
          ...prev, 
          isPaused: true,
          sent: sentCount,
          failed: failedCount,
          pending: contacts.length - sentCount - failedCount,
          archived: archivedCount,
        }));
        addLog('warning', '⚠️ Disparo pausado automaticamente devido a falha no envio');
        toast({
          title: '⚠️ Disparo Pausado',
          description: `Falha ao enviar para ${contact.name || phone}. Verifique a instância e clique em Retomar.`,
          variant: 'destructive',
        });
        
        // Persist state immediately after failure
        persistCurrentState(
          contacts,
          config,
          i + 1, // Next contact to try
          sentCount,
          failedCount,
          archivedCount,
          historyRecordId || undefined,
          progress.logs
        );
        
        // Wait for resume
        while (pausedRef.current) {
          await sleep(1000);
          if (abortControllerRef.current?.signal.aborted) break;
        }
        
        if (abortControllerRef.current?.signal.aborted) break;
        continue;
      }

      setProgress(prev => ({
        ...prev,
        sent: sentCount,
        failed: failedCount,
        pending: contacts.length - sentCount - failedCount,
        archived: archivedCount,
        estimatedTimeRemaining: (contacts.length - i - 1) * ((config.minDelay + config.maxDelay) / 2)
      }));

      messagesSinceLastPause++;

      // Check if we need to pause
      if (config.pauseAfterMessages > 0 && messagesSinceLastPause >= config.pauseAfterMessages) {
        addLog('info', `Pausando por ${config.pauseDurationMinutes} minutos após ${config.pauseAfterMessages} mensagens`);
        await sleep(config.pauseDurationMinutes * 60 * 1000);
        messagesSinceLastPause = 0;
        addLog('info', 'Retomando envio');
      }

      // Check if we should stop completely
      if (config.stopAfterMessages > 0 && sentCount + failedCount >= config.stopAfterMessages) {
        addLog('warning', `Parada automática após ${config.stopAfterMessages} disparos`);
        pausedRef.current = true;
        setProgress(prev => ({ ...prev, isPaused: true }));
      }

      // Random delay before next message
      if (i < contacts.length - 1) {
        const delay = getRandomDelay();
        await sleep(delay);
      }
    }

    // Clear persisted state on completion
    clearPersistedState();

    // Update history record
    if (historyRecordId) {
      await supabase
        .from('bulk_dispatch_history')
        .update({
          success_count: sentCount,
          failed_count: failedCount,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', historyRecordId);
    }

    setProgress(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
    }));

    addLog('info', `Disparo finalizado: ${sentCount} enviados, ${failedCount} falharam${config.autoArchive ? `, ${archivedCount} arquivados` : ''}`);
    
    // Play completion sound
    playDispatchComplete();
    
    // Show detailed completion toast
    const archivedInfo = config.autoArchive ? `\n📦 ${archivedCount} arquivados` : '';
    toast({
      title: '🎉 Disparo Concluído!',
      description: `✅ ${sentCount} enviados\n❌ ${failedCount} falharam${archivedInfo}`,
    });
  }, [user, contacts, config, progress, toast, addLog, getNextInstance, selectRandomMessage, isWithinBusinessHours, getRandomDelay, persistCurrentState, clearPersistedState]);

  const pauseDispatch = useCallback(() => {
    pausedRef.current = true;
    setProgress(prev => ({ ...prev, isPaused: true }));
    addLog('info', 'Disparo pausado');
    
    // Persist state when manually paused
    persistCurrentState(
      contacts,
      config,
      currentIndexRef.current,
      progress.sent,
      progress.failed,
      progress.archived,
      historyRecordIdRef.current || undefined,
      progress.logs
    );
  }, [addLog, contacts, config, progress, persistCurrentState]);

  const resumeDispatch = useCallback(async (instancesData?: any[]) => {
    pausedRef.current = false;
    setProgress(prev => ({ ...prev, isPaused: false }));
    addLog('info', 'Disparo retomado');
    
    // If resuming from persisted state with instances data, restart the dispatch loop
    if (hasPendingResume && instancesData) {
      setHasPendingResume(false);
      await startDispatch(instancesData, currentIndexRef.current);
    }
  }, [addLog, hasPendingResume, startDispatch]);

  const cancelDispatch = useCallback(() => {
    abortControllerRef.current?.abort();
    setProgress(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
    }));
    addLog('warning', 'Disparo cancelado');
    
    // Clear persisted state on cancel
    clearPersistedState();
  }, [addLog, clearPersistedState]);

  const updateConfig = useCallback((updates: Partial<DispatchConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const loadConfig = useCallback((newConfig: DispatchConfig) => {
    setConfig(newConfig);
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setContacts([]);
    setProgress({
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      archived: 0,
      isPaused: false,
      isRunning: false,
      logs: [],
    });
    clearPersistedState();
  }, [clearPersistedState]);

  return {
    config,
    contacts,
    progress,
    hasPendingResume,
    setContacts,
    updateConfig,
    loadConfig,
    resetConfig,
    startDispatch,
    pauseDispatch,
    resumeDispatch,
    cancelDispatch,
  };
}
