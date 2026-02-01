import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Mail,
  Phone,
  User,
  DollarSign,
  Calendar,
  FileText,
  MessageCircle,
  Trash2,
  Save,
  X,
  ExternalLink,
  Building,
  Target,
  Thermometer,
  MapPin,
  Clock,
  Tag,
  Paperclip,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  KanbanLead,
  KANBAN_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  LEAD_TEMPERATURES,
  COMPANY_SIZES,
  useKanbanLeads,
} from '@/hooks/useKanbanLeads';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { LeadTagsManager } from './LeadTagsManager';
import { cn } from '@/lib/utils';

interface LeadDetailsDialogProps {
  lead: KanbanLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
  const { updateLead, deleteLead, updateLeadStatus, tags, createTag, assignTag, removeTag } = useKanbanLeads();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const [formData, setFormData] = useState({
    lead_name: '',
    lead_full_name: '',
    lead_email: '',
    lead_personal_id: '',
    lead_notes: '',
    deal_value: 0,
    lead_status: 'novo',
    lead_source: 'manual',
    priority: 'medium',
    temperature: 'warm',
    follow_up_date: '',
    expected_close_date: '',
    company_name: '',
    company_industry: '',
    company_size: '',
    lost_reason: '',
    won_reason: '',
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        lead_name: lead.lead_name || '',
        lead_full_name: lead.lead_full_name || '',
        lead_email: lead.lead_email || '',
        lead_personal_id: lead.lead_personal_id || '',
        lead_notes: lead.lead_notes || '',
        deal_value: lead.deal_value || 0,
        lead_status: lead.lead_status || 'novo',
        lead_source: lead.lead_source || 'manual',
        priority: lead.priority || 'medium',
        temperature: lead.temperature || 'warm',
        follow_up_date: lead.follow_up_date ? lead.follow_up_date.slice(0, 16) : '',
        expected_close_date: lead.expected_close_date ? lead.expected_close_date.slice(0, 10) : '',
        company_name: lead.company_name || '',
        company_industry: lead.company_industry || '',
        company_size: lead.company_size || '',
        lost_reason: lead.lost_reason || '',
        won_reason: lead.won_reason || '',
      });
      setIsEditing(false);
      setActiveTab('info');
    }
  }, [lead]);

  if (!lead) return null;

  const displayName = lead.lead_name || lead.lead_full_name || lead.phone;
  const initials = displayName
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const currentStatus = KANBAN_STATUSES.find(s => s.id === formData.lead_status);
  const currentPriority = LEAD_PRIORITIES.find(p => p.id === formData.priority);
  const currentTemperature = LEAD_TEMPERATURES.find(t => t.id === formData.temperature);
  const currentSource = LEAD_SOURCES.find(s => s.id === formData.lead_source);

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);
    
    if (formData.lead_status !== lead.lead_status) {
      await updateLeadStatus(lead.id, formData.lead_status, lead.lead_kanban_order);
    }
    
    const success = await updateLead(lead.id, {
      lead_name: formData.lead_name || null,
      lead_full_name: formData.lead_full_name || null,
      lead_email: formData.lead_email || null,
      lead_personal_id: formData.lead_personal_id || null,
      lead_notes: formData.lead_notes || null,
      deal_value: formData.deal_value || null,
      lead_source: formData.lead_source,
      priority: formData.priority,
      temperature: formData.temperature,
      follow_up_date: formData.follow_up_date || null,
      expected_close_date: formData.expected_close_date || null,
      company_name: formData.company_name || null,
      company_industry: formData.company_industry || null,
      company_size: formData.company_size || null,
      lost_reason: formData.lost_reason || null,
      won_reason: formData.won_reason || null,
    });

    setIsSaving(false);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    const success = await deleteLead(lead.id);
    if (success) {
      onOpenChange(false);
    }
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={lead.contact_avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">{displayName}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn(currentStatus?.color, 'text-white')}>
                      {currentStatus?.title}
                    </Badge>
                    <Badge variant="outline" className={currentPriority?.textColor}>
                      {currentPriority?.label}
                    </Badge>
                    <span className="text-lg">{currentTemperature?.icon}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-1" />
                      Salvar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-4">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="company">Empresa</TabsTrigger>
              <TabsTrigger value="activities">Atividades</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="info" className="space-y-4 m-0 pr-4">
                {/* Tags */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Etiquetas
                  </Label>
                  <LeadTagsManager
                    leadId={lead.id}
                    currentTags={lead.tags || []}
                    availableTags={tags}
                    onAssignTag={assignTag}
                    onRemoveTag={removeTag}
                    onCreateTag={createTag}
                  />
                </div>

                {/* Status, Priority, Temperature row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    {isEditing ? (
                      <Select
                        value={formData.lead_status}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, lead_status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KANBAN_STATUSES.map(status => (
                            <SelectItem key={status.id} value={status.id}>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", status.color)} />
                                {status.title}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 bg-muted/50 rounded-md">
                        <Badge className={cn(currentStatus?.color, 'text-white')}>
                          {currentStatus?.title}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    {isEditing ? (
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_PRIORITIES.map(priority => (
                            <SelectItem key={priority.id} value={priority.id}>
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 bg-muted/50 rounded-md">
                        <Badge variant="outline" className={currentPriority?.textColor}>
                          {currentPriority?.label}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Temperatura</Label>
                    {isEditing ? (
                      <Select
                        value={formData.temperature}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, temperature: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_TEMPERATURES.map(temp => (
                            <SelectItem key={temp.id} value={temp.id}>
                              {temp.icon} {temp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 bg-muted/50 rounded-md text-lg">
                        {currentTemperature?.icon} {currentTemperature?.label}
                      </div>
                    )}
                  </div>
                </div>

                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    {isEditing ? (
                      <Input
                        value={formData.lead_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, lead_name: e.target.value }))}
                        placeholder="Nome do lead"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.lead_name || '-'}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    {isEditing ? (
                      <Input
                        value={formData.lead_full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, lead_full_name: e.target.value }))}
                        placeholder="Nome completo"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.lead_full_name || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.phone}</span>
                      <a
                        href={`https://wa.me/${lead.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={formData.lead_email}
                        onChange={(e) => setFormData(prev => ({ ...prev, lead_email: e.target.value }))}
                        placeholder="email@exemplo.com"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.lead_email || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Value and Source */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor do Negócio</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.deal_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, deal_value: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-green-500 font-medium">
                          R$ {(lead.deal_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Origem</Label>
                    {isEditing ? (
                      <Select
                        value={formData.lead_source}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, lead_source: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_SOURCES.map(source => (
                            <SelectItem key={source.id} value={source.id}>
                              {source.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span>{currentSource?.label || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Follow-up</Label>
                    {isEditing ? (
                      <Input
                        type="datetime-local"
                        value={formData.follow_up_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, follow_up_date: e.target.value }))}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {lead.follow_up_date
                            ? format(new Date(lead.follow_up_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : '-'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Previsão de Fechamento</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={formData.expected_close_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {lead.expected_close_date
                            ? format(new Date(lead.expected_close_date), "dd/MM/yyyy", { locale: ptBR })
                            : '-'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CPF/CNPJ and Created Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    {isEditing ? (
                      <Input
                        value={formData.lead_personal_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, lead_personal_id: e.target.value }))}
                        placeholder="000.000.000-00"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.lead_personal_id || '-'}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Criado em</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lead.created_at
                          ? format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Won/Lost Reason (conditional) */}
                {(formData.lead_status === 'fechado' || formData.lead_status === 'perdido') && (
                  <div className="space-y-2">
                    <Label>
                      {formData.lead_status === 'fechado' ? 'Motivo do Fechamento' : 'Motivo da Perda'}
                    </Label>
                    {isEditing ? (
                      <Textarea
                        value={formData.lead_status === 'fechado' ? formData.won_reason : formData.lost_reason}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            [formData.lead_status === 'fechado' ? 'won_reason' : 'lost_reason']: e.target.value,
                          }))
                        }
                        placeholder={
                          formData.lead_status === 'fechado'
                            ? 'Por que o negócio foi fechado?'
                            : 'Por que o lead foi perdido?'
                        }
                        rows={2}
                      />
                    ) : (
                      <div className="p-2 bg-muted/50 rounded-md">
                        {formData.lead_status === 'fechado'
                          ? lead.won_reason || 'Não informado'
                          : lead.lost_reason || 'Não informado'}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="company" className="space-y-4 m-0 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    {isEditing ? (
                      <Input
                        value={formData.company_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                        placeholder="Nome da empresa"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.company_name || '-'}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Setor/Indústria</Label>
                    {isEditing ? (
                      <Input
                        value={formData.company_industry}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_industry: e.target.value }))}
                        placeholder="Ex: Tecnologia, Varejo..."
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.company_industry || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Porte da Empresa</Label>
                  {isEditing ? (
                    <Select
                      value={formData.company_size}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, company_size: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o porte" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZES.map(size => (
                          <SelectItem key={size.id} value={size.id}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {COMPANY_SIZES.find(s => s.id === lead.company_size)?.label || '-'}
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activities" className="m-0 pr-4">
                <LeadActivityTimeline leadId={lead.id} />
              </TabsContent>

              <TabsContent value="notes" className="m-0 pr-4">
                <div className="space-y-2">
                  <Label>Anotações</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.lead_notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, lead_notes: e.target.value }))}
                      placeholder="Adicione notas sobre este lead..."
                      rows={12}
                    />
                  ) : (
                    <div className="p-3 bg-muted/50 rounded-md min-h-[300px] whitespace-pre-wrap">
                      {lead.lead_notes || 'Nenhuma nota adicionada.'}
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Delete Button */}
          <div className="flex justify-end pt-4 border-t border-border/50 flex-shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
