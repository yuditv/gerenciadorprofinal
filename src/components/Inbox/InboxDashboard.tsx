import { useMemo, useState, useEffect } from "react";
import {
  MessageSquare, Clock, CheckCircle, Users, TrendingUp,
  AlertCircle, Bot, BarChart3, Star, ThumbsUp, ThumbsDown,
  Timer, Target, HelpCircle, ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Conversation } from "@/hooks/useInboxConversations";
import { AgentStatus } from "@/hooks/useAgentStatus";
import { useInboxCSAT } from "@/hooks/useInboxCSAT";
import { useContactReasons } from "@/hooks/useContactReasons";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface InboxDashboardProps {
  conversations: Conversation[];
  agents: AgentStatus[];
  metrics: {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    unassigned: number;
    unread: number;
    mine: number;
  };
}

export function InboxDashboard({ conversations, agents, metrics }: InboxDashboardProps) {
  const { metrics: csatMetrics } = useInboxCSAT();
  const { reasons, getReasonStats } = useContactReasons();
  const [reasonStats, setReasonStats] = useState<{ reason_id: string; count: number }[]>([]);

  useEffect(() => {
    getReasonStats().then(setReasonStats);
  }, []);

  // Calculate hourly distribution
  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    conversations.forEach(conv => {
      const hour = new Date(conv.last_message_at).getHours();
      hours[hour]++;
    });
    return Object.entries(hours).map(([hour, count]) => ({
      hour: `${hour}h`,
      mensagens: count
    }));
  }, [conversations]);

  // Status distribution
  const statusData = useMemo(() => {
    return [
      { name: 'Abertas', value: metrics.open, color: 'hsl(var(--chart-1))' },
      { name: 'Pendentes', value: metrics.pending, color: 'hsl(var(--chart-2))' },
      { name: 'Compra Finalizada', value: metrics.resolved, color: 'hsl(var(--chart-3))' },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Average response time
  const avgResponseTime = useMemo(() => {
    const withResponse = conversations.filter(c => c.first_reply_at);
    if (withResponse.length === 0) return 'N/A';
    const totalMinutes = withResponse.reduce((acc, c) => {
      const created = new Date(c.created_at).getTime();
      const replied = new Date(c.first_reply_at!).getTime();
      return acc + (replied - created) / 60000;
    }, 0);
    const avg = totalMinutes / withResponse.length;
    if (avg < 60) return `${Math.round(avg)}min`;
    return `${Math.round(avg / 60)}h`;
  }, [conversations]);

  // Average resolution time
  const avgResolutionTime = useMemo(() => {
    const resolved = conversations.filter(c => c.resolved_at);
    if (resolved.length === 0) return 'N/A';
    const totalMinutes = resolved.reduce((acc, c) => {
      const created = new Date(c.created_at).getTime();
      const resolvedAt = new Date(c.resolved_at!).getTime();
      return acc + (resolvedAt - created) / 60000;
    }, 0);
    const avg = totalMinutes / resolved.length;
    if (avg < 60) return `${Math.round(avg)}min`;
    if (avg < 1440) return `${Math.round(avg / 60)}h`;
    return `${Math.round(avg / 1440)}d`;
  }, [conversations]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
    conversations.filter(c => c.status === 'open').forEach(c => {
      counts[c.priority]++;
    });
    return counts;
  }, [conversations]);

  // Conversations by instance
  const instanceData = useMemo(() => {
    const grouped: Record<string, number> = {};
    conversations.forEach(conv => {
      const name = conv.instance?.instance_name || 'Desconhecido';
      grouped[name] = (grouped[name] || 0) + 1;
    });
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [conversations]);

  // Contact reasons chart data
  const reasonChartData = useMemo(() => {
    return reasonStats
      .map(stat => {
        const reason = reasons.find(r => r.id === stat.reason_id);
        return reason ? { name: reason.name, count: stat.count, color: reason.color } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?.count || 0) - (a?.count || 0))
      .slice(0, 8);
  }, [reasonStats, reasons]);

  const onlineAgents = agents.filter(a => a.status === 'online');
  const busyAgents = agents.filter(a => a.status === 'busy');

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Atendimento</h2>
          <p className="text-muted-foreground">Visão geral das conversas, métricas e satisfação</p>
        </div>

        {/* KPI Cards - Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Abertas</p>
                  <p className="text-3xl font-bold">{metrics.open}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Resposta</p>
                  <p className="text-3xl font-bold">{avgResponseTime}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Resolução</p>
                  <p className="text-3xl font-bold">{avgResolutionTime}</p>
                </div>
                <Timer className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compra Finalizada</p>
                  <p className="text-3xl font-bold text-green-500">{metrics.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards - Row 2: CSAT + SLA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CSAT Médio</p>
                  <p className="text-3xl font-bold">
                    {csatMetrics.averageRating > 0 ? csatMetrics.averageRating.toFixed(1) : 'N/A'}
                  </p>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className={cn(
                        "h-3 w-3",
                        i <= Math.round(csatMetrics.averageRating)
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-muted-foreground/30"
                      )} />
                    ))}
                  </div>
                </div>
                <Star className="h-8 w-8 text-yellow-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">NPS Score</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    csatMetrics.npsScore >= 50 ? "text-green-500" :
                    csatMetrics.npsScore >= 0 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {csatMetrics.totalResponses > 0 ? csatMetrics.npsScore : 'N/A'}
                  </p>
                </div>
                <Target className="h-8 w-8 text-indigo-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Não Atribuídas</p>
                  <p className="text-3xl font-bold text-orange-500">{metrics.unassigned}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa Resposta CSAT</p>
                  <p className="text-3xl font-bold">{csatMetrics.responseRate.toFixed(0)}%</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Priority Distribution */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'urgent', label: 'Urgente', color: 'bg-red-500', count: priorityData.urgent },
            { key: 'high', label: 'Alta', color: 'bg-orange-500', count: priorityData.high },
            { key: 'medium', label: 'Média', color: 'bg-yellow-500', count: priorityData.medium },
            { key: 'low', label: 'Baixa', color: 'bg-green-500', count: priorityData.low },
          ].map(p => (
            <Card key={p.key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("h-3 w-3 rounded-full", p.color)} />
                  <span className="text-xs text-muted-foreground">{p.label}</span>
                  <span className="ml-auto text-lg font-bold">{p.count}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Mensagens por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ mensagens: { label: "Mensagens", color: "hsl(var(--primary))" } }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="mensagens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Status das Conversas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[200px]">
                {statusData.length > 0 ? (
                  <div className="flex items-center gap-8">
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {statusData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                          <span className="text-sm font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Sem dados</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CSAT Rating Distribution + Contact Reasons */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* CSAT Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Distribuição CSAT
              </CardTitle>
              <CardDescription>{csatMetrics.totalResponses} avaliações recebidas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map(rating => {
                  const count = csatMetrics.ratingDistribution[rating] || 0;
                  const percentage = csatMetrics.totalResponses > 0
                    ? (count / csatMetrics.totalResponses) * 100
                    : 0;
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-16 shrink-0">
                        {rating === 5 || rating === 4 ? (
                          <ThumbsUp className="h-3 w-3 text-green-500" />
                        ) : rating <= 2 ? (
                          <ThumbsDown className="h-3 w-3 text-red-500" />
                        ) : null}
                        <span className="text-sm">{rating} ★</span>
                      </div>
                      <Progress value={percentage} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Contact Reasons Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Motivos de Contato
              </CardTitle>
              <CardDescription>Categorias mais frequentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reasonChartData.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Nenhum motivo categorizado ainda. Configure em Configurações.
                  </p>
                ) : (
                  reasonChartData.map((item, index) => {
                    const maxCount = reasonChartData[0]?.count || 1;
                    const percentage = ((item?.count || 0) / maxCount) * 100;
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item?.color }} />
                        <span className="text-sm truncate flex-1">{item?.name}</span>
                        <Progress value={percentage} className="w-20 h-2" />
                        <Badge variant="secondary" className="text-xs">{item?.count}</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Atendentes Online
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {onlineAgents.length === 0 && busyAgents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum atendente online</p>
                ) : (
                  <>
                    {[...onlineAgents, ...busyAgents].map(agent => (
                      <div key={agent.id} className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={agent.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {agent.profile?.display_name?.slice(0, 2).toUpperCase() || 'AG'}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                            agent.status === 'online' ? "bg-green-500" : "bg-yellow-500"
                          )} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{agent.profile?.display_name || 'Atendente'}</p>
                        </div>
                        <Badge variant="outline" className={cn(
                          agent.status === 'online'
                            ? "text-green-500 border-green-500"
                            : "text-yellow-500 border-yellow-500"
                        )}>
                          {agent.status === 'online' ? 'Online' : 'Ocupado'}
                        </Badge>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Conversas por Instância
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {instanceData.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma conversa</p>
                ) : (
                  instanceData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{item.name}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
