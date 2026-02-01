import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Mail,
  Bell
} from "lucide-react";
import { ClientCharts } from "@/components/ClientCharts";
import { RetentionMetrics } from "@/components/RetentionMetrics";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Tooltip
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface MessageStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
}

interface MonthlyData {
  month: string;
  fullMonth: string;
  clients: number;
  renewals: number;
  messages: number;
  revenue: number;
  newClients: number;
  churnedClients: number;
}

interface MonthlyComparison {
  current: {
    clients: number;
    renewals: number;
    messages: number;
    revenue: number;
    newClients: number;
  };
  previous: {
    clients: number;
    renewals: number;
    messages: number;
    revenue: number;
    newClients: number;
  };
  changes: {
    clients: number;
    renewals: number;
    messages: number;
    revenue: number;
    newClients: number;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clients, isLoading: clientsLoading } = useClients();
  const [messageStats, setMessageStats] = useState<MessageStats>({
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [comparison, setComparison] = useState<MonthlyComparison | null>(null);

  const planPrices: Record<string, number> = {
    monthly: 99.90,
    quarterly: 54.99,
    semiannual: 99.99,
    annual: 149.99
  };

  const planDurations: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12
  };

  useEffect(() => {
    if (user && clients.length >= 0) {
      fetchDashboardData();
    }
  }, [user, clients]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch message statistics
      const { data: messages } = await supabase
        .from('scheduled_messages')
        .select('status')
        .eq('user_id', user.id);

      if (messages) {
        const stats = {
          total: messages.length,
          pending: messages.filter(m => m.status === 'pending').length,
          sent: messages.filter(m => m.status === 'sent').length,
          failed: messages.filter(m => m.status === 'failed').length,
          cancelled: messages.filter(m => m.status === 'cancelled').length
        };
        setMessageStats(stats);
      }

      // Fetch monthly data for the last 6 months
      const monthlyStats: MonthlyData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const monthLabel = format(date, 'MMM', { locale: ptBR });
        const fullMonthLabel = format(date, 'MMMM yyyy', { locale: ptBR });

        // Fetch renewals for this month
        const { data: renewals } = await supabase
          .from('renewal_history')
          .select('id, plan')
          .eq('user_id', user.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        // Fetch messages sent in this month
        const { data: sentMessages } = await supabase
          .from('scheduled_messages')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'sent')
          .gte('sent_at', start.toISOString())
          .lte('sent_at', end.toISOString());

        // Calculate revenue from renewals
        const monthRevenue = renewals?.reduce((acc, r) => {
          return acc + (planPrices[r.plan] || 0);
        }, 0) || 0;

        // Count new clients (created this month)
        const newClientsCount = clients.filter(c => {
          const createdAt = new Date(c.createdAt);
          return createdAt >= start && createdAt <= end;
        }).length;

        // Count churned clients (expired this month and not renewed)
        const churnedCount = clients.filter(c => {
          const expiresAt = new Date(c.expiresAt);
          return expiresAt >= start && expiresAt <= end && expiresAt < new Date();
        }).length;

        monthlyStats.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          fullMonth: fullMonthLabel.charAt(0).toUpperCase() + fullMonthLabel.slice(1),
          clients: clients.length,
          renewals: renewals?.length || 0,
          messages: sentMessages?.length || 0,
          revenue: monthRevenue,
          newClients: newClientsCount,
          churnedClients: churnedCount
        });
      }
      
      setMonthlyData(monthlyStats);

      // Calculate month-over-month comparison
      if (monthlyStats.length >= 2) {
        const current = monthlyStats[monthlyStats.length - 1];
        const previous = monthlyStats[monthlyStats.length - 2];
        
        const calcChange = (curr: number, prev: number) => {
          if (prev === 0) return curr > 0 ? 100 : 0;
          return ((curr - prev) / prev) * 100;
        };

        setComparison({
          current: {
            clients: current.clients,
            renewals: current.renewals,
            messages: current.messages,
            revenue: current.revenue,
            newClients: current.newClients
          },
          previous: {
            clients: previous.clients,
            renewals: previous.renewals,
            messages: previous.messages,
            revenue: previous.revenue,
            newClients: previous.newClients
          },
          changes: {
            clients: calcChange(current.clients, previous.clients),
            renewals: calcChange(current.renewals, previous.renewals),
            messages: calcChange(current.messages, previous.messages),
            revenue: calcChange(current.revenue, previous.revenue),
            newClients: calcChange(current.newClients, previous.newClients)
          }
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalClients = clients.length;
  const activeClients = clients.filter(c => new Date(c.expiresAt) > new Date()).length;
  const expiringClients = clients.filter(c => {
    const daysUntilExpiry = Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  }).length;
  const expiredClients = clients.filter(c => new Date(c.expiresAt) <= new Date()).length;

  const mrr = clients.reduce((acc, client) => {
    const price = client.price || planPrices[client.plan] || 0;
    const months = planDurations[client.plan] || 1;
    return acc + (price / months);
  }, 0);

  const retentionRate = totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(1) : 0;
  const churnRate = totalClients > 0 ? ((expiredClients / totalClients) * 100).toFixed(1) : 0;

  const messageChartData = [
    { name: 'Pendentes', value: messageStats.pending, color: 'hsl(45, 93%, 47%)' },
    { name: 'Enviadas', value: messageStats.sent, color: 'hsl(142, 71%, 45%)' },
    { name: 'Falhas', value: messageStats.failed, color: 'hsl(0, 84%, 60%)' },
    { name: 'Canceladas', value: messageStats.cancelled, color: 'hsl(215, 14%, 60%)' }
  ].filter(d => d.value > 0);

  const planDistribution = [
    { name: 'Mensal', value: clients.filter(c => c.plan === 'monthly').length, color: '#3b82f6' },
    { name: 'Trimestral', value: clients.filter(c => c.plan === 'quarterly').length, color: '#8b5cf6' },
    { name: 'Semestral', value: clients.filter(c => c.plan === 'semiannual').length, color: '#06b6d4' },
    { name: 'Anual', value: clients.filter(c => c.plan === 'annual').length, color: '#10b981' }
  ].filter(d => d.value > 0);

  const renderChangeIndicator = (change: number, inverted = false) => {
    const isPositive = inverted ? change < 0 : change > 0;
    const isNegative = inverted ? change > 0 : change < 0;
    
    if (Math.abs(change) < 0.1) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    
    return (
      <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };

  const handleTestNotification = async () => {
    try {
      toast.loading('Testando notificação automática...');
      const { data, error } = await supabase.functions.invoke('daily-expiration-check');
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Verificação concluída! ${data?.totalEmailsSent || 0} email(s) enviado(s)`);
    } catch (error: any) {
      toast.dismiss();
      toast.error('Erro ao testar notificação: ' + error.message);
    }
  };

  if (clientsLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-primary/20 sticky top-0 z-10" style={{
        background: "hsl(230 18% 8% / 0.7)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.2), 0 0 40px hsl(0 75% 55% / 0.06)"
      }}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-primary/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl" style={{ background: "hsl(0 75% 55% / 0.15)", boxShadow: "0 0 20px hsl(0 75% 55% / 0.2)" }}>
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-gradient">Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestNotification} className="border-primary/30 hover:bg-primary/10" style={{ background: "hsl(230 18% 10% / 0.6)" }}>
              <Bell className="h-4 w-4 mr-2" />
              Testar Notificações
            </Button>
            <Button variant="outline" size="sm" onClick={fetchDashboardData} className="border-primary/30 hover:bg-primary/10" style={{ background: "hsl(230 18% 10% / 0.6)" }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Auto Notifications Info */}
        <Card className="border-primary/30" style={{ background: "hsl(0 75% 55% / 0.08)", backdropFilter: "blur(16px)" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full" style={{ background: "hsl(0 75% 55% / 0.2)", boxShadow: "0 0 15px hsl(0 75% 55% / 0.3)" }}>
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Notificações Automáticas Ativas</h3>
                <p className="text-sm text-muted-foreground">
                  Emails são enviados automaticamente às 9h para clientes com planos vencendo em 7, 3 e 1 dia(s).
                </p>
              </div>
              <Badge variant="outline" className="border-green-500/50 text-green-400" style={{ background: "hsl(142 70% 45% / 0.15)" }}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Month-over-Month Comparison */}
        {comparison && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Comparativo Mensal
                <Badge variant="secondary" className="ml-2">
                  {monthlyData[monthlyData.length - 2]?.month} → {monthlyData[monthlyData.length - 1]?.month}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Renovações</span>
                    {renderChangeIndicator(comparison.changes.renewals)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{comparison.current.renewals}</span>
                    <span className="text-sm text-muted-foreground">vs {comparison.previous.renewals}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Novos Clientes</span>
                    {renderChangeIndicator(comparison.changes.newClients)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{comparison.current.newClients}</span>
                    <span className="text-sm text-muted-foreground">vs {comparison.previous.newClients}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Mensagens</span>
                    {renderChangeIndicator(comparison.changes.messages)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{comparison.current.messages}</span>
                    <span className="text-sm text-muted-foreground">vs {comparison.previous.messages}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Receita</span>
                    {renderChangeIndicator(comparison.changes.revenue)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">R$ {comparison.current.revenue.toFixed(0)}</span>
                    <span className="text-sm text-muted-foreground">vs R$ {comparison.previous.revenue.toFixed(0)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Clientes</span>
                    {renderChangeIndicator(comparison.changes.clients)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{comparison.current.clients}</span>
                    <span className="text-sm text-muted-foreground">vs {comparison.previous.clients}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-500" />
                <span className="text-2xl font-bold">{totalClients}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Total Clientes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <span className="text-2xl font-bold">{activeClients}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Ativos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <span className="text-2xl font-bold">{expiringClients}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Expirando</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <XCircle className="h-8 w-8 text-red-500" />
                <span className="text-2xl font-bold">{expiredClients}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Expirados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <DollarSign className="h-8 w-8 text-emerald-500" />
                <span className="text-2xl font-bold">R$ {mrr.toFixed(0)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">MRR</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <MessageSquare className="h-8 w-8 text-purple-500" />
                <span className="text-2xl font-bold">{messageStats.total}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Mensagens</p>
            </CardContent>
          </Card>
        </div>

        {/* Retention & Churn */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Taxa de Retenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-green-500">{retentionRate}%</span>
                <span className="text-muted-foreground mb-1">dos clientes ativos</span>
              </div>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${retentionRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Taxa de Churn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-red-500">{churnRate}%</span>
                <span className="text-muted-foreground mb-1">clientes perdidos</span>
              </div>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${churnRate}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução da Receita (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Receita"
                    stroke="hsl(142, 71%, 45%)" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(142, 71%, 45%)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Message Status Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status das Mensagens</CardTitle>
            </CardHeader>
            <CardContent>
              {messageChartData.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messageChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {messageChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhuma mensagem agendada
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por Plano</CardTitle>
            </CardHeader>
            <CardContent>
              {planDistribution.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum cliente cadastrado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Activity Chart */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Atividade Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="renewals" name="Renovações" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="newClients" name="Novos Clientes" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="messages" name="Mensagens" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Charts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientCharts clients={clients} />
          </CardContent>
        </Card>

        {/* Retention Metrics */}
        <RetentionMetrics clients={clients} />
      </main>
    </div>
  );
}
