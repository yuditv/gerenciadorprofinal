import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useProfile } from "@/hooks/useProfile";
import { usePlanSettings } from "@/hooks/usePlanSettings";
import { useResellers } from "@/hooks/useResellers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ResellerGoalsCard } from "@/components/ResellerGoalsCard";
import { ResellerManagement } from "@/components/ResellerManagement";
import { CommissionReport } from "@/components/CommissionReport";
import { CommissionPayments } from "@/components/CommissionPayments";
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
  Search,
  Settings,
  History,
  Package,
  Save,
  Pencil,
  Eye,
  MessageCircle,
  UserPlus,
  Calculator,
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
import { formatCurrency, planLabels, getExpirationStatus, getDaysUntilExpiration } from "@/types/client";
import type { PlanType } from "@/types/client";

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
}

interface Transaction {
  id: string;
  client_name: string;
  plan: string;
  amount: number;
  type: 'new' | 'renewal';
  date: Date;
}

interface MonthlyTrend {
  month: string;
  clients: number;
  revenue: number;
  renewals: number;
}

export default function ResellerArea() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { clients, isLoading: clientsLoading } = useClients();
  const { settings: planSettings, saveSettings: savePlanSettings, isLoading: plansLoading } = usePlanSettings();
  const { resellers, isLoading: resellersLoading, createReseller, updateReseller, deleteReseller } = useResellers();
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [editingPlan, setEditingPlan] = useState<{ planKey: PlanType; planName: string; planPrice: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);

  const planPrices: Record<string, number> = useMemo(() => {
    const prices: Record<string, number> = {};
    planSettings.forEach(s => {
      prices[s.planKey] = s.planPrice;
    });
    return prices;
  }, [planSettings]);

  // Calculate stats
  const stats = useMemo((): ResellerStats => {
    const now = new Date();
    
    const activeClients = clients.filter(c => new Date(c.expiresAt) > now).length;
    const expiringClients = clients.filter(c => {
      const daysUntil = differenceInDays(new Date(c.expiresAt), now);
      return daysUntil > 0 && daysUntil <= 7;
    }).length;
    const expiredClients = clients.filter(c => new Date(c.expiresAt) <= now).length;

    const startOfThisMonth = startOfMonth(now);
    const newClientsThisMonth = clients.filter(c => {
      const createdAt = new Date(c.createdAt);
      return createdAt >= startOfThisMonth;
    }).length;

    const monthlyRevenue = clients.reduce((acc, client) => {
      const price = client.price || planPrices[client.plan] || 0;
      const planDurations: Record<string, number> = {
        monthly: 1, quarterly: 3, semiannual: 6, annual: 12
      };
      return acc + (price / (planDurations[client.plan] || 1));
    }, 0);

    const projectedRevenue = monthlyRevenue + (expiringClients * (planPrices.monthly || 99.90));
    const retentionRate = clients.length > 0 ? (activeClients / clients.length) * 100 : 0;
    const avgClientLifetime = clients.length > 0
      ? clients.reduce((acc, c) => {
          const lifetime = differenceInDays(new Date(c.expiresAt), new Date(c.createdAt));
          return acc + Math.max(0, lifetime);
        }, 0) / clients.length
      : 0;

    return {
      totalClients: clients.length,
      activeClients,
      expiringClients,
      expiredClients,
      monthlyRevenue,
      projectedRevenue,
      retentionRate,
      avgClientLifetime,
      newClientsThisMonth,
      renewalsThisMonth: 0,
    };
  }, [clients, planPrices]);

  // Filter clients for list
  const filteredClients = useMemo(() => {
    let filtered = clients;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.whatsapp.includes(query)
      );
    }
    
    const now = new Date();
    if (clientFilter === 'active') {
      filtered = filtered.filter(c => {
        const daysUntil = getDaysUntilExpiration(c.expiresAt);
        return daysUntil > 7;
      });
    } else if (clientFilter === 'expiring') {
      filtered = filtered.filter(c => {
        const daysUntil = getDaysUntilExpiration(c.expiresAt);
        return daysUntil > 0 && daysUntil <= 7;
      });
    } else if (clientFilter === 'expired') {
      filtered = filtered.filter(c => getDaysUntilExpiration(c.expiresAt) < 0);
    }
    
    return filtered;
  }, [clients, searchQuery, clientFilter]);

  // Plan distribution for pie chart
  const planDistribution = useMemo(() => {
    return [
      { name: 'Mensal', value: clients.filter(c => c.plan === 'monthly').length, color: '#3b82f6' },
      { name: 'Trimestral', value: clients.filter(c => c.plan === 'quarterly').length, color: '#8b5cf6' },
      { name: 'Semestral', value: clients.filter(c => c.plan === 'semiannual').length, color: '#06b6d4' },
      { name: 'Anual', value: clients.filter(c => c.plan === 'annual').length, color: '#10b981' },
    ].filter(d => d.value > 0);
  }, [clients]);

  // Load transactions
  const loadTransactions = async () => {
    if (!user) return;
    setLoadingTransactions(true);

    try {
      // Get renewals
      const { data: renewals } = await supabase
        .from('renewal_history')
        .select('*, clients(name, price, plan)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const transactionsList: Transaction[] = [];

      // Add renewals
      if (renewals) {
        renewals.forEach((r: any) => {
          transactionsList.push({
            id: r.id,
            client_name: r.clients?.name || 'Cliente',
            plan: r.plan,
            amount: r.clients?.price || planPrices[r.plan] || 0,
            type: 'renewal',
            date: new Date(r.created_at),
          });
        });
      }

      // Add new clients as transactions
      clients.forEach(c => {
        if (!c.renewalHistory || c.renewalHistory.length === 0) {
          transactionsList.push({
            id: c.id,
            client_name: c.name,
            plan: c.plan,
            amount: c.price || planPrices[c.plan] || 0,
            type: 'new',
            date: new Date(c.createdAt),
          });
        }
      });

      // Sort by date
      transactionsList.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(transactionsList);

      // Calculate monthly trend
      const trend: MonthlyTrend[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const clientsInMonth = clients.filter(c => new Date(c.createdAt) <= end).length;
        const monthTransactions = transactionsList.filter(t => 
          t.date >= start && t.date <= end
        );
        const monthRevenue = monthTransactions.reduce((acc, t) => acc + t.amount, 0);
        const monthRenewals = monthTransactions.filter(t => t.type === 'renewal').length;

        trend.push({
          month: format(date, 'MMM', { locale: ptBR }),
          clients: clientsInMonth,
          revenue: monthRevenue,
          renewals: monthRenewals,
        });
      }
      setMonthlyTrend(trend);

    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Load data on mount
  useState(() => {
    if (user) {
      loadTransactions();
    }
  });

  const handleSavePlanSettings = async () => {
    if (!editingPlan) return;
    
    const newSettings = planSettings.map(s => 
      s.planKey === editingPlan.planKey 
        ? { ...s, planName: editingPlan.planName, planPrice: editingPlan.planPrice }
        : s
    );
    
    await savePlanSettings(newSettings);
    setEditingPlan(null);
    toast.success('Plano atualizado com sucesso!');
  };

  const getStatusBadge = (expiresAt: Date) => {
    const status = getExpirationStatus(expiresAt);
    const days = getDaysUntilExpiration(expiresAt);
    
    if (status === 'expired') {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Vencido</Badge>;
    } else if (status === 'expiring') {
      return <Badge className="gap-1 bg-yellow-500/20 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3" />{days}d</Badge>;
    }
    return <Badge className="gap-1 bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3" />Ativo</Badge>;
  };

  if (clientsLoading || plansLoading || resellersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Área de Revenda</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {profile?.display_name || user?.email}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadTransactions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
            <TabsTrigger value="resellers" className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Revendedores</span>
            </TabsTrigger>
            <TabsTrigger value="commissions" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Comissões</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Planos</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Goals and Quick Stats */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Goals Card */}
              <ResellerGoalsCard 
                currentClients={stats.totalClients} 
                currentRevenue={stats.monthlyRevenue} 
              />

              {/* Quick Stats */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Users className="h-8 w-8 text-blue-500" />
                      <div className="text-right">
                        <span className="text-2xl font-bold">{stats.totalClients}</span>
                        {stats.newClientsThisMonth > 0 && (
                          <p className="text-xs text-green-500 flex items-center justify-end gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            +{stats.newClientsThisMonth} este mês
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Total de Clientes</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <DollarSign className="h-8 w-8 text-green-500" />
                      <span className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Receita Mensal</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <TrendingUp className="h-8 w-8 text-purple-500" />
                      <span className="text-2xl font-bold">{stats.retentionRate.toFixed(1)}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Taxa de Retenção</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Clock className="h-8 w-8 text-orange-500" />
                      <span className="text-2xl font-bold">{Math.round(stats.avgClientLifetime)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Dias Médios</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Status Overview */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-green-500/20 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setActiveTab('clients'); setClientFilter('active'); }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.activeClients}</p>
                      <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setActiveTab('clients'); setClientFilter('expiring'); }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-yellow-500/10">
                      <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.expiringClients}</p>
                      <p className="text-sm text-muted-foreground">Vencendo em 7 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/20 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setActiveTab('clients'); setClientFilter('expired'); }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-red-500/10">
                      <TrendingDown className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.expiredClients}</p>
                      <p className="text-sm text-muted-foreground">Planos Vencidos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
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
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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
                    {planDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-muted-foreground">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Resellers Tab */}
          <TabsContent value="resellers" className="space-y-4">
            <ResellerManagement
              resellers={resellers}
              onCreateReseller={createReseller}
              onUpdateReseller={updateReseller}
              onDeleteReseller={deleteReseller}
            />
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="space-y-6">
            <CommissionReport
              resellers={resellers}
              clients={clients}
              planPrices={planPrices}
            />
            <CommissionPayments
              resellers={resellers}
              planPrices={planPrices}
            />
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Lista de Clientes
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-[200px]"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant={clientFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setClientFilter('all')}
                      >
                        Todos
                      </Button>
                      <Button
                        variant={clientFilter === 'active' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setClientFilter('active')}
                      >
                        Ativos
                      </Button>
                      <Button
                        variant={clientFilter === 'expiring' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setClientFilter('expiring')}
                      >
                        Vencendo
                      </Button>
                      <Button
                        variant={clientFilter === 'expired' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setClientFilter('expired')}
                      >
                        Vencidos
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClients.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{client.name}</p>
                                <p className="text-xs text-muted-foreground">{client.whatsapp}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{planLabels[client.plan]}</Badge>
                            </TableCell>
                            <TableCell>
                              {formatCurrency(client.price || planPrices[client.plan] || 0)}
                            </TableCell>
                            <TableCell>
                              {format(client.expiresAt, 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(client.expiresAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`, '_blank')}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate('/')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Gestão de Planos e Preços
                </CardTitle>
                <CardDescription>
                  Configure os nomes e valores dos planos para seus clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {planSettings.map((plan) => (
                    <div
                      key={plan.planKey}
                      className="flex items-center justify-between p-4 border rounded-lg bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{plan.planName}</p>
                          <p className="text-sm text-muted-foreground">
                            Tipo: {planLabels[plan.planKey]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-primary">
                          {formatCurrency(plan.planPrice)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPlan({
                            planKey: plan.planKey,
                            planName: plan.planName,
                            planPrice: plan.planPrice
                          })}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Transações
                </CardTitle>
                <CardDescription>
                  Veja todas as vendas e renovações realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhuma transação encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {format(transaction.date, 'dd/MM/yyyy HH:mm')}
                              </TableCell>
                              <TableCell className="font-medium">
                                {transaction.client_name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {planLabels[transaction.plan as PlanType] || transaction.plan}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {transaction.type === 'new' ? (
                                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                                    Nova Venda
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                                    Renovação
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-primary">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
            <DialogDescription>
              Altere o nome e valor deste plano
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input
                  value={editingPlan.planName}
                  onChange={(e) => setEditingPlan({ ...editingPlan, planName: e.target.value })}
                  placeholder="Ex: Plano Mensal"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingPlan.planPrice}
                  onChange={(e) => setEditingPlan({ ...editingPlan, planPrice: parseFloat(e.target.value) || 0 })}
                  placeholder="99.90"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePlanSettings}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
