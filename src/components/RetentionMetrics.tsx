import { useMemo } from 'react';
import { Client, getExpirationStatus, formatCurrency, planMonthlyEquivalent, planDurations } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';
import { differenceInMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface RetentionMetricsProps {
  clients: Client[];
}

export function RetentionMetrics({ clients }: RetentionMetricsProps) {
  const metrics = useMemo(() => {
    const now = new Date();
    const activeClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'active');
    const expiringClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'expiring');
    const expiredClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'expired');

    // Total renewals
    const totalRenewals = clients.reduce((acc, c) => acc + (c.renewalHistory?.length || 0), 0);

    // Clients with at least one renewal (retained)
    const retainedClients = clients.filter(c => c.renewalHistory && c.renewalHistory.length > 0);

    // Retention rate: clients who renewed at least once / total clients
    const retentionRate = clients.length > 0 
      ? (retainedClients.length / clients.length) * 100 
      : 0;

    // Churn rate: expired clients / total clients
    const churnRate = clients.length > 0 
      ? (expiredClients.length / clients.length) * 100 
      : 0;

    // At-risk rate: expiring clients / total clients
    const atRiskRate = clients.length > 0 
      ? (expiringClients.length / clients.length) * 100 
      : 0;

    // MRR calculation - using custom price divided by plan duration
    const mrr = activeClients.reduce((acc, client) => {
      const monthlyValue = client.price !== null 
        ? client.price / planDurations[client.plan]
        : planMonthlyEquivalent[client.plan];
      return acc + monthlyValue;
    }, 0);

    // At-risk MRR (clients expiring soon)
    const atRiskMrr = expiringClients.reduce((acc, client) => {
      const monthlyValue = client.price !== null 
        ? client.price / planDurations[client.plan]
        : planMonthlyEquivalent[client.plan];
      return acc + monthlyValue;
    }, 0);

    // Lost MRR (expired clients)
    const lostMrr = expiredClients.reduce((acc, client) => {
      const monthlyValue = client.price !== null 
        ? client.price / planDurations[client.plan]
        : planMonthlyEquivalent[client.plan];
      return acc + monthlyValue;
    }, 0);

    // Renewals this month
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const renewalsThisMonth = clients.reduce((acc, client) => {
      const monthRenewals = client.renewalHistory?.filter(r => 
        isWithinInterval(new Date(r.date), { start: currentMonthStart, end: currentMonthEnd })
      ).length || 0;
      return acc + monthRenewals;
    }, 0);

    // Average renewals per client
    const avgRenewalsPerClient = clients.length > 0 
      ? totalRenewals / clients.length 
      : 0;

    // Customer Lifetime Value (simplified: avg months as customer * avg monthly revenue)
    const avgMonthsAsCustomer = clients.reduce((acc, client) => {
      const months = differenceInMonths(client.expiresAt, client.createdAt);
      return acc + Math.max(months, 1);
    }, 0) / Math.max(clients.length, 1);

    const avgMonthlyRevenue = clients.length > 0 
      ? clients.reduce((acc, c) => {
          const monthlyValue = c.price !== null 
            ? c.price / planDurations[c.plan]
            : planMonthlyEquivalent[c.plan];
          return acc + monthlyValue;
        }, 0) / clients.length 
      : 0;

    const ltv = avgMonthsAsCustomer * avgMonthlyRevenue;

    return {
      totalClients: clients.length,
      activeClients: activeClients.length,
      expiringClients: expiringClients.length,
      expiredClients: expiredClients.length,
      retainedClients: retainedClients.length,
      totalRenewals,
      retentionRate,
      churnRate,
      atRiskRate,
      mrr,
      atRiskMrr,
      lostMrr,
      renewalsThisMonth,
      avgRenewalsPerClient,
      ltv,
    };
  }, [clients]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Métricas de Retenção</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Retention Rate */}
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Taxa de Retenção</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {metrics.retentionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.retainedClients} de {metrics.totalClients} renovaram
            </p>
          </CardContent>
        </Card>

        {/* Churn Rate */}
        <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Taxa de Churn</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {metrics.churnRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.expiredClients} cliente(s) perdido(s)
            </p>
          </CardContent>
        </Card>

        {/* At Risk Rate */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Próximo de Expirar</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {metrics.atRiskRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.expiringClients} cliente(s) expirando
            </p>
          </CardContent>
        </Card>

        {/* Total Renewals */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total de Renovações</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {metrics.totalRenewals}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.renewalsThisMonth} este mês
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MRR */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">MRR Ativo</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(metrics.mrr)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.activeClients} cliente(s) ativo(s)
            </p>
          </CardContent>
        </Card>

        {/* At-Risk MRR */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">MRR Próximo de Expirar</span>
            </div>
            <p className="text-xl font-bold text-amber-600">
              {formatCurrency(metrics.atRiskMrr)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.expiringClients} cliente(s) expirando
            </p>
          </CardContent>
        </Card>

        {/* LTV */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">LTV Médio</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(metrics.ltv)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {metrics.avgRenewalsPerClient.toFixed(1)} renovações/cliente
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
