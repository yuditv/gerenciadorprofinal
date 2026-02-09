import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Heart, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Client, getExpirationStatus, getDaysUntilExpiration } from '@/types/client';

interface ClientHealthScoreProps {
  clients: Client[];
}

interface HealthSegment {
  label: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

function calculateHealthScore(client: Client): number {
  let score = 100;
  
  // Factor 1: Days until expiration (40 points max)
  const daysUntilExpiry = getDaysUntilExpiration(client.expiresAt);
  if (daysUntilExpiry < 0) {
    score -= 40; // Expired = -40
  } else if (daysUntilExpiry <= 3) {
    score -= 30; // Expiring very soon = -30
  } else if (daysUntilExpiry <= 7) {
    score -= 20; // Expiring soon = -20
  } else if (daysUntilExpiry <= 14) {
    score -= 10; // Expiring in 2 weeks = -10
  }
  
  // Factor 2: Plan type (20 points max) - longer plans = more committed
  const planScores: Record<string, number> = {
    annual: 20,
    semiannual: 15,
    quarterly: 10,
    monthly: 5,
  };
  score += (planScores[client.plan] || 0) - 10; // Normalize
  
  // Factor 3: Has complete profile (20 points max)
  if (!client.email || client.email === '') score -= 5;
  if (!client.whatsapp || client.whatsapp === '') score -= 5;
  if (!client.serviceUsername) score -= 5;
  if (!client.servicePassword) score -= 5;
  
  // Factor 4: Renewal history (20 points max)
  const renewalCount = client.renewalHistory?.length || 0;
  if (renewalCount >= 3) {
    score += 10; // Loyal customer
  } else if (renewalCount >= 1) {
    score += 5; // Has renewed before
  }
  
  return Math.max(0, Math.min(100, score));
}

function getHealthLabel(score: number): { label: string; color: string; bgColor: string; icon: React.ElementType } {
  if (score >= 80) return { label: 'Excelente', color: 'text-green-500', bgColor: 'bg-green-500', icon: CheckCircle };
  if (score >= 60) return { label: 'Bom', color: 'text-blue-500', bgColor: 'bg-blue-500', icon: TrendingUp };
  if (score >= 40) return { label: 'Atenção', color: 'text-amber-500', bgColor: 'bg-amber-500', icon: Clock };
  if (score >= 20) return { label: 'Risco', color: 'text-orange-500', bgColor: 'bg-orange-500', icon: AlertTriangle };
  return { label: 'Crítico', color: 'text-red-500', bgColor: 'bg-red-500', icon: XCircle };
}

export function ClientHealthScore({ clients }: ClientHealthScoreProps) {
  const healthData = useMemo(() => {
    const clientsWithScores = clients.map(client => ({
      ...client,
      healthScore: calculateHealthScore(client),
    }));

    const segments: HealthSegment[] = [
      { label: 'Excelente', count: 0, percentage: 0, color: 'text-green-500', bgColor: 'bg-green-500', icon: CheckCircle },
      { label: 'Bom', count: 0, percentage: 0, color: 'text-blue-500', bgColor: 'bg-blue-500', icon: TrendingUp },
      { label: 'Atenção', count: 0, percentage: 0, color: 'text-amber-500', bgColor: 'bg-amber-500', icon: Clock },
      { label: 'Risco', count: 0, percentage: 0, color: 'text-orange-500', bgColor: 'bg-orange-500', icon: AlertTriangle },
      { label: 'Crítico', count: 0, percentage: 0, color: 'text-red-500', bgColor: 'bg-red-500', icon: XCircle },
    ];

    clientsWithScores.forEach(client => {
      if (client.healthScore >= 80) segments[0].count++;
      else if (client.healthScore >= 60) segments[1].count++;
      else if (client.healthScore >= 40) segments[2].count++;
      else if (client.healthScore >= 20) segments[3].count++;
      else segments[4].count++;
    });

    const total = clients.length;
    segments.forEach(s => {
      s.percentage = total > 0 ? (s.count / total) * 100 : 0;
    });

    const averageScore = clientsWithScores.length > 0
      ? clientsWithScores.reduce((sum, c) => sum + c.healthScore, 0) / clientsWithScores.length
      : 0;

    const atRiskClients = clientsWithScores
      .filter(c => c.healthScore < 40)
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 5);

    return {
      segments,
      averageScore,
      atRiskClients,
      totalClients: clients.length,
    };
  }, [clients]);

  const avgScoreInfo = getHealthLabel(healthData.averageScore);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Health Score dos Clientes
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn("gap-1", avgScoreInfo.color)}
          >
            <Activity className="h-3 w-3" />
            Média: {healthData.averageScore.toFixed(0)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Health Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Saúde Geral da Base</span>
            <span className={cn("font-medium", avgScoreInfo.color)}>
              {avgScoreInfo.label}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
            {healthData.segments.map((segment, i) => (
              <div
                key={segment.label}
                className={cn("h-full transition-all", segment.bgColor)}
                style={{ width: `${segment.percentage}%` }}
              />
            ))}
          </div>
        </div>

        {/* Segments Grid */}
        <div className="grid grid-cols-5 gap-2">
          {healthData.segments.map(segment => {
            const Icon = segment.icon;
            return (
              <div
                key={segment.label}
                className="text-center p-2 rounded-lg bg-muted/50 border border-border/50"
              >
                <Icon className={cn("h-5 w-5 mx-auto mb-1", segment.color)} />
                <div className="text-lg font-bold">{segment.count}</div>
                <div className="text-xs text-muted-foreground">{segment.label}</div>
                <div className={cn("text-xs font-medium", segment.color)}>
                  {segment.percentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* At Risk Clients */}
        {healthData.atRiskClients.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              Clientes em Risco
            </div>
            <div className="space-y-2">
              {healthData.atRiskClients.map(client => {
                const info = getHealthLabel(client.healthScore);
                const Icon = info.icon;
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", info.color)} />
                      <div>
                        <div className="font-medium text-sm truncate max-w-[150px]">
                          {client.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getExpirationStatus(client.expiresAt) === 'expired' 
                            ? 'Expirado' 
                            : `${getDaysUntilExpiration(client.expiresAt)} dias restantes`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={client.healthScore} 
                        className={cn("w-16 h-2", info.bgColor)}
                      />
                      <span className={cn("text-sm font-medium w-8 text-right", info.color)}>
                        {client.healthScore}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
