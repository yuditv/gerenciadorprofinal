import { useState, useRef, useEffect, useCallback } from "react";
// framer-motion import removed for performance
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, MoreVertical, Bot, User, Check, Clock, Tag, UserPlus, Archive, RotateCcw, Lock, PanelRightOpen, PanelRightClose, PanelLeftOpen, PanelLeftClose, Play, RefreshCw, Camera, Trash2, MessageSquareText, Ban, UserCheck, Search, ChevronDown, Settings, Pencil, BookUser, SquareStack, GalleryHorizontal, Tv, Wifi, QrCode, X, SpellCheck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Conversation, InboxLabel } from "@/hooks/useInboxConversations";
import { ChatMessage } from "@/hooks/useInboxMessages";
import { useAuth } from "@/hooks/useAuth";
import { useClientByPhone } from "@/hooks/useClientByPhone";
import { useCannedResponses, CannedResponse } from "@/hooks/useCannedResponses";
import { useContactAvatar } from "@/hooks/useContactAvatar";
import { usePresence } from "@/hooks/usePresence";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClientInfoPanel } from "./ClientInfoPanel";
import { MessageStatus } from "./MessageStatus";
import { TypingIndicator } from "./TypingIndicator";
import { FileUploadButton } from "./FileUploadButton";
import { AttachmentPreview } from "./AttachmentPreview";
import { QuickReplyAutocomplete } from "./QuickReplyAutocomplete";
import { AudioRecorder } from "./AudioRecorder";
import { MediaGallery } from "./MediaGallery";
// QuickMessagesPanel removed - management moved to Inbox Settings
import { EmojiPickerButton } from "./EmojiPickerButton";
import { AudioPlayer } from "./AudioPlayer";
import { AttachmentRenderer } from "./AttachmentRenderer";
import { MessageSearchDialog } from "./MessageSearchDialog";
import { SyncOptionsDialog } from "./SyncOptionsDialog";
import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { TestGeneratorDialog } from "./TestGeneratorDialog";
import { IPTVTestChoiceDialog } from "./IPTVTestChoiceDialog";
import { GextvTestGeneratorDialog } from "./GextvTestGeneratorDialog";
import { VPNTestGeneratorDialog } from "./VPNTestGeneratorDialog";
import { GeneratePIXDialog } from "./GeneratePIXDialog";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { useAutoCorrect } from "@/hooks/useAutoCorrect";
import { useAIAgents } from "@/hooks/useAIAgents";
interface ChatPanelProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  labels: InboxLabel[];
  isLoading: boolean;
  isSending: boolean;
  isSyncing?: boolean;
  isDeleting?: boolean;
  onSendMessage: (content: string, isPrivate?: boolean, mediaUrl?: string, mediaType?: string, fileName?: string) => Promise<boolean>;
  onAssignToMe: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onToggleAI: (enabled: boolean, agentId?: string | null) => void;
  onAssignLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onMarkAsRead: () => void;
  onRegisterClient?: (phone: string, name?: string) => void;
  onRetryMessage?: (messageId: string) => Promise<boolean>;
  onSyncMessages?: (limit?: number) => void;
  onDeleteConversation?: (conversationId: string, deleteFromWhatsApp: boolean) => Promise<boolean>;
  onDeleteMessage?: (messageId: string, deleteForEveryone: boolean) => Promise<boolean>;
  onSaveContact?: (conversationId: string, name?: string) => Promise<boolean>;
  onRenameContact?: (conversationId: string, name: string) => Promise<boolean>;
}
interface AttachmentState {
  url: string;
  type: string;
  fileName: string;
}
type AttachmentList = AttachmentState[];
export function ChatPanel({
  conversation,
  messages,
  labels,
  isLoading,
  isSending,
  isSyncing,
  isDeleting,
  onSendMessage,
  onAssignToMe,
  onResolve,
  onReopen,
  onToggleAI,
  onAssignLabel,
  onRemoveLabel,
  onMarkAsRead,
  onRegisterClient,
  onRetryMessage,
  onSyncMessages,
  onDeleteConversation,
  onDeleteMessage,
  onSaveContact,
  onRenameContact
}: ChatPanelProps) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [message, setMessage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentList>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryInitialId, setGalleryInitialId] = useState<string | undefined>();
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [contactAvatarUrl, setContactAvatarUrl] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteFromWhatsApp, setDeleteFromWhatsApp] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  // showQuickPanel removed - management moved to Inbox Settings

  // Client panel is always visible - no toggle needed
  const [isBlocking, setIsBlocking] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showSaveContactDialog, setShowSaveContactDialog] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [showIPTVChoice, setShowIPTVChoice] = useState(false);
  const [showIPTVSportplay, setShowIPTVSportplay] = useState(false);
  const [showIPTVGextv, setShowIPTVGextv] = useState(false);
  const [showVPNTestGenerator, setShowVPNTestGenerator] = useState(false);
  const [showPIXDialog, setShowPIXDialog] = useState(false);
  const [showScheduleMessage, setShowScheduleMessage] = useState(false);
  const [isStartingNumericMenu, setIsStartingNumericMenu] = useState(false);
  const [showClientSheet, setShowClientSheet] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-correct hook
  const { isEnabled: autoCorrectEnabled, toggleEnabled: toggleAutoCorrect, processText: autoCorrectText } = useAutoCorrect();

  // AI agents for selector
  const { agents: allAIAgents } = useAIAgents();
  const whatsAppActiveAgents = allAIAgents.filter(a => a.is_active && a.is_whatsapp_enabled);

  // Fetch client by phone
  const {
    client,
    isLoading: isLoadingClient
  } = useClientByPhone(conversation?.phone || null);

  // Canned responses for quick replies (autocomplete)
  const {
    responses,
    searchResponses,
    findByShortCode
  } = useCannedResponses();

  // Contact avatar fetcher
  const {
    fetchAvatar,
    isLoading: isFetchingAvatar
  } = useContactAvatar();

  // Presence hook for typing/recording indicators
  const {
    sendPresence
  } = usePresence(conversation?.id || null);
  
  // Debounce timer for stopping composing presence
  const composingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Send composing presence with auto-stop after 3 seconds of inactivity
  const handleComposingPresence = useCallback(() => {
    // Clear existing timeout
    if (composingTimeoutRef.current) {
      clearTimeout(composingTimeoutRef.current);
    }
    
    // Send composing
    sendPresence('composing');
    
    // Auto-stop after 3 seconds
    composingTimeoutRef.current = setTimeout(() => {
      sendPresence('paused');
    }, 3000);
  }, [sendPresence]);
  
  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      if (composingTimeoutRef.current) {
        clearTimeout(composingTimeoutRef.current);
      }
    };
  }, [conversation?.id]);

  // Get WhatsApp instances to find instance_key
  const {
    instances
  } = useWhatsAppInstances();
  const currentInstance = instances.find(i => i.id === conversation?.instance_id);
  const instanceKey = currentInstance?.instance_key || "";

  // Check if contact is blocked from conversation metadata
  const isContactBlocked = (conversation?.metadata as Record<string, unknown> | null)?.is_blocked === true;

  const parseNumericMenuConfig = (consultationContext: string | null) => {
    if (!consultationContext) return null;
    try {
      const json = JSON.parse(consultationContext);
      const cfg = json?.numeric_menu;
      if (!cfg?.enabled) return null;
      const prompt = (cfg.prompt ?? '').toString();
      const options = cfg.options && typeof cfg.options === 'object' ? cfg.options : {};
      return { prompt, options } as { prompt: string; options: Record<string, { reply?: string; title?: string }> };
    } catch {
      return null;
    }
  };

  // Get autocomplete suggestions based on current message
  const getAutocompleteSuggestions = () => {
    if (!message.startsWith('/')) return [];
    const query = message.slice(1); // Remove the leading /
    return searchResponses(query);
  };
  const autocompleteSuggestions = getAutocompleteSuggestions();
  const showAutocomplete = message.startsWith('/') && autocompleteSuggestions.length > 0;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      // Access the actual scrollable viewport inside Radix ScrollArea
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  // Mark as read when conversation is selected
  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      onMarkAsRead();
    }
  }, [conversation?.id]);

  // Reset autocomplete index when suggestions change
  useEffect(() => {
    setAutocompleteIndex(-1);
  }, [autocompleteSuggestions.length]);

  // Simulate typing indicator based on recent messages (last message from contact within 30s)
  useEffect(() => {
    if (!conversation || messages.length === 0) {
      setIsTyping(false);
      return;
    }
    const lastContactMessage = [...messages].reverse().find(m => m.sender_type === 'contact');
    if (!lastContactMessage) {
      setIsTyping(false);
      return;
    }
    const timeSinceLastMessage = Date.now() - new Date(lastContactMessage.created_at).getTime();

    // Show typing for 5 seconds after a message, simulating continued engagement
    if (timeSinceLastMessage < 5000) {
      setIsTyping(true);
      const timeout = setTimeout(() => setIsTyping(false), 5000 - timeSinceLastMessage);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [messages, conversation]);
  const handleSelectAutocomplete = (response: CannedResponse) => {
    // Replace message with canned response content
    let content = response.content;

    // Replace variables
    if (conversation?.contact_name) {
      content = content.replace(/\{\{nome\}\}/gi, conversation.contact_name);
    }
    if (conversation?.phone) {
      content = content.replace(/\{\{telefone\}\}/gi, conversation.phone);
    }

    // If this canned response has media, attach it so it is sent together.
    // (media_type for canned responses is stored as: image|video|audio|document)
    if (response.media_url && response.media_type) {
      setAttachments(prev => {
        // Avoid duplicating the same attachment if user selects the same shortcut again quickly
        if (prev.some(a => a.url === response.media_url)) return prev;
        return [
          ...prev,
          {
            url: response.media_url,
            type: response.media_type,
            fileName: response.media_name || 'Arquivo',
          },
        ];
      });
    }

    setMessage(content);
    setAutocompleteIndex(-1);
    textareaRef.current?.focus();
  };
  const handleSend = async () => {
    // Allow sending multiple messages quickly; each message has its own optimistic state.
    if (!message.trim() && attachments.length === 0) return;

    // Capturar valores antes de limpar
    const messageToSend = message.trim();
    const privateToSend = isPrivate;
    const attachmentsToSend = [...attachments];

    // Limpar imediatamente - UX instantânea
    setMessage("");
    setIsPrivate(false);
    setAttachments([]);
    
    // Cancel composing presence immediately
    if (composingTimeoutRef.current) {
      clearTimeout(composingTimeoutRef.current);
      composingTimeoutRef.current = null;
    }
    // Send paused to stop typing indicator (UAZAPI cancels on message send anyway)
    if (!privateToSend) {
      sendPresence('paused');
    }

    // Se tiver anexos, enviar cada um separadamente
    if (attachmentsToSend.length > 0) {
      for (let i = 0; i < attachmentsToSend.length; i++) {
        const att = attachmentsToSend[i];
        // Primeira mensagem leva o texto, as demais só a mídia
        const textToSend = i === 0 ? messageToSend : "";
        await onSendMessage(textToSend, privateToSend, att.url, att.type, att.fileName);
      }
    } else {
      // Apenas texto
      await onSendMessage(messageToSend, privateToSend);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle autocomplete navigation
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(prev => prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(prev => prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter' && autocompleteIndex >= 0) {
        e.preventDefault();
        if (autocompleteIndex >= 0) {
          handleSelectAutocomplete(autocompleteSuggestions[autocompleteIndex]);
        } else if (autocompleteSuggestions.length > 0) {
          handleSelectAutocomplete(autocompleteSuggestions[0]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setMessage('');
        return;
      }
    }

    // Check for shortcode completion on space
    if (e.key === ' ' && message.startsWith('/')) {
      const shortCode = message.slice(1).trim();
      const response = findByShortCode(shortCode);
      if (response) {
        e.preventDefault();
        handleSelectAutocomplete(response);
        return;
      }
    }

    // Send on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const handleFileUploaded = (url: string, type: string, fileName: string) => {
    setAttachments(prev => [...prev, {
      url,
      type,
      fileName
    }]);
  };
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  const handleAudioReady = (url: string, type: string, fileName: string) => {
    // Send audio immediately
    onSendMessage("", isPrivate, url, type, fileName);
    setIsRecordingAudio(false);
  };
  const openMediaGallery = (messageId: string) => {
    setGalleryInitialId(messageId);
    setShowGallery(true);
  };
  const handleDeleteConversation = async () => {
    if (!conversation || !onDeleteConversation) return;
    setIsDeletingConversation(true);
    const success = await onDeleteConversation(conversation.id, deleteFromWhatsApp);
    setIsDeletingConversation(false);
    if (success) {
      setShowDeleteDialog(false);
      setDeleteFromWhatsApp(false);
    }
  };
  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    if (!onDeleteMessage) return false;
    const success = await onDeleteMessage(messageId, deleteForEveryone);
    if (success) {
      setMessageToDelete(null);
    }
    return success;
  };
  const handleRenameContact = async () => {
    if (!conversation || !onRenameContact || !newContactName.trim()) return;
    const success = await onRenameContact(conversation.id, newContactName.trim());
    if (success) {
      setShowRenameDialog(false);
      setNewContactName("");
    }
  };
  const handleSaveContact = async () => {
    if (!conversation || !onSaveContact) return;
    setIsSavingContact(true);
    const success = await onSaveContact(conversation.id, newContactName.trim() || undefined);
    setIsSavingContact(false);
    if (success) {
      setShowSaveContactDialog(false);
      setNewContactName("");
    }
  };

  // handleQuickSend and handleEditFromQuick removed - panel moved to Inbox Settings

  // Handler for emoji selection - inserts at cursor position
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);

      // Reposition cursor after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setMessage(message + emoji);
    }
  };

  // Handle block button click - show confirmation dialog if blocking
  const handleBlockClick = () => {
    if (isContactBlocked) {
      // Unblocking doesn't need confirmation
      handleToggleBlock();
    } else {
      // Blocking needs confirmation
      setShowBlockDialog(true);
    }
  };

  // Handle actual blocking/unblocking contact via UAZAPI
  const handleToggleBlock = async () => {
    if (!conversation) return;
    const shouldBlock = !isContactBlocked;
    setShowBlockDialog(false);
    setIsBlocking(true);
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      const response = await fetch('https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/whatsapp-instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'block_contact',
          conversationId: conversation.id,
          block: shouldBlock
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar bloqueio');
      }
      toast({
        title: shouldBlock ? 'Contato bloqueado' : 'Contato desbloqueado',
        description: shouldBlock ? 'Este contato não poderá mais enviar mensagens para esta instância' : 'Este contato pode enviar mensagens novamente'
      });
    } catch (error) {
      console.error('Error toggling block:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível alterar o bloqueio',
        variant: 'destructive'
      });
    } finally {
      setIsBlocking(false);
    }
  };
  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };
  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };
  const getSenderInfo = (msg: ChatMessage) => {
    switch (msg.sender_type) {
      case 'contact':
        return {
          name: conversation?.contact_name || 'Cliente',
          icon: User,
          color: 'text-foreground'
        };
      case 'agent':
        return {
          name: msg.metadata?.sent_by as string || 'Atendente',
          icon: User,
          color: 'text-blue-500'
        };
      case 'ai':
        return {
          name: msg.metadata?.agent_name as string || 'Assistente IA',
          icon: Bot,
          color: 'text-primary'
        };
      case 'system':
        return {
          name: 'Sistema',
          icon: Clock,
          color: 'text-muted-foreground'
        };
      default:
        return {
          name: 'Desconhecido',
          icon: User,
          color: 'text-foreground'
        };
    }
  };
  const getMessageStatus = (msg: ChatMessage): 'sending' | 'sent' | 'delivered' | 'read' | 'failed' => {
    // Check metadata status first (optimistic updates)
    const metadataStatus = msg.metadata?.status as string | undefined;
    if (metadataStatus === 'sending') return 'sending';
    if (metadataStatus === 'failed' || msg.metadata?.send_error) return 'failed';

    // Check if read
    if (msg.is_read) return 'read';

    // Check metadata for delivered/sent status
    if (metadataStatus === 'delivered') return 'delivered';
    if (metadataStatus === 'sent') return 'sent';

    // For temp messages (optimistic), use time-based logic
    if (msg.id.startsWith('temp-')) {
      return 'sending';
    }

    // For real messages without explicit status, assume delivered
    return 'delivered';
  };
  if (!conversation) {
    return <div className="flex-1 flex items-center justify-center bg-inbox">
        <div className="text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium">Selecione uma conversa</h3>
          <p className="text-sm">Escolha uma conversa da lista para começar</p>
        </div>
      </div>;
  }
  const assignedLabels = conversation.labels?.map(l => l.label) || [];
  const nonNullAssignedLabels = assignedLabels.filter(Boolean) as InboxLabel[];
  const availableLabels = labels.filter(l => !assignedLabels.some(al => al?.id === l.id));
  return <div className="flex-1 flex h-full inbox-container overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden inbox-chat-area">
        {/* Header */}
        <div className={cn(
        "p-3 inbox-header flex items-center justify-between",
        "border-b border-border/50",
        "bg-card/20 backdrop-blur-md"
      )}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
            <AvatarImage src={contactAvatarUrl || conversation.contact_avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
              {getInitials(conversation.contact_name, conversation.phone)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="font-semibold tracking-tight truncate text-sm sm:text-base">
              {conversation.contact_name || formatPhone(conversation.phone)}
            </h3>
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground overflow-hidden">
              <span className="hidden sm:inline">{formatPhone(conversation.phone)}</span>
              <span className="hidden sm:inline">•</span>
              <Badge variant="outline" className={cn("text-[10px] sm:text-xs shrink-0", conversation.status === 'open' && "border-green-500 text-green-500", conversation.status === 'resolved' && "border-muted-foreground text-muted-foreground")}>
                {conversation.status === 'open' ? 'Aberta' : conversation.status === 'pending' ? 'Pendente' : conversation.status === 'resolved' ? 'Compra Finalizada' : 'Adiada'}
              </Badge>
              {isContactBlocked && <Badge variant="outline" className="text-[10px] sm:text-xs border-destructive text-destructive shrink-0">
                  <Ban className="h-3 w-3 mr-1" />
                  Bloqueado
                </Badge>}
              {conversation.instance && <span className="hidden sm:inline truncate">
                  • {conversation.instance.instance_name}
                </span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Client Info Button - visible on screens < 2xl (where side panel may cut off) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="2xl:hidden h-8 w-8"
                onClick={() => setShowClientSheet(true)}
              >
                <User className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dados do Cliente</TooltipContent>
          </Tooltip>

          {/* IPTV Test Generator Button - hidden on mobile */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setShowIPTVChoice(true)} className="hidden sm:inline-flex">
                <Tv className="h-4 w-4 mr-1" />
                IPTV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar Teste IPTV</TooltipContent>
          </Tooltip>

          {/* VPN Test Generator Button - hidden on mobile */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setShowVPNTestGenerator(true)} className="hidden sm:inline-flex">
                <Wifi className="h-4 w-4 mr-1" />
                VPN
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar Teste VPN / Internet</TooltipContent>
          </Tooltip>

          {/* Schedule Message - hidden on mobile */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setShowScheduleMessage(true)} className="hidden sm:inline-flex">
                <Clock className="h-4 w-4 mr-1" />
                Agendar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Agendar mensagem</TooltipContent>
          </Tooltip>

          {/* Search Button - hidden on mobile */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setShowSearchDialog(true)} className="hidden sm:inline-flex h-8 w-8">
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Buscar mensagens</TooltipContent>
          </Tooltip>

          {/* AI Toggle with agent selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer border", conversation.ai_enabled ? "bg-primary/10 border-primary/30" : "bg-muted border-transparent")}>
                <Bot className={cn("h-4 w-4", conversation.ai_enabled ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-xs font-medium hidden sm:inline max-w-[80px] truncate", conversation.ai_enabled ? "text-primary" : "text-muted-foreground")}>
                  {conversation.ai_enabled 
                    ? (conversation.active_agent?.name || 'IA') 
                    : 'IA'}
                </span>
                <ChevronDown className={cn("h-3 w-3", conversation.ai_enabled ? "text-primary" : "text-muted-foreground")} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {conversation.ai_enabled ? (
                <>
                  <DropdownMenuItem onClick={() => onToggleAI(false)} className="text-destructive">
                    <Ban className="h-4 w-4 mr-2" />
                    Desativar IA
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Trocar agente:</p>
                  {whatsAppActiveAgents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => onToggleAI(true, agent.id)}
                      className="gap-2"
                    >
                      <div className="p-1 rounded" style={{ backgroundColor: `${agent.color || '#666'}20` }}>
                        <Bot className="h-3 w-3" style={{ color: agent.color || '#666' }} />
                      </div>
                      <span className="flex-1 truncate">{agent.name}</span>
                      {conversation.active_agent_id === agent.id && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : (
                <>
                  <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Ativar IA com agente:</p>
                  {whatsAppActiveAgents.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum agente WhatsApp ativo</p>
                  )}
                  {whatsAppActiveAgents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => onToggleAI(true, agent.id)}
                      className="gap-2"
                    >
                      <div className="p-1 rounded" style={{ backgroundColor: `${agent.color || '#666'}20` }}>
                        <Bot className="h-3 w-3" style={{ color: agent.color || '#666' }} />
                      </div>
                      <span className="flex-1 truncate">{agent.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assign to me - hidden on mobile */}
          {!conversation.assigned_to && <Button variant="outline" size="sm" onClick={onAssignToMe} className="hidden sm:inline-flex">
              <UserPlus className="h-4 w-4 mr-1" />
              Assumir
            </Button>}

          {/* Resolve/Reopen - hidden on mobile */}
          {conversation.status === 'open' || conversation.status === 'pending' ? <Button variant="outline" size="sm" onClick={onResolve} className="hidden sm:inline-flex">
              <Check className="h-4 w-4 mr-1" />
              Finalizar
            </Button> : <Button variant="outline" size="sm" onClick={onReopen} className="hidden sm:inline-flex">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reabrir
            </Button>}

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Mobile-only items */}
              <DropdownMenuItem onClick={() => setShowIPTVChoice(true)} className="sm:hidden">
                <Tv className="h-4 w-4 mr-2" />
                Gerar Teste IPTV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowVPNTestGenerator(true)} className="sm:hidden">
                <Wifi className="h-4 w-4 mr-2" />
                Gerar Teste VPN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowScheduleMessage(true)} className="sm:hidden">
                <Clock className="h-4 w-4 mr-2" />
                Agendar mensagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSearchDialog(true)} className="sm:hidden">
                <Search className="h-4 w-4 mr-2" />
                Buscar mensagens
              </DropdownMenuItem>
              {!conversation.assigned_to && (
                <DropdownMenuItem onClick={onAssignToMe} className="sm:hidden">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assumir conversa
                </DropdownMenuItem>
              )}
              {(conversation.status === 'open' || conversation.status === 'pending') ? (
                <DropdownMenuItem onClick={onResolve} className="sm:hidden">
                  <Check className="h-4 w-4 mr-2" />
                  Finalizar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onReopen} className="sm:hidden">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reabrir
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="sm:hidden" />

              <DropdownMenuItem
                onClick={async () => {
                  if (!conversation?.active_agent_id) {
                    toast({
                      title: 'Sem agente ativo',
                      description: 'Defina um agente ativo para esta conversa antes de iniciar o menu.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  setIsStartingNumericMenu(true);
                  try {
                    const { data: agent, error } = await supabase
                      .from('ai_agents')
                      .select('id,name,consultation_context,is_active,is_whatsapp_enabled')
                      .eq('id', conversation.active_agent_id)
                      .maybeSingle();

                    if (error || !agent) throw error || new Error('Agente não encontrado');
                    const menuCfg = parseNumericMenuConfig(agent.consultation_context);
                    if (!menuCfg?.prompt?.trim()) {
                      toast({
                        title: 'Menu não configurado',
                        description: 'Este agente não tem menu numérico ativo/configurado.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    // 1) Send menu message
                    const ok = await onSendMessage(menuCfg.prompt);
                    if (!ok) return;

                    // 2) Persist state on conversation
                    const currentMeta = (conversation.metadata as Record<string, unknown> | null) ?? {};
                    const optionKeys = Object.keys(menuCfg.options || {}).filter(Boolean);
                    const newMeta: Record<string, unknown> = {
                      ...currentMeta,
                      bot_menu: {
                        mode: 'numeric',
                        status: 'waiting_choice',
                        agent_id: agent.id,
                        started_at: new Date().toISOString(),
                        options: optionKeys,
                      },
                    };

                    const { error: upErr } = await supabase
                      .from('conversations')
                      .update({ metadata: newMeta } as any)
                      .eq('id', conversation.id);
                    if (upErr) throw upErr;

                    toast({
                      title: 'Menu iniciado',
                      description: 'A conversa ficou aguardando a opção (1/2/3…).',
                    });
                  } catch (e) {
                    console.error('Error starting numeric menu:', e);
                    toast({
                      title: 'Erro ao iniciar menu',
                      description: e instanceof Error ? e.message : 'Não foi possível iniciar o menu.',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsStartingNumericMenu(false);
                  }
                }}
                disabled={isStartingNumericMenu}
              >
                <MessageSquareText className="h-4 w-4 mr-2" />
                {isStartingNumericMenu ? 'Iniciando menu...' : 'Iniciar menu do bot'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={async () => {
                if (conversation) {
                  const avatarUrl = await fetchAvatar(
                    conversation.id, 
                    conversation.phone,
                    conversation.instance_id
                  );
                  if (avatarUrl) {
                    setContactAvatarUrl(avatarUrl);
                  }
                }
              }} disabled={isFetchingAvatar}>
                <Camera className="h-4 w-4 mr-2" />
                {isFetchingAvatar ? 'Buscando...' : 'Atualizar foto de perfil'}
              </DropdownMenuItem>
              {/* Rename contact */}
              <DropdownMenuItem onClick={() => {
                setNewContactName(conversation.contact_name || "");
                setShowRenameDialog(true);
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Renomear contato
              </DropdownMenuItem>
              {/* Save to WhatsApp contacts */}
              <DropdownMenuItem onClick={() => {
                setNewContactName(conversation.contact_name || "");
                setShowSaveContactDialog(true);
              }}>
                <BookUser className="h-4 w-4 mr-2" />
                Salvar na agenda
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Register/View Client */}
              {!client && onRegisterClient && <DropdownMenuItem onClick={() => onRegisterClient(conversation.phone, conversation.contact_name || undefined)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar cliente
                </DropdownMenuItem>}
              {client && <DropdownMenuItem disabled className="text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  Cliente cadastrado
                </DropdownMenuItem>}
              <DropdownMenuSeparator />
              {/* Labels submenu */}
              {availableLabels.length > 0 && <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <Tag className="h-4 w-4" />
                      Adicionar etiqueta
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-64 max-h-72 overflow-y-auto bg-popover border border-border">
                      {availableLabels.map(label => <DropdownMenuItem key={label.id} onClick={() => onAssignLabel(label.id)}>
                          <div className="h-3 w-3 rounded-full mr-2" style={{
                        backgroundColor: label.color
                      }} />
                          <span className="truncate">{label.name}</span>
                        </DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                </>}
              {/* Block/Unblock contact */}
              <DropdownMenuItem onClick={handleBlockClick} disabled={isBlocking} className={isContactBlocked ? "text-green-600 focus:text-green-600" : "text-amber-600 focus:text-amber-600"}>
                {isBlocking ? <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {isContactBlocked ? 'Desbloqueando...' : 'Bloqueando...'}
                  </> : isContactBlocked ? <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Desbloquear contato
                  </> : <>
                    <Ban className="h-4 w-4 mr-2" />
                    Bloquear contato
                  </>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Delete conversation */}
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Labels bar */}
      {nonNullAssignedLabels.length > 0 && (() => {
      const MAX_INLINE = 3;
      const inlineLabels = nonNullAssignedLabels.slice(0, MAX_INLINE);
      const overflowLabels = nonNullAssignedLabels.slice(MAX_INLINE);
      return <div className="px-3 py-2 border-b border-border/50 bg-card/10 backdrop-blur-md flex items-center gap-2 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {inlineLabels.map(label => <Badge key={label.id} variant="secondary" className="text-xs cursor-pointer hover:opacity-80" style={{
          backgroundColor: `${label.color}20`,
          borderColor: label.color,
          color: label.color
        }} onClick={() => onRemoveLabel(label.id)}>
                {label.name}
                <span className="ml-1">×</span>
              </Badge>)}

            {overflowLabels.length > 0 && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-xs">
                    +{overflowLabels.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 bg-popover border border-border">
                  {overflowLabels.map(label => <DropdownMenuItem key={label.id} onClick={() => onRemoveLabel(label.id)} className="gap-2">
                      <div className="h-3 w-3 rounded-full" style={{
                  backgroundColor: label.color
                }} />
                      <span className="flex-1 truncate">{label.name}</span>
                      <span className="text-muted-foreground">×</span>
                    </DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>}
          </div>;
    })()}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 min-h-0 inbox-scroll bg-white dark:bg-white/5">
        {isLoading ? <div className="space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <div className={cn("animate-pulse rounded-lg p-3", i % 2 === 0 ? "bg-muted w-48" : "bg-primary/20 w-36")}>
                  <div className="h-4 bg-muted-foreground/20 rounded w-full" />
                </div>
              </div>)}
          </div> : messages.length === 0 ? <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma mensagem ainda</p>
          </div> : <div className="space-y-4">
            {messages.map((msg, index) => {
            const sender = getSenderInfo(msg);
            const isOutgoing = msg.sender_type === 'agent' || msg.sender_type === 'ai';
            const showDate = index === 0 || format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');
            const messageStatus = getMessageStatus(msg);
            return <div key={msg.id}>
                  {showDate && <div className="text-center my-4">
                      <span className="text-xs text-muted-foreground bg-card/20 border border-border/40 backdrop-blur-sm px-3 py-1 rounded-full">
                        {format(new Date(msg.created_at), "d 'de' MMMM", {
                    locale: ptBR
                  })}
                      </span>
                    </div>}
                  
                  <div className={cn("flex gap-2 group", isOutgoing ? "justify-end" : "justify-start")}>
                    {/* Delete button - appears on hover (for outgoing messages on the left) */}
                    {isOutgoing && onDeleteMessage && !msg.metadata?.deleted && <button onClick={() => setMessageToDelete(msg)} className="opacity-0 group-hover:opacity-100 transition-opacity self-center p-1 hover:bg-muted rounded" title="Apagar mensagem">
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>}
                    
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5",
                      "border border-border/35",
                      "backdrop-blur-md shadow-[var(--shadow-sm)]",
                      "transition-all duration-200",
                      isOutgoing
                        ? msg.sender_type === 'ai'
                          ? "bg-primary/10 text-foreground"
                          : "bg-inbox-message-sent text-foreground rounded-br-sm"
                        : "bg-inbox-message-received rounded-bl-sm",
                      msg.is_private && "inbox-message-private border border-dashed !border-amber-500/40",
                      msg.metadata?.deleted && "opacity-60 italic"
                    )}>
                      {/* Sender info */}
                      <div className={cn(
                        "flex items-center gap-1 text-xs mb-1",
                        isOutgoing ? "justify-end" : "justify-start",
                        isOutgoing
                          ? msg.sender_type === 'ai'
                            ? "text-primary"
                            : "text-muted-foreground"
                          : "text-muted-foreground"
                      )}>
                        <sender.icon className="h-3 w-3" />
                        <span>{sender.name}</span>
                        {msg.is_private && <Lock className="h-3 w-3 text-amber-500" />}
                      </div>

                      {/* Media */}
                      {msg.media_url && <div className="mb-2">
                          {msg.media_type?.startsWith('image/') ? <button onClick={() => openMediaGallery(msg.id)} className="block cursor-pointer hover:opacity-90 transition-opacity">
                              <img src={msg.media_url} alt="Media" className={cn("rounded object-cover", msg.media_type === 'image/webp' ? "max-w-32 max-h-32" : "max-w-full max-h-64")} />
                            </button> : msg.media_type?.startsWith('video/') ? <div className="relative group/video">
                              <video src={msg.media_url} className="rounded max-w-full max-h-64 cursor-pointer" onClick={() => openMediaGallery(msg.id)} />
                              <button onClick={() => openMediaGallery(msg.id)} className="absolute inset-0 flex items-center justify-center bg-black/30 rounded opacity-0 group-hover/video:opacity-100 transition-opacity">
                                <Play className="h-12 w-12 text-white" />
                              </button>
                            </div> : msg.media_type?.startsWith('audio/') ? <div className="space-y-2">
                              <AudioPlayer src={msg.media_url} isOutgoing={isOutgoing} />

                              {Boolean((msg.metadata as any)?.transcription?.text) && <div className={cn("rounded-lg border border-border/50 bg-muted/40 px-3 py-2", isOutgoing && msg.sender_type !== 'ai' && "bg-background/20")}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-medium text-muted-foreground">Transcrição</span>
                                    {Boolean((msg.metadata as any)?.transcription?.language) && <Badge variant="secondary" className="text-[10px]">
                                        {(msg.metadata as any)?.transcription?.language}
                                      </Badge>}
                                    {Boolean((msg.metadata as any)?.transcription?.provider) && <Badge variant="secondary" className="text-[10px]">
                                        {(msg.metadata as any)?.transcription?.provider}
                                      </Badge>}
                                  </div>
                                  <p className="text-xs whitespace-pre-wrap break-words text-foreground/90">
                                    {(msg.metadata as any)?.transcription?.text}
                                  </p>
                                </div>}
                            </div> : <AttachmentRenderer 
                                  url={msg.media_url} 
                                  mediaType={msg.media_type} 
                                  isOutgoing={isOutgoing}
                                  onImageClick={() => openMediaGallery(msg.id)}
                                />}
                        </div>}

                      {/* Content */}
                      {msg.content && <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>}

                      {/* Time and Status */}
                      <div className={cn(
                        "flex items-center gap-1 text-xs mt-1",
                        isOutgoing ? "justify-end" : "justify-start",
                        "text-muted-foreground"
                      )}>
                        <span>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        <MessageStatus status={messageStatus} isOutgoing={isOutgoing} onRetry={messageStatus === 'failed' && onRetryMessage ? () => onRetryMessage(msg.id) : undefined} />
                      </div>
                    </div>
                    
                    {/* Delete button - appears on hover (for incoming messages on the right) */}
                    {!isOutgoing && onDeleteMessage && !msg.metadata?.deleted && <button onClick={() => setMessageToDelete(msg)} className="opacity-0 group-hover:opacity-100 transition-opacity self-center p-1 hover:bg-muted rounded" title="Apagar mensagem">
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>}
                  </div>
                </div>;
          })}
            
            {/* Typing Indicator */}
            {isTyping && <TypingIndicator name={conversation.contact_name || 'Cliente'} />}
          </div>}
      </ScrollArea>

      {/* Input */}
      <div className={cn(
        "p-3 inbox-input-area flex-shrink-0",
        "border-t border-border/50",
        "bg-card/15 backdrop-blur-md"
      )}>
        {/* Attachments Preview */}
        {attachments.length > 0 && <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att, index) => <AttachmentPreview key={`${att.url}-${index}`} url={att.url} type={att.type} fileName={att.fileName} onRemove={() => handleRemoveAttachment(index)} />)}
          </div>}

        {/* Private note indicator */}
        {isPrivate && <div className="flex items-center gap-2 text-xs text-yellow-600 mb-2 px-2">
            <Lock className="h-3 w-3" />
            Nota privada (não será enviada ao cliente)
          </div>}

        <div className="flex items-end gap-2">
          {/* Actions moved OUT of the textarea (prevents the recorder UI from covering the input) */}
          <div className="flex items-center gap-1 pb-2">
            <EmojiPickerButton onEmojiSelect={handleEmojiSelect} disabled={isSending} />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPrivate(!isPrivate)}>
                  <Lock className={cn("h-4 w-4", isPrivate ? "text-yellow-500" : "text-muted-foreground")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isPrivate ? 'Nota privada' : 'Tornar nota privada'}
              </TooltipContent>
            </Tooltip>

            <FileUploadButton onFileUploaded={handleFileUploaded} disabled={isSending} />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPIXDialog(true)} disabled={isSending}>
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gerar PIX</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleAutoCorrect}>
                  <SpellCheck className={cn("h-4 w-4", autoCorrectEnabled ? "text-primary" : "text-muted-foreground")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{autoCorrectEnabled ? 'Correção automática ativada' : 'Ativar correção automática'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <AudioRecorder onAudioReady={handleAudioReady} disabled={isSending || attachments.length > 0} onRecordingStart={() => sendPresence('recording')} onRecordingEnd={() => sendPresence('paused')} />
              </TooltipTrigger>
              <TooltipContent>Gravar áudio</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 relative">
            {/* Quick Reply Autocomplete */}
            <QuickReplyAutocomplete responses={autocompleteSuggestions} isVisible={showAutocomplete} selectedIndex={autocompleteIndex} onSelect={handleSelectAutocomplete} />

            <Textarea ref={textareaRef} placeholder={isPrivate ? "Escreva uma nota privada..." : "Digite sua mensagem..."} value={message} onChange={e => {
              const newValue = autoCorrectText(e.target.value);
              setMessage(newValue);
              // Send composing presence when typing (not for private notes)
              if (newValue.length > 0 && !isPrivate) {
                handleComposingPresence();
              }
            }} onKeyDown={handleKeyDown} spellCheck={true} className={cn("min-h-[44px] max-h-32 resize-none inbox-input-field", "bg-inbox-input dark:bg-inbox-input", isPrivate && "!border-amber-500/50 dark:!border-amber-500/40")} rows={1} />
          </div>
          
          <Button onClick={handleSend} disabled={!message.trim() && attachments.length === 0 || isSending} className="h-11 shadow-[var(--shadow-sm)]">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Reply Hint */}
        {responses.length > 0 && !message && <p className="text-xs text-muted-foreground mt-1.5 px-1">
            💡 Digite <span className="font-mono text-primary">/</span> para ver respostas rápidas
          </p>}
      </div>
      </div>

      {/* Client Info Panel - Right side (only visible on 2xl+ screens to avoid being cut off) */}
      <div className={cn(
        "border-l border-border/50 shrink-0 overflow-hidden w-80 py-0",
        "bg-card/10 backdrop-blur-md",
        // Only show on extra-large screens (1536px+) to avoid being cut off
        "hidden 2xl:block"
      )}>
        <ScrollArea className="w-80 h-full">
          <div className="p-3">
            <ClientInfoPanel client={client} isLoading={isLoadingClient} phone={conversation.phone} contactName={conversation.contact_name || undefined} contactAvatar={contactAvatarUrl || conversation.contact_avatar} agentId={conversation.active_agent_id} onRegisterClient={onRegisterClient} />
          </div>
        </ScrollArea>
      </div>

      {/* Mobile Client Info Sheet */}
      <Sheet open={showClientSheet} onOpenChange={setShowClientSheet}>
        <SheetContent side="right" className="w-[min(90vw,360px)] p-0 bg-background/95 backdrop-blur-md">
          <SheetHeader className="p-4 pb-2 border-b border-border/50">
            <SheetTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Cliente
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-60px)]">
            <div className="p-3">
              <ClientInfoPanel client={client} isLoading={isLoadingClient} phone={conversation.phone} contactName={conversation.contact_name || undefined} contactAvatar={contactAvatarUrl || conversation.contact_avatar} agentId={conversation.active_agent_id} onRegisterClient={onRegisterClient} />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>


      {/* Media Gallery Modal */}
      {showGallery && <MediaGallery messages={messages} initialMediaId={galleryInitialId} onClose={() => {
      setShowGallery(false);
      setGalleryInitialId(undefined);
    }} />}

      {/* Delete Conversation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a deletar a conversa com{' '}
              <strong>{conversation?.contact_name || formatPhone(conversation?.phone || '')}</strong>.
              <br /><br />
              Esta ação irá remover todas as mensagens e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex items-center space-x-2 py-4">
            <Checkbox id="delete-whatsapp" checked={deleteFromWhatsApp} onCheckedChange={checked => setDeleteFromWhatsApp(checked === true)} />
            <label htmlFor="delete-whatsapp" className="text-sm text-muted-foreground cursor-pointer">
              Deletar também do WhatsApp
            </label>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingConversation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} disabled={isDeletingConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingConversation ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Contact Confirmation Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Bloquear contato?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a bloquear{' '}
                <strong className="text-foreground">
                  {conversation?.contact_name || formatPhone(conversation?.phone || '')}
                </strong>.
              </p>
              <p className="text-amber-600 dark:text-amber-500 font-medium">
                ⚠️ Consequências do bloqueio:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Este contato <strong>não poderá</strong> enviar mensagens para você</li>
                <li>Você <strong>não poderá</strong> enviar mensagens para este contato</li>
                <li>O contato não será notificado sobre o bloqueio</li>
                <li>Você pode desbloquear a qualquer momento</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Ban className="h-4 w-4 mr-2" />
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message Search Dialog */}
      <MessageSearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} conversationId={conversation?.id || ''} onMessageClick={messageId => {
      // Close dialog and scroll to message (future enhancement)
      setShowSearchDialog(false);
    }} />

      {/* Sync Options Dialog */}
      <SyncOptionsDialog open={showSyncDialog} onOpenChange={setShowSyncDialog} conversationId={conversation?.id || null} onSyncMessages={limit => {
      onSyncMessages?.(limit);
    }} isSyncing={isSyncing || false} />

      {/* Delete Message Dialog */}
      <DeleteMessageDialog open={!!messageToDelete} onOpenChange={open => !open && setMessageToDelete(null)} message={messageToDelete} onDelete={handleDeleteMessage} isDeleting={isDeleting || false} />

      {/* Rename Contact Dialog */}
      <AlertDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renomear Contato</AlertDialogTitle>
            <AlertDialogDescription>
              Digite o novo nome para este contato. O nome será salvo apenas localmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Nome do contato" className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-2 focus:ring-ring" autoFocus onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleRenameContact();
            }
          }} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewContactName("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameContact} disabled={!newContactName.trim()}>
              <Pencil className="h-4 w-4 mr-2" />
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Contact to WhatsApp Dialog */}
      <AlertDialog open={showSaveContactDialog} onOpenChange={setShowSaveContactDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar na Agenda do WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              O contato será adicionado à agenda do celular conectado a esta instância do WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Nome do contato</label>
              <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Nome para salvar na agenda" className="w-full mt-1 px-3 py-2 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
            </div>
            <p className="text-xs text-muted-foreground">
              📞 Telefone: {formatPhone(conversation?.phone || '')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewContactName("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveContact} disabled={isSavingContact}>
              <BookUser className="h-4 w-4 mr-2" />
              {isSavingContact ? 'Salvando...' : 'Salvar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* IPTV Choice Dialog */}
      <IPTVTestChoiceDialog
        open={showIPTVChoice}
        onOpenChange={setShowIPTVChoice}
        onChooseGextv={() => setShowIPTVGextv(true)}
        onChooseSportplay={() => setShowIPTVSportplay(true)}
      />

      {/* IPTV Test Generator Dialogs */}
      <TestGeneratorDialog open={showIPTVSportplay} onOpenChange={setShowIPTVSportplay} />
      <GextvTestGeneratorDialog open={showIPTVGextv} onOpenChange={setShowIPTVGextv} />

      {/* VPN Test Generator Dialog */}
      <VPNTestGeneratorDialog open={showVPNTestGenerator} onOpenChange={setShowVPNTestGenerator} />

      {/* Schedule Message Dialog */}
      <ScheduleMessageDialog open={showScheduleMessage} onOpenChange={setShowScheduleMessage} conversation={conversation} />

      {/* PIX Generation Dialog */}
      {conversation && <GeneratePIXDialog open={showPIXDialog} onOpenChange={setShowPIXDialog} conversationId={conversation.id} instanceId={conversation.instance_id} clientPhone={conversation.phone} clientName={conversation.contact_name || undefined} onSendMessage={onSendMessage} />}
    </div>;
}