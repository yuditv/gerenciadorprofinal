import { useState, useEffect } from 'react';
import { Client } from '@/types/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { Mail, Send, Loader2, FileText, Edit3, Plus, Trash2, Save, Star } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { emailTemplates, EmailTemplate, replaceTemplateVariables, getTemplatesByCategory } from '@/lib/emailTemplates';
import { useEmailTemplates, CustomEmailTemplate } from '@/hooks/useEmailTemplates';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function SendEmailDialog({ open, onOpenChange, client }: SendEmailDialogProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | CustomEmailTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'custom' | 'preview'>('templates');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Custom template state
  const { templates: customTemplates, isLoading: isLoadingTemplates, createTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSubject('');
      setMessage('');
      setSelectedTemplate(null);
      setActiveTab('templates');
      setCategoryFilter('all');
      resetTemplateForm();
    }
  }, [open]);

  const resetTemplateForm = () => {
    setIsCreatingTemplate(false);
    setEditingTemplateId(null);
    setNewTemplateName('');
    setNewTemplateSubject('');
    setNewTemplateContent('');
  };

  const handleSelectPredefinedTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    if (client && template.id !== 'custom') {
      setSubject(replaceTemplateVariables(template.subject, client));
      setMessage(replaceTemplateVariables(template.body, client));
    } else {
      setSubject(template.subject);
      setMessage(template.body);
    }
    setActiveTab('preview');
  };

  const handleSelectCustomTemplate = (template: CustomEmailTemplate) => {
    setSelectedTemplate(template);
    if (client) {
      setSubject(replaceTemplateVariables(template.subject || '', client));
      setMessage(replaceTemplateVariables(template.content, client));
    } else {
      setSubject(template.subject || '');
      setMessage(template.content);
    }
    setActiveTab('preview');
  };

  const handleSaveAsTemplate = async () => {
    if (!subject.trim() && !message.trim()) {
      toast.error('Preencha o assunto ou mensagem antes de salvar');
      return;
    }
    
    setNewTemplateSubject(subject);
    setNewTemplateContent(message);
    setIsCreatingTemplate(true);
    setActiveTab('custom');
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Digite um nome para o template');
      return;
    }

    const result = await createTemplate({
      template_type: newTemplateName,
      subject: newTemplateSubject,
      content: newTemplateContent,
    });

    if (result) {
      resetTemplateForm();
    }
  };

  const handleEditTemplate = (template: CustomEmailTemplate) => {
    setEditingTemplateId(template.id);
    setNewTemplateName(template.template_type);
    setNewTemplateSubject(template.subject || '');
    setNewTemplateContent(template.content);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId) return;

    const result = await updateTemplate(editingTemplateId, {
      template_type: newTemplateName,
      subject: newTemplateSubject,
      content: newTemplateContent,
    });

    if (result) {
      resetTemplateForm();
    }
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    
    await deleteTemplate(templateToDelete);
    setDeleteConfirmOpen(false);
    setTemplateToDelete(null);
  };

  const handleSend = async () => {
    if (!client?.email) {
      toast.error('Cliente não possui email cadastrado');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      toast.error('Preencha o assunto e a mensagem');
      return;
    }

    setIsSending(true);

    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="margin: 20px 0; white-space: pre-wrap; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Este email foi enviado automaticamente.</p>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: client.email,
          subject: subject,
          html: htmlContent,
        },
      });

      if (error) throw error;

      toast.success(`Email enviado para ${client.name}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error('Erro ao enviar email: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      onOpenChange(false);
    }
  };

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'welcome', label: 'Boas-vindas' },
    { id: 'renewal', label: 'Renovação' },
    { id: 'expiration', label: 'Vencimento' },
    { id: 'custom', label: 'Outros' },
  ];

  const filteredTemplates = getTemplatesByCategory(categoryFilter);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Enviar Email
            </DialogTitle>
          </DialogHeader>

          {client && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Client Info */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 mb-4">
                <p className="text-sm font-medium">{client.name}</p>
                <p className="text-xs text-muted-foreground">{client.email || 'Sem email cadastrado'}</p>
              </div>

              {!client.email ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Este cliente não possui email cadastrado.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Edite o cliente para adicionar um email.
                  </p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'custom' | 'preview')} className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="templates" className="gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Padrões</span>
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="gap-2">
                      <Star className="h-4 w-4" />
                      <span className="hidden sm:inline">Meus Templates</span>
                      {customTemplates.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {customTemplates.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2">
                      <Edit3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Predefined Templates */}
                  <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col mt-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {categories.map((cat) => (
                        <Badge
                          key={cat.id}
                          variant={categoryFilter === cat.id ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => setCategoryFilter(cat.id)}
                        >
                          {cat.label}
                        </Badge>
                      ))}
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="grid gap-2 pr-4">
                        {filteredTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectPredefinedTemplate(template)}
                            className={`w-full text-left p-3 rounded-lg border transition-all hover:border-primary/50 hover:bg-primary/5 ${
                              selectedTemplate && 'id' in selectedTemplate && selectedTemplate.id === template.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border/50 bg-background'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xl">{template.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{template.name}</p>
                                {template.subject && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {template.subject}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {categories.find(c => c.id === template.category)?.label}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Custom Templates */}
                  <TabsContent value="custom" className="flex-1 overflow-hidden flex flex-col mt-4">
                    {isCreatingTemplate || editingTemplateId ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nome do Template</Label>
                          <Input
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder="Ex: Promoção de Verão"
                            maxLength={50}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Assunto</Label>
                          <Input
                            value={newTemplateSubject}
                            onChange={(e) => setNewTemplateSubject(e.target.value)}
                            placeholder="Assunto do email"
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Conteúdo</Label>
                          <Textarea
                            value={newTemplateContent}
                            onChange={(e) => setNewTemplateContent(e.target.value)}
                            placeholder="Conteúdo do template..."
                            className="min-h-[150px] resize-none"
                            maxLength={5000}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                          <p className="font-medium mb-1">Variáveis disponíveis:</p>
                          <p className="break-words">
                            {'{nome}'}, {'{email}'}, {'{plano}'}, {'{servico}'}, {'{valor}'}, {'{vencimento}'}, {'{usuario}'}, {'{senha}'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={resetTemplateForm} className="flex-1">
                            Cancelar
                          </Button>
                          <Button 
                            onClick={editingTemplateId ? handleUpdateTemplate : handleCreateTemplate}
                            className="flex-1 gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {editingTemplateId ? 'Atualizar' : 'Salvar'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="w-full gap-2 mb-3 border-dashed"
                          onClick={() => setIsCreatingTemplate(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Criar Novo Template
                        </Button>

                        <ScrollArea className="flex-1">
                          {isLoadingTemplates ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : customTemplates.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                              <p>Nenhum template personalizado</p>
                              <p className="text-sm">Crie seus próprios templates para usar depois!</p>
                            </div>
                          ) : (
                            <div className="grid gap-2 pr-4">
                              {customTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  className="p-3 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-all"
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="text-xl">📝</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm">{template.template_type}</p>
                                      {template.subject && (
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                          {template.subject}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleSelectCustomTemplate(template)}
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEditTemplate(template)}
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          setTemplateToDelete(template.id);
                                          setDeleteConfirmOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
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
                  <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Assunto</Label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Digite o assunto do email"
                        disabled={isSending}
                      />
                    </div>

                    <div className="space-y-2 flex-1 flex flex-col">
                      <Label htmlFor="message">Mensagem</Label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 min-h-[180px] resize-none"
                        disabled={isSending}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleSaveAsTemplate}
                        disabled={!subject.trim() && !message.trim()}
                      >
                        <Star className="h-4 w-4" />
                        Salvar como Template
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        Variáveis: {'{nome}'}, {'{plano}'}, {'{vencimento}'}...
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleClose} disabled={isSending}>
              Cancelar
            </Button>
            {client?.email && activeTab === 'preview' && (
              <Button onClick={handleSend} disabled={isSending || !subject.trim() || !message.trim()}>
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Email
                  </>
                )}
              </Button>
            )}
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
