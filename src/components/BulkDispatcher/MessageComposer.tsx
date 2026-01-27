import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  MessageSquare, Plus, Trash2, Bold, Italic, 
  Sparkles, Copy, Info, RefreshCw,
  Image, Video, FileAudio, FileText, Type, Loader2, Wand2, Shuffle, Zap
} from 'lucide-react';
import { generatePreview, validateSpintax, SPINTAX_SUGGESTIONS } from '@/lib/spintaxParser';
import { cn } from '@/lib/utils';
import { MediaUploader, MediaType } from './MediaUploader';
import { SpintaxManager } from './SpintaxManager';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  variations?: string[];
  mediaType?: MediaType;
  mediaUrl?: string;
  fileName?: string;
  mimetype?: string;
}

interface MessageComposerProps {
  messages: Message[];
  randomizeOrder: boolean;
  onMessagesChange: (messages: Message[]) => void;
  onRandomizeChange: (randomize: boolean) => void;
}

const VARIABLES = [
  { key: '{nome}', label: 'Nome completo', example: 'João Silva' },
  { key: '{primeiro_nome}', label: 'Primeiro nome', example: 'João' },
  { key: '{telefone}', label: 'Telefone', example: '5511999998888' },
  { key: '{plano}', label: 'Plano', example: 'Premium' },
  { key: '{vencimento}', label: 'Data vencimento', example: '15/02/2026' },
  { key: '{dias}', label: 'Dias até vencer', example: '3' },
  { key: '{link}', label: 'Link personalizado', example: 'https://...' },
];

type CopyType = 'copy' | 'anuncio' | 'lembrete' | 'promocao';
type ToneType = 'casual' | 'formal' | 'persuasivo' | 'urgente';

