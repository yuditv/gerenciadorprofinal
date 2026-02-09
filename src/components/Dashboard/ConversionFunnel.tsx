import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Users, MessageSquare, UserCheck, DollarSign, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStage {
  id: string;
  name: string;
  count: number;
  value: number;
  color: string;
  icon: React.ElementType;
}

interface ConversionFunnelProps {
  leads: Array<{
    id: string;
    lead_status: string;
    deal_value: number | null;
  }>;
}

export function ConversionFunnel({ leads }: ConversionFunnelProps) {
  const stages = useMemo<FunnelStage[]>(() => {
    const statusCounts: Record<string, { count: number; value: number }> = {
      novo: { count: 0, value: 0 },
      qualificado: { count: 0, value: 0 },
      proposta: { count: 0, value: 0 },
      negociacao: { count: 0, value: 0 },
      fechado: { count: 0, value: 0 },
    };

    leads.forEach(lead => {
      const status = lead.lead_status || 'novo';
      if (statusCounts[status]) {
        statusCounts[status].count += 1;
        statusCounts[status].value += lead.deal_value || 0;
      }
    });

    return [
      { id: 'novo', name: 'Novos', ...statusCounts.novo, color: 'bg-blue-500', icon: Users },
      { id: 'qualificado', name: 'Qualificados', ...statusCounts.qualificado, color: 'bg-purple-500', icon: MessageSquare },
      { id: 'proposta', name: 'Proposta', ...statusCounts.proposta, color: 'bg-amber-500', icon: UserCheck },
      { id: 'negociacao', name: 'Negociação', ...statusCounts.negociacao, color: 'bg-orange-500', icon: DollarSign },
      { id: 'fechado', name: 'Fechados', ...statusCounts.fechado, color: 'bg-green-500', icon: Target },
    ];
  }, [leads]);

  const totalLeads = stages.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  const conversionRates = useMemo(() => {
    const rates: number[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const current = stages[i].count;
      const next = stages[i + 1].count;
      rates.push(current > 0 ? (next / current) * 100 : 0);
    }
    return rates;
  }, [stages]);

  const overallConversion = totalLeads > 0 
    ? ((stages[stages.length - 1].count / stages[0].count) * 100) || 0 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Funil de Conversão
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Conversão geral: <span className="font-bold text-green-500">{overallConversion.toFixed(1)}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Funnel Visualization */}
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const widthPercent = totalLeads > 0 ? Math.max((stage.count / maxCount) * 100, 15) : 15;
            const Icon = stage.icon;
            
            return (
              <div key={stage.id} className="relative">
                {/* Stage Row */}
                <div className="flex items-center gap-4">
                  {/* Stage Bar */}
                  <div 
                    className={cn(
                      "relative h-14 rounded-lg flex items-center justify-between px-4 transition-all duration-500",
                      stage.color
                    )}
                    style={{ 
                      width: `${widthPercent}%`,
                      marginLeft: `${(100 - widthPercent) / 2}%`,
                    }}
                  >
                    <div className="flex items-center gap-2 text-white">
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{stage.name}</span>
                    </div>
                    <div className="text-right text-white">
                      <div className="font-bold">{stage.count}</div>
                      <div className="text-xs opacity-80">
                        R$ {stage.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conversion Rate Arrow */}
                {index < stages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <ArrowRight className="h-4 w-4 rotate-90" />
                      <span className={cn(
                        "font-medium",
                        conversionRates[index] >= 50 ? "text-green-500" :
                        conversionRates[index] >= 25 ? "text-amber-500" : "text-red-500"
                      )}>
                        {conversionRates[index].toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{stages[0].count}</div>
            <div className="text-xs text-muted-foreground">Entradas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{stages[stages.length - 1].count}</div>
            <div className="text-xs text-muted-foreground">Fechados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">
              R$ {stages[stages.length - 1].value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">Valor Fechado</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
