import { useMemo } from 'react';
import { Client, planLabels, PlanType } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Users, RefreshCw, PieChart as PieChartIcon } from 'lucide-react';

interface ClientChartsProps {
  clients: Client[];
}

const PLAN_COLORS: Record<PlanType, string> = {
  monthly: 'hsl(280, 65%, 60%)',
  quarterly: 'hsl(217, 91%, 50%)',
  semiannual: 'hsl(142, 71%, 45%)',
  annual: 'hsl(35, 92%, 50%)',
};

export function ClientCharts({ clients }: ClientChartsProps) {
  // Client evolution over the last 6 months
  const clientEvolutionData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const clientsUpToMonth = clients.filter(c => 
        new Date(c.createdAt) <= monthEnd
      ).length;
      
      months.push({
        month: format(date, 'MMM', { locale: ptBR }),
        fullMonth: format(date, 'MMMM yyyy', { locale: ptBR }),
        clientes: clientsUpToMonth,
      });
    }
    return months;
  }, [clients]);

  // Renewals per month
  const renewalsData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      let renewalsCount = 0;
      clients.forEach(c => {
        c.renewalHistory.forEach(r => {
          if (isWithinInterval(new Date(r.date), { start: monthStart, end: monthEnd })) {
            renewalsCount++;
          }
        });
      });
      
      months.push({
        month: format(date, 'MMM', { locale: ptBR }),
        fullMonth: format(date, 'MMMM yyyy', { locale: ptBR }),
        renovações: renewalsCount,
      });
    }
    return months;
  }, [clients]);

  // Distribution by plan
  const planDistributionData = useMemo(() => {
    const distribution: Record<PlanType, number> = {
      monthly: 0,
      quarterly: 0,
      semiannual: 0,
      annual: 0,
    };

    clients.forEach(c => {
      distribution[c.plan]++;
    });

    return (Object.entries(distribution) as [PlanType, number][])
      .filter(([_, count]) => count > 0)
      .map(([plan, count]) => ({
        name: planLabels[plan],
        value: count,
        color: PLAN_COLORS[plan],
      }));
  }, [clients]);

  const totalRenewals = useMemo(() => {
    return clients.reduce((acc, c) => acc + c.renewalHistory.length, 0);
  }, [clients]);

  if (clients.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Análises e Gráficos
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Client Evolution Chart */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Evolução de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={clientEvolutionData}>
                  <defs>
                    <linearGradient id="colorClientes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="clientes" 
                    stroke="hsl(217, 91%, 50%)" 
                    fill="url(#colorClientes)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Renewals Chart */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-plan-semiannual" />
              Renovações por Mês
              <span className="ml-auto text-muted-foreground font-normal">
                Total: {totalRenewals}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={renewalsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
                  />
                  <Bar 
                    dataKey="renovações" 
                    fill="hsl(142, 71%, 45%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-plan-annual" />
              Distribuição por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {planDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {planDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`${value} cliente(s)`, 'Quantidade']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados para exibir
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
