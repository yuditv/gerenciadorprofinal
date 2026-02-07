import { useState, useEffect } from 'react';
import { BarChart3, CheckCircle2, XCircle, Send, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CampaignStat {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
  started_at: string | null;
}

export function CampaignMetrics() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('id, name, status, total_contacts, sent_count, failed_count, created_at, completed_at, started_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setCampaigns((data || []) as CampaignStat[]);
      } catch (e) {
        console.error('Error fetching campaigns:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [user]);

  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0);
  const totalContacts = campaigns.reduce((acc, c) => acc + (c.total_contacts || 0), 0);
  const successRate = totalContacts > 0 ? ((totalSent / totalContacts) * 100).toFixed(1) : '0';

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    scheduled: 'Agendada',
    running: 'Em execução',
    paused: 'Pausada',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    scheduled: 'bg-blue-500/10 text-blue-500',
    running: 'bg-amber-500/10 text-amber-500',
    paused: 'bg-orange-500/10 text-orange-500',
    completed: 'bg-emerald-500/10 text-emerald-500',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Send className="h-5 w-5 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{totalSent}</div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
            <div className="text-2xl font-bold">{totalFailed}</div>
            <div className="text-xs text-muted-foreground">Falharam</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{campaigns.length}</div>
            <div className="text-xs text-muted-foreground">Campanhas</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Campanhas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma campanha encontrada
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map(campaign => {
                  const total = campaign.total_contacts || 0;
                  const sent = campaign.sent_count || 0;
                  const failed = campaign.failed_count || 0;
                  const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;

                  return (
                    <div key={campaign.id} className="p-3 rounded-lg border border-border/30 bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{campaign.name}</span>
                        <Badge variant="outline" className={cn("text-[10px]", statusColors[campaign.status])}>
                          {statusLabels[campaign.status] || campaign.status}
                        </Badge>
                      </div>

                      <Progress value={progress} className="h-1.5" />

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {sent}
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-destructive" />
                            {failed}
                          </span>
                          <span>/ {total}</span>
                        </div>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
