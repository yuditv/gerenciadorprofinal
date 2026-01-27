import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  MessageSquare, Plus, Trash2, Bold, Italic, 
  Sparkles, Wand2, Shuffle, Zap, Loader2,
  Image, Video, FileAudio, FileText, Type, File, Copy,
  SquareStack, GalleryHorizontal
} from 'lucide-react';
import { generatePreview, validateSpintax, SPINTAX_SUGGESTIONS } from '@/lib/spintaxParser';
import { cn } from '@/lib/utils';
import { MediaUploader, MediaType } from './MediaUploader';
import { SpintaxManager } from './SpintaxManager';
import { InteractiveMenuComposer } from '@/components/Inbox/InteractiveMenuComposer';
import { MediaCarouselComposer } from '@/components/Inbox/MediaCarouselComposer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const WHATSAPP_TEMPLATES = [
  {
    id: 'renewal-reminder',
    name: '🔄 Lembrete de Renovação',
    content: `Olá {nome}! 👋

Passando para lembrar que seu plano {plano} vence em {vencimento}.

Para continuar aproveitando todos os benefícios sem interrupção, renove seu plano o quanto antes!

Aguardamos seu contato! 😊`,
  },
  {
    id: 'expiration-warning',
    name: '⚠️ Aviso de Vencimento',
    content: `Olá {nome}!

Seu plano {plano} vence em {vencimento}.

Não deixe para última hora! Renove agora e evite interrupções.

✓ Acesso ininterrupto
✓ Suporte prioritário

Aguardamos seu contato!`,
  },
  {
    id: 'expired',
    name: '🔴 Plano Expirado',
    content: `Olá {nome}!

Notamos que seu plano {plano} expirou em {vencimento}.

Sentimos sua falta! Para reativar seu acesso, entre em contato conosco.

Estamos prontos para ajudá-lo! 🤝`,
  },
  {
    id: 'welcome',
    name: '👋 Boas-vindas',
    content: `Olá {nome}! 🎉

Seja muito bem-vindo(a)!

Seu plano {plano} já está ativo e você tem acesso completo até {vencimento}.

Se precisar de ajuda, estamos à disposição!

Atenciosamente,
Equipe de Suporte`,
  },
  {
    id: 'credentials',
    name: '🔑 Enviar Credenciais',
    content: `Olá {nome}!

Seguem suas credenciais de acesso:

📱 Usuário: {usuario}
🔐 Senha: {senha}

Se tiver dúvidas, estamos à disposição!`,
  },
  {
    id: 'promotion',
    name: '🎁 Promoção',
    content: `Olá {nome}! 🎁

Temos uma oferta especial para você!

🔥 Renove agora e ganhe desconto exclusivo!

Válido por tempo limitado. Aproveite!`,
  },
];

interface Message {
  id: string;
  content: string;
  variations?: string[];
  mediaType?: MediaType;
  mediaUrl?: string;
  fileName?: string;
  mimetype?: string;
}

interface ComposerStudioProps {
  messages: Message[];
  randomizeOrder: boolean;
  onMessagesChange: (messages: Message[]) => void;
  onRandomizeChange: (randomize: boolean) => void;
}

const VARIABLES = [
  { key: '{nome}', label: 'Nome', example: 'João Silva' },
  { key: '{primeiro_nome}', label: 'Primeiro nome', example: 'João' },
  { key: '{telefone}', label: 'Telefone', example: '5511999998888' },
  { key: '{plano}', label: 'Plano', example: 'Premium' },
  { key: '{vencimento}', label: 'Vencimento', example: '15/02/2026' },
  { key: '{dias}', label: 'Dias', example: '3' },
  { key: '{link}', label: 'Link', example: 'https://...' },
];

type CopyType = 'copy' | 'anuncio' | 'lembrete' | 'promocao';
type ToneType = 'casual' | 'formal' | 'persuasivo' | 'urgente';

