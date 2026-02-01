import { Users, DollarSign, TrendingUp, AlertCircle, Clock, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useKanbanLeads } from '@/hooks/useKanbanLeads';
import { cn } from '@/lib/utils';

export function KanbanStats() {
  const { stats, columns } = useKanbanLeads();

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
      value: `R$ ${stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Taxa de Conversão',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Follow-ups Atrasados',
      value: stats.overdueFollowUps,
      icon: AlertCircle,
      color: stats.overdueFollowUps > 0 ? 'text-red-500' : 'text-muted-foreground',
      bgColor: stats.overdueFollowUps > 0 ? 'bg-red-500/10' : 'bg-muted/50',
    },
    {
      title: 'Follow-ups Próximos',
      value: stats.upcomingFollowUps,
      icon: Clock,
      color: stats.upcomingFollowUps > 0 ? 'text-amber-500' : 'text-muted-foreground',
      bgColor: stats.upcomingFollowUps > 0 ? 'bg-amber-500/10' : 'bg-muted/50',
    },
    {
      title: 'Fechados',
      value: stats.closedLeads,
      icon: Target,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Value by Stage */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Valor por Etapa do Pipeline
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {columns.map((column) => {
              const columnValue = stats.valueByStatus[column.id] || 0;
              const percentage = stats.totalValue > 0 
                ? (columnValue / stats.totalValue) * 100 
                : 0;
              
              return (
                <div
                  key={column.id}
                  className="flex-1 min-w-[120px] p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-2 h-2 rounded-full", column.color)} />
                    <span className="text-xs font-medium truncate">{column.title}</span>
                  </div>
                  <p className="text-lg font-bold text-green-500">
                    R$ {columnValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>{column.leads.length} leads</span>
                    <span>{percentage.toFixed(0)}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", column.color)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
