import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Campaign } from "@/hooks/useCampaigns";
import { supabase } from "@/integrations/supabase/client";

interface CampaignLog {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

interface CampaignLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
}

export function CampaignLogsDialog({ open, onOpenChange, campaign }: CampaignLogsDialogProps) {
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchLogs = async () => {
    if (!campaign) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_contacts' as any)
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      setLogs((data as unknown as CampaignLog[]) || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && campaign) {
      fetchLogs();
    }
  }, [open, campaign]);

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Logs da Campanha - {campaign?.name}
          </DialogTitle>
          <DialogDescription>
            Histórico de envios e status dos contatos
          </DialogDescription>
        </DialogHeader>

        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all">
                Todos ({logs.length})
              </TabsTrigger>
              <TabsTrigger value="sent">
                Enviados ({logs.filter(l => l.status === 'sent').length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Falhas ({logs.filter(l => l.status === 'failed').length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pendentes ({logs.filter(l => l.status === 'pending').length})
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum registro encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <p className="font-medium text-sm">
                          {log.name || log.phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {log.sent_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.sent_at).toLocaleString('pt-BR')}
                        </span>
                      )}
                      {getStatusBadge(log.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>

        {filteredLogs.some(l => l.error_message) && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-red-400 mb-2">Erros Recentes:</h4>
            <div className="space-y-1">
              {filteredLogs
                .filter(l => l.error_message)
                .slice(0, 3)
                .map((log) => (
                  <p key={log.id} className="text-xs text-red-300">
                    {log.phone}: {log.error_message}
                  </p>
                ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
