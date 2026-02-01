import { useState } from 'react';
import { User, Mail, Phone, DollarSign, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useKanbanLeads, KANBAN_STATUSES } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeadDialog({ open, onOpenChange }: CreateLeadDialogProps) {
  const { createLead } = useKanbanLeads();
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    lead_name: '',
    lead_full_name: '',
    lead_email: '',
    lead_personal_id: '',
    lead_notes: '',
    deal_value: '',
    lead_status: 'novo',
  });

  const handleCreate = async () => {
    if (!formData.phone.trim()) {
      return;
    }

    setIsCreating(true);
    const result = await createLead({
      phone: formData.phone.replace(/\D/g, ''),
      lead_name: formData.lead_name || null,
      lead_full_name: formData.lead_full_name || null,
      lead_email: formData.lead_email || null,
      lead_personal_id: formData.lead_personal_id || null,
      lead_notes: formData.lead_notes || null,
      deal_value: formData.deal_value ? parseFloat(formData.deal_value) : null,
      lead_status: formData.lead_status,
    });

    setIsCreating(false);

    if (result) {
      // Reset form
      setFormData({
        phone: '',
        lead_name: '',
        lead_full_name: '',
        lead_email: '',
        lead_personal_id: '',
        lead_notes: '',
        deal_value: '',
        lead_status: 'novo',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone (Required) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Telefone *
            </Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="5511999999999"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status Inicial</Label>
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
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome
              </Label>
              <Input
                value={formData.lead_name}
                onChange={(e) => setFormData(prev => ({ ...prev, lead_name: e.target.value }))}
                placeholder="Nome"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={formData.lead_full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, lead_full_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              type="email"
              value={formData.lead_email}
              onChange={(e) => setFormData(prev => ({ ...prev, lead_email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Deal Value */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor do Negócio
              </Label>
              <Input
                type="number"
                step="0.01"
                value={formData.deal_value}
                onChange={(e) => setFormData(prev => ({ ...prev, deal_value: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                CPF/CNPJ
              </Label>
              <Input
                value={formData.lead_personal_id}
                onChange={(e) => setFormData(prev => ({ ...prev, lead_personal_id: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.lead_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, lead_notes: e.target.value }))}
              placeholder="Notas sobre o lead..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !formData.phone.trim()}>
            {isCreating ? 'Criando...' : 'Criar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
