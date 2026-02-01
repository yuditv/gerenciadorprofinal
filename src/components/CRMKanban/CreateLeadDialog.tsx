import { useState } from 'react';
import {
  Phone,
  User,
  Mail,
  Building,
  DollarSign,
  Target,
  Calendar,
} from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useKanbanLeads,
  KANBAN_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  LEAD_TEMPERATURES,
  COMPANY_SIZES,
} from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeadDialog({ open, onOpenChange }: CreateLeadDialogProps) {
  const { createLead } = useKanbanLeads();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    lead_name: '',
    lead_full_name: '',
    lead_email: '',
    lead_personal_id: '',
    lead_status: 'novo',
    lead_source: 'manual',
    priority: 'medium',
    temperature: 'warm',
    deal_value: 0,
    lead_notes: '',
    company_name: '',
    company_industry: '',
    company_size: '',
    follow_up_date: '',
    expected_close_date: '',
  });

  const handleSubmit = async () => {
    if (!formData.phone.trim()) return;

    setIsLoading(true);
    const result = await createLead({
      phone: formData.phone.replace(/\D/g, ''),
      lead_name: formData.lead_name || null,
      lead_full_name: formData.lead_full_name || null,
      lead_email: formData.lead_email || null,
      lead_personal_id: formData.lead_personal_id || null,
      lead_status: formData.lead_status,
      lead_source: formData.lead_source,
      priority: formData.priority,
      temperature: formData.temperature,
      deal_value: formData.deal_value || null,
      lead_notes: formData.lead_notes || null,
      company_name: formData.company_name || null,
      company_industry: formData.company_industry || null,
      company_size: formData.company_size || null,
      follow_up_date: formData.follow_up_date || null,
      expected_close_date: formData.expected_close_date || null,
    });

    setIsLoading(false);
    if (result) {
      setFormData({
        phone: '',
        lead_name: '',
        lead_full_name: '',
        lead_email: '',
        lead_personal_id: '',
        lead_status: 'novo',
        lead_source: 'manual',
        priority: 'medium',
        temperature: 'warm',
        deal_value: 0,
        lead_notes: '',
        company_name: '',
        company_industry: '',
        company_size: '',
        follow_up_date: '',
        expected_close_date: '',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Novo Lead
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Phone (required) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone *
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="5511999999999"
                required
              />
            </div>

            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.lead_name}
                  onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  value={formData.lead_full_name}
                  onChange={(e) => setFormData({ ...formData, lead_full_name: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, lead_email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            {/* Status, Priority, Temperature */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.lead_status}
                  onValueChange={(value) => setFormData({ ...formData, lead_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_STATUSES.map((status) => (
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

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_PRIORITIES.map((priority) => (
                      <SelectItem key={priority.id} value={priority.id}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Temperatura</Label>
                <Select
                  value={formData.temperature}
                  onValueChange={(value) => setFormData({ ...formData, temperature: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_TEMPERATURES.map((temp) => (
                      <SelectItem key={temp.id} value={temp.id}>
                        {temp.icon} {temp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Source and Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Origem
                </Label>
                <Select
                  value={formData.lead_source}
                  onValueChange={(value) => setFormData({ ...formData, lead_source: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor do Negócio
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deal_value || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, deal_value: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="company" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Nome da Empresa
              </Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Setor/Indústria</Label>
                <Input
                  value={formData.company_industry}
                  onChange={(e) => setFormData({ ...formData, company_industry: e.target.value })}
                  placeholder="Ex: Tecnologia, Varejo..."
                />
              </div>

              <div className="space-y-2">
                <Label>Porte da Empresa</Label>
                <Select
                  value={formData.company_size}
                  onValueChange={(value) => setFormData({ ...formData, company_size: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data Follow-up
                </Label>
                <Input
                  type="datetime-local"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Previsão de Fechamento</Label>
                <Input
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                />
              </div>
            </div>

            {/* CPF/CNPJ */}
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input
                value={formData.lead_personal_id}
                onChange={(e) => setFormData({ ...formData, lead_personal_id: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.lead_notes}
                onChange={(e) => setFormData({ ...formData, lead_notes: e.target.value })}
                placeholder="Anotações sobre o lead..."
                rows={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !formData.phone.trim()}>
            {isLoading ? 'Criando...' : 'Criar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
