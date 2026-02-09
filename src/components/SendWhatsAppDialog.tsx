import { useMemo, useState } from 'react';
import { Client, getDaysUntilExpiration, planLabels } from '@/types/client';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Send, Smartphone, User, Loader2, FileText, Star, Plus, Trash2, Edit3, Save, QrCode, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWhatsAppTemplates, WhatsAppTemplate } from '@/hooks/useWhatsAppTemplates';

const PIX_KEY = '91980910280';
const PIX_KEY_FORMATTED = '(91) 98091-0280';

interface SendWhatsAppDialogProps {
  client: Client | null;
  instances: WhatsAppInstance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendWhatsAppDialog({ client, instances, open, onOpenChange }: SendWhatsAppDialogProps) {
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'predefined' | 'custom' | 'edit'>('predefined');

  // Custom templates
  const { templates: customTemplates, isLoading: isLoadingTemplates, createTemplate, updateTemplate, deleteTemplate } = useWhatsAppTemplates();
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const connectedInstances = instances.filter(i => i.status === 'connected');

  const predefinedTemplates = useMemo(() => {
    if (!client) return [];

    const days = getDaysUntilExpiration(client.expiresAt);
    const expiresAtStr = client.expiresAt.toLocaleDateString('pt-BR');
    const planLabel = planLabels[client.plan] ?? client.plan;
    const priceStr = client.price != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.price)
      : '';
    return [
      {
        id: 'expiring',
        label: '⏰ Aviso: vai expirar',
        value:
          `Olá ${client.name}! Tudo bem? 🙂\n` +
          `Seu plano *${planLabel}* vence em *${expiresAtStr}* (${days} dia(s)).\n` +
          `Posso gerar sua renovação agora para você não ficar sem acesso?`,
      },
      {
        id: 'expired',
        label: '🔴 Expirado: renovar agora',
        value:
          `Olá ${client.name}!\n` +
          `Seu acesso *venceu em ${expiresAtStr}*.\n` +
          `Se quiser, eu já faço sua renovação agora pra liberar novamente.`,
      },
      {
        id: 'renew_short',
        label: '🔄 Renovação (curta)',
        value:
          `Oi ${client.name}! Sua renovação está disponível. Quer renovar agora?`,
      },
      {
        id: 'renew_with_price',
        label: '💰 Renovação (com valor)',
        value:
          `Olá ${client.name}!\n` +
          `Renovação do plano *${planLabel}*${priceStr ? ` por *${priceStr}*` : ''}.\n` +
          `Quer que eu envie o pagamento para renovar?`,
      },
      {
        id: 'pix_payment',
        label: '💲 Cobrança PIX',
        value:
          `Olá ${client.name}! 🙂\n\n` +
          `💰 *Pagamento via PIX*\n` +
          `Plano: *${planLabel}*\n` +
          (priceStr ? `Valor: *${priceStr}*\n` : '') +
          `\n📲 *Chave PIX (Celular):*\n` +
          `*${PIX_KEY_FORMATTED}*\n\n` +
          `_Faça o PIX e envie o comprovante aqui._\n\n` +
          `⚠️ Após confirmação, seu acesso será liberado!`,
      },
      {
        id: 'pix_renewal',
        label: '💲 Renovação + PIX',
        value:
          `Olá ${client.name}!\n\n` +
          `Seu plano *${planLabel}* vence em *${expiresAtStr}*.\n` +
          (priceStr ? `Valor para renovação: *${priceStr}*\n\n` : '\n') +
          `📲 *Renove agora via PIX:*\n` +
          `Chave PIX (Celular): *${PIX_KEY_FORMATTED}*\n\n` +
          `✅ Envie o comprovante aqui e seu acesso será renovado imediatamente!`,
      },
    ];
  }, [client]);

  const replaceVariables = (content: string) => {
    if (!client) return content;

    const days = getDaysUntilExpiration(client.expiresAt);
    const expiresAtStr = client.expiresAt.toLocaleDateString('pt-BR');
    const planLabel = planLabels[client.plan] ?? client.plan;
    const priceStr = client.price != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.price)
      : '';

