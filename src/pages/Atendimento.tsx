import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowLeft, RefreshCw, Circle, Lock, AlertTriangle, Zap, Settings, Trash2, Keyboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInboxConversations, Conversation } from "@/hooks/useInboxConversations";
import { useInboxMessages, ChatMessage } from "@/hooks/useInboxMessages";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useAutomationTriggers } from "@/hooks/useAutomationTriggers";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { InboxSidebar } from "@/components/Inbox/InboxSidebar";
import { ConversationList } from "@/components/Inbox/ConversationList";
import { ChatPanel } from "@/components/Inbox/ChatPanel";
import { InboxDashboard } from "@/components/Inbox/InboxDashboard";
import { KanbanView } from "@/components/Inbox/KanbanView";
import { SubscriptionPlansDialog } from "@/components/SubscriptionPlansDialog";
import { ClientForm } from "@/components/ClientForm";
import { Client } from "@/types/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
// motion import removed for performance
import { useAccountContext } from "@/hooks/useAccountContext";
import { useCustomerChatLinks } from "@/hooks/useCustomerChatLinks";
import { useCustomerConversations } from "@/hooks/useCustomerConversations";
import { useCustomerMessages, CustomerMessage } from "@/hooks/useCustomerMessages";
import { CreateCustomerChatLinkDialog, QuickCopyLinkButton } from "@/components/CustomerChat/CreateCustomerChatLinkDialog";
import { CustomerChatList } from "@/components/CustomerChat/CustomerChatList";
import { CustomerChatPanel } from "@/components/CustomerChat/CustomerChatPanel";
import { useAIAgents } from "@/hooks/useAIAgents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KeyboardShortcutsPanel } from "@/components/Inbox/KeyboardShortcutsPanel";
import { DateRange } from "react-day-picker";

