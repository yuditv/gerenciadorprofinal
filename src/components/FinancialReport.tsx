import { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Client, PlanType, planLabels, planDurations, formatCurrency, getExpirationStatus } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Calendar, DollarSign, PieChartIcon } from 'lucide-react';

interface FinancialReportProps {
  clients: Client[];
}

const PLAN_COLORS: Record<PlanType, string> = {
  monthly: '#3b82f6',
  quarterly: '#8b5cf6',
  semiannual: '#10b981',
  annual: '#f59e0b',
};

export function FinancialReport({ clients }: FinancialReportProps) {
  // Filter active clients only
  const activeClients = useMemo(() => {
    return clients.filter(c => getExpirationStatus(c.expiresAt) !== 'expired');
  }, [clients]);

  // Calculate revenue metrics
  const revenueMetrics = useMemo(() => {
    const totalRevenue = activeClients.reduce((acc, c) => acc + (c.price || 0), 0);
    
    const mrr = activeClients.reduce((acc, c) => {
      const monthlyValue = c.price !== null 
        ? c.price / planDurations[c.plan]
        : 0;
      return acc + monthlyValue;
    }, 0);

    return {
      total: totalRevenue,
      mrr,
      quarterly: mrr * 3,
      annual: mrr * 12,
    };
  }, [activeClients]);

  // Revenue by plan for bar chart
  const revenueByPlan = useMemo(() => {
    const planData = (Object.keys(planLabels) as PlanType[]).map(plan => {
      const planClients = activeClients.filter(c => c.plan === plan);
      const totalRevenue = planClients.reduce((acc, c) => acc + (c.price || 0), 0);
      const clientCount = planClients.length;
      
      return {
        name: planLabels[plan],
        plan,
        revenue: totalRevenue,
        clients: clientCount,
        avgTicket: clientCount > 0 ? totalRevenue / clientCount : 0,
      };
    });
    
    return planData;
  }, [activeClients]);

  // Revenue distribution for pie chart
  const revenueDistribution = useMemo(() => {
    return revenueByPlan
      .filter(d => d.revenue > 0)
      .map(d => ({
        name: d.name,
        value: d.revenue,
        color: PLAN_COLORS[d.plan],
      }));
  }, [revenueByPlan]);

  // Projected revenue data for line/bar chart
  const projectedRevenue = useMemo(() => {
    return [
      { period: 'Mensal', value: revenueMetrics.mrr },
      { period: 'Trimestral', value: revenueMetrics.quarterly },
      { period: 'Semestral', value: revenueMetrics.mrr * 6 },
      { period: 'Anual', value: revenueMetrics.annual },
    ];
  }, [revenueMetrics]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-muted-foreground">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(revenueMetrics.total)}</p>
                <p className="text-xs text-muted-foreground">Receita Total Ativa</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-plan-monthly/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-plan-monthly" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(revenueMetrics.mrr)}</p>
                <p className="text-xs text-muted-foreground">MRR (Mensal)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-plan-quarterly/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-plan-quarterly" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(revenueMetrics.quarterly)}</p>
                <p className="text-xs text-muted-foreground">Projeção Trimestral</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-plan-annual/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-plan-annual" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(revenueMetrics.annual)}</p>
                <p className="text-xs text-muted-foreground">Projeção Anual</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Receita por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPlan} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    name="Receita"
                    radius={[4, 4, 0, 0]}
                  >
                    {revenueByPlan.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PLAN_COLORS[entry.plan]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Distribution Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Distribuição de Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {revenueDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projected Revenue Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Projeção de Receita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectedRevenue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="period" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(1)}k`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="value" 
                  name="Receita Projetada"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Plan Details Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Detalhes por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full" type="always">
            <div className="min-w-[600px]">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plano</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Clientes</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Receita Total</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {revenueByPlan.map((plan) => {
                  const percentage = revenueMetrics.total > 0 
                    ? ((plan.revenue / revenueMetrics.total) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <tr key={plan.plan} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: PLAN_COLORS[plan.plan] }}
                          />
                          {plan.name}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-medium">{plan.clients}</td>
                      <td className="text-right py-3 px-4 font-medium text-primary">
                        {formatCurrency(plan.revenue)}
                      </td>
                      <td className="text-right py-3 px-4 text-muted-foreground">
                        {formatCurrency(plan.avgTicket)}
                      </td>
                      <td className="text-right py-3 px-4 text-muted-foreground">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td className="py-3 px-4 font-semibold">Total</td>
                  <td className="text-right py-3 px-4 font-semibold">{activeClients.length}</td>
                  <td className="text-right py-3 px-4 font-semibold text-primary">
                    {formatCurrency(revenueMetrics.total)}
                  </td>
                  <td className="text-right py-3 px-4 text-muted-foreground">
                    {formatCurrency(activeClients.length > 0 ? revenueMetrics.total / activeClients.length : 0)}
                  </td>
                  <td className="text-right py-3 px-4 font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
            </div>
            <ScrollBar orientation="horizontal" className="h-3" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
