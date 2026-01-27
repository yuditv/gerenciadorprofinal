import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Send, 
  MoreVertical, 
  Bot, 
  User,
  Check,
  Clock,
  Tag,
  UserPlus,
  Archive,
  RotateCcw,
  Lock,
  PanelRightOpen,
  PanelRightClose,
  PanelLeftOpen,
  PanelLeftClose,
  Play,
  RefreshCw,
  Camera,
  Trash2,
  MessageSquareText,
  Ban,
  UserCheck,
  Search,
  ChevronDown,
  Settings,
  Pencil,
  BookUser,
  SquareStack,
  GalleryHorizontal,
  Tv,
  Wifi,
  QrCode
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { MessageSearchDialog } from "./MessageSearchDialog";
import { SyncOptionsDialog } from "./SyncOptionsDialog";
import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { TestGeneratorDialog } from "./TestGeneratorDialog";
import { VPNTestGeneratorDialog } from "./VPNTestGeneratorDialog";
import { GeneratePIXDialog } from "./GeneratePIXDialog";

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
  onToggleAI: (enabled: boolean) => void;
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
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [showTestGenerator, setShowTestGenerator] = useState(false);
  const [showVPNTestGenerator, setShowVPNTestGenerator] = useState(false);
  const [showPIXDialog, setShowPIXDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch client by phone
  const { client, isLoading: isLoadingClient } = useClientByPhone(conversation?.phone || null);

  // Canned responses for quick replies (autocomplete)
  const { responses, searchResponses, findByShortCode } = useCannedResponses();
  
  // Contact avatar fetcher
  const { fetchAvatar, isLoading: isFetchingAvatar } = useContactAvatar();
  
  
  // Presence hook for typing/recording indicators
  const { sendPresence } = usePresence(conversation?.id || null);
  
  // Get WhatsApp instances to find instance_key
  const { instances } = useWhatsAppInstances();
  const currentInstance = instances.find(i => i.id === conversation?.instance_id);
  const instanceKey = currentInstance?.instance_key || "";

  // Check if contact is blocked from conversation metadata
  const isContactBlocked = (conversation?.metadata as Record<string, unknown> | null)?.is_blocked === true;

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
    
    setMessage(content);
    setAutocompleteIndex(-1);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if ((!message.trim() && attachments.length === 0) || isSending) return;
    
    // Capturar valores antes de limpar
    const messageToSend = message.trim();
    const privateToSend = isPrivate;
    const attachmentsToSend = [...attachments];
    
    // Limpar imediatamente - UX instantânea
    setMessage("");
    setIsPrivate(false);
    setAttachments([]);
    
    // Se tiver anexos, enviar cada um separadamente
    if (attachmentsToSend.length > 0) {
      for (let i = 0; i < attachmentsToSend.length; i++) {
        const att = attachmentsToSend[i];
        // Primeira mensagem leva o texto, as demais só a mídia
        const textToSend = i === 0 ? messageToSend : "";
        await onSendMessage(
          textToSend, 
          privateToSend,
          att.url,
          att.type,
          att.fileName
        );
      }
    } else {
      // Apenas texto
      onSendMessage(messageToSend, privateToSend);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle autocomplete navigation
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(prev => 
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(prev => 
          prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteIndex >= 0)) {
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
    setAttachments(prev => [...prev, { url, type, fileName }]);
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
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/whatsapp-instances',
        {
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
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar bloqueio');
      }
      
      toast({
        title: shouldBlock ? 'Contato bloqueado' : 'Contato desbloqueado',
        description: shouldBlock 
          ? 'Este contato não poderá mais enviar mensagens para esta instância'
          : 'Este contato pode enviar mensagens novamente',
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
        return { name: 'Desconhecido', icon: User, color: 'text-foreground' };
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
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium">Selecione uma conversa</h3>
          <p className="text-sm">Escolha uma conversa da lista para começar</p>
        </div>
      </div>
    );
  }

  const assignedLabels = conversation.labels?.map(l => l.label) || [];
  const availableLabels = labels.filter(l => !assignedLabels.some(al => al?.id === l.id));

  return (
    <div className="flex-1 flex h-full inbox-container overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden inbox-chat-area">
        {/* Header */}
        <div className="p-3 inbox-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={contactAvatarUrl || conversation.contact_avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(conversation.contact_name, conversation.phone)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">
              {conversation.contact_name || formatPhone(conversation.phone)}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatPhone(conversation.phone)}</span>
              <span>•</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  conversation.status === 'open' && "border-green-500 text-green-500",
                  conversation.status === 'resolved' && "border-muted-foreground text-muted-foreground"
                )}
              >
                {conversation.status === 'open' ? 'Aberta' : 
                 conversation.status === 'pending' ? 'Pendente' :
                 conversation.status === 'resolved' ? 'Resolvida' : 'Adiada'}
              </Badge>
              {isContactBlocked && (
                <Badge 
                  variant="outline" 
                  className="text-xs border-destructive text-destructive"
                >
                  <Ban className="h-3 w-3 mr-1" />
                  Bloqueado
                </Badge>
              )}
              {conversation.instance && (
                <>
                  <span>•</span>
                  <span>{conversation.instance.instance_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">


          {/* IPTV Test Generator Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTestGenerator(true)}
              >
                <Tv className="h-4 w-4 mr-1" />
                IPTV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar Teste IPTV</TooltipContent>
          </Tooltip>

          {/* VPN Test Generator Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowVPNTestGenerator(true)}
              >
                <Wifi className="h-4 w-4 mr-1" />
                VPN
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar Teste VPN / Internet</TooltipContent>
          </Tooltip>

          {/* Quick Messages Panel toggle removed - management moved to Settings */}

          {/* Search Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowSearchDialog(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Buscar mensagens</TooltipContent>
          </Tooltip>

          {/* AI Toggle with pause indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
                conversation.ai_enabled 
                  ? "bg-primary/10 border border-primary/30" 
                  : conversation.ai_paused_at
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-muted"
              )}>
                <Bot className={cn(
                  "h-4 w-4",
                  conversation.ai_enabled 
                    ? "text-primary" 
                    : conversation.ai_paused_at 
                      ? "text-amber-500"
                      : "text-muted-foreground"
                )} />
                <Switch
                  checked={conversation.ai_enabled}
                  onCheckedChange={onToggleAI}
                  className="scale-75"
                />
                {!conversation.ai_enabled && conversation.ai_paused_at && (
                  <Clock className="h-3 w-3 text-amber-500 animate-pulse" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {conversation.ai_enabled 
                ? 'IA ativada - clique para pausar' 
                : conversation.ai_paused_at 
                  ? `IA pausada - reativa automaticamente em ${formatDistanceToNow(new Date(new Date(conversation.ai_paused_at).getTime() + 60 * 60 * 1000), { locale: ptBR })}`
                  : 'IA desativada - clique para ativar'
              }
            </TooltipContent>
          </Tooltip>

          {/* Assign to me */}
          {!conversation.assigned_to && (
            <Button variant="outline" size="sm" onClick={onAssignToMe}>
              <UserPlus className="h-4 w-4 mr-1" />
              Assumir
            </Button>
          )}

          {/* Resolve/Reopen */}
          {conversation.status === 'open' || conversation.status === 'pending' ? (
            <Button variant="outline" size="sm" onClick={onResolve}>
              <Check className="h-4 w-4 mr-1" />
              Resolver
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onReopen}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reabrir
            </Button>
          )}

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={async () => {
                  if (conversation) {
                    const avatarUrl = await fetchAvatar(conversation.id, conversation.phone);
                    if (avatarUrl) {
                      setContactAvatarUrl(avatarUrl);
                    }
                  }
                }}
                disabled={isFetchingAvatar}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isFetchingAvatar ? 'Buscando...' : 'Atualizar foto de perfil'}
              </DropdownMenuItem>
              {/* Rename contact */}
              <DropdownMenuItem 
                onClick={() => {
                  setNewContactName(conversation.contact_name || "");
                  setShowRenameDialog(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Renomear contato
              </DropdownMenuItem>
              {/* Save to WhatsApp contacts */}
              <DropdownMenuItem 
                onClick={() => {
                  setNewContactName(conversation.contact_name || "");
                  setShowSaveContactDialog(true);
                }}
              >
                <BookUser className="h-4 w-4 mr-2" />
                Salvar na agenda
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Register/View Client */}
              {!client && onRegisterClient && (
                <DropdownMenuItem 
                  onClick={() => onRegisterClient(conversation.phone, conversation.contact_name || undefined)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar cliente
                </DropdownMenuItem>
              )}
              {client && (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  Cliente cadastrado
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {/* Labels submenu */}
              {availableLabels.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Adicionar etiqueta
                  </div>
                  {availableLabels.map(label => (
                    <DropdownMenuItem 
                      key={label.id}
                      onClick={() => onAssignLabel(label.id)}
                    >
                      <div 
                        className="h-3 w-3 rounded-full mr-2"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {/* Block/Unblock contact */}
              <DropdownMenuItem 
                onClick={handleBlockClick}
                disabled={isBlocking}
                className={isContactBlocked ? "text-green-600 focus:text-green-600" : "text-amber-600 focus:text-amber-600"}
              >
                {isBlocking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {isContactBlocked ? 'Desbloqueando...' : 'Bloqueando...'}
                  </>
                ) : isContactBlocked ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Desbloquear contato
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Bloquear contato
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Delete conversation */}
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Labels bar */}
      {assignedLabels.length > 0 && (
        <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {assignedLabels.map(label => label && (
            <Badge
              key={label.id}
              variant="secondary"
              className="text-xs cursor-pointer hover:opacity-80"
              style={{ 
                backgroundColor: `${label.color}20`,
                borderColor: label.color,
                color: label.color
              }}
              onClick={() => onRemoveLabel(label.id)}
            >
              {label.name}
              <span className="ml-1">×</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 min-h-0 inbox-scroll">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn(
                "flex gap-2",
                i % 2 === 0 ? "justify-start" : "justify-end"
              )}>
                <div className={cn(
                  "animate-pulse rounded-lg p-3",
                  i % 2 === 0 ? "bg-muted w-48" : "bg-primary/20 w-36"
                )}>
                  <div className="h-4 bg-muted-foreground/20 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const sender = getSenderInfo(msg);
              const isOutgoing = msg.sender_type === 'agent' || msg.sender_type === 'ai';
              const showDate = index === 0 || 
                format(new Date(msg.created_at), 'yyyy-MM-dd') !== 
                format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');
              const messageStatus = getMessageStatus(msg);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {format(new Date(msg.created_at), "d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  
                  <div className={cn(
                    "flex gap-2 group",
                    isOutgoing ? "justify-end" : "justify-start"
                  )}>
                    {/* Delete button - appears on hover (for outgoing messages on the left) */}
                    {isOutgoing && onDeleteMessage && !(msg.metadata?.deleted) && (
                      <button
                        onClick={() => setMessageToDelete(msg)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity self-center p-1 hover:bg-muted rounded"
                        title="Apagar mensagem"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                    
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 transition-colors",
                      isOutgoing 
                        ? msg.sender_type === 'ai'
                          ? "bg-primary/15 text-foreground dark:bg-primary/10"
                          : "bg-inbox-message-sent text-foreground rounded-br-sm"
                        : "bg-inbox-message-received border border-border/50 rounded-bl-sm",
                      msg.is_private && "inbox-message-private border border-dashed !border-amber-500/40",
                      msg.metadata?.deleted && "opacity-60 italic"
                    )}>
                      {/* Sender info */}
                      <div className={cn(
                        "flex items-center gap-1 text-xs mb-1",
                        isOutgoing ? "justify-end" : "justify-start",
                        isOutgoing 
                          ? msg.sender_type === 'ai' ? "text-primary" : "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}>
                        <sender.icon className="h-3 w-3" />
                        <span>{sender.name}</span>
                        {msg.is_private && (
                          <Lock className="h-3 w-3 text-amber-500" />
                        )}
                      </div>

                      {/* Media */}
                      {msg.media_url && (
                        <div className="mb-2">
                          {msg.media_type?.startsWith('image/') ? (
                            <button
                              onClick={() => openMediaGallery(msg.id)}
                              className="block cursor-pointer hover:opacity-90 transition-opacity"
                            >
                              <img 
                                src={msg.media_url} 
                                alt="Media" 
                                className={cn(
                                  "rounded object-cover",
                                  msg.media_type === 'image/webp' 
                                    ? "max-w-32 max-h-32"
                                    : "max-w-full max-h-64"
                                )}
                              />
                            </button>
                          ) : msg.media_type?.startsWith('video/') ? (
                            <div className="relative group/video">
                              <video 
                                src={msg.media_url} 
                                className="rounded max-w-full max-h-64 cursor-pointer"
                                onClick={() => openMediaGallery(msg.id)}
                              />
                              <button
                                onClick={() => openMediaGallery(msg.id)}
                                className="absolute inset-0 flex items-center justify-center bg-black/30 rounded opacity-0 group-hover/video:opacity-100 transition-opacity"
                              >
                                <Play className="h-12 w-12 text-white" />
                              </button>
                            </div>
                          ) : msg.media_type?.startsWith('audio/') ? (
                            <AudioPlayer 
                              src={msg.media_url} 
                              isOutgoing={isOutgoing}
                            />
                          ) : (
                            <a 
                              href={msg.media_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm underline flex items-center gap-1"
                            >
                              📎 Anexo
                            </a>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      {msg.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}

                      {/* Time and Status */}
                      <div className={cn(
                        "flex items-center gap-1 text-xs mt-1",
                        isOutgoing ? "justify-end" : "justify-start",
                        isOutgoing 
                          ? msg.sender_type === 'ai' ? "text-muted-foreground" : "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}>
                        <span>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        <MessageStatus 
                          status={messageStatus}
                          isOutgoing={isOutgoing}
                          onRetry={messageStatus === 'failed' && onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                        />
                      </div>
                    </div>
                    
                    {/* Delete button - appears on hover (for incoming messages on the right) */}
                    {!isOutgoing && onDeleteMessage && !(msg.metadata?.deleted) && (
                      <button
                        onClick={() => setMessageToDelete(msg)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity self-center p-1 hover:bg-muted rounded"
                        title="Apagar mensagem"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Typing Indicator */}
            {isTyping && (
              <TypingIndicator name={conversation.contact_name || 'Cliente'} />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 inbox-input-area flex-shrink-0">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att, index) => (
              <AttachmentPreview
                key={`${att.url}-${index}`}
                url={att.url}
                type={att.type}
                fileName={att.fileName}
                onRemove={() => handleRemoveAttachment(index)}
              />
            ))}
          </div>
        )}

        {/* Private note indicator */}
        {isPrivate && (
          <div className="flex items-center gap-2 text-xs text-yellow-600 mb-2 px-2">
            <Lock className="h-3 w-3" />
            Nota privada (não será enviada ao cliente)
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            {/* Quick Reply Autocomplete */}
            <QuickReplyAutocomplete
              responses={autocompleteSuggestions}
              isVisible={showAutocomplete}
              selectedIndex={autocompleteIndex}
              onSelect={handleSelectAutocomplete}
            />

            <Textarea
              ref={textareaRef}
              placeholder={isPrivate ? "Escreva uma nota privada..." : "Digite sua mensagem... (use / para respostas rápidas)"}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                // Send composing presence when typing (not for private notes)
                if (e.target.value.length > 0 && !isPrivate) {
                  sendPresence('composing');
                }
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                "min-h-[44px] max-h-32 resize-none pr-20 inbox-input-field",
                "bg-inbox-input dark:bg-inbox-input",
                isPrivate && "!border-amber-500/50 dark:!border-amber-500/40"
              )}
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <EmojiPickerButton 
                onEmojiSelect={handleEmojiSelect}
                disabled={isSending}
              />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsPrivate(!isPrivate)}
                  >
                    <Lock className={cn(
                      "h-4 w-4",
                      isPrivate ? "text-yellow-500" : "text-muted-foreground"
                    )} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPrivate ? 'Nota privada' : 'Tornar nota privada'}
                </TooltipContent>
              </Tooltip>
              
              <FileUploadButton
                onFileUploaded={handleFileUploaded}
                disabled={isSending}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowPIXDialog(true)}
                    disabled={isSending}
                  >
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gerar PIX</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <AudioRecorder
                    onAudioReady={handleAudioReady}
                    disabled={isSending || attachments.length > 0}
                    onRecordingStart={() => sendPresence('recording')}
                    onRecordingEnd={() => sendPresence('paused')}
                  />
                </TooltipTrigger>
                <TooltipContent>Gravar áudio</TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <Button 
            onClick={handleSend}
            disabled={(!message.trim() && attachments.length === 0) || isSending}
            className="h-11"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Reply Hint */}
        {responses.length > 0 && !message && (
          <p className="text-xs text-muted-foreground mt-1.5 px-1">
            💡 Digite <span className="font-mono text-primary">/</span> para ver respostas rápidas
          </p>
        )}
      </div>
      </div>

      {/* Client Info Panel - Right side (always visible) */}
      <div className="border-l shrink-0 overflow-hidden bg-muted/20 w-80">
        <ScrollArea className="w-80 h-full">
          <div className="p-3">
            <ClientInfoPanel
              client={client}
              isLoading={isLoadingClient}
              phone={conversation.phone}
              contactName={conversation.contact_name || undefined}
              contactAvatar={contactAvatarUrl || conversation.contact_avatar}
              agentId={conversation.active_agent_id}
              onRegisterClient={onRegisterClient}
            />
          </div>
        </ScrollArea>
      </div>


      {/* Media Gallery Modal */}
      {showGallery && (
        <MediaGallery
          messages={messages}
          initialMediaId={galleryInitialId}
          onClose={() => {
            setShowGallery(false);
            setGalleryInitialId(undefined);
          }}
        />
      )}

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
            <Checkbox 
              id="delete-whatsapp" 
              checked={deleteFromWhatsApp}
              onCheckedChange={(checked) => setDeleteFromWhatsApp(checked === true)}
            />
            <label htmlFor="delete-whatsapp" className="text-sm text-muted-foreground cursor-pointer">
              Deletar também do WhatsApp
            </label>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingConversation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConversation}
              disabled={isDeletingConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
            <AlertDialogAction 
              onClick={handleToggleBlock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Ban className="h-4 w-4 mr-2" />
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message Search Dialog */}
      <MessageSearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        conversationId={conversation?.id || ''}
        onMessageClick={(messageId) => {
          // Close dialog and scroll to message (future enhancement)
          setShowSearchDialog(false);
        }}
      />

      {/* Sync Options Dialog */}
      <SyncOptionsDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        conversationId={conversation?.id || null}
        onSyncMessages={(limit) => {
          onSyncMessages?.(limit);
        }}
        isSyncing={isSyncing || false}
      />

      {/* Delete Message Dialog */}
      <DeleteMessageDialog
        open={!!messageToDelete}
        onOpenChange={(open) => !open && setMessageToDelete(null)}
        message={messageToDelete}
        onDelete={handleDeleteMessage}
        isDeleting={isDeleting || false}
      />

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
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Nome do contato"
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRenameContact();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewContactName("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRenameContact}
              disabled={!newContactName.trim()}
            >
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
              <input
                type="text"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Nome para salvar na agenda"
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              📞 Telefone: {formatPhone(conversation?.phone || '')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewContactName("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSaveContact}
              disabled={isSavingContact}
            >
              <BookUser className="h-4 w-4 mr-2" />
              {isSavingContact ? 'Salvando...' : 'Salvar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* IPTV Test Generator Dialog */}
      <TestGeneratorDialog
        open={showTestGenerator}
        onOpenChange={setShowTestGenerator}
      />

      {/* VPN Test Generator Dialog */}
      <VPNTestGeneratorDialog
        open={showVPNTestGenerator}
        onOpenChange={setShowVPNTestGenerator}
      />

      {/* PIX Generation Dialog */}
      {conversation && (
        <GeneratePIXDialog
          open={showPIXDialog}
          onOpenChange={setShowPIXDialog}
          conversationId={conversation.id}
          instanceId={conversation.instance_id}
          clientPhone={conversation.phone}
          clientName={conversation.contact_name || undefined}
          onSendMessage={onSendMessage}
        />
      )}
    </div>
  );
}