export function MessageComposer({
  messages,
  randomizeOrder,
  onMessagesChange,
  onRandomizeChange
}: MessageComposerProps) {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(
    messages[0]?.id || null
  );
  const [showPreview, setShowPreview] = useState(false);
  
  // AI Generation states
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiType, setAiType] = useState<CopyType>('copy');
  const [aiTone, setAiTone] = useState<ToneType>('persuasivo');
  const [includeVariables, setIncludeVariables] = useState(true);
  const [aiQuantity, setAiQuantity] = useState<number>(1);
  const [showSpintaxManager, setShowSpintaxManager] = useState(false);

  const addMessage = () => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      content: '',
      variations: [],
      mediaType: 'none',
      mediaUrl: undefined,
      fileName: undefined,
      mimetype: undefined
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
    onMessagesChange(
      messages.map(m => m.id === id ? { ...m, content } : m)
    );
  };

  const addVariation = (messageId: string) => {
    onMessagesChange(
      messages.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            variations: [...(m.variations || []), '']
          };
        }
        return m;
      })
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
      messages.map(m => {
        if (m.id === messageId && m.variations) {
          return {
            ...m,
            variations: m.variations.filter((_, i) => i !== index)
          };
        }
        return m;
      })
    );
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

  const insertSpintax = (suggestion: typeof SPINTAX_SUGGESTIONS[0]) => {
    const spintax = `{{ ${suggestion.key} : ${suggestion.options.join(' | ')} }}`;
    insertVariable(spintax);
  };

  const handleInsertSpintaxFromManager = (spintax: string) => {
    insertVariable(spintax);
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

  const updateMediaType = (messageId: string, mediaType: MediaType) => {
    onMessagesChange(
      messages.map(m => m.id === messageId ? { 
        ...m, 
        mediaType,
        // Clear media if switching back to none
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
      toast.error('Digite uma descrição do que deseja gerar');
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

      if (error) {
        console.error('Error generating copy:', error);
        toast.error('Erro ao gerar mensagem. Tente novamente.');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        const [principal, ...variacoes] = data.messages as string[];
        
        if (activeMessageId) {
          // Update existing message with content and variations
          onMessagesChange(
            messages.map(m => m.id === activeMessageId 
              ? { 
                  ...m, 
                  content: principal, 
                  variations: variacoes.length > 0 ? variacoes : m.variations 
                }
              : m
            )
          );
        } else {
          // Create new message with content and variations
          const newMessage: Message = {
            id: crypto.randomUUID(),
            content: principal,
            variations: variacoes,
            mediaType: 'none',
            mediaUrl: undefined,
            fileName: undefined,
            mimetype: undefined
          };
          onMessagesChange([...messages, newMessage]);
          setActiveMessageId(newMessage.id);
        }
        
        const totalCount = data.messages.length;
        toast.success(`${totalCount} ${totalCount === 1 ? 'mensagem gerada' : 'variações geradas'} com sucesso!`);
        setShowAiDialog(false);
        setAiPrompt('');
      }
    } catch (error) {
      console.error('Error calling generate-copy:', error);
      toast.error('Erro ao conectar com o serviço de IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeMessage = messages.find(m => m.id === activeMessageId);
  const validation = activeMessage ? validateSpintax(activeMessage.content) : { valid: true, errors: [] };
  const preview = activeMessage ? generatePreview(activeMessage.content) : '';

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="stats-icon-container accent">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg">Configuração de Mensagens</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Crie mensagens personalizadas
              </p>
            </div>
            <Badge className="bg-primary/20 text-primary border-primary/30">
              {messages.length} mensagem(ns)
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAiDialog(true)}
                className="gap-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 hover:border-primary/50"
              >
                <Wand2 className="w-4 h-4 text-primary" />
                Gerar com IA
              </Button>
            </motion.div>
            <Button variant="outline" size="sm" onClick={addMessage} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nova
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Variables Bar */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Variáveis Disponíveis</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {VARIABLES.map(v => (
              <motion.div key={v.key} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Badge
                  variant="outline"
                  className="cursor-pointer bg-background/60 hover:bg-primary/20 hover:border-primary/50 transition-all"
                  onClick={() => insertVariable(v.key)}
                >
                  {v.key}
                </Badge>
              </motion.div>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-foreground">
                  <Info className="w-3 h-3 mr-1" />
                  Ajuda
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-3">
                  <h4 className="font-semibold">Variáveis Disponíveis</h4>
                  <div className="space-y-2">
                    {VARIABLES.map(v => (
                      <div key={v.key} className="flex justify-between text-sm">
                        <code className="text-primary">{v.key}</code>
                        <span className="text-muted-foreground">{v.example}</span>
                      </div>
                    ))}
                  </div>
                  <h4 className="font-semibold pt-2">Spintax</h4>
                  <p className="text-sm text-muted-foreground">
                    Use para variações aleatórias:
                  </p>
                  <code className="text-xs block bg-muted p-2 rounded">
                    {"{{ saudacao : Olá | Oi | Hey }}"}
                  </code>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Spintax Suggestions */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Spintax:</span>
          {SPINTAX_SUGGESTIONS.slice(0, 3).map(s => (
            <Button
              key={s.key}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => insertSpintax(s)}
            >
              <Sparkles className="w-3 h-3 mr-1 text-primary" />
              {s.key}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowSpintaxManager(true)}
          >
            <Shuffle className="w-3.5 h-3.5" />
            Gerenciar KEYs
          </Button>
        </div>

        {/* Message Tabs */}
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {messages.map((msg, index) => (
                <motion.div 
                  key={msg.id} 
                  className="flex items-center gap-1 shrink-0"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <motion.button
                    onClick={() => setActiveMessageId(msg.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                      "border backdrop-blur-sm",
                      activeMessageId === msg.id 
                        ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]" 
                        : "bg-background/40 border-white/10 text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    Mensagem {index + 1}
                  </motion.button>
                  {messages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeMessage(msg.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Active Message Editor */}
        {activeMessage && (
          <div className="space-y-4">
            {/* Media Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm">Tipo de Conteúdo</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { type: 'none' as MediaType, icon: Type, label: 'Texto' },
                  { type: 'image' as MediaType, icon: Image, label: 'Imagem' },
                  { type: 'video' as MediaType, icon: Video, label: 'Vídeo' },
                  { type: 'audio' as MediaType, icon: FileAudio, label: 'Áudio' },
                  { type: 'document' as MediaType, icon: FileText, label: 'Documento' },
                ].map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant={(activeMessage.mediaType || 'none') === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateMediaType(activeMessage.id, type)}
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Media Uploader (if media type selected) */}
            {activeMessage.mediaType && activeMessage.mediaType !== 'none' && (
              <MediaUploader
                type={activeMessage.mediaType}
                currentUrl={activeMessage.mediaUrl}
                currentFilename={activeMessage.fileName}
                onUpload={(url, filename, mimetype) => 
                  handleMediaUpload(activeMessage.id, url, filename, mimetype)
                }
                onRemove={() => handleMediaRemove(activeMessage.id)}
              />
            )}

            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 w-fit">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => wrapWithFormat('bold')}
                title="Negrito (*texto*)"
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => wrapWithFormat('italic')}
                title="Itálico (_texto_)"
              >
                <Italic className="w-4 h-4" />
              </Button>
            </div>

            {/* Main Message / Caption */}
            <div className="space-y-2">
              <Label className="text-sm">
                {activeMessage.mediaType && activeMessage.mediaType !== 'none' 
                  ? 'Legenda (opcional)' 
                  : 'Mensagem Principal'}
              </Label>
              <Textarea
                data-message-id={activeMessage.id}
                value={activeMessage.content}
                onChange={(e) => updateMessage(activeMessage.id, e.target.value)}
                onFocus={() => setActiveMessageId(activeMessage.id)}
                placeholder={
                  activeMessage.mediaType && activeMessage.mediaType !== 'none'
                    ? "Digite uma legenda para a mídia..."
                    : "Digite sua mensagem aqui... Use {nome} para variáveis e {{ key : opção1 | opção2 }} para Spintax"
                }
                className="min-h-[120px] font-mono text-sm"
              />
              {!validation.valid && (
                <div className="text-sm text-destructive">
                  {validation.errors.map((err, i) => (
                    <p key={i}>⚠️ {err}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Variations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Variações</Label>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Anti-bloqueio
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addVariation(activeMessage.id)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Variação
                </Button>
              </div>

              {activeMessage.variations && activeMessage.variations.length > 0 ? (
                <div className="grid gap-3">
                  {activeMessage.variations.map((variation, index) => (
                    <div 
                      key={index} 
                      className="group relative rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 p-3 transition-all hover:border-primary/30 hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Textarea
                            value={variation}
                            onChange={(e) => updateVariation(activeMessage.id, index, e.target.value)}
                            placeholder={`Escreva a variação ${index + 1} da mensagem...`}
                            className="min-h-[70px] resize-none border-0 bg-transparent p-0 font-mono text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVariation(activeMessage.id, index)}
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Copy className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Adicione variações para evitar bloqueios
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    O sistema alternará entre as mensagens automaticamente
                  </p>
                </div>
              )}
              
              {activeMessage.variations && activeMessage.variations.length > 0 && (
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
                  <Info className="w-3 h-3" />
                  As variações serão usadas aleatoriamente durante o disparo
                </p>
              )}
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Preview</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {showPreview ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              {showPreview && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-sm whitespace-pre-wrap">{preview || 'Digite uma mensagem para ver o preview'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma mensagem configurada</p>
            <Button variant="outline" className="mt-3" onClick={addMessage}>
              <Plus className="w-4 h-4 mr-1" />
              Criar Primeira Mensagem
            </Button>
          </div>
        )}

        {/* Footer Options */}
        {messages.length > 1 && (
          <div className="flex items-center gap-3 pt-4 border-t border-border/50">
            <Switch
              id="randomize"
              checked={randomizeOrder}
              onCheckedChange={onRandomizeChange}
            />
            <Label htmlFor="randomize" className="text-sm">
              Randomizar ordem das mensagens
            </Label>
          </div>
        )}
      </CardContent>

      {/* AI Generation Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Gerar Mensagem com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o que você quer criar e a IA irá gerar uma mensagem otimizada para WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descreva o que você quer criar</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex: Anúncio de promoção de internet fibra 300MB por R$99,90 com instalação grátis"
                rows={3}
                className="resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Tipo de Mensagem</Label>
                <Select value={aiType} onValueChange={(v) => setAiType(v as CopyType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="copy">Copy Geral</SelectItem>
                    <SelectItem value="anuncio">Anúncio</SelectItem>
                    <SelectItem value="lembrete">Lembrete</SelectItem>
                    <SelectItem value="promocao">Promoção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Tom da Mensagem</Label>
                <Select value={aiTone} onValueChange={(v) => setAiTone(v as ToneType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="persuasivo">Persuasivo</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Quantidade de Variações</Label>
              <Select 
                value={aiQuantity.toString()} 
                onValueChange={(v) => setAiQuantity(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mensagem</SelectItem>
                  <SelectItem value="2">2 variações</SelectItem>
                  <SelectItem value="3">3 variações</SelectItem>
                  <SelectItem value="4">4 variações</SelectItem>
                  <SelectItem value="5">5 variações</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Múltiplas variações ajudam a evitar bloqueios do WhatsApp
              </p>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Checkbox 
                id="includeVars"
                checked={includeVariables}
                onCheckedChange={(checked) => setIncludeVariables(checked === true)}
              />
              <Label htmlFor="includeVars" className="text-sm cursor-pointer">
                Incluir variáveis personalizadas ({'{nome}'}, {'{plano}'}, etc.)
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerateWithAI}
              disabled={isGenerating || !aiPrompt.trim()}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar Mensagem
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spintax Manager Dialog */}
      <SpintaxManager 
        open={showSpintaxManager} 
        onOpenChange={setShowSpintaxManager}
        onInsertSpintax={handleInsertSpintaxFromManager}
      />
    </Card>
  );
}