export default function Atendimento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions: accountPerms, isMember, ownerId } = useAccountContext();
  const { showNotification, playSound } = useSystemNotifications();
  
  const [activeTab, setActiveTab] = useState<'conversations' | 'customer-chat' | 'dashboard' | 'kanban'>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedCustomerConversationId, setSelectedCustomerConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState<{ phone: string; name?: string } | null>(null);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [showCreateCustomerLink, setShowCreateCustomerLink] = useState(false);

  const { links, createLink, setLinkActive, deleteLink, getInviteUrl, isMutating: isCustomerLinksMutating } =
    useCustomerChatLinks(!isMember ? ownerId : null);

  // Callback for new customer chat messages (from conversations hook)
  const handleNewCustomerChatMessage = useCallback((
    conversationId: string, 
    customerName: string, 
    content: string | null,
    mediaType: string | null,
    fileName: string | null
  ) => {
    console.log('[Atendimento] New customer chat message from:', customerName);
    playSound('message');
    
    const bodyText = content 
      ? (content.substring(0, 100) + (content.length > 100 ? '...' : ''))
      : (mediaType ? `📎 ${fileName || 'Mídia'}` : 'Nova mensagem');
    
    showNotification({
      title: `💬 ${customerName}`,
      body: bodyText,
      soundType: 'message',
      silent: true,
    });
  }, [playSound, showNotification]);

  const customerConversationCallbacks = useMemo(() => ({
    onNewMessage: handleNewCustomerChatMessage,
  }), [handleNewCustomerChatMessage]);

  const {
    conversations: customerConversations,
    unreadTotal: customerUnreadTotal,
    isLoading: isCustomerConversationsLoading,
    deleteConversation: deleteCustomerConversation,
    toggleAI: toggleCustomerAI,
    setActiveAgent: setCustomerActiveAgent,
    lastUpdatedConversationId: highlightedCustomerConversationId,
  } = useCustomerConversations(!isMember ? ownerId : null, customerConversationCallbacks);

  const { agents: aiAgents } = useAIAgents();
  const [isDeletingCustomerConv, setIsDeletingCustomerConv] = useState(false);

  // Callback for new message notifications (from messages hook - when chat is open)
  const handleNewCustomerMessage = useCallback((message: CustomerMessage) => {
    // Only play sound if the message is from customer and not the currently selected conversation
    // (the conversation hook already handles notifications for new messages in closed conversations)
    if (message.sender_type === 'customer') {
      playSound('message');
    }
  }, [playSound]);

  const notificationCallbacks = useMemo(() => ({
    onNewMessage: handleNewCustomerMessage,
  }), [handleNewCustomerMessage]);

  const selectedCustomerConversation = customerConversations.find((c) => c.id === selectedCustomerConversationId) ?? null;
  const {
    messages: customerMessages,
    isLoading: customerMessagesLoading,
    isSending: isCustomerSending,
    sendMessage: sendCustomerMessage,
  } = useCustomerMessages(
    selectedCustomerConversationId, 
    "owner",
    selectedCustomerConversation
      ? { owner_id: selectedCustomerConversation.owner_id, customer_user_id: selectedCustomerConversation.customer_user_id }
      : null,
    notificationCallbacks
  );

  const { instances } = useWhatsAppInstances();
  const { isActive, isOnTrial, getRemainingDays, isLoading: isSubscriptionLoading } = useSubscription();
  const { isAdmin, isLoading: isPermissionsLoading } = useUserPermissions();
  // Admins bypass subscription check; evita “flash” aguardando permissão/assinatura resolverem.
  const subscriptionExpired = !isPermissionsLoading && !isSubscriptionLoading && !isAdmin && !isActive();
  const { agents, myStatus, updateStatus } = useAgentStatus();
  
  const {
    conversations,
    labels,
    isLoading,
    filter,
    setFilter,
    metrics,
    refetch,
    assignLabel,
    removeLabel,
    assignToMe,
    resolveConversation,
    reopenConversation,
    toggleAI,
    markAsRead,
    snoozeConversation,
    setPriority,
    deleteConversation,
    saveContactToWhatsApp,
    renameContact
  } = useInboxConversations();

  const {
    messages,
    isLoading: messagesLoading,
    isSending,
    isSyncing,
    isDeleting,
    sendMessage,
    retryMessage,
    deleteMessage,
    syncMessages
  } = useInboxMessages(selectedConversation?.id || null);

  // Push notifications and sound effects
  const { permission, requestPermission, showLocalNotification, isSupported } = usePushNotifications();
  const { playNewMessage, playMessageSent } = useSoundEffects();
  const lastNotifiedMessageRef = useRef<string | null>(null);
  const promptedAiConversationsRef = useRef<Set<string>>(new Set());

  const maybePromptAIForConversation = useCallback((conv: Conversation) => {
    const meta = (conv.metadata as Record<string, unknown> | null) || {};
    const isPending = meta.ai_prompt_pending === true;
    if (!isPending) return;
    if (promptedAiConversationsRef.current.has(conv.id)) return;
    promptedAiConversationsRef.current.add(conv.id);

    const contactName = conv.contact_name || 'Cliente';

    const upsertDecision = async (enable: boolean) => {
      const nextMeta: Record<string, unknown> = {
        ...meta,
        ai_prompt_pending: false,
        ai_prompt_decided_at: new Date().toISOString(),
        ai_prompt_decision: enable ? 'enabled' : 'disabled',
      };

      const updateData: Record<string, unknown> = {
        metadata: nextMeta,
        ai_enabled: enable,
        // Keep as "desativada" (not paused) if user chooses no.
        ai_paused_at: enable ? null : null,
      };

      if (enable) {
        updateData.assigned_to = null;

        // If the conversation doesn't have an active agent yet, apply the user's default agent.
        if (!conv.active_agent_id) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData.user?.id;
            if (userId) {
              const { data: prefs } = await supabase
                .from('ai_agent_preferences')
                .select('default_agent_id')
                .eq('user_id', userId)
                .maybeSingle();

              if (prefs?.default_agent_id) {
                updateData.active_agent_id = prefs.default_agent_id;
              }
            }
          } catch (e) {
            console.warn('[Atendimento] Failed to load ai_agent_preferences (ignored):', e);
          }
        }
      }

      await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conv.id);
    };

    let toastHandle: { dismiss: () => void } | null = null;

    toastHandle = toast({
      title: 'Nova conversa — ativar IA?',
      description: (
        <div className="mt-2 space-y-2">
          <div className="text-sm text-muted-foreground">
            Mensagem recebida de <span className="font-medium text-foreground">{contactName}</span>.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={async () => {
                toastHandle?.dismiss();
                await upsertDecision(true);
              }}
            >
              Ativar IA
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                toastHandle?.dismiss();
                await upsertDecision(false);
              }}
            >
              Manter desligada
            </Button>
          </div>
        </div>
      ),
    });
  }, [toast]);

  // Request notification permission on mount
  useEffect(() => {
    if (isSupported && permission === 'default') {
      // Auto-request after user interaction
      const handleClick = () => {
        requestPermission();
        document.removeEventListener('click', handleClick);
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [isSupported, permission, requestPermission]);

  // Keep a stable ref to conversations to avoid re-subscribing channels
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // Listen for new incoming messages and show notifications
  useEffect(() => {
    const channel = supabase
      .channel('inbox-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_inbox_messages' },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          // Only notify for incoming messages from contacts
          if (newMessage.sender_type === 'contact' && newMessage.id !== lastNotifiedMessageRef.current) {
            lastNotifiedMessageRef.current = newMessage.id;
            
            // Find conversation to get contact name
            const conv = conversationsRef.current.find(c => c.id === newMessage.conversation_id);
            const contactName = conv?.contact_name || 'Cliente';
            
            // Play new message notification sound
            playNewMessage();
            
            // Show desktop notification if page is not focused
            if (document.hidden && permission === 'granted') {
              showLocalNotification(`💬 Nova mensagem de ${contactName}`, {
                body: newMessage.content?.slice(0, 100) || 'Mensagem de mídia',
                tag: `inbox-${newMessage.conversation_id}`,
                requireInteraction: false,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permission, showLocalNotification, playNewMessage]);

  // Fetch default agent from routing when instance filter changes
  useEffect(() => {
    const fetchDefaultAgent = async () => {
      if (!filter.instanceId) {
        setDefaultAgentId(null);
        return;
      }
      
      const { data } = await supabase
        .from('whatsapp_agent_routing')
        .select('agent_id')
        .eq('instance_id', filter.instanceId)
        .eq('is_active', true)
        .maybeSingle();
      
      setDefaultAgentId(data?.agent_id || null);
    };
    
    fetchDefaultAgent();
  }, [filter.instanceId]);

  // Automation triggers callbacks
  const automationCallbacks = {
    onSendMessage: useCallback(async (conversationId: string, content: string, isPrivate?: boolean) => {
      // Implementation for sending message to specific conversation
      const { error } = await supabase
        .from('chat_inbox_messages')
        .insert({
          conversation_id: conversationId,
          content,
          sender_type: isPrivate ? 'agent' : 'agent',
          is_private: isPrivate || false,
        });
      return !error;
    }, []),
    onAssignLabel: useCallback(async (conversationId: string, labelId: string) => {
      await supabase
        .from('conversation_labels')
        .insert({ conversation_id: conversationId, label_id: labelId });
    }, []),
    onResolve: useCallback(async (conversationId: string) => {
      await supabase
        .from('conversations')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', conversationId);
    }, []),
    onToggleAI: useCallback(async (conversationId: string, enabled: boolean) => {
      // When enabling AI, clear the pause timestamp and assigned_to
      // When disabling, set the pause timestamp
      const updateData: Record<string, unknown> = { ai_enabled: enabled };
      
      if (enabled) {
        updateData.ai_paused_at = null; // Clear pause timestamp when manually enabling
        updateData.assigned_to = null; // Allow AI to respond
      } else {
        updateData.ai_paused_at = new Date().toISOString(); // Track when AI was paused
      }
      
      await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId);
    }, []),
    onSnooze: useCallback(async (conversationId: string, until: Date) => {
      await supabase
        .from('conversations')
        .update({ status: 'snoozed', snoozed_until: until.toISOString() })
        .eq('id', conversationId);
    }, []),
    onSetPriority: useCallback(async (conversationId: string, priority: string) => {
      await supabase
        .from('conversations')
        .update({ priority })
        .eq('id', conversationId);
    }, []),
  };

  const { triggerMessageCreated, triggerConversationCreated } = useAutomationTriggers(automationCallbacks);

  // Real-time message listener for automation triggers (use ref to avoid re-subscribing)
  const lastProcessedRef = useRef(lastProcessedMessageId);
  useEffect(() => { lastProcessedRef.current = lastProcessedMessageId; }, [lastProcessedMessageId]);

  useEffect(() => {
    const channel = supabase
      .channel('automation-triggers')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_inbox_messages' },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          // Only trigger for incoming messages from contacts
          if (newMessage.sender_type === 'contact' && newMessage.id !== lastProcessedRef.current) {
            setLastProcessedMessageId(newMessage.id);
            
            // Find the conversation for this message
            const conversation = conversationsRef.current.find(c => c.id === newMessage.conversation_id);
            if (conversation) {
              console.log('[Automation] New message received, checking triggers...');
              triggerMessageCreated(conversation, newMessage);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const newConversation = payload.new as Conversation;
          console.log('[Automation] New conversation created, checking triggers...');
          triggerConversationCreated(newConversation);
          // Ask whether to enable AI on new conversations (only when flagged by backend).
          maybePromptAIForConversation(newConversation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerMessageCreated, triggerConversationCreated, maybePromptAIForConversation]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter(prev => ({ ...prev, search: searchQuery || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, setFilter]);

  // Update selected conversation when list changes
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations, selectedConversation?.id]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleSendMessage = async (content: string, isPrivate?: boolean, mediaUrl?: string, mediaType?: string, fileName?: string) => {
    return sendMessage(content, isPrivate || false, mediaUrl, mediaType, fileName);
  };

  const handleAssignToMe = () => {
    if (selectedConversation) {
      assignToMe(selectedConversation.id);
    }
  };

  const handleResolve = () => {
    if (selectedConversation) {
      resolveConversation(selectedConversation.id);
    }
  };

  const handleReopen = () => {
    if (selectedConversation) {
      reopenConversation(selectedConversation.id);
    }
  };

  const handleToggleAI = (enabled: boolean) => {
    if (selectedConversation) {
      toggleAI(selectedConversation.id, enabled);
    }
  };

  const handleAssignLabel = (labelId: string) => {
    if (selectedConversation) {
      assignLabel(selectedConversation.id, labelId);
    }
  };

  const handleRemoveLabel = (labelId: string) => {
    if (selectedConversation) {
      removeLabel(selectedConversation.id, labelId);
    }
  };

  const handleMarkAsRead = () => {
    if (selectedConversation) {
      markAsRead(selectedConversation.id);
    }
  };

  const handleDeleteConversation = async (conversationId: string, deleteFromWhatsApp: boolean) => {
    const success = await deleteConversation(conversationId, deleteFromWhatsApp);
    if (success) {
      setSelectedConversation(null);
    }
    return success;
  };

  const handleRegisterClient = (phone: string, name?: string) => {
    setNewClientData({ phone, name });
    setShowClientForm(true);
  };

  const handleClientFormSubmit = async (clientData: Omit<Client, 'id' | 'renewalHistory'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          name: clientData.name,
          whatsapp: clientData.whatsapp,
          email: clientData.email,
          service: clientData.service,
          plan: clientData.plan,
          price: clientData.price,
          notes: clientData.notes,
          expires_at: clientData.expiresAt.toISOString(),
          service_username: clientData.serviceUsername,
          service_password: clientData.servicePassword,
          app_name: clientData.appName,
          device: clientData.device
        });

      if (error) throw error;

      toast({
        title: 'Cliente cadastrado',
        description: 'O cliente foi cadastrado com sucesso!',
      });

      setShowClientForm(false);
      setNewClientData(null);
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: 'Erro ao cadastrar cliente',
        description: 'Tente novamente',
        variant: 'destructive'
      });
    }
  };

  const statusColors = {
    online: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-gray-400'
  };

  const statusLabels = {
    online: 'Online',
    busy: 'Ocupado',
    offline: 'Offline'
  };

  return (
    <div className="theme-atendimento h-screen flex flex-col bg-inbox inbox-surface overflow-hidden">
      {/* Subscription Expired Banner */}
      {subscriptionExpired && (
        <div
          className="animate-fade-in bg-destructive/10 border-b border-destructive/20 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-destructive text-sm sm:text-base">Assinatura Expirada</p>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Renove sua assinatura para acessar a Central de Atendimento
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setShowPlans(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shrink-0"
            size="sm"
          >
            <Zap className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Renovar Agora</span>
            <span className="sm:hidden">Renovar</span>
          </Button>
        </div>
      )}

      {/* Top Header */}
      <header className="h-12 sm:h-14 border-b border-border/50 bg-inbox-header flex items-center justify-between px-2 sm:px-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => {
            try { localStorage.setItem('app-active-section', JSON.stringify('clients')); } catch {}
            navigate('/?section=clients', { replace: true });
          }}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <h1 className="text-sm sm:text-lg font-semibold truncate">Central de Atendimento</h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Status Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" disabled={subscriptionExpired}>
                <Circle className={cn(
                  "h-2 w-2 fill-current",
                  statusColors[myStatus?.status || 'offline']
                )} />
                <span className="hidden sm:inline">{statusLabels[myStatus?.status || 'offline']}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateStatus('online')}>
                <Circle className="h-2 w-2 mr-2 fill-green-500 text-green-500" />
                Online
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('busy')}>
                <Circle className="h-2 w-2 mr-2 fill-yellow-500 text-yellow-500" />
                Ocupado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('offline')}>
                <Circle className="h-2 w-2 mr-2 fill-gray-400 text-gray-400" />
                Offline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {accountPerms.canManageLabelsMacros && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => navigate('/inbox-settings')} 
              disabled={subscriptionExpired}
              title="Configurações do Inbox"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setShowKeyboardShortcuts(true)}
            title="Atalhos de Teclado"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={subscriptionExpired}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {/* Subscription Expired Overlay */}
        {subscriptionExpired && (
          <div
              className="animate-fade-in absolute inset-0 bg-inbox/80 z-50 flex items-center justify-center"
          >
            <div className="text-center p-8 max-w-md">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">
                Central de Atendimento Bloqueada
              </h3>
              <p className="text-muted-foreground mb-6">
                Sua assinatura expirou. Renove para continuar atendendo seus clientes via WhatsApp.
              </p>
              <Button 
                size="lg"
                onClick={() => setShowPlans(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <Zap className="h-5 w-5 mr-2" />
                Ver Planos de Assinatura
              </Button>
            </div>
          </div>
        )}

        {/* Horizontal Navigation Bar (Top) */}
        <InboxSidebar
          instances={instances}
          labels={labels}
          filter={filter}
          onFilterChange={setFilter}
          metrics={metrics}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showCustomerChatTab={!isMember}
          customerUnread={customerUnreadTotal}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {activeTab === 'dashboard' ? (
            <InboxDashboard
              conversations={conversations}
              agents={agents}
              metrics={metrics}
            />
          ) : activeTab === 'kanban' ? (
            <KanbanView
              conversations={conversations}
              onSelect={handleSelectConversation}
              selectedId={selectedConversation?.id || null}
            />
          ) : activeTab === 'customer-chat' ? (
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Links sidebar - hidden on mobile */}
              <div className="hidden lg:flex w-80 border-r border-border/50 flex-col bg-inbox-sidebar shrink-0">
                <div className="p-3 border-b border-border/50 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Links</div>
                  <Button size="sm" onClick={() => setShowCreateCustomerLink(true)}>
                    Criar link
                  </Button>
                </div>
                <div className="p-2 space-y-2 overflow-auto">
                  {links.slice(0, 6).map((l) => (
                    <div key={l.id} className="rounded-xl border border-border/30 bg-card/25 p-3">
                      <div className="text-xs text-muted-foreground truncate">{getInviteUrl(l.token)}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs">
                          {l.is_active ? "Ativo" : "Inativo"}
                          {l.customer_name ? ` • ${l.customer_name}` : ""}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <QuickCopyLinkButton url={getInviteUrl(l.token)} />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isCustomerLinksMutating}
                            onClick={() => setLinkActive(l.id, !l.is_active)}
                          >
                            {l.is_active ? "Desativar" : "Ativar"}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={isCustomerLinksMutating}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir link?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso remove o link permanentemente. Se alguém já tiver usado esse link, a conversa já
                                  criada continuará existindo.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteLink(l.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Chat List - full width mobile, w-80 desktop; hidden when chat selected on mobile */}
              <div className={cn(
                "md:block",
                selectedCustomerConversationId ? "hidden" : "flex-1 md:flex-none"
              )}>
                {/* Mobile create link button */}
                <div className="lg:hidden p-2 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{customerConversations.length} conversas</span>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateCustomerLink(true)}>
                    Criar link
                  </Button>
                </div>
                <CustomerChatList
                  conversations={customerConversations}
                  selectedId={selectedCustomerConversationId}
                  onSelect={(c) => setSelectedCustomerConversationId(c.id)}
                  onDelete={async (id) => {
                    setIsDeletingCustomerConv(true);
                    const success = await deleteCustomerConversation(id);
                    if (success && selectedCustomerConversationId === id) {
                      setSelectedCustomerConversationId(null);
                    }
                    setIsDeletingCustomerConv(false);
                    if (success) {
                      toast({ title: "Conversa excluída" });
                    } else {
                      toast({ title: "Erro ao excluir conversa", variant: "destructive" });
                    }
                    return success;
                  }}
                  isLoading={isCustomerConversationsLoading}
                  isDeleting={isDeletingCustomerConv}
                  highlightedConversationId={highlightedCustomerConversationId}
                />
              </div>

              {/* Customer Chat Panel - hidden on mobile when no chat selected */}
              <div className={cn(
                "flex-1 min-w-0",
                selectedCustomerConversationId ? "flex flex-col" : "hidden md:flex md:flex-col"
              )}>
                {/* Mobile back button */}
                {selectedCustomerConversationId && (
                  <div className="md:hidden p-2 border-b border-border/50 flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerConversationId(null)}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Voltar
                    </Button>
                    <span className="text-sm font-medium truncate">
                      {selectedCustomerConversation?.customer_name ?? "Cliente"}
                    </span>
                  </div>
                )}
                <CustomerChatPanel
                  title={selectedCustomerConversation ? selectedCustomerConversation.customer_name ?? "Cliente" : "Selecione um chat"}
                  messages={customerMessages}
                  isLoading={customerMessagesLoading}
                  isSending={isCustomerSending}
                  onSend={sendCustomerMessage}
                  viewer="owner"
                  conversation={selectedCustomerConversation}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Conversation List - full width on mobile, hidden when conversation is selected on mobile */}
              <div className={cn(
                "md:block",
                selectedConversation ? "hidden" : "flex-1 md:flex-none"
              )}>
                <ConversationList
                  conversations={conversations}
                  selectedId={selectedConversation?.id || null}
                  onSelect={handleSelectConversation}
                  isLoading={isLoading}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  defaultAgentId={defaultAgentId}
                />
              </div>

              {/* Chat Panel - hidden on mobile when no conversation selected */}
              <div className={cn(
                "flex-1 min-w-0",
                selectedConversation ? "flex flex-col" : "hidden md:flex md:flex-col"
              )}>
                {/* Mobile back button */}
                {selectedConversation && (
                  <div className="md:hidden p-2 border-b border-border/50 flex items-center gap-2 bg-inbox-header">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Voltar
                    </Button>
                    <span className="text-sm font-medium truncate">
                      {selectedConversation.contact_name || selectedConversation.phone}
                    </span>
                  </div>
                )}
                <ChatPanel
                  conversation={selectedConversation}
                  messages={messages}
                  labels={labels}
                  isLoading={messagesLoading}
                  isSending={isSending}
                  isSyncing={isSyncing}
                  isDeleting={isDeleting}
                  onSendMessage={handleSendMessage}
                  onAssignToMe={handleAssignToMe}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  onToggleAI={handleToggleAI}
                  onAssignLabel={handleAssignLabel}
                  onRemoveLabel={handleRemoveLabel}
                  onMarkAsRead={handleMarkAsRead}
                  onRegisterClient={handleRegisterClient}
                  onRetryMessage={retryMessage}
                  onSyncMessages={(limit) => syncMessages({ limit, silent: false })}
                  onDeleteConversation={handleDeleteConversation}
                  onDeleteMessage={deleteMessage}
                  onSaveContact={saveContactToWhatsApp}
                  onRenameContact={renameContact}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <CreateCustomerChatLinkDialog
        open={showCreateCustomerLink}
        onOpenChange={setShowCreateCustomerLink}
        onCreate={createLink}
        getInviteUrl={getInviteUrl}
      />

      {/* Subscription Plans Dialog */}
      <SubscriptionPlansDialog open={showPlans} onOpenChange={setShowPlans} />

      {/* Client Form Dialog */}
      <ClientForm
        open={showClientForm}
        onOpenChange={(open) => {
          setShowClientForm(open);
          if (!open) setNewClientData(null);
        }}
        onSubmit={handleClientFormSubmit}
        initialData={newClientData ? {
          id: '',
          name: newClientData.name || '',
          whatsapp: newClientData.phone || '',
          email: '',
          service: 'IPTV' as const,
          plan: 'monthly' as const,
          price: null,
          notes: null,
          createdAt: new Date(),
          expiresAt: new Date(),
          renewalHistory: [],
          serviceUsername: null,
          servicePassword: null,
          appName: null,
          device: null
        } : null}
      />

      {/* Keyboard Shortcuts Panel */}
      <KeyboardShortcutsPanel open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts} />
    </div>
  );
}

// Force module refresh
