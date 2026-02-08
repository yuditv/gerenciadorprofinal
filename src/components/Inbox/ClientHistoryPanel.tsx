import { useState, useEffect } from 'react';
import { History, MessageSquare, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ConversationSummary {
  id: string;
  instance_name: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  ticket_number: string | null;
  summary: string | null;
  created_at: string;
  message_count: number;
}

interface ClientHistoryPanelProps {
  phone: string | null;
  currentConversationId?: string;
}

export function ClientHistoryPanel({ phone, currentConversationId }: ClientHistoryPanelProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!phone) { setConversations([]); return; }

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const normalized = phone.replace(/\D/g, '');
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            id, status, last_message_at, last_message_preview, 
            ticket_number, summary, created_at,
            instance:whatsapp_instances!conversations_instance_id_fkey(instance_name)
          `)
          .or(`phone.eq.${normalized},phone.ilike.%${normalized.slice(-9)}%`)
          .order('last_message_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const mapped = (data || []).map((c: any) => ({
          id: c.id,
          instance_name: c.instance?.instance_name || 'Instância',
          status: c.status,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          ticket_number: c.ticket_number,
          summary: c.summary,
          created_at: c.created_at,
          message_count: 0,
        }));

        setConversations(mapped);
      } catch (e) {
        console.error('Error fetching client history:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [phone]);

  const otherConversations = conversations.filter(c => c.id !== currentConversationId);

  if (!phone || otherConversations.length === 0) return null;

  const statusColors: Record<string, string> = {
    open: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    resolved: 'bg-muted text-muted-foreground border-border',
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    snoozed: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  };

  const displayed = expanded ? otherConversations : otherConversations.slice(0, 3);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Histórico do Cliente
          </div>
          <Badge variant="outline" className="text-[10px]">
            {otherConversations.length} conversa{otherConversations.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ScrollArea className={cn(expanded ? "h-48" : "h-auto")}>
          <div className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              displayed.map(conv => (
                <div key={conv.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {conv.ticket_number && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {conv.ticket_number}
                        </span>
                      )}
                      <Badge variant="outline" className={cn("text-[10px]", statusColors[conv.status])}>
                        {conv.status === 'open' ? 'Aberta' : conv.status === 'resolved' ? 'Compra Finalizada' : conv.status}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {conv.instance_name}
                    </span>
                  </div>
                  {conv.last_message_preview && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {conv.last_message_preview}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {otherConversations.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" /> Ver mais {otherConversations.length - 3} conversa(s)</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