    return content
      .replace(/{nome}/g, client.name)
      .replace(/{plano}/g, planLabel)
      .replace(/{vencimento}/g, expiresAtStr)
      .replace(/{dias}/g, String(days))
      .replace(/{valor}/g, priceStr)
      .replace(/{whatsapp}/g, client.whatsapp)
      .replace(/{email}/g, client.email || '')
      .replace(/{usuario}/g, client.serviceUsername || '')
      .replace(/{senha}/g, client.servicePassword || '')
      .replace(/{pix_chave}/g, PIX_KEY_FORMATTED)
      .replace(/{pix_numero}/g, PIX_KEY);
  };

  const applyPredefinedTemplate = (templateId: string) => {
    const tpl = predefinedTemplates.find(t => t.id === templateId);
    if (tpl) {
      setMessage(tpl.value);
      setActiveTab('edit');
    }
  };

  const applyCustomTemplate = (template: WhatsAppTemplate) => {
    setMessage(replaceVariables(template.content));
    setActiveTab('edit');
  };

  const resetTemplateForm = () => {
    setIsCreatingTemplate(false);
    setEditingTemplateId(null);
    setNewTemplateName('');
    setNewTemplateContent('');
  };

  const handleSaveAsTemplate = () => {
    if (!message.trim()) {
      toast.error('Escreva uma mensagem antes de salvar');
      return;
    }
    setNewTemplateContent(message);
    setNewTemplateName('');
    setIsCreatingTemplate(true);
    setActiveTab('custom');
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Digite um nome para o template');
      return;
    }
    const success = await createTemplate(newTemplateName, newTemplateContent);
    if (success) resetTemplateForm();
  };

  const handleEditTemplate = (template: WhatsAppTemplate) => {
    setEditingTemplateId(template.id);
    setNewTemplateName(template.subject || '');
    setNewTemplateContent(template.content);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId) return;
    const success = await updateTemplate(editingTemplateId, newTemplateName, newTemplateContent);
    if (success) resetTemplateForm();
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    await deleteTemplate(templateToDelete);
    setDeleteConfirmOpen(false);
    setTemplateToDelete(null);
  };

  const handleSend = async () => {
    if (!client || !selectedInstance || !message.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSending(true);
    const messageToSend = message.trim();
    setMessage('');

    try {
      const instance = instances.find(i => i.id === selectedInstance);
      if (!instance?.instance_key) {
        throw new Error('Instância não configurada');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-uazapi', {
        body: {
          instanceKey: instance.instance_key,
          phone: client.whatsapp.replace(/\D/g, ''),
          message: messageToSend,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Mensagem enviada com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessage(prev => prev || messageToSend);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage('');
      setSelectedInstance('');
      setActiveTab('predefined');
      resetTemplateForm();
      onOpenChange(false);
    }
  };

  if (!client) return null;

  const messageVariables = [
    { key: '{nome}', label: 'Nome' },
    { key: '{plano}', label: 'Plano' },
    { key: '{vencimento}', label: 'Vencimento' },
    { key: '{dias}', label: 'Dias' },
    { key: '{valor}', label: 'Valor' },
    { key: '{pix_chave}', label: 'PIX Chave' },
    { key: '{usuario}', label: 'Usuário' },
    { key: '{senha}', label: 'Senha' },
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleClose();
            return;
          }
          onOpenChange(true);
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Enviar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem direta para o cliente
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-2">
            {/* Client Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{client.name}</p>
                <p className="text-sm text-muted-foreground">{client.whatsapp}</p>
              </div>
            </div>

            {/* Instance Selection */}
            <div className="space-y-2">
              <Label>Instância WhatsApp</Label>
              {connectedInstances.length === 0 ? (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                  Nenhuma instância conectada. Configure uma instância primeiro.
                </div>
              ) : (
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map(instance => (
                      <SelectItem key={instance.id} value={instance.id}>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span>{instance.instance_name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            Online
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Templates Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="predefined" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Padrões
                </TabsTrigger>
                <TabsTrigger value="custom" className="gap-1.5 text-xs">
                  <Star className="h-3.5 w-3.5" />
                  Meus
                  {customTemplates.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {customTemplates.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="edit" className="gap-1.5 text-xs">
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </TabsTrigger>
              </TabsList>

              {/* Predefined Templates */}
              <TabsContent value="predefined" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-[220px]">
                  <div className="grid gap-2 pr-2">
                    {predefinedTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => applyPredefinedTemplate(tpl.id)}
                        className="w-full text-left p-3 rounded-lg border border-border/50 bg-background hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <p className="font-medium text-sm">{tpl.label}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {tpl.value.slice(0, 100)}...
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Custom Templates */}
              <TabsContent value="custom" className="flex-1 overflow-hidden flex flex-col mt-3">
                {isCreatingTemplate || editingTemplateId ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Nome do Template</Label>
                      <Input
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Ex: Cobrança PIX mensal"
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Conteúdo</Label>
                      <Textarea
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        placeholder="Digite a mensagem do template..."
                        className="min-h-[120px] resize-none"
                        maxLength={5000}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {messageVariables.map((v) => (
                        <Badge
                          key={v.key}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 transition-colors text-[10px]"
                          onClick={() => setNewTemplateContent(prev => prev + v.key)}
                        >
                          {v.key}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetTemplateForm} className="flex-1" size="sm">
                        Cancelar
                      </Button>
                      <Button
                        onClick={editingTemplateId ? handleUpdateTemplate : handleCreateTemplate}
                        className="flex-1 gap-1.5"
                        size="sm"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {editingTemplateId ? 'Atualizar' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full gap-2 mb-3 border-dashed"
                      size="sm"
                      onClick={() => setIsCreatingTemplate(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Criar Novo Template
                    </Button>

                    <ScrollArea className="h-[180px]">
                      {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : customTemplates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhum template salvo</p>
                          <p className="text-xs">Crie templates personalizados com variáveis e PIX!</p>
                        </div>
                      ) : (
                        <div className="grid gap-2 pr-2">
                          {customTemplates.map((template) => (
                            <div
                              key={template.id}
                              className="p-3 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-all"
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{template.subject || 'Sem nome'}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {template.content.slice(0, 80)}...
                                  </p>
                                </div>
                                <div className="flex gap-0.5 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => applyCustomTemplate(template)}
                                    title="Usar template"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleEditTemplate(template)}
                                    title="Editar"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setTemplateToDelete(template.id);
                                      setDeleteConfirmOpen(true);
                                    }}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              {/* Edit & Send */}
              <TabsContent value="edit" className="flex-1 overflow-hidden flex flex-col mt-3 space-y-3">
                <div className="space-y-1.5 flex-1 flex flex-col">
                  <Label>Mensagem</Label>
                  <Textarea
                    placeholder="Digite sua mensagem ou escolha um template..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 min-h-[150px] resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleSaveAsTemplate}
                    disabled={!message.trim()}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Salvar como Template
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {message.length} caracteres
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {messageVariables.map((v) => (
                    <Badge
                      key={v.key}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 transition-colors text-[10px]"
                      onClick={() => setMessage(prev => prev + v.key)}
                    >
                      {v.key} <span className="opacity-50 ml-0.5">{v.label}</span>
                    </Badge>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isSending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !selectedInstance || !message.trim() || connectedInstances.length === 0}
              className="gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
