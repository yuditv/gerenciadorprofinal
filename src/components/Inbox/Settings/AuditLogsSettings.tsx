import { useState, useEffect, useCallback } from "react";
import { Search, ScrollText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  auditable_type: string | null;
  auditable_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-600 border-green-500/20",
  update: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delete: "bg-red-500/10 text-red-600 border-red-500/20",
  assign: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  resolve: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

export function AuditLogsSettings() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.auditable_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionColor = (action: string) => {
    const baseAction = action.split('_')[0];
    return ACTION_COLORS[baseAction] || "bg-muted text-muted-foreground";
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Logs de Auditoria</h2>
        <p className="text-muted-foreground">
          Histórico de todas as ações realizadas no sistema.
        </p>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ação ou tipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Logs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ScrollText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Nenhum log encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Tente outro termo de busca" : "Os logs de atividades aparecerão aqui"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px] rounded-lg border">
          <div className="divide-y">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getActionColor(log.action)}>
                        {formatAction(log.action)}
                      </Badge>
                      {log.auditable_type && (
                        <span className="text-sm text-muted-foreground">
                          em {log.auditable_type}
                        </span>
                      )}
                    </div>
                    
                    {log.new_data && Object.keys(log.new_data).length > 0 && (
                      <p className="text-sm text-muted-foreground truncate">
                        {JSON.stringify(log.new_data).slice(0, 100)}...
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                    </div>
                    {log.ip_address && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {log.ip_address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Mostrando os últimos 100 registros
      </p>
    </div>
  );
}
