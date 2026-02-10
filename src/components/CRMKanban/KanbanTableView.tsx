import { useState } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpDown,
  MoreHorizontal,
  Phone,
  Mail,
  ExternalLink,
  Trash2,
  Edit,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  KanbanLead,
  KANBAN_STATUSES,
  LEAD_PRIORITIES,
  LEAD_TEMPERATURES,
} from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

interface KanbanTableViewProps {
  leads: KanbanLead[];
  onLeadClick: (lead: KanbanLead) => void;
  onBulkDelete: (leadIds: string[]) => void;
}

type SortField = 'lead_name' | 'deal_value' | 'created_at' | 'lead_status' | 'priority';
type SortDirection = 'asc' | 'desc';

export function KanbanTableView({
  leads,
  onLeadClick,
  onBulkDelete,
}: KanbanTableViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map(l => l.id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedLeads = [...leads].sort((a, b) => {
    let aValue: any = (a as any)[sortField];
    let bValue: any = (b as any)[sortField];

    if (sortField === 'deal_value') {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusBadge = (status: string) => {
    const statusInfo = KANBAN_STATUSES.find(s => s.id === status);
    return (
      <Badge className={cn(statusInfo?.color, 'text-white')}>
        {statusInfo?.title || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityInfo = LEAD_PRIORITIES.find(p => p.id === priority);
    return (
      <Badge variant="outline" className={priorityInfo?.textColor}>
        {priorityInfo?.label || priority}
      </Badge>
    );
  };

  const getTemperatureEmoji = (temp: string) => {
    const tempInfo = LEAD_TEMPERATURES.find(t => t.id === temp);
    return tempInfo?.icon || '🌤️';
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.length} selecionados
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onBulkDelete(selectedIds);
              setSelectedIds([]);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="w-full" type="always">
          <div className="min-w-[900px]">
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === leads.length && leads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => handleSort('lead_name')}
                >
                  Lead
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => handleSort('lead_status')}
                >
                  Status
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => handleSort('priority')}
                >
                  Prioridade
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Temp.</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => handleSort('deal_value')}
                >
                  Valor
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => handleSort('created_at')}
                >
                  Criado
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map(lead => {
              const displayName = lead.lead_name || lead.lead_full_name || lead.phone;
              const initials = displayName
                ?.split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || '?';

              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onLeadClick(lead)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={lead.contact_avatar || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{displayName}</p>
                        {lead.company_name && (
                          <p className="text-xs text-muted-foreground">
                            {lead.company_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${lead.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-600"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      {lead.lead_email && (
                        <a
                          href={`mailto:${lead.lead_email}`}
                          className="text-blue-500 hover:text-blue-600"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(lead.lead_status)}</TableCell>
                  <TableCell>{getPriorityBadge(lead.priority || 'medium')}</TableCell>
                  <TableCell className="text-center text-lg">
                    {getTemperatureEmoji(lead.temperature || 'warm')}
                  </TableCell>
                  <TableCell>
                    <span className="text-green-500 font-medium">
                      R$ {(lead.deal_value || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {lead.created_at
                      ? format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR })
                      : '-'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onLeadClick(lead)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={`https://wa.me/${lead.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir WhatsApp
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onBulkDelete([lead.id])}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          </Table>
          </div>
          <ScrollBar orientation="horizontal" className="h-3" />
        </ScrollArea>
      </div>
    </div>
  );
}
