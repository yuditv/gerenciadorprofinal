import { useMemo } from "react";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  Users,
  TrendingUp,
  AlertCircle,
  Bot,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Conversation } from "@/hooks/useInboxConversations";
import { AgentStatus } from "@/hooks/useAgentStatus";
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

  // Calculate status distribution
  const statusData = useMemo(() => {
    return [
      { name: 'Abertas', value: metrics.open, color: 'hsl(var(--chart-1))' },
      { name: 'Pendentes', value: metrics.pending, color: 'hsl(var(--chart-2))' },
      { name: 'Resolvidas', value: metrics.resolved, color: 'hsl(var(--chart-3))' },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Calculate average response time (mock for now)
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

  // Conversations by instance
  const instanceData = useMemo(() => {
    const grouped: Record<string, number> = {};
    conversations.forEach(conv => {
      const name = conv.instance?.instance_name || 'Desconhecido';
      grouped[name] = (grouped[name] || 0) + 1;
    });
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [conversations]);

  const onlineAgents = agents.filter(a => a.status === 'online');
  const busyAgents = agents.filter(a => a.status === 'busy');

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Atendimento</h2>
          <p className="text-muted-foreground">Visão geral das conversas e métricas</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversas Abertas</p>
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
                  <p className="text-sm text-muted-foreground">Tempo Médio</p>
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
                  <p className="text-sm text-muted-foreground">Resolvidas Hoje</p>
                  <p className="text-3xl font-bold text-green-500">{metrics.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Hourly Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Mensagens por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  mensagens: { label: "Mensagens", color: "hsl(var(--primary))" }
                }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="mensagens" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
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
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {statusData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
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

        {/* Bottom Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Online Agents */}
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
                    {onlineAgents.map(agent => (
                      <div key={agent.id} className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={agent.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {agent.profile?.display_name?.slice(0, 2).toUpperCase() || 'AG'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {agent.profile?.display_name || 'Atendente'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Online
                        </Badge>
                      </div>
                    ))}
                    {busyAgents.map(agent => (
                      <div key={agent.id} className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={agent.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {agent.profile?.display_name?.slice(0, 2).toUpperCase() || 'AG'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-yellow-500 border-2 border-background" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {agent.profile?.display_name || 'Atendente'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                          Ocupado
                        </Badge>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Conversations by Instance */}
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
