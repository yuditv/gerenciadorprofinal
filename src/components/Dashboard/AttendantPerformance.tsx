import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Clock, 
  MessageSquare, 
  CheckCircle, 
  BarChart3,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountContext } from '@/hooks/useAccountContext';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface AttendantStats {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  totalConversations: number;
  resolvedConversations: number;
  avgResponseTimeMinutes: number;
  messagesReceived: number;
  messagesSent: number;
  satisfactionScore: number;
  onlineTimeHours: number;
}

interface PerformanceMetric {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}

export function AttendantPerformance() {
  const { user } = useAuth();
  const { ownerId } = useAccountContext();
  const [attendants, setAttendants] = useState<AttendantStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (!user) return;
    fetchPerformanceData();
  }, [user, ownerId, period]);

  const fetchPerformanceData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const resolvedOwnerId = ownerId || user.id;
      
      // Calculate date range
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch account members
      const { data: members } = await supabase
        .from('account_members')
        .select('member_id, member_name, member_email')
        .eq('owner_id', resolvedOwnerId);

      // Include owner as an attendant
      const attendantIds = [resolvedOwnerId, ...(members?.map(m => m.member_id) || [])];
      
      // Fetch conversations with attendants
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, assigned_to, status, created_at, resolved_at')
        .eq('user_id', resolvedOwnerId)
        .gte('created_at', startDate.toISOString());

      // Fetch messages to calculate response times
      const { data: messages } = await supabase
        .from('chat_inbox_messages')
        .select('id, conversation_id, sender_type, sender_id, created_at')
        .in('conversation_id', conversations?.map(c => c.id) || [])
        .order('created_at', { ascending: true });

      // Calculate stats per attendant
      const statsMap: Record<string, AttendantStats> = {};

      // Initialize with owner
      statsMap[resolvedOwnerId] = {
        id: resolvedOwnerId,
        name: 'Você',
        email: user.email || '',
        totalConversations: 0,
        resolvedConversations: 0,
        avgResponseTimeMinutes: 0,
        messagesReceived: 0,
        messagesSent: 0,
        satisfactionScore: 85, // Placeholder
        onlineTimeHours: 0,
      };

      // Initialize members
      members?.forEach(m => {
        statsMap[m.member_id] = {
          id: m.member_id,
          name: m.member_name || 'Atendente',
          email: m.member_email || '',
          totalConversations: 0,
          resolvedConversations: 0,
          avgResponseTimeMinutes: 0,
          messagesReceived: 0,
          messagesSent: 0,
          satisfactionScore: 85,
          onlineTimeHours: 0,
        };
      });

      // Count conversations per attendant
      conversations?.forEach(conv => {
        const assignee = conv.assigned_to || resolvedOwnerId;
        if (statsMap[assignee]) {
          statsMap[assignee].totalConversations++;
          if (conv.status === 'resolved') {
            statsMap[assignee].resolvedConversations++;
          }
        }
      });

      // Count messages and calculate response times
      const responseTimes: Record<string, number[]> = {};
      const conversationMessages: Record<string, typeof messages> = {};

      messages?.forEach(msg => {
        if (!conversationMessages[msg.conversation_id]) {
          conversationMessages[msg.conversation_id] = [];
        }
        conversationMessages[msg.conversation_id]!.push(msg);
      });

      Object.values(conversationMessages).forEach(convMsgs => {
        if (!convMsgs) return;
        
        let lastCustomerMsgTime: Date | null = null;
        
        convMsgs.forEach(msg => {
          if (msg.sender_type === 'customer' || msg.sender_type === 'client') {
            lastCustomerMsgTime = new Date(msg.created_at);
          } else if (msg.sender_type === 'agent' || msg.sender_type === 'owner') {
            const senderId = msg.sender_id || resolvedOwnerId;
            if (statsMap[senderId]) {
              statsMap[senderId].messagesSent++;
              
              if (lastCustomerMsgTime) {
                const responseTime = (new Date(msg.created_at).getTime() - lastCustomerMsgTime.getTime()) / 60000;
                if (responseTime > 0 && responseTime < 1440) { // Less than 24 hours
                  if (!responseTimes[senderId]) responseTimes[senderId] = [];
                  responseTimes[senderId].push(responseTime);
                }
              }
            }
            lastCustomerMsgTime = null;
          }
        });
      });

      // Calculate average response times
      Object.entries(responseTimes).forEach(([id, times]) => {
        if (statsMap[id] && times.length > 0) {
          statsMap[id].avgResponseTimeMinutes = times.reduce((a, b) => a + b, 0) / times.length;
        }
      });

      setAttendants(Object.values(statsMap).filter(a => a.totalConversations > 0 || a.messagesSent > 0));
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const teamMetrics = useMemo<PerformanceMetric[]>(() => {
    if (attendants.length === 0) {
      return [
        { label: 'Total Conversas', value: 0, icon: MessageSquare, color: 'text-blue-500' },
        { label: 'Taxa Resolução', value: '0%', icon: CheckCircle, color: 'text-green-500' },
        { label: 'Tempo Resp. Médio', value: '-', icon: Clock, color: 'text-amber-500' },
        { label: 'Atendentes Ativos', value: 0, icon: Users, color: 'text-purple-500' },
      ];
    }

    const totalConvs = attendants.reduce((sum, a) => sum + a.totalConversations, 0);
    const resolvedConvs = attendants.reduce((sum, a) => sum + a.resolvedConversations, 0);
    const resolutionRate = totalConvs > 0 ? (resolvedConvs / totalConvs) * 100 : 0;
    
    const avgResponseTimes = attendants.filter(a => a.avgResponseTimeMinutes > 0);
    const overallAvgResponse = avgResponseTimes.length > 0
      ? avgResponseTimes.reduce((sum, a) => sum + a.avgResponseTimeMinutes, 0) / avgResponseTimes.length
      : 0;

    const formatTime = (minutes: number): string => {
      if (minutes < 1) return '< 1 min';
      if (minutes < 60) return `${Math.round(minutes)} min`;
      return `${(minutes / 60).toFixed(1)} h`;
    };

    return [
      { label: 'Total Conversas', value: totalConvs, icon: MessageSquare, color: 'text-blue-500' },
      { label: 'Taxa Resolução', value: `${resolutionRate.toFixed(0)}%`, icon: CheckCircle, color: 'text-green-500' },
      { label: 'Tempo Resp. Médio', value: formatTime(overallAvgResponse), icon: Clock, color: 'text-amber-500' },
      { label: 'Atendentes Ativos', value: attendants.length, icon: Users, color: 'text-purple-500' },
    ];
  }, [attendants]);

  const chartData = useMemo(() => {
    return attendants.map(a => ({
      name: a.name.split(' ')[0],
      conversas: a.totalConversations,
      resolvidas: a.resolvedConversations,
    }));
  }, [attendants]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Performance da Equipe
          </CardTitle>
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as const).map(p => (
              <Badge
                key={p}
                variant={period === p ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setPeriod(p)}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {teamMetrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("h-4 w-4", metric.color)} />
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                </div>
                <div className="text-xl font-bold">{metric.value}</div>
              </div>
            );
          })}
        </div>

        {attendants.length > 0 ? (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Lista</TabsTrigger>
              <TabsTrigger value="chart">Gráfico</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-3 mt-4">
              {attendants.sort((a, b) => b.totalConversations - a.totalConversations).map((attendant, index) => {
                const resolutionRate = attendant.totalConversations > 0
                  ? (attendant.resolvedConversations / attendant.totalConversations) * 100
                  : 0;
                
                return (
                  <div
                    key={attendant.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="relative">
                      {index === 0 && attendants.length > 1 && (
                        <Award className="absolute -top-1 -right-1 h-4 w-4 text-amber-500" />
                      )}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={attendant.avatar} />
                        <AvatarFallback className="bg-primary/10">
                          {attendant.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{attendant.name}</span>
                        {index === 0 && attendants.length > 1 && (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                            Top
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {attendant.email}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="font-bold text-blue-500">{attendant.totalConversations}</div>
                        <div className="text-xs text-muted-foreground">Conversas</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-500">{resolutionRate.toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">Resoluções</div>
                      </div>
                      <div>
                        <div className="font-bold text-amber-500">
                          {attendant.avgResponseTimeMinutes < 60 
                            ? `${Math.round(attendant.avgResponseTimeMinutes || 0)}m` 
                            : `${(attendant.avgResponseTimeMinutes / 60).toFixed(1)}h`}
                        </div>
                        <div className="text-xs text-muted-foreground">Resp.</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="chart" className="mt-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="conversas" name="Conversas" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolvidas" name="Resolvidas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum atendimento no período selecionado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
