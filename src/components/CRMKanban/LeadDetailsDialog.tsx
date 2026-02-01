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
import { KanbanLead, KANBAN_STATUSES, useKanbanLeads } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface LeadDetailsDialogProps {
  lead: KanbanLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
  const { updateLead, deleteLead, updateLeadStatus } = useKanbanLeads();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    lead_name: '',
    lead_full_name: '',
    lead_email: '',
    lead_personal_id: '',
    lead_notes: '',
    deal_value: 0,
    lead_status: 'novo',
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
      });
      setIsEditing(false);
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

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);
    
    // Update status if changed
    if (formData.lead_status !== lead.lead_status) {
      await updateLeadStatus(lead.id, formData.lead_status, lead.lead_kanban_order);
    }
    
    // Update other fields
    const success = await updateLead(lead.id, {
      lead_name: formData.lead_name || null,
      lead_full_name: formData.lead_full_name || null,
      lead_email: formData.lead_email || null,
      lead_personal_id: formData.lead_personal_id || null,
      lead_notes: formData.lead_notes || null,
      deal_value: formData.deal_value || null,
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
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
                    <div className={cn("w-2 h-2 rounded-full", currentStatus?.color)} />
                    <span className="text-sm text-muted-foreground">{currentStatus?.title}</span>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Salvar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              {/* Status */}
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
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <div className={cn("w-3 h-3 rounded-full", currentStatus?.color)} />
                    <span>{currentStatus?.title}</span>
                  </div>
                )}
              </div>

              {/* Name */}
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

              {/* Deal Value */}
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
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label>Última interação</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {lead.last_message_at
                        ? format(new Date(lead.last_message_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <div className="space-y-2">
                <Label>Anotações</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.lead_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, lead_notes: e.target.value }))}
                    placeholder="Adicione notas sobre este lead..."
                    rows={8}
                  />
                ) : (
                  <div className="p-3 bg-muted/50 rounded-md min-h-[200px] whitespace-pre-wrap">
                    {lead.lead_notes || 'Nenhuma nota adicionada.'}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Delete Button */}
          <div className="flex justify-end pt-4 border-t border-border/50">
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
