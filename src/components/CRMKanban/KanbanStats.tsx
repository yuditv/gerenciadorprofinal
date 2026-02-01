import { Users, DollarSign, Ticket, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useKanbanLeads, KANBAN_STATUSES } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

export function KanbanStats() {
  const { columns, stats } = useKanbanLeads();

  const statCards = [
    {
      title: 'Total de Leads',
      value: stats.totalLeads,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Valor Total',
      value: `R$ ${stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Tickets Abertos',
      value: stats.openTickets,
      icon: Ticket,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Taxa de Conversão',
      value: stats.totalLeads > 0
        ? `${Math.round((columns.find(c => c.id === 'fechado')?.leads.length || 0) / stats.totalLeads * 100)}%`
        : '0%',
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