export function ComposerStudio({
  messages,
  randomizeOrder,
  onMessagesChange,
  onRandomizeChange
}: ComposerStudioProps) {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(messages[0]?.id || null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiType, setAiType] = useState<CopyType>('copy');
  const [aiTone, setAiTone] = useState<ToneType>('persuasivo');
  const [includeVariables, setIncludeVariables] = useState(true);
  const [aiQuantity, setAiQuantity] = useState<number>(1);
  const [showSpintaxManager, setShowSpintaxManager] = useState(false);
  const [showInteractiveMenu, setShowInteractiveMenu] = useState(false);
  const [showMediaCarousel, setShowMediaCarousel] = useState(false);

  const addMessage = () => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      content: '',
      variations: [],
      mediaType: 'none',
    };
    onMessagesChange([...messages, newMessage]);
    setActiveMessageId(newMessage.id);
  };

  const removeMessage = (id: string) => {
    const updated = messages.filter(m => m.id !== id);
    onMessagesChange(updated);
    if (activeMessageId === id) {
      setActiveMessageId(updated[0]?.id || null);
    }
  };

  const updateMessage = (id: string, content: string) => {
    onMessagesChange(messages.map(m => m.id === id ? { ...m, content } : m));
  };

  const insertVariable = (variable: string) => {
    if (!activeMessageId) return;
    
    const textarea = document.querySelector(`textarea[data-message-id="${activeMessageId}"]`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentMessage = messages.find(m => m.id === activeMessageId);
    if (!currentMessage) return;

    const newContent = 
      currentMessage.content.slice(0, start) + 
      variable + 
      currentMessage.content.slice(end);
    
    updateMessage(activeMessageId, newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const wrapWithFormat = (format: 'bold' | 'italic') => {
    if (!activeMessageId) return;
    
    const textarea = document.querySelector(`textarea[data-message-id="${activeMessageId}"]`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentMessage = messages.find(m => m.id === activeMessageId);
    if (!currentMessage) return;

    const selectedText = currentMessage.content.slice(start, end);
    const wrapper = format === 'bold' ? '*' : '_';
    const newText = `${wrapper}${selectedText}${wrapper}`;
    
    const newContent = 
      currentMessage.content.slice(0, start) + 
      newText + 
      currentMessage.content.slice(end);
    
    updateMessage(activeMessageId, newContent);
  };

  // Variation management functions
  const addVariation = (messageId: string) => {
    onMessagesChange(
      messages.map(m => m.id === messageId 
        ? { ...m, variations: [...(m.variations || []), ''] }
        : m
      )
    );
  };

  const updateVariation = (messageId: string, index: number, content: string) => {
    onMessagesChange(
      messages.map(m => {
        if (m.id === messageId && m.variations) {
          const newVariations = [...m.variations];
          newVariations[index] = content;
          return { ...m, variations: newVariations };
        }
        return m;
      })
    );
  };

  const removeVariation = (messageId: string, index: number) => {
    onMessagesChange(
      messages.map(m => m.id === messageId && m.variations
        ? { ...m, variations: m.variations.filter((_, i) => i !== index) }
        : m
      )
    );
  };

  const applyTemplate = (template: typeof WHATSAPP_TEMPLATES[0]) => {
    if (activeMessageId) {
      updateMessage(activeMessageId, template.content);
    } else {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        content: template.content,
        variations: [],
        mediaType: 'none',
      };
      onMessagesChange([...messages, newMessage]);
      setActiveMessageId(newMessage.id);
    }
    toast.success(`Template "${template.name}" aplicado!`);
  };

  const updateMediaType = (messageId: string, mediaType: MediaType) => {
    onMessagesChange(
      messages.map(m => m.id === messageId ? { 
        ...m, 
        mediaType,
        ...(mediaType === 'none' ? { mediaUrl: undefined, fileName: undefined, mimetype: undefined } : {})
      } : m)
    );
  };

  const handleMediaUpload = (messageId: string, url: string, filename: string, mimetype: string) => {
    onMessagesChange(
      messages.map(m => m.id === messageId ? { 
        ...m, 
        mediaUrl: url,
        fileName: filename,
        mimetype
      } : m)
    );
  };

  const handleMediaRemove = (messageId: string) => {
    onMessagesChange(
      messages.map(m => m.id === messageId ? { 
        ...m, 
        mediaUrl: undefined,
        fileName: undefined,
        mimetype: undefined
      } : m)
    );
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Digite uma descrição');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-copy', {
        body: {
          prompt: aiPrompt,
          type: aiType,
          tone: aiTone,
          includeVariables,
          quantity: aiQuantity
        }
      });

      if (error || data?.error) {
        toast.error('Erro ao gerar mensagem');
        return;
      }

      if (data?.messages?.length > 0) {
        const [principal, ...variacoes] = data.messages as string[];
        
        if (activeMessageId) {
          onMessagesChange(
            messages.map(m => m.id === activeMessageId 
              ? { ...m, content: principal, variations: variacoes.length > 0 ? variacoes : m.variations }
              : m
            )
          );
        } else {
          const newMessage: Message = {
            id: crypto.randomUUID(),
            content: principal,
            variations: variacoes,
            mediaType: 'none',
          };
          onMessagesChange([...messages, newMessage]);
          setActiveMessageId(newMessage.id);
        }
        
        toast.success(`${data.messages.length} variações geradas!`);
        setShowAiDialog(false);
        setAiPrompt('');
      }
    } catch (error) {
      toast.error('Erro ao conectar com IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeMessage = messages.find(m => m.id === activeMessageId);
  const validation = activeMessage ? validateSpintax(activeMessage.content) : { valid: true, errors: [] };

  return (
    <div className="composer-studio">
      {/* Header */}
      <div className="composer-header">
        <div className="flex items-center gap-3">
          <div className="stats-icon-container accent p-2">
            <MessageSquare className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold">Editor de Mensagens</h3>
            <p className="text-xs text-muted-foreground">{messages.length} mensagem(ns)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <File className="w-4 h-4" />
                Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b border-border/50">
                <h4 className="font-medium text-sm">Templates Prontos</h4>
                <p className="text-xs text-muted-foreground">Selecione para aplicar</p>
              </div>
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-1">
                  {WHATSAPP_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{template.content.slice(0, 50)}...</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          
          {/* Interactive Menu Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5"
            onClick={() => setShowInteractiveMenu(true)}
          >
            <SquareStack className="w-4 h-4" />
            Menu
          </Button>
          
          {/* Media Carousel Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5"
            onClick={() => setShowMediaCarousel(true)}
          >
            <GalleryHorizontal className="w-4 h-4" />
            Carrossel
          </Button>
          
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAiDialog(true)}
              className="gap-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30"
            >
              <Wand2 className="w-4 h-4 text-primary" />
              IA
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="composer-content">
        {/* Variables Bar */}
        <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border border-border/30">
          <span className="text-xs text-muted-foreground mr-2 flex items-center">
            <Zap className="w-3 h-3 mr-1 text-primary" />
            Variáveis:
          </span>
          {VARIABLES.map(v => (
            <motion.button
              key={v.key}
              onClick={() => insertVariable(v.key)}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              className="variable-chip"
            >
              {v.key}
            </motion.button>
          ))}
        </div>

        {/* Message Tabs */}
        {messages.length > 0 && (
          <div className="message-tabs-container">
            <AnimatePresence mode="popLayout">
              {messages.map((msg, index) => (
                <motion.div 
                  key={msg.id} 
                  className="flex items-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <div
                    onClick={() => setActiveMessageId(msg.id)}
                    className={cn(
                      "message-tab",
                      activeMessageId === msg.id && "active"
                    )}
                  >
                    Msg {index + 1}
                  </div>
                  {messages.length > 1 && activeMessageId === msg.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 ml-1 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeMessage(msg.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 ml-auto"
              onClick={addMessage}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Active Message Editor */}
        {activeMessage ? (
          <div className="space-y-4">
            {/* Media Type Selector */}
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'none' as MediaType, icon: Type, label: 'Texto' },
                { type: 'image' as MediaType, icon: Image, label: 'Imagem' },
                { type: 'video' as MediaType, icon: Video, label: 'Vídeo' },
                { type: 'audio' as MediaType, icon: FileAudio, label: 'Áudio' },
                { type: 'document' as MediaType, icon: FileText, label: 'Doc' },
              ].map(({ type, icon: Icon, label }) => (
                <Button
                  key={type}
                  variant={activeMessage.mediaType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateMediaType(activeMessage.id, type)}
                  className={cn(
                    "gap-1.5",
                    activeMessage.mediaType === type && "bg-primary/20 text-primary border-primary/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Media Uploader */}
            {activeMessage.mediaType && activeMessage.mediaType !== 'none' && (
              <MediaUploader
                type={activeMessage.mediaType}
                currentUrl={activeMessage.mediaUrl}
                currentFilename={activeMessage.fileName}
                onUpload={(url, filename, mimetype) => handleMediaUpload(activeMessage.id, url, filename, mimetype)}
                onRemove={() => handleMediaRemove(activeMessage.id)}
              />
            )}

            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => wrapWithFormat('bold')}>
                <Bold className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => wrapWithFormat('italic')}>
                <Italic className="w-4 h-4" />
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShowSpintaxManager(true)}
              >
                <Shuffle className="w-3 h-3" />
                Spintax
              </Button>
            </div>

            {/* Main Textarea */}
            <Textarea
              data-message-id={activeMessage.id}
              value={activeMessage.content}
              onChange={(e) => updateMessage(activeMessage.id, e.target.value)}
              placeholder="Digite sua mensagem aqui...

Use variáveis como {nome} para personalizar.
Use spintax {{ opção1 | opção2 }} para variações."
              className="composer-textarea min-h-[200px]"
            />

            {/* Validation */}
            {!validation.valid && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                {validation.errors.map((err, i) => (
                  <div key={i}>⚠️ {err}</div>
                ))}
              </div>
            )}

            {/* Variations Section */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Variações</Label>
                  <Badge className="text-xs bg-primary/10 text-primary border-0">Anti-bloqueio</Badge>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => addVariation(activeMessage.id)}
                  className="gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  Nova Variação
                </Button>
              </div>
              
              {activeMessage.variations && activeMessage.variations.length > 0 ? (
                <div className="space-y-2">
                  {activeMessage.variations.map((variation, index) => (
                    <motion.div 
                      key={index} 
                      className="relative group"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="absolute left-3 top-3 z-10">
                        <Badge variant="outline" className="text-xs bg-background">
                          V{index + 1}
                        </Badge>
                      </div>
                      <Textarea
                        value={variation}
                        onChange={(e) => updateVariation(activeMessage.id, index, e.target.value)}
                        placeholder={`Variação ${index + 1}...`}
                        className="pl-14 pr-10 min-h-[80px] resize-none bg-muted/30 border-border/50"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => removeVariation(activeMessage.id, index)}
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                  Adicione variações para evitar bloqueios ao enviar mensagens em massa
                </p>
              )}
            </div>

            {/* Randomize Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="randomize" className="text-sm cursor-pointer">
                  Randomizar ordem das mensagens
                </Label>
              </div>
              <Switch
                id="randomize"
                checked={randomizeOrder}
                onCheckedChange={onRandomizeChange}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-2">Nenhuma mensagem</p>
            <p className="text-sm text-muted-foreground mb-4">Crie sua primeira mensagem</p>
            <Button onClick={addMessage} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Mensagem
            </Button>
          </div>
        )}
      </div>

      {/* AI Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Gerar com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o que deseja e a IA criará a mensagem
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Mensagem de lembrete de pagamento amigável..."
              className="min-h-[100px]"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Tipo</Label>
                <Select value={aiType} onValueChange={(v) => setAiType(v as CopyType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="copy">Copy</SelectItem>
                    <SelectItem value="anuncio">Anúncio</SelectItem>
                    <SelectItem value="lembrete">Lembrete</SelectItem>
                    <SelectItem value="promocao">Promoção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Tom</Label>
                <Select value={aiTone} onValueChange={(v) => setAiTone(v as ToneType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="persuasivo">Persuasivo</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Incluir variáveis</Label>
              <Switch checked={includeVariables} onCheckedChange={setIncludeVariables} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>Cancelar</Button>
            <Button onClick={handleGenerateWithAI} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spintax Manager */}
      {showSpintaxManager && (
        <SpintaxManager
          open={showSpintaxManager}
          onOpenChange={setShowSpintaxManager}
          onInsertSpintax={insertVariable}
        />
      )}

      {/* Interactive Menu Composer */}
      <InteractiveMenuComposer
        open={showInteractiveMenu}
        onOpenChange={setShowInteractiveMenu}
        composeMode={true}
        onCompose={(data) => {
          // Formata o menu para inserir como mensagem especial
          const menuText = `[MENU:${data.menuType.toUpperCase()}]\n${data.text}\n\nOpções: ${data.choices.join(' | ')}${data.footerText ? `\n\n${data.footerText}` : ''}`;
          if (activeMessageId) {
            updateMessage(activeMessageId, menuText);
          } else {
            const newMessage: Message = {
              id: crypto.randomUUID(),
              content: menuText,
              variations: [],
              mediaType: 'none',
            };
            onMessagesChange([...messages, newMessage]);
            setActiveMessageId(newMessage.id);
          }
          toast.success('Menu interativo adicionado à mensagem!');
        }}
      />

      {/* Media Carousel Composer */}
      <MediaCarouselComposer
        open={showMediaCarousel}
        onOpenChange={setShowMediaCarousel}
        composeMode={true}
        onCompose={(data) => {
          // Formata o carrossel para inserir como mensagem especial
          const carouselText = `[CARROSSEL:${data.carousel.length} CARDS]\n${data.text}\n\n${data.carousel.map((card, i) => `Card ${i + 1}: ${card.text}`).join('\n')}`;
          if (activeMessageId) {
            updateMessage(activeMessageId, carouselText);
          } else {
            const newMessage: Message = {
              id: crypto.randomUUID(),
              content: carouselText,
              variations: [],
              mediaType: 'none',
            };
            onMessagesChange([...messages, newMessage]);
            setActiveMessageId(newMessage.id);
          }
          toast.success('Carrossel adicionado à mensagem!');
        }}
      />
    </div>
  );
}
