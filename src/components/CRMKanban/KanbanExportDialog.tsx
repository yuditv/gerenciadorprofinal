import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
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
import { KanbanLead, KANBAN_STATUSES, LEAD_SOURCES, LEAD_PRIORITIES } from '@/hooks/useKanbanLeads';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface KanbanExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: KanbanLead[];
}

const EXPORT_FIELDS = [
  { id: 'lead_name', label: 'Nome' },
  { id: 'lead_full_name', label: 'Nome Completo' },
  { id: 'phone', label: 'Telefone' },
  { id: 'lead_email', label: 'Email' },
  { id: 'lead_status', label: 'Status' },
  { id: 'priority', label: 'Prioridade' },
  { id: 'temperature', label: 'Temperatura' },
  { id: 'lead_source', label: 'Origem' },
  { id: 'deal_value', label: 'Valor' },
  { id: 'company_name', label: 'Empresa' },
  { id: 'company_industry', label: 'Setor' },
  { id: 'follow_up_date', label: 'Data Follow-up' },
  { id: 'expected_close_date', label: 'Previsão Fechamento' },
  { id: 'lead_notes', label: 'Notas' },
  { id: 'created_at', label: 'Criado em' },
];

export function KanbanExportDialog({
  open,
  onOpenChange,
  leads,
}: KanbanExportDialogProps) {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.slice(0, 8).map(f => f.id)
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const getStatusLabel = (statusId: string) => {
    return KANBAN_STATUSES.find(s => s.id === statusId)?.title || statusId;
  };

  const getPriorityLabel = (priorityId: string) => {
    return LEAD_PRIORITIES.find(p => p.id === priorityId)?.label || priorityId;
  };

  const getSourceLabel = (sourceId: string) => {
    return LEAD_SOURCES.find(s => s.id === sourceId)?.label || sourceId;
  };

  const handleExport = () => {
    setIsExporting(true);

    try {
      // Filter leads by status
      let filteredLeads = leads;
      if (statusFilter !== 'all') {
        filteredLeads = leads.filter(l => l.lead_status === statusFilter);
      }

      // Prepare data
      const data = filteredLeads.map(lead => {
        const row: Record<string, any> = {};

        selectedFields.forEach(fieldId => {
          const field = EXPORT_FIELDS.find(f => f.id === fieldId);
          if (!field) return;

          let value = (lead as any)[fieldId];

          // Format specific fields
          if (fieldId === 'lead_status') {
            value = getStatusLabel(value);
          } else if (fieldId === 'priority') {
            value = getPriorityLabel(value || 'medium');
          } else if (fieldId === 'lead_source') {
            value = getSourceLabel(value || 'manual');
          } else if (fieldId === 'deal_value' && value) {
            value = `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          } else if ((fieldId === 'created_at' || fieldId === 'follow_up_date' || fieldId === 'expected_close_date') && value) {
            value = new Date(value).toLocaleDateString('pt-BR');
          }

          row[field.label] = value || '';
        });

        return row;
      });

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');

      // Download file
      const filename = `leads-crm-${new Date().toISOString().split('T')[0]}`;
      
      if (format === 'xlsx') {
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else {
        XLSX.writeFile(wb, `${filename}.csv`);
      }

      toast.success(`${filteredLeads.length} leads exportados!`);
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar leads');
    } finally {
      setIsExporting(false);
    }
  };

  const leadsToExport = statusFilter === 'all'
    ? leads
    : leads.filter(l => l.lead_status === statusFilter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Leads
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div className="flex gap-2">
            <Button
              variant={format === 'xlsx' ? 'default' : 'outline'}
              onClick={() => setFormat('xlsx')}
              className="flex-1"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel (.xlsx)
            </Button>
            <Button
              variant={format === 'csv' ? 'default' : 'outline'}
              onClick={() => setFormat('csv')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Filtrar por status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {KANBAN_STATUSES.map(status => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {leadsToExport.length} leads serão exportados
            </p>
          </div>

          {/* Fields Selection */}
          <div className="space-y-2">
            <Label>Campos a exportar</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
              {EXPORT_FIELDS.map(field => (
                <div key={field.id} className="flex items-center gap-2">
                  <Checkbox
                    id={field.id}
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <Label
                    htmlFor={field.id}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.length === 0 || leadsToExport.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
