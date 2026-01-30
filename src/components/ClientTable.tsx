import { Client, planLabels, getExpirationStatus, formatCurrency, getDaysUntilExpiration } from '@/types/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, RefreshCw, History, ArrowLeftRight, Bell, Mail, Phone, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onRenew: (id: string) => void;
  onViewHistory: (client: Client) => void;
  onChangePlan: (client: Client) => void;
  onViewNotifications: (client: Client) => void;
  onSendEmail: (client: Client) => void;
  onActivateAI?: (client: Client) => void;
  getPlanName: (plan: string) => string;
  selectedClients?: Set<string>;
  onToggleSelection?: (clientId: string) => void;
}

export function ClientTable({
  clients,
  onEdit,
  onDelete,
  onRenew,
  onViewHistory,
  onChangePlan,
  onViewNotifications,
  onSendEmail,
  onActivateAI,
  getPlanName,
  selectedClients,
  onToggleSelection,
}: ClientTableProps) {
  const getStatusBadge = (client: Client) => {
    const status = getExpirationStatus(client.expiresAt);
    const days = getDaysUntilExpiration(client.expiresAt);

    if (status === 'expired') {
      return <Badge variant="destructive" className="text-xs">Expirado</Badge>;
    }
    if (status === 'expiring') {
      return <Badge variant="outline" className="text-xs border-amber-500 text-amber-500 bg-amber-500/10">{days}d restantes</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-500 bg-emerald-500/10">Ativo</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      monthly: 'bg-plan-monthly/20 text-plan-monthly border-plan-monthly/50',
      quarterly: 'bg-plan-quarterly/20 text-plan-quarterly border-plan-quarterly/50',
      semiannual: 'bg-plan-semiannual/20 text-plan-semiannual border-plan-semiannual/50',
      annual: 'bg-plan-annual/20 text-plan-annual border-plan-annual/50',
    };
    return (
      <Badge variant="outline" className={`text-xs ${colors[plan] || ''}`}>
        {getPlanName(plan)}
      </Badge>
    );
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            {onToggleSelection && (
              <TableHead className="w-10"></TableHead>
            )}
            <TableHead className="text-muted-foreground font-semibold">Cliente</TableHead>
            <TableHead className="text-muted-foreground font-semibold hidden md:table-cell">Contato</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Plano</TableHead>
            <TableHead className="text-muted-foreground font-semibold hidden sm:table-cell">Valor</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Vencimento</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
            <TableHead className="text-muted-foreground font-semibold text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className={`border-border/30 hover:bg-primary/5 ${selectedClients?.has(client.id) ? 'bg-primary/10' : ''}`}>
              {onToggleSelection && (
                <TableCell className="w-10">
                  <Checkbox
                    checked={selectedClients?.has(client.id) || false}
                    onCheckedChange={() => onToggleSelection(client.id)}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="font-medium">{client.name}</div>
                {client.email && (
                  <div className="text-xs text-muted-foreground md:hidden flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {client.email}
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {client.email && (
                  <div className="text-sm flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {client.email}
                  </div>
                )}
                <div className="text-sm flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {client.whatsapp}
                </div>
              </TableCell>
              <TableCell>{getPlanBadge(client.plan)}</TableCell>
              <TableCell className="hidden sm:table-cell">
                {client.price !== null ? formatCurrency(client.price) : '-'}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {format(client.expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(client)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border-border/50 z-50">
                    {onActivateAI && getExpirationStatus(client.expiresAt) === 'expired' && (
                      <>
                        <DropdownMenuItem onClick={() => onActivateAI(client)}>
                          <Bot className="h-4 w-4 mr-2 text-primary" />
                          Ativar IA
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border/50" />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(client)}>
                      <Pencil className="h-4 w-4 mr-2 text-primary" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRenew(client.id)}>
                      <RefreshCw className="h-4 w-4 mr-2 text-emerald-500" />
                      Renovar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangePlan(client)}>
                      <ArrowLeftRight className="h-4 w-4 mr-2 text-accent" />
                      Alterar Plano
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/50" />
                    <DropdownMenuItem onClick={() => onViewHistory(client)}>
                      <History className="h-4 w-4 mr-2 text-muted-foreground" />
                      Histórico
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewNotifications(client)}>
                      <Bell className="h-4 w-4 mr-2 text-muted-foreground" />
                      Notificações
                    </DropdownMenuItem>
                    {client.email && (
                      <DropdownMenuItem onClick={() => onSendEmail(client)}>
                        <Mail className="h-4 w-4 mr-2 text-primary" />
                        Enviar Email
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-border/50" />
                    <DropdownMenuItem onClick={() => onDelete(client.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
