import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Award,
  Zap,
  BarChart3,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, planLabels } from "@/types/client";

interface ResellerStats {
  totalClients: number;
  activeClients: number;
  expiringClients: number;
  expiredClients: number;
  monthlyRevenue: number;
  projectedRevenue: number;
  retentionRate: number;
  avgClientLifetime: number;
  newClientsThisMonth: number;
  renewalsThisMonth: number;
  messagesThisMonth: number;
}

interface MonthlyTrend {
  month: string;
  clients: number;
  revenue: number;
  renewals: number;
}

export default function ResellerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { clients, isLoading: clientsLoading } = useClients();
  const [stats, setStats] = useState<ResellerStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState({ clients: 50, revenue: 5000 });

  const planPrices: Record<string, number> = {
    monthly: 99.90,
    quarterly: 54.99,
    semiannual: 99.99,
    annual: 149.99,
  };

  useEffect(() => {
    if (user && clients.length >= 0) {
      calculateStats();
    }
  }, [user, clients]);

  const calculateStats = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const startOfThisMonth = startOfMonth(now);
      const endOfThisMonth = endOfMonth(now);

      // Basic client stats
      const activeClients = clients.filter(c => new Date(c.expiresAt) > now).length;
      const expiringClients = clients.filter(c => {
        const daysUntil = differenceInDays(new Date(c.expiresAt), now);
        return daysUntil > 0 && daysUntil <= 7;
      }).length;
      const expiredClients = clients.filter(c => new Date(c.expiresAt) <= now).length;

      // New clients this month
      const newClientsThisMonth = clients.filter(c => {
        const createdAt = new Date(c.createdAt);
        return createdAt >= startOfThisMonth && createdAt <= endOfThisMonth;
      }).length;

      // Monthly revenue calculation
      const monthlyRevenue = clients.reduce((acc, client) => {
        const price = client.price || planPrices[client.plan] || 0;
        const planDurations: Record<string, number> = {
          monthly: 1, quarterly: 3, semiannual: 6, annual: 12
        };
        return acc + (price / (planDurations[client.plan] || 1));
      }, 0);

      // Projected revenue (if all expiring clients renew)
      const projectedRevenue = monthlyRevenue + (expiringClients * (planPrices.monthly / 1));

      // Retention rate
      const retentionRate = clients.length > 0 ? (activeClients / clients.length) * 100 : 0;

      // Average client lifetime (in days)
      const avgClientLifetime = clients.length > 0
        ? clients.reduce((acc, c) => {
            const lifetime = differenceInDays(new Date(c.expiresAt), new Date(c.createdAt));
            return acc + Math.max(0, lifetime);
          }, 0) / clients.length
        : 0;

      // Fetch renewals this month
      const { data: renewals } = await supabase
        .from('renewal_history')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', startOfThisMonth.toISOString())
        .lte('created_at', endOfThisMonth.toISOString());

      // Fetch messages this month
      const { data: messages } = await supabase
        .from('scheduled_messages')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .gte('sent_at', startOfThisMonth.toISOString())
        .lte('sent_at', endOfThisMonth.toISOString());

      setStats({
        totalClients: clients.length,
        activeClients,
        expiringClients,
        expiredClients,
        monthlyRevenue,
        projectedRevenue,
        retentionRate,
        avgClientLifetime,
        newClientsThisMonth,
        renewalsThisMonth: renewals?.length || 0,
        messagesThisMonth: messages?.length || 0,
      });

      // Calculate monthly trend (last 6 months)
      const trend: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const clientsInMonth = clients.filter(c => {
          const createdAt = new Date(c.createdAt);
          return createdAt <= end;
        }).length;

        const { data: monthRenewals } = await supabase
          .from('renewal_history')
          .select('plan')
          .eq('user_id', user.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        const monthRevenue = monthRenewals?.reduce((acc, r) => {
          return acc + (planPrices[r.plan] || 0);
        }, 0) || 0;

        trend.push({
          month: format(date, 'MMM', { locale: ptBR }),
          clients: clientsInMonth,
          revenue: monthRevenue,
          renewals: monthRenewals?.length || 0,
        });
      }
      setMonthlyTrend(trend);

    } catch (error) {
      console.error('Error calculating stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Plan distribution for pie chart
  const planDistribution = useMemo(() => {
    const distribution = [
      { name: 'Mensal', value: clients.filter(c => c.plan === 'monthly').length, color: '#3b82f6' },
      { name: 'Trimestral', value: clients.filter(c => c.plan === 'quarterly').length, color: '#8b5cf6' },
      { name: 'Semestral', value: clients.filter(c => c.plan === 'semiannual').length, color: '#06b6d4' },
      { name: 'Anual', value: clients.filter(c => c.plan === 'annual').length, color: '#10b981' },
    ].filter(d => d.value > 0);
    return distribution;
  }, [clients]);

  // Goal progress
  const clientGoalProgress = stats ? Math.min((stats.totalClients / goals.clients) * 100, 100) : 0;
  const revenueGoalProgress = stats ? Math.min((stats.monthlyRevenue / goals.revenue) * 100, 100) : 0;

  if (clientsLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Meu Dashboard</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {profile?.display_name || user?.email}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={calculateStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-500" />
                <div className="text-right">
                  <span className="text-2xl font-bold">{stats?.totalClients || 0}</span>
                  {stats?.newClientsThisMonth ? (
                    <p className="text-xs text-green-500 flex items-center justify-end gap-1">
                      <ArrowUpRight className="h-3 w-3" />
                      +{stats.newClientsThisMonth} este mês
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Total de Clientes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <DollarSign className="h-8 w-8 text-green-500" />
                <span className="text-2xl font-bold">
                  {formatCurrency(stats?.monthlyRevenue || 0)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Receita Mensal</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <span className="text-2xl font-bold">
                  {stats?.retentionRate.toFixed(1) || 0}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Taxa de Retenção</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Clock className="h-8 w-8 text-orange-500" />
                <span className="text-2xl font-bold">
                  {Math.round(stats?.avgClientLifetime || 0)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Dias Médios (Plano)</p>
            </CardContent>
          </Card>
        </div>

        {/* Goals Progress */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Meta de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{stats?.totalClients || 0} / {goals.clients}</span>
                </div>
                <Progress value={clientGoalProgress} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{clientGoalProgress.toFixed(0)}% concluído</span>
                  <span>Faltam {Math.max(0, goals.clients - (stats?.totalClients || 0))} clientes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Meta de Receita Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{formatCurrency(stats?.monthlyRevenue || 0)} / {formatCurrency(goals.revenue)}</span>
                </div>
                <Progress value={revenueGoalProgress} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{revenueGoalProgress.toFixed(0)}% concluído</span>
                  <span>Faltam {formatCurrency(Math.max(0, goals.revenue - (stats?.monthlyRevenue || 0)))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.activeClients || 0}</p>
                  <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.expiringClients || 0}</p>
                  <p className="text-sm text-muted-foreground">Vencendo em 7 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.expiredClients || 0}</p>
                  <p className="text-sm text-muted-foreground">Planos Vencidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução de Receita
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Receita']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Distribuição de Planos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {planDistribution.length > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum cliente cadastrado
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {planDistribution.map((plan) => (
                  <div key={plan.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: plan.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {plan.name} ({plan.value})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Atividade Mensal
            </CardTitle>
            <CardDescription>Renovações e crescimento de clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="clients" name="Clientes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="renewals" name="Renovações" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/delinquent')} variant="outline">
                <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                Ver Inadimplentes ({stats?.expiredClients || 0})
              </Button>
              <Button onClick={() => navigate('/scheduled')} variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                Mensagens Agendadas
              </Button>
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard Completo
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
