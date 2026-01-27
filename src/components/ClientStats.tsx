import { Client, PlanType, planLabels, planMonthlyEquivalent, planDurations, formatCurrency, getExpirationStatus } from '@/types/client';
import { Users, TrendingUp, AlertTriangle, DollarSign, Zap, Shield, Activity } from 'lucide-react';
import { useMemo } from 'react';

interface ClientStatsProps {
  clients: Client[];
}

const planColors: Record<PlanType, string> = {
  monthly: 'from-plan-monthly to-plan-monthly/50',
  quarterly: 'from-plan-quarterly to-plan-quarterly/50',
  semiannual: 'from-plan-semiannual to-plan-semiannual/50',
  annual: 'from-plan-annual to-plan-annual/50',
};

const planGlows: Record<PlanType, string> = {
  monthly: 'shadow-[0_0_20px_hsl(280_100%_65%/0.3)]',
  quarterly: 'shadow-[0_0_20px_hsl(200_100%_50%/0.3)]',
  semiannual: 'shadow-[0_0_20px_hsl(160_100%_45%/0.3)]',
  annual: 'shadow-[0_0_20px_hsl(35_100%_55%/0.3)]',
};

export function ClientStats({ clients }: ClientStatsProps) {
  const totalClients = clients.length;
  
  const planCounts = clients.reduce((acc, client) => {
    acc[client.plan] = (acc[client.plan] || 0) + 1;
    return acc;
  }, {} as Record<PlanType, number>);

  // Calculate total revenue per plan using custom prices
  const planRevenue = useMemo(() => {
    return clients
      .filter(c => getExpirationStatus(c.expiresAt) !== 'expired')
      .reduce((acc, client) => {
        const revenue = client.price !== null ? client.price : 0;
        acc[client.plan] = (acc[client.plan] || 0) + revenue;
        return acc;
      }, {} as Record<PlanType, number>);
  }, [clients]);

  // Calculate MRR (Monthly Recurring Revenue) - use custom price if available
  const mrr = useMemo(() => {
    return clients
      .filter(c => getExpirationStatus(c.expiresAt) !== 'expired')
      .reduce((acc, client) => {
        // Use custom price divided by plan duration, or fallback to planMonthlyEquivalent
        const monthlyValue = client.price !== null 
          ? client.price / planDurations[client.plan]
          : planMonthlyEquivalent[client.plan];
        return acc + monthlyValue;
      }, 0);
  }, [clients]);

  // Active vs expiring/expired
  const activeClients = clients.filter(c => getExpirationStatus(c.expiresAt) === 'active').length;
  const atRiskClients = clients.filter(c => ['expiring', 'expired'].includes(getExpirationStatus(c.expiresAt))).length;

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="stat-card group shimmer">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center neon-glow">
                <Users className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-accent flex items-center justify-center">
                <Activity className="h-2.5 w-2.5 text-accent-foreground" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl sm:text-3xl font-bold text-gradient truncate">{totalClients}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Total de Clientes</p>
            </div>
          </div>
        </div>

        <div className="stat-card group shimmer">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-br from-plan-semiannual to-accent flex items-center justify-center shadow-[0_0_20px_hsl(160_100%_45%/0.4)]">
                <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-plan-semiannual flex items-center justify-center">
                <Zap className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl sm:text-3xl font-bold text-gradient truncate">{formatCurrency(mrr)}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">MRR (Receita Mensal)</p>
            </div>
          </div>
        </div>

        <div className="stat-card group shimmer">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-br from-plan-quarterly to-primary flex items-center justify-center shadow-[0_0_20px_hsl(200_100%_50%/0.4)]">
                <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-plan-quarterly flex items-center justify-center">
                <Shield className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl sm:text-3xl font-bold text-gradient truncate">{activeClients}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Clientes Ativos</p>
            </div>
          </div>
        </div>

        <div className="stat-card group shimmer">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-br from-destructive to-plan-annual flex items-center justify-center shadow-[0_0_20px_hsl(0_84%_60%/0.4)]">
                <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
              </div>
              {atRiskClients > 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center animate-pulse">
                  <span className="text-[10px] font-bold text-destructive-foreground">{atRiskClients}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl sm:text-3xl font-bold text-destructive truncate">{atRiskClients}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Próximo de Expirar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {(Object.keys(planLabels) as PlanType[]).map((plan) => (
          <div
            key={plan}
            className={`stat-card group hover:${planGlows[plan]} transition-all duration-300`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gradient-to-br ${planColors[plan]} flex items-center justify-center flex-shrink-0`}>
                <span className="text-base sm:text-lg font-bold text-primary-foreground">{planCounts[plan] || 0}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm sm:text-lg font-bold text-foreground truncate">
                    {planLabels[plan]}
                  </p>
                </div>
                <p className="text-xs sm:text-sm font-medium text-primary truncate">
                  {formatCurrency(planRevenue[plan] || 0)}
                </p>
              </div>
            </div>
            {/* Progress bar showing plan distribution */}
            <div className="mt-2 sm:mt-3 h-1 rounded-full bg-muted/30 overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${planColors[plan]} transition-all duration-500`}
                style={{ width: `${totalClients > 0 ? ((planCounts[plan] || 0) / totalClients) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}