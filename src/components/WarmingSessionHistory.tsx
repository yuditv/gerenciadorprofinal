import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  History, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  Eye,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Flame,
  Play,
  Pause
} from "lucide-react";
import { WarmingSession, WarmingLog } from "@/hooks/useWarmingSessions";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WarmingSessionHistoryProps {
  sessions: WarmingSession[];
  onLoadSession: (session: WarmingSession) => void;
  onRefresh: () => void;
}

interface SessionStats {
  totalMessages: number;
  successRate: number;
  aiGeneratedCount: number;
  failedCount: number;
}

export function WarmingSessionHistory({ sessions, onLoadSession, onRefresh }: WarmingSessionHistoryProps) {
  const [selectedSession, setSelectedSession] = useState<WarmingSession | null>(null);
  const [sessionLogs, setSessionLogs] = useState<WarmingLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);

  const fetchSessionLogs = async (sessionId: string) => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await (supabase as any)
        .from('warming_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSessionLogs((data || []) as WarmingLog[]);
    } catch (error) {
      console.error('Error fetching session logs:', error);
      toast.error('Erro ao carregar logs da sessão');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const calculateStats = (session: WarmingSession): SessionStats => {
    const totalMessages = session.messages_sent + session.messages_received;
    const successRate = session.messages_sent > 0 
      ? Math.round((session.messages_sent / Math.max(session.daily_limit, session.messages_sent)) * 100)
      : 0;
    
    return {
      totalMessages,
      successRate: Math.min(successRate, 100),
      aiGeneratedCount: session.use_ai ? Math.round(session.messages_sent * 0.7) : 0,
      failedCount: Math.max(0, session.daily_limit - session.messages_sent)
    };
  };

  const getStatusBadge = (status: WarmingSession['status']) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1"><Play className="h-3 w-3" />Executando</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1"><Pause className="h-3 w-3" />Pausado</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Completo</Badge>;
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1"><XCircle className="h-3 w-3" />Erro</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Parado</Badge>;
    }
  };

  const getSpeedLabel = (speed: string) => {
    switch (speed) {
      case 'slow': return '🐢 Lento';
      case 'normal': return '⚡ Normal';
      case 'fast': return '🚀 Rápido';
      default: return speed;
    }
  };

  const handleViewLogs = async (session: WarmingSession) => {
    setSelectedSession(session);
    await fetchSessionLogs(session.id);
    setShowLogsDialog(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Delete logs first
      await (supabase as any).from('warming_logs').delete().eq('session_id', sessionId);
      // Then delete session
      const { error } = await (supabase as any).from('warming_sessions').delete().eq('id', sessionId);
      
      if (error) throw error;
      
      toast.success('Sessão excluída com sucesso');
      onRefresh();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Erro ao excluir sessão');
    }
  };

  const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'error');
  const activeSessions = sessions.filter(s => s.status === 'running' || s.status === 'paused');
  const idleSessions = sessions.filter(s => s.status === 'idle');

  // Calculate overall stats
  const overallStats = {
    totalSessions: sessions.length,
    totalMessages: sessions.reduce((acc, s) => acc + s.messages_sent + s.messages_received, 0),
    avgSuccessRate: sessions.length > 0 
      ? Math.round(sessions.reduce((acc, s) => acc + (s.messages_sent / Math.max(s.daily_limit, 1)) * 100, 0) / sessions.length)
      : 0,
    aiUsedCount: sessions.filter(s => s.use_ai).length
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Sessões
              </CardTitle>
              <CardDescription>
                Acompanhe o histórico e estatísticas das sessões de aquecimento
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary/10 rounded-lg text-center">
              <p className="text-2xl font-bold">{overallStats.totalSessions}</p>
              <p className="text-sm text-muted-foreground">Total de Sessões</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold">{overallStats.totalMessages}</p>
              <p className="text-sm text-muted-foreground">Mensagens Trocadas</p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold">{overallStats.avgSuccessRate}%</p>
              <p className="text-sm text-muted-foreground">Taxa de Sucesso Média</p>
            </div>
            <div className="p-4 bg-purple-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold">{overallStats.aiUsedCount}</p>
              <p className="text-sm text-muted-foreground">Sessões com IA</p>
            </div>
          </div>

          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2 text-green-400">
                <Flame className="h-4 w-4" />
                Sessões Ativas ({activeSessions.length})
              </h4>
              <div className="space-y-2">
                {activeSessions.map((session) => {
                  const stats = calculateStats(session);
                  return (
                    <div
                      key={session.id}
                      className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{session.name || 'Sessão de Aquecimento'}</span>
                            {getStatusBadge(session.status)}
                            {session.use_ai && (
                              <Badge variant="outline" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                IA
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{session.selected_instances.length} instâncias</span>
                            <span>{getSpeedLabel(session.conversation_speed)}</span>
                            <span>{stats.totalMessages} mensagens</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewLogs(session)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session History Table */}
          {sessions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-medium">Todas as Sessões</h4>
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sessão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Instâncias</TableHead>
                      <TableHead>Mensagens</TableHead>
                      <TableHead>Velocidade</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const stats = calculateStats(session);
                      return (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Flame className="h-4 w-4 text-orange-500" />
                              <div>
                                <p className="font-medium">{session.name || 'Sessão'}</p>
                                {session.use_ai && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Sparkles className="h-2 w-2" />
                                    IA
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                          <TableCell>{session.selected_instances.length}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-muted-foreground" />
                              <span>{stats.totalMessages}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{session.daily_limit}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getSpeedLabel(session.conversation_speed)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{format(new Date(session.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(session.created_at), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleViewLogs(session)}
                                title="Ver logs"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => onLoadSession(session)}
                                title="Carregar configuração"
                                disabled={session.status === 'running'}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSession(session.id)}
                                title="Excluir sessão"
                                disabled={session.status === 'running'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-medium">Nenhuma sessão de aquecimento ainda</p>
              <p className="text-sm text-muted-foreground">
                Configure e inicie sua primeira sessão de aquecimento
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Logs da Sessão
            </DialogTitle>
            <DialogDescription>
              {selectedSession?.name || 'Sessão de Aquecimento'} - {selectedSession && format(new Date(selectedSession.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              {/* Session Summary */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-lg font-bold">{selectedSession.messages_sent}</p>
                  <p className="text-xs text-muted-foreground">Enviadas</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{selectedSession.messages_received}</p>
                  <p className="text-xs text-muted-foreground">Recebidas</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{selectedSession.progress}%</p>
                  <p className="text-xs text-muted-foreground">Progresso</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{sessionLogs.filter(l => l.ai_generated).length}</p>
                  <p className="text-xs text-muted-foreground">IA Geradas</p>
                </div>
              </div>

              {/* Logs Table */}
              {isLoadingLogs ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessionLogs.length > 0 ? (
                <ScrollArea className="h-[400px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horário</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.message}
                          </TableCell>
                          <TableCell>
                            {log.status === 'sent' || log.status === 'delivered' ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {log.status === 'sent' ? 'Enviada' : 'Entregue'}
                              </Badge>
                            ) : log.status === 'failed' ? (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
                                <XCircle className="h-3 w-3" />
                                Falhou
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.ai_generated ? (
                              <Badge variant="outline" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                IA
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Template</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum log encontrado para esta sessão</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
