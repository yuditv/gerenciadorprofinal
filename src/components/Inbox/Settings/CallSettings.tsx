import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhoneOff, Phone, AlertTriangle, Loader2 } from "lucide-react";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useToast } from "@/hooks/use-toast";

export function CallSettings() {
  const { instances } = useWhatsAppInstances();
  const { toast } = useToast();
  const [autoRejectEnabled, setAutoRejectEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);

  // Load saved settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('auto-reject-calls');
    if (saved) {
      try {
        setAutoRejectEnabled(JSON.parse(saved));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  const handleToggle = async (instanceId: string, enabled: boolean) => {
    setLoading(instanceId);
    
    const newState = { ...autoRejectEnabled, [instanceId]: enabled };
    setAutoRejectEnabled(newState);
    localStorage.setItem('auto-reject-calls', JSON.stringify(newState));
    
    toast({
      title: enabled ? 'Rejeição automática ativada' : 'Rejeição automática desativada',
      description: `Chamadas serão ${enabled ? 'rejeitadas automaticamente' : 'permitidas'} nesta instância`,
    });
    
    setLoading(null);
  };

  const connectedInstances = instances.filter(i => i.status === 'connected');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5" />
            Rejeição Automática de Chamadas
          </CardTitle>
          <CardDescription>
            Configure para rejeitar automaticamente todas as chamadas recebidas em cada instância
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                Quando ativado, o sistema rejeitará automaticamente todas as chamadas recebidas via webhook.
              </p>
              <p className="mt-1">
                <strong>Nota:</strong> Esta funcionalidade requer que o webhook esteja configurado para receber eventos de chamada.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {connectedInstances.length > 0 ? (
              connectedInstances.map(instance => (
                <div 
                  key={instance.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{instance.instance_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {instance.phone_connected || 'Sem número'}
                        </p>
                        {autoRejectEnabled[instance.id] && (
                          <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                            <PhoneOff className="w-3 h-3 mr-1" />
                            Rejeitando
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {loading === instance.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      checked={autoRejectEnabled[instance.id] || false}
                      onCheckedChange={(v) => handleToggle(instance.id, v)}
                      disabled={loading === instance.id}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhuma instância conectada</p>
                <p className="text-sm mt-1">
                  Conecte uma instância WhatsApp para configurar a rejeição de chamadas
                </p>
              </div>
            )}
          </div>

          {connectedInstances.length > 0 && (
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium mb-3 block">Como funciona:</Label>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  <span>Quando uma chamada é recebida, o webhook detecta o evento</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  <span>Se a rejeição estiver ativada para a instância, a chamada é rejeitada automaticamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  <span>O chamador verá que a ligação foi recusada</span>
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
